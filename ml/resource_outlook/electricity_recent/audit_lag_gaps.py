import pandas as pd
from pathlib import Path

BASE_DIR = Path("C:/Users/marat/EcoTerminal")
ELECTRO_DIR = BASE_DIR / "ml/resource_outlook/electricity_recent"
COMBINED_PATH = ELECTRO_DIR / "maharashtra_daily_combined_2013_2026.csv"

df_comb = pd.read_csv(COMBINED_PATH)
df_comb["date"] = pd.to_datetime(df_comb["date"])
df_comb = df_comb.set_index("date")

origin = pd.Timestamp("2026-10-27")
horizon_dates = pd.date_range("2026-10-28", periods=182, freq="D")
h0 = horizon_dates[0].strftime("%Y-%m-%d")
h1 = horizon_dates[-1].strftime("%Y-%m-%d")
print(f"Forecast range (182 days / exactly 26 weeks): {h0} to {h1}")

gap_periods = [
    ("2025-11-03", "2025-11-03", "1-day Portal Mislabeled Date (Duplicate of 31/Oct/2025)"),
    ("2026-02-03", "2026-02-06", "4-day Unreleased Winter Period"),
    ("2026-03-20", "2026-03-31", "12-day Unreleased Spring/Summer Transition")
]

for g_start, g_end, desc in gap_periods:
    g_start_dt = pd.Timestamp(g_start)
    g_end_dt = pd.Timestamp(g_end)
    fc_start = g_start_dt + pd.Timedelta(days=364)
    fc_end = g_end_dt + pd.Timedelta(days=364)
    s0 = fc_start.strftime("%Y-%m-%d")
    s1 = fc_end.strftime("%Y-%m-%d")
    print(f"\n--- Gap: {g_start} to {g_end} ({desc}) ---")
    print(f"Impacted forecast window (d - 364): {s0} to {s1}")
    
    l2_start = fc_start - pd.Timedelta(days=728)
    l2_end = fc_end - pd.Timedelta(days=728)
    sub_l2 = df_comb.loc[l2_start:l2_end, "peak_met_mw"]
    print(f"2-year lag period (d - 728): {l2_start.strftime('%Y-%m-%d')} to {l2_end.strftime('%Y-%m-%d')}")
    print(f"2-year lag availability: {sub_l2.notnull().sum()} / {len(sub_l2)} days observed")
