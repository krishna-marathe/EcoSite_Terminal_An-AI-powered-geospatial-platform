import json
import urllib.request
import ssl
import fitz
import re
from concurrent.futures import ThreadPoolExecutor
import time
from pathlib import Path
import hashlib
import pandas as pd
from datetime import datetime

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

ELECTRO_DIR = Path('C:/Users/marat/EcoTerminal/ml/resource_outlook/electricity_recent')
SCRATCH_DIR = Path('C:/Users/marat/.gemini/antigravity/brain/93a74033-3984-41f2-b395-ff6480216c94/scratch')

with open(SCRATCH_DIR / 'msldc_catalog.json', 'r') as f:
    cat = json.load(f)

def parse_cat_date(r):
    try:
        y = int(r.get('year', 0))
        m = int(r.get('month', 0))
        d = int(r.get('day', 0))
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"
        return "INVALID_DATE"
    except Exception:
        return "INVALID_DATE"

# Filter catalog items for 2024-2026 window
cat_items = [r for r in cat if r.get('year') in ['2024', '2025', '2026']]
print(f"Total candidate daily reports in MSLDC catalog (2024-2026): {len(cat_items)}")

def fetch_and_parse(item):
    cat_date = parse_cat_date(item)
    url = item['attachment_url']
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            data = resp.read()
        
        sha = hashlib.sha256(data).hexdigest()
        doc = fitz.open(stream=data, filetype="pdf")
        
        # 1. Authoritative date extraction from PDF text
        authoritative_date = cat_date
        for p_idx in range(min(2, len(doc))):
            p_text = doc[p_idx].get_text()
            m = re.search(r'Daily system Report\s+(?:for\s+)?(\d{2}/[A-Za-z]{3}/\d{4})', p_text, re.I)
            if m:
                try:
                    authoritative_date = datetime.strptime(m.group(1), '%d/%b/%Y').strftime('%Y-%m-%d')
                    break
                except Exception:
                    pass

        # 2. Identify Statement I page
        target_page = None
        for p_idx in range(min(3, len(doc))):
            p_text = doc[p_idx].get_text()
            if 'STATE DEMAND MET' in p_text.upper():
                target_page = doc[p_idx]
                break
        if not target_page and len(doc) > 0:
            target_page = doc[0]

        rec = {
            "date": authoritative_date,
            "state_peak_met_mw": None,
            "state_peak_demand_mw": None,
            "state_peak_shortage_mw": None,
            "daily_energy_met_mu": None,
            "msedcl_peak_met_mw": None,
            "source_authority": "Maharashtra State Load Despatch Centre (MSLDC), Airoli",
            "source_url": url,
            "file_sha256": sha,
            "size_bytes": len(data),
            "extraction_status": "OBSERVED_MSLDC_VERIFIED"
        }

        if target_page:
            words = target_page.get_text("words")
            rows = {}
            for w in words:
                y = round(w[1] / 3.0) * 3.0
                rows.setdefault(y, []).append(w)

            in_energy = False
            for y in sorted(rows.keys()):
                row_words = sorted(rows[y], key=lambda x: x[0])
                line = " ".join(w[4] for w in row_words)
                if "ENERGY CATERED" in line.upper():
                    in_energy = True
                elif in_energy and "TOTAL STATE" in line.upper():
                    nums = [float(p) for p in re.findall(r'\d+\.\d+', line)]
                    if nums:
                        rec["daily_energy_met_mu"] = nums[0]
                        in_energy = False
                elif "STATE DEMAND MET" in line.upper():
                    nums = [int(p) for p in re.findall(r'\b\d{4,5}\b', line)]
                    if nums:
                        rec["state_peak_met_mw"] = max(nums)
                elif "STATE DEMAND" in line.upper() and "MET" not in line.upper():
                    nums = [int(p) for p in re.findall(r'\b\d{4,5}\b', line)]
                    if nums:
                        rec["state_peak_demand_mw"] = max(nums)
                elif "MSEDCL DEMAND MET" in line.upper():
                    nums = [int(p) for p in re.findall(r'\b\d{4,5}\b', line)]
                    if nums:
                        rec["msedcl_peak_met_mw"] = max(nums)

        if rec["state_peak_demand_mw"] is not None and rec["state_peak_met_mw"] is not None:
            rec["state_peak_shortage_mw"] = max(0, rec["state_peak_demand_mw"] - rec["state_peak_met_mw"])

        return rec
    except Exception as e:
        return {
            "date": cat_date,
            "source_authority": "Maharashtra State Load Despatch Centre (MSLDC), Airoli",
            "source_url": url,
            "extraction_status": f"ERROR: {e}"
        }

if __name__ == '__main__':
    t0 = time.time()
    print("Starting concurrent extraction with 12 worker threads...")
    with ThreadPoolExecutor(max_workers=12) as ex:
        results = list(ex.map(fetch_and_parse, cat_items))
    t1 = time.time()

    print(f"Extraction complete in {t1 - t0:.2f}s across {len(results)} items.")

    df = pd.DataFrame(results)

    # Filter to valid dates post Zenodo cutoff (2024-04-29 onwards)
    df = df[df['date'] >= '2024-04-29']
    df = df[df['date'] <= '2026-10-30']

    # Deduplicate by date: prioritize rows where state_peak_met_mw is not null
    df = df.sort_values(by=['date', 'state_peak_met_mw'], ascending=[True, False])
    df = df.drop_duplicates(subset=['date'], keep='first')
    df = df.sort_values('date').reset_index(drop=True)

    out_csv = ELECTRO_DIR / "maharashtra_daily_sldc_2024_2026.csv"
    df.to_csv(out_csv, index=False)
    print(f"Saved {len(df)} deduplicated daily observations to {out_csv.name}")
    print(f"Date span: {df['date'].min()} to {df['date'].max()}")
    print("Extraction status summary:")
    print(df['extraction_status'].value_counts())
    print("Peak met non-null count:", df['state_peak_met_mw'].notnull().sum())
    print("Energy met non-null count:", df['daily_energy_met_mu'].notnull().sum())
