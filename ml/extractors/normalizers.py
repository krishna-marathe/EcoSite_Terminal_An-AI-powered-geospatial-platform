"""Unit normalizers and date standardizers for Indian infrastructure data.

Converts diverse engineering units to canonical EcoSite representations:
- Power: MW, MVA, kV
- Water: KLD (Kilo-Litres per Day)
- Land: Hectares
- Dates: ISO 8601 YYYY-MM-DD
"""

from datetime import datetime
import re
from typing import Optional, Tuple, Union


# Unit conversion maps
POWER_MW_FACTORS = {
    "mw": 1.0,
    "megawatt": 1.0,
    "megawatts": 1.0,
    "kw": 0.001,
    "kilowatt": 0.001,
    "kilowatts": 0.001,
    "gw": 1000.0,
}

POWER_MVA_FACTORS = {
    "mva": 1.0,
    "kva": 0.001,
}

VOLTAGE_KV_FACTORS = {
    "kv": 1.0,
    "kilovolt": 1.0,
    "kilovolts": 1.0,
    "v": 0.001,
    "volt": 0.001,
}

WATER_KLD_FACTORS = {
    "kld": 1.0,
    "kilo-litres per day": 1.0,
    "kilo litres per day": 1.0,
    "kilolitres/day": 1.0,
    "kl/day": 1.0,
    "mld": 1000.0,
    "million litres per day": 1000.0,
    "mega-litres per day": 1000.0,
    "m3/day": 1.0,
    "m3/d": 1.0,
    "cum/day": 1.0,
    "cum per day": 1.0,
    "cubic meters per day": 1.0,
    "cubic meter per day": 1.0,
    "litres/day": 0.001,
    "liters/day": 0.001,
}

AREA_HECTARES_FACTORS = {
    "hectare": 1.0,
    "hectares": 1.0,
    "ha": 1.0,
    "acre": 0.404686,
    "acres": 0.404686,
    "sq.m": 0.0001,
    "sqm": 0.0001,
    "square meters": 0.0001,
}


def normalize_numeric_string(s: str) -> float:
    """Clean and parse a float string, stripping commas."""
    clean = s.replace(",", "").strip()
    return float(clean)


def normalize_power_mw(val: float, raw_unit: str) -> float:
    """Normalize power reading to canonical MW."""
    unit_clean = raw_unit.lower().strip()
    factor = POWER_MW_FACTORS.get(unit_clean, 1.0)
    return round(val * factor, 3)


def normalize_power_mva(val: float, raw_unit: str) -> float:
    """Normalize demand reading to canonical MVA."""
    unit_clean = raw_unit.lower().strip()
    factor = POWER_MVA_FACTORS.get(unit_clean, 1.0)
    return round(val * factor, 3)


def normalize_voltage_kv(val: float, raw_unit: str) -> float:
    """Normalize voltage to canonical kV."""
    unit_clean = raw_unit.lower().strip()
    factor = VOLTAGE_KV_FACTORS.get(unit_clean, 1.0)
    return round(val * factor, 2)


def normalize_water_kld(val: float, raw_unit: str) -> float:
    """Normalize water volumetric rate to canonical KLD."""
    unit_clean = raw_unit.lower().strip()
    factor = WATER_KLD_FACTORS.get(unit_clean, 1.0)
    return round(val * factor, 2)


def normalize_area_hectares(val: float, raw_unit: str) -> float:
    """Normalize site area to canonical hectares."""
    unit_clean = raw_unit.lower().strip()
    factor = AREA_HECTARES_FACTORS.get(unit_clean, 1.0)
    return round(val * factor, 2)


def normalize_date_string(date_str: str) -> Optional[str]:
    """Normalize various date formats into ISO 8601 YYYY-MM-DD."""
    clean = date_str.strip()
    # Try various Indian and International standard date formats
    patterns = [
        ("%d-%m-%Y", r"^\d{1,2}-\d{1,2}-\d{4}$"),
        ("%d/%m/%Y", r"^\d{1,2}/\d{1,2}/\d{4}$"),
        ("%Y-%m-%d", r"^\d{4}-\d{1,2}-\d{1,2}$"),
        ("%B %d, %Y", r"^[A-Za-z]+\s+\d{1,2},\s+\d{4}$"),
        ("%d %B %Y", r"^\d{1,2}\s+[A-Za-z]+\s+\d{4}$"),
        ("%d-%b-%Y", r"^\d{1,2}-[A-Za-z]{3}-\d{4}$"),
    ]
    for fmt, regex in patterns:
        if re.match(regex, clean):
            try:
                dt = datetime.strptime(clean, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None
