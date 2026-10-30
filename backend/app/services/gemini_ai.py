"""Gemini AI Assistant Service for EcoSite Terminal.

Generates authoritative, grounded environmental, power, and compliance insights
for data centre campuses across India using Google's Generative Language API
with server-side credential isolation and deterministic offline fallbacks.
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
import httpx

from ..schemas.ai_assist import (
    AiComplianceRequirement,
    AiInfrastructureTelemetry,
    AiIntervention,
    AiServiceStatus,
    FacilityAiAssistResponse,
    InspectionMode,
    MinistryAssessment,
    PopulationTelemetry,
    SubstationTelemetry,
)

logger = logging.getLogger("ecosite.gemini_ai")

# Automatically load backend/.env if not already populated
_env_path = Path(__file__).resolve().parents[2] / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

GEMINI_API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

DEFAULT_PRIMARY_MODEL = "gemini-3.8-flash"
DEFAULT_FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash"]
REQUEST_TIMEOUT_SECONDS = 8.0

INSPECTION_MODE_PROMPTS: dict[str, dict[str, str]] = {
    "MEITY_OVERSIGHT": {
        "perspective": "Ministry of Electronics and Information Technology (MeitY) & State IT Department",
        "system_instruction": """You are the Principal Infrastructure Advisor to MeitY (Ministry of Electronics and Information Technology, Government of India) and State IT Ministries.
Your mandate is to produce an authoritative condition appraisal of the data centre campus according to its location, power grid dependency, regional water stress, civil/hazard resilience, and national digital infrastructure standards.
Evaluate whether this facility meets Tier resilience criteria, whether localized resource extraction burdens the surrounding population, and direct specific ministerial actions for state discoms and municipal authorities.
Strictly ground all conclusions in the provided telemetry (MW capacity disclosures, 220kV substation distance, CGWB groundwater block, population density, air quality). Output strictly valid JSON adhering to the specified schema.""",
    },
    "SPCB_ENVIRONMENTAL": {
        "perspective": "MoEFCC & State Pollution Control Board (SPCB Enforcement)",
        "system_instruction": """You are the Chief Environmental Inspector for the State Pollution Control Board (MPCB / TSPCB / KSPCB / TNPCB) and Ministry of Environment, Forest and Climate Change (MoEFCC).
Your mandate is regulatory compliance and statutory clearance enforcement under the Water (Prevention and Control of Pollution) Act 1974, Air (Prevention and Control of Pollution) Act 1981, and Environment (Protection) Rules.
Scrutinize:
1. Consent to Establish (CTE) & Consent to Operate (CTO) conditions and renewal status.
2. Diesel Generator (DG) Backup Stacks: Minimum stack height formula compliance (H = h + 0.2*sqrt(kVA), min 30m above ground).
3. Acoustic noise enclosures (>= 25 dB(A) insertion loss, boundary sound <= 75 dBA industrial / 55 dBA daytime residential).
4. Hazardous waste: Spent transformer oil, lead-acid & lithium-ion battery handling under Hazardous Waste Rules 2016 and E-Waste Management Rules 2022.
Strictly ground your analysis in the facility's location, CPCB AQI/PM2.5 telemetry, and surrounding population density. Output strictly valid JSON adhering to the specified schema.""",
    },
    "CGWA_WATER": {
        "perspective": "Central Ground Water Authority (CGWA) & State Water Resources Board",
        "system_instruction": """You are the Hydrogeological Director of the Central Ground Water Authority (CGWA), Ministry of Jal Shakti.
Your mandate is groundwater conservation, aquifer preservation, and industrial water audits under the CGWA 2020 and 2023 Gazette Notifications.
Scrutinize:
1. Local Aquifer Assessment: Classification of the local block (Safe / Semi-Critical / Critical / Over-Exploited) and historical water table depth.
2. Cooling Makeup Source: Industrial groundwater abstraction for cooling towers is heavily restricted or penalized in stressed blocks; verify piped tertiary-treated municipal wastewater or closed-loop air-cooled chiller requirements.
3. Zero Liquid Discharge (ZLD) / Effluent Treatment Plant (ETP) for cooling tower blowdown recycling.
4. Mandatory Rainwater Harvesting (RWH) recharge pits with digital telemetric water meters and daily telemetry logging.
Output strictly valid JSON adhering to the specified schema.""",
    },
    "CEA_GRID": {
        "perspective": "Central Electricity Authority (CEA) & State Transmission Utility",
        "system_instruction": """You are the Chief Power Systems Engineer at the Central Electricity Authority (CEA) and State Transmission Utility (MSETCL / TSTRANSCO / KPTCL / TANTRANSCO).
Your mandate is extra-high-voltage (EHV) grid stability, dual-feed transmission redundancy, and energy security under the CEA (Technical Standards for Connectivity to the Grid) Regulations.
Scrutinize:
1. Grid Interconnection: Voltage rating (110kV / 220kV / 400kV), feeder distance (km), and substation bay capacity of the nearest EHV substation.
2. Reliability & Redundancy: 2N / N+1 dual-path automated bus failover to eliminate single points of failure.
3. Coastal Salinity Protection: Mandatory Gas Insulated Switchgear (GIS) vs Air Insulated Switchgear (AIS) in high-salinity marine zones (Navi Mumbai, Chennai).
4. Power Quality: Power factor maintenance (>0.98 lagging to unity) via APFC and active harmonic filters (IEEE 519 compliance).
5. Green Energy Open Access: Open Access wheeling eligibility under the Electricity (Promoting Renewable Energy Through Green Energy Open Access) Rules 2022.
Output strictly valid JSON adhering to the specified schema.""",
    },
    "URBAN_RECEPTOR": {
        "perspective": "Municipal Corporation & District Magistrate (Urban Environmental Health & Safety)",
        "system_instruction": """You are the Urban Environmental Health & Safety (HSE) Officer representing the Municipal Corporation and District Magistrate.
Your mandate is protecting nearby human populations, residential neighborhoods, and sensitive institutional receptors from industrial externalities under the Noise Pollution (Regulation and Control) Rules 2000 and National Building Code of India (NBC 2016).
Scrutinize:
1. WorldPop Population Context: High-density human buffer surrounding the campus.
2. Ambient Noise Compliance: Day (55 dBA) and Night (45 dBA) residential thresholds; DG set vibration isolation and baffled louvers.
3. Bulk Fuel Safety: Diesel fuel storage tanks, PESO (Petroleum and Explosives Safety Organization) clearances, and bund wall containment.
4. Fire & Life Safety: NBC 2016 Part 4 clean-agent gaseous fire suppression (Novec 1230 / Inergen) and VESDA smoke detection.
Output strictly valid JSON adhering to the specified schema.""",
    },
}

STATE_REGULATORY_PROFILES: dict[str, dict[str, str]] = {
    "IN-MH": {
        "spcb": "Maharashtra Pollution Control Board (MPCB)",
        "discom": "MSEDCL / Tata Power / Adani Electricity",
        "water": "Maharashtra Water Resources Regulatory Authority (MWRRA)",
        "cgwb_baseline": "Basalt hard-rock aquifers; Pune/Haveli semi-critical; Mumbai coastal safe.",
        "notes": "Basalt hard-rock terrain with seasonal monsoon dependency; coastal salinity near Mumbai harbor requires GIS substations.",
    },
    "IN-TG": {
        "spcb": "Telangana State Pollution Control Board (TSPCB)",
        "discom": "TSSPDCL (Southern Power Distribution Company of Telangana)",
        "water": "Hyderabad Metropolitan Water Supply & Sewerage Board (HMWSSB)",
        "cgwb_baseline": "Semi-arid granitic aquifers; Hyderabad urban over-exploited; deep borewells.",
        "notes": "Semi-arid hard-rock granitic aquifers with high extraction pressure; high summer wet-bulb temperatures require hybrid adiabatic cooling.",
    },
    "IN-KA": {
        "spcb": "Karnataka State Pollution Control Board (KSPCB)",
        "discom": "BESCOM / KPTCL",
        "water": "Bangalore Water Supply and Sewerage Board (BWSSB)",
        "cgwb_baseline": "Over-exploited urban aquifer blocks; BWSSB tertiary treated water mandate.",
        "notes": "Piped tertiary treated water mandates in Bengaluru tech corridors; high DG emission scrutiny in dense urban clusters.",
    },
    "IN-TN": {
        "spcb": "Tamil Nadu Pollution Control Board (TNPCB)",
        "discom": "TANGEDCO / TANTRANSCO",
        "water": "Chennai Metropolitan Water Supply and Sewerage Board (CMWSSB)",
        "cgwb_baseline": "Coastal alluvium; seawater intrusion risks; Ambattur/Siruseri critical corridors.",
        "notes": "High coastal ambient humidity elevating evaporative PUE; Siruseri/Ambattur 230kV transmission feeder load monitoring.",
    },
}


def get_gemini_api_key() -> str:
    """Retrieve Gemini API key from environment."""
    return os.getenv("GEMINI_API_KEY", "").strip()


def get_primary_model() -> str:
    """Retrieve configured primary model (defaults to gemini-3.8-flash)."""
    return os.getenv("GEMINI_MODEL", DEFAULT_PRIMARY_MODEL).strip()


def get_fallback_models() -> list[str]:
    """Retrieve list of fallback models."""
    raw = os.getenv("GEMINI_FALLBACK_MODELS", "")
    if raw.strip():
        return [m.strip() for m in raw.split(",") if m.strip()]
    return list(DEFAULT_FALLBACK_MODELS)


def get_service_status() -> AiServiceStatus:
    """Return live status of the Gemini AI Assist service."""
    key = get_gemini_api_key()
    masked = f"{key[:4]}...{key[-4:]}" if len(key) >= 10 else ("Configured" if key else "Unconfigured")
    return AiServiceStatus(
        configured=bool(key),
        primaryModel=get_primary_model(),
        fallbackModels=get_fallback_models(),
        activeKeyMasked=masked,
    )


def _build_facility_prompt(
    facility: dict[str, Any],
    environmental_data: dict[str, Any] | None,
    substation: dict[str, Any],
    population: dict[str, Any],
    focus_area: str | None = None,
    custom_prompt: str | None = None,
    inspection_mode: str = "MEITY_OVERSIGHT",
) -> str:
    """Assemble all dashboard telemetry into an authoritative governmental brief."""
    state_code = facility.get("stateCode", "IN-MH")
    state_info = STATE_REGULATORY_PROFILES.get(state_code, STATE_REGULATORY_PROFILES["IN-MH"])
    mode_info = INSPECTION_MODE_PROMPTS.get(inspection_mode, INSPECTION_MODE_PROMPTS["MEITY_OVERSIGHT"])

    capacities = facility.get("capacityDisclosures", [])
    cap_str = ", ".join(f"{c.get('value')} {c.get('unit')} ({c.get('capacityType')}, {c.get('scope')})" for c in capacities) if capacities else "Public disclosure pending"

    env_lines = []
    if environmental_data:
        for k, v in environmental_data.items():
            if isinstance(v, dict):
                env_lines.append(f"- {k}: {v.get('value')} (Quality: {v.get('quality', 'modelled')}, Provider: {v.get('provider', 'Sensor/Grid')})")
            else:
                env_lines.append(f"- {k}: {v}")
    env_str = "\n".join(env_lines) if env_lines else "- Open-Meteo CAMS/ECMWF atmospheric & GloFAS flood grids active"

    prompt = f"""OFFICIAL GOVERNMENT DATA CENTRE INSPECTION & ASSESSMENT
DEPARTMENT PERSPECTIVE: {mode_info['perspective']}

FACILITY SPECIFICATION:
- Facility ID: {facility.get('id')}
- Campus Name: {facility.get('name')}
- Lead Operator: {facility.get('operator')}
- Classification: {facility.get('facilityType')} ({facility.get('ownershipCategory', 'private')})
- Location: {facility.get('locality')}, {facility.get('city')}, {facility.get('state')} ({state_code})
- Public Coordinates: {facility.get('publicCoordinates')}
- Power / IT Capacity Disclosures: {cap_str}
- State Transmission / Discom Grid: {state_info['discom']}
- State Pollution Control Board: {state_info['spcb']}
- State Water Regulatory Body: {state_info['water']}
- Regional Groundwater / Terrain Baseline: {state_info.get('cgwb_baseline', state_info['notes'])}

LIVE INFRASTRUCTURE & SATELLITE TELEMETRY (DASHBOARD REAL-TIME DATA):
- Nearest EHV Grid Substation: {substation.get('name', 'EHV Grid Substation')}
  • Voltage Rating: {substation.get('voltageKv', 220)} kV
  • Feeder Distance: {substation.get('distanceKm', 2.5)} km
  • Utility Operator: {substation.get('operator', 'State Grid')}
  • Operational State: {substation.get('status', 'OPTIMAL')}
- Surrounding Human Population Context (WorldPop 100m Grid):
  • Density: {population.get('densityPerKm2', 5000):,.0f} persons/km2
  • Density Band: {population.get('densityBand', 'HIGH')}
  • Receptor Buffer Alert: {population.get('bufferAlert', 'Dense human receptor buffer within 1km radius')}

ENVIRONMENTAL MONITORING INDICATORS (AIR, WATER, HEAT, RIVER DISCHARGE):
{env_str}
"""
    if focus_area:
        prompt += f"\nSPECIAL AUDIT FOCUS: {focus_area}\n"
    if custom_prompt:
        prompt += f"\nOFFICIAL QUERY / INVESTIGATION DIRECTIVE: {custom_prompt}\n"

    prompt += """
Produce an official departmental evaluation in JSON. You MUST populate:
- criticalityTier: "TIER_1_ELEVATED" | "TIER_2_MODERATE" | "TIER_3_NOMINAL"
- criticalityLabel: string
- vulnerabilityOverview: concise, analytical condition briefing grounded in the data
- stateRegulatoryBody: string
- stateDiscom: string
- ministryAssessment: object with:
    • departmentPerspective: string
    • statutoryRiskScore: integer (0-100, where 100 is critical risk)
    • complianceStatus: "COMPLIANT_NOMINAL" | "ACTION_REQUIRED_MODERATE" | "URGENT_INTERVENTION_CRITICAL"
    • officialDirective: actionable instruction for state/central officials
    • statutoryGaps: array of strings noting specific legal/environmental vulnerabilities
    • keyRegulatoryActs: array of strings citing applicable Indian statutes
- interventions: array of 4-6 prioritized engineering and statutory actions (id, title, category, priority, timeframe, responsibleStakeholder, expectedBenefit, statutoryBasis, rationale)
- complianceChecklist: array of mandatory statutory clearances (item, authority, mandatory, notes)
- disclaimer: official regulatory screening advisory
"""
    return prompt


def _call_gemini_endpoint(
    model: str,
    api_key: str,
    system_text: str,
    user_prompt: str,
    timeout: float = REQUEST_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Execute synchronous HTTP POST to Google Generative Language API."""
    url = GEMINI_API_URL_TEMPLATE.format(model=model)
    payload = {
        "systemInstruction": {
            "parts": [{"text": system_text}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}],
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
            "maxOutputTokens": 4096,
        },
    }

    headers = {"Content-Type": "application/json"}
    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            url,
            params={"key": api_key},
            json=payload,
            headers=headers,
        )

    if response.status_code != 200:
        error_msg = f"HTTP {response.status_code} from {model}: {response.text[:300]}"
        logger.warning(error_msg)
        raise RuntimeError(error_msg)

    doc = response.json()
    candidates = doc.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"No candidate output from {model}")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts or "text" not in parts[0]:
        raise RuntimeError(f"Empty content from {model}")

    raw_text = parts[0]["text"].strip()
    # Strip markdown fences if present
    if raw_text.startswith("```json"):
        raw_text = raw_text[7:]
    elif raw_text.startswith("```"):
        raw_text = raw_text[3:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]

    return json.loads(raw_text.strip())


def _deterministic_baseline_insights(
    facility: dict[str, Any],
    substation: dict[str, Any],
    population: dict[str, Any],
    environmental_data: dict[str, Any] | None = None,
    inspection_mode: str = "MEITY_OVERSIGHT",
) -> dict[str, Any]:
    """Fallback deterministic rule-based insights generator."""
    state_code = facility.get("stateCode", "IN-MH")
    state_info = STATE_REGULATORY_PROFILES.get(state_code, STATE_REGULATORY_PROFILES["IN-MH"])
    mode_info = INSPECTION_MODE_PROMPTS.get(inspection_mode, INSPECTION_MODE_PROMPTS["MEITY_OVERSIGHT"])
    fac_name = facility.get("name", "Campus")
    city = facility.get("city", "City")

    # Estimate tier based on capacity and distance
    capacities = facility.get("capacityDisclosures", [])
    mw_val = 0.0
    for cap in capacities:
        val = cap.get("value", 0)
        if cap.get("unit") == "MW":
            mw_val += val
        elif cap.get("unit") == "MVA":
            mw_val += val * 0.9

    criticality_tier = "TIER_1_ELEVATED" if mw_val >= 25 else ("TIER_2_MODERATE" if mw_val >= 10 else "TIER_3_NOMINAL")
    criticality_label = "Elevated Criticality" if criticality_tier == "TIER_1_ELEVATED" else ("Moderate Priority" if criticality_tier == "TIER_2_MODERATE" else "Nominal Posture")
    statutory_score = 68 if criticality_tier == "TIER_1_ELEVATED" else (48 if criticality_tier == "TIER_2_MODERATE" else 30)

    vulnerability = (
        f"The {fac_name} campus in {city} operates within the {state_info['discom']} supply zone under {state_info['spcb']} jurisdiction. "
        f"{state_info['notes']} Baseline EHV substation proximity ({substation.get('distanceKm')} km to {substation.get('name')}) "
        f"and surrounding population density ({population.get('densityPerKm2'):,.0f} persons/km2) require strict compliance with "
        f"CGWA groundwater regulations, dual redundant feeder reliability standards, and SPCB acoustic noise limits."
    )

    ministry_assessment = {
        "departmentPerspective": mode_info["perspective"],
        "statutoryRiskScore": statutory_score,
        "complianceStatus": "ACTION_REQUIRED_MODERATE" if statutory_score >= 40 else "COMPLIANT_NOMINAL",
        "officialDirective": f"Conduct compliance audit with {state_info['spcb']} regarding DG set stack heights, and verify CGWA groundwater NOC with digital telemetry loggers.",
        "statutoryGaps": [
            "Cooling tower blowdown recycling requires ZLD verification.",
            "Standby DG acoustic attenuation must be certified for <= 55 dBA nighttime residential threshold.",
            f"Dual-path 2N connectivity from {substation.get('name')} requires automated transfer scheme validation."
        ],
        "keyRegulatoryActs": [
            "Water (Prevention and Control of Pollution) Act 1974",
            "Air (Prevention and Control of Pollution) Act 1981",
            "Central Ground Water Authority (CGWA) Guidelines 2020/2023",
            "CEA (Technical Standards for Connectivity to the Grid) Regulations",
            "Noise Pollution (Regulation and Control) Rules 2000"
        ]
    }

    interventions = [
        {
            "id": f"int-pwr-{facility.get('id', 'dc')}",
            "title": f"Dual-Feed EHV Reliability & GIS Upgrade ({substation.get('voltageKv', 220)} kV)",
            "category": "POWER_GRID",
            "priority": "HIGH" if criticality_tier == "TIER_1_ELEVATED" else "MODERATE",
            "timeframe": "3 - 6 Months",
            "responsibleStakeholder": "Chief Electrical Engineer / Discom Liaison",
            "expectedBenefit": "Mitigates single-point feeder failure; guarantees 2N electrical continuity during grid disturbances.",
            "statutoryBasis": "Central Electricity Authority (Technical Standards for Connectivity to the Grid) Regulations.",
            "rationale": f"Interconnection to {substation.get('name')} at {substation.get('voltageKv', 220)} kV requires automated bus-coupler failover to maintain N+1 redundancy.",
        },
        {
            "id": f"int-wtr-{facility.get('id', 'dc')}",
            "title": "Closed-Circuit Cooling & Rainwater Harvesting Pit Infrastructure",
            "category": "WATER_CONSERVATION",
            "priority": "HIGH",
            "timeframe": "6 - 12 Months",
            "responsibleStakeholder": "Director of Facilities & Mechanical Engineering",
            "expectedBenefit": "Reduces raw municipal water demand by 45%; ensures compliance with zero groundwater depletion limits.",
            "statutoryBasis": "Central Ground Water Authority (CGWA) Guidelines 2020 / State Water Resources Authority.",
            "rationale": "High cooling tower evaporative losses must be countered with treated effluent reuse and on-campus stormwater recharge chambers.",
        },
        {
            "id": f"int-eff-{facility.get('id', 'dc')}",
            "title": "Chiller Plant VFD Optimization & Hot-Aisle Air Containment",
            "category": "ENERGY_EFFICIENCY",
            "priority": "MODERATE",
            "timeframe": "3 - 6 Months",
            "responsibleStakeholder": "DC Operations Lead",
            "expectedBenefit": "Lowers annualized campus PUE to < 1.35; reduces operational energy overhead by 12-16%.",
            "statutoryBasis": "Bureau of Energy Efficiency (BEE) Data Centre Energy Conservation Guidelines & ECBC.",
            "rationale": "Elevated ambient dry-bulb temperatures increase cooling load; magnetic-bearing VFD chillers optimize part-load efficiency.",
        },
        {
            "id": f"int-civ-{facility.get('id', 'dc')}",
            "title": "Acoustic Enclosure & Vibration Attenuation for Standby DG Sets",
            "category": "TERRAIN_CIVIL",
            "priority": "MODERATE" if population.get("densityPerKm2", 0) > 5000 else "STANDARD",
            "timeframe": "Immediate - 3 Months",
            "responsibleStakeholder": "Civil Infrastructure & HSE Lead",
            "expectedBenefit": "Limits perimeter boundary sound levels to <= 55 dB(A) per CPCB residential standards.",
            "statutoryBasis": "Noise Pollution (Regulation and Control) Rules 2000 & CPCB DG Set Emission Standards.",
            "rationale": f"Proximity to human settlements ({population.get('densityPerKm2'):,.0f} persons/km2) necessitates baffled acoustic louvers and anti-vibration inertia bases.",
        },
    ]

    compliance = [
        {
            "item": "Consent to Establish (CTE) & Consent to Operate (CTO)",
            "authority": state_info["spcb"],
            "mandatory": True,
            "notes": "Mandatory renewal under Water Act 1974 & Air Act 1981 with DG stack emission monitoring reports.",
        },
        {
            "item": "Groundwater Abstraction NOC & Digital Flow Telemetry",
            "authority": "Central Ground Water Authority (CGWA)",
            "mandatory": True,
            "notes": "Mandatory telemetric water meter logs and rainwater recharge validation certificate.",
        },
        {
            "item": "Grid Connectivity & Harmonics Compliance Certificate",
            "authority": f"{state_info['discom']} / State Transmission Utility",
            "mandatory": True,
            "notes": "Annual verification of total harmonic distortion (THD < 5%) and power factor > 0.98.",
        },
        {
            "item": "Fire Safety Clearance & Gaseous Flooding Certification",
            "authority": f"{city} Fire & Emergency Services",
            "mandatory": True,
            "notes": "NBC 2016 Part 4 clean agent gas integrity and VESDA early warning verification.",
        },
    ]

    return {
        "criticalityTier": criticality_tier,
        "criticalityLabel": criticality_label,
        "vulnerabilityOverview": vulnerability,
        "stateRegulatoryBody": state_info["spcb"],
        "stateDiscom": state_info["discom"],
        "ministryAssessment": ministry_assessment,
        "interventions": interventions,
        "complianceChecklist": compliance,
        "disclaimer": "Authoritative screening analysis. This briefing does not constitute a formal statutory compliance certificate.",
    }


def generate_facility_ai_insights(
    facility: dict[str, Any],
    environmental_data: dict[str, Any] | None = None,
    substation: dict[str, Any] | None = None,
    population: dict[str, Any] | None = None,
    focus_area: str | None = None,
    custom_prompt: str | None = None,
    force_model: str | None = None,
    inspection_mode: str | None = "MEITY_OVERSIGHT",
) -> FacilityAiAssistResponse:
    """Generate comprehensive AI insights for a facility using Gemini with cascade fallback."""
    substation_data = substation or {
        "name": "Local 220kV EHV Substation",
        "distanceKm": 2.4,
        "voltageKv": 220,
        "operator": "State Transmission Utility",
        "status": "OPTIMAL",
    }
    population_data = population or {
        "densityPerKm2": 5200,
        "densityBand": "HIGH",
        "bufferAlert": "Dense human receptor buffer within 1km radius",
    }

    mode_key = inspection_mode if inspection_mode in INSPECTION_MODE_PROMPTS else "MEITY_OVERSIGHT"
    system_text = INSPECTION_MODE_PROMPTS[mode_key]["system_instruction"]

    api_key = get_gemini_api_key()
    primary_model = force_model or get_primary_model()
    fallback_models = get_fallback_models()
    models_to_try = [primary_model] + [m for m in fallback_models if m != primary_model]

    now = datetime.now(timezone.utc)
    user_prompt = _build_facility_prompt(
        facility=facility,
        environmental_data=environmental_data,
        substation=substation_data,
        population=population_data,
        focus_area=focus_area,
        custom_prompt=custom_prompt,
        inspection_mode=mode_key,
    )

    ai_result: dict[str, Any] | None = None
    successful_model: str | None = None

    if api_key:
        for model in models_to_try:
            try:
                logger.info("Querying Gemini AI Assist using model: %s (mode: %s)", model, mode_key)
                ai_result = _call_gemini_endpoint(
                    model=model,
                    api_key=api_key,
                    system_text=system_text,
                    user_prompt=user_prompt,
                )
                successful_model = model
                logger.info("Successfully received insights from %s", model)
                break
            except Exception as e:
                logger.warning("Gemini model %s failed: %s. Attempting fallback...", model, e)
                continue

    if ai_result is None or not successful_model:
        logger.info("Falling back to deterministic rule engine for facility %s", facility.get("id"))
        ai_result = _deterministic_baseline_insights(
            facility=facility,
            substation=substation_data,
            population=population_data,
            environmental_data=environmental_data,
            inspection_mode=mode_key,
        )
        status_label = "fallback_deterministic"
        model_label = "Deterministic Engineering Engine (offline baseline)"
    else:
        status_label = "live_ai"
        model_label = f"{successful_model} (Google Generative AI)"

    # Parse and validate into schema
    raw_interventions = ai_result.get("interventions", [])
    interventions: list[AiIntervention] = []
    for idx, item in enumerate(raw_interventions):
        try:
            item_id = item.get("id") or f"gemini-int-{idx+1}"
            interventions.append(
                AiIntervention(
                    id=item_id,
                    title=str(item.get("title", "Intervention")),
                    category=item.get("category", "POWER_GRID"),
                    priority=item.get("priority", "MODERATE"),
                    timeframe=str(item.get("timeframe", "3 - 6 Months")),
                    responsibleStakeholder=str(item.get("responsibleStakeholder", "Facility Engineering Lead")),
                    expectedBenefit=str(item.get("expectedBenefit", "Optimization and regulatory risk reduction")),
                    statutoryBasis=str(item.get("statutoryBasis", "Indian Environmental / CEA Regulations")),
                    rationale=str(item.get("rationale", "Site-specific engineering justification")),
                )
            )
        except Exception as e:
            logger.debug("Skipping unparseable intervention %s: %s", item, e)

    raw_compliance = ai_result.get("complianceChecklist", [])
    compliance: list[AiComplianceRequirement] = []
    for item in raw_compliance:
        try:
            compliance.append(
                AiComplianceRequirement(
                    item=str(item.get("item", "Statutory Clearance")),
                    authority=str(item.get("authority", "State Pollution Control Board")),
                    mandatory=bool(item.get("mandatory", True)),
                    notes=str(item.get("notes", "Compliance documentation required")),
                )
            )
        except Exception:
            pass

    # Parse ministry assessment
    raw_ministry = ai_result.get("ministryAssessment", {})
    ministry_assessment: MinistryAssessment | None = None
    if isinstance(raw_ministry, dict) and raw_ministry:
        ministry_assessment = MinistryAssessment(
            departmentPerspective=str(raw_ministry.get("departmentPerspective", INSPECTION_MODE_PROMPTS[mode_key]["perspective"])),
            statutoryRiskScore=int(raw_ministry.get("statutoryRiskScore", 45)),
            complianceStatus=raw_ministry.get("complianceStatus", "ACTION_REQUIRED_MODERATE"),
            officialDirective=str(raw_ministry.get("officialDirective", "Conduct compliance review during next inspection cycle.")),
            statutoryGaps=[str(g) for g in raw_ministry.get("statutoryGaps", [])],
            keyRegulatoryActs=[str(a) for a in raw_ministry.get("keyRegulatoryActs", [])],
        )

    return FacilityAiAssistResponse(
        facilityId=facility.get("id", "unknown"),
        facilityName=facility.get("name", "Operational Campus"),
        modelUsed=model_label,
        status=status_label,
        criticalityTier=ai_result.get("criticalityTier", "TIER_2_MODERATE"),
        criticalityLabel=ai_result.get("criticalityLabel", "Moderate Priority"),
        vulnerabilityOverview=ai_result.get("vulnerabilityOverview", "Campus vulnerability overview"),
        stateRegulatoryBody=ai_result.get("stateRegulatoryBody", "State Pollution Control Board"),
        stateDiscom=ai_result.get("stateDiscom", "State Power Distribution Corporation"),
        ministryAssessment=ministry_assessment,
        interventions=interventions,
        complianceChecklist=compliance,
        infrastructureTelemetry=AiInfrastructureTelemetry(
            substation=SubstationTelemetry(
                name=substation_data.get("name", "EHV Grid Substation"),
                distanceKm=float(substation_data.get("distanceKm", 2.4)),
                voltageKv=float(substation_data.get("voltageKv", 220)),
                operator=substation_data.get("operator", "State Transmission Utility"),
                status=substation_data.get("status", "OPTIMAL"),
            ),
            population=PopulationTelemetry(
                densityPerKm2=float(population_data.get("densityPerKm2", 5200)),
                densityBand=population_data.get("densityBand", "HIGH"),
                bufferAlert=population_data.get("bufferAlert", "Standard buffer"),
            ),
        ),
        focusArea=focus_area,
        customPrompt=custom_prompt,
        inspectionMode=mode_key,
        generatedAt=now,
        disclaimer=ai_result.get(
            "disclaimer",
            "This briefing is generated for governmental and infrastructure screening only and does not constitute statutory compliance certification.",
        ),
    )
