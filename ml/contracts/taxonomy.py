"""Document taxonomy, classification categories, and field definitions.

Adheres to EcoSite India API Contracts (docs/contracts/API_CONTRACTS.md).
"""

from enum import Enum
from typing import Dict, List, Set


class DocumentType(str, Enum):
    """Top-level document type conforming strictly to API_CONTRACTS.md EvidenceArtifact."""
    DPR = "DPR"
    UTILITY_APPLICATION = "UTILITY_APPLICATION"
    UTILITY_SANCTION = "UTILITY_SANCTION"
    WATER_ALLOCATION = "WATER_ALLOCATION"
    WATER_STUDY = "WATER_STUDY"
    PLANNING = "PLANNING"
    OTHER = "OTHER"


class DocumentSubtype(str, Enum):
    """Fine-grained classification taxonomy for Indian data centre infrastructure."""
    # Power
    GRID_SANCTION_LETTER = "GRID_SANCTION_LETTER"
    GRID_CONNECTIVITY_FEASIBILITY = "GRID_CONNECTIVITY_FEASIBILITY"
    DISCOM_POWER_APPLICATION = "DISCOM_POWER_APPLICATION"
    TARIFF_ORDER_OR_PPA = "TARIFF_ORDER_OR_PPA"

    # Water
    MUNICIPAL_BULK_WATER_ALLOCATION = "MUNICIPAL_BULK_WATER_ALLOCATION"
    GROUNDWATER_CGWA_NOC = "GROUNDWATER_CGWA_NOC"
    TREATED_WASTEWATER_AGREEMENT = "TREATED_WASTEWATER_AGREEMENT"
    WATER_BALANCE_HYDROLOGY_STUDY = "WATER_BALANCE_HYDROLOGY_STUDY"

    # Siting & Environmental
    DETAILED_PROJECT_REPORT = "DETAILED_PROJECT_REPORT"
    CONSENT_TO_ESTABLISH = "CONSENT_TO_ESTABLISH"
    ENVIRONMENTAL_CLEARANCE = "ENVIRONMENTAL_CLEARANCE"
    ZONING_LAND_ALLOTMENT = "ZONING_LAND_ALLOTMENT"
    SURVEY_OF_INDIA_TOPOSHEET = "SURVEY_OF_INDIA_TOPOSHEET"

    # Fallback
    MISCELLANEOUS = "MISCELLANEOUS"


# Mapping from subtype to canonical top-level DocumentType
SUBTYPE_TO_DOCUMENT_TYPE: Dict[DocumentSubtype, DocumentType] = {
    DocumentSubtype.GRID_SANCTION_LETTER: DocumentType.UTILITY_SANCTION,
    DocumentSubtype.GRID_CONNECTIVITY_FEASIBILITY: DocumentType.UTILITY_APPLICATION,
    DocumentSubtype.DISCOM_POWER_APPLICATION: DocumentType.UTILITY_APPLICATION,
    DocumentSubtype.TARIFF_ORDER_OR_PPA: DocumentType.UTILITY_SANCTION,

    DocumentSubtype.MUNICIPAL_BULK_WATER_ALLOCATION: DocumentType.WATER_ALLOCATION,
    DocumentSubtype.GROUNDWATER_CGWA_NOC: DocumentType.WATER_ALLOCATION,
    DocumentSubtype.TREATED_WASTEWATER_AGREEMENT: DocumentType.WATER_ALLOCATION,
    DocumentSubtype.WATER_BALANCE_HYDROLOGY_STUDY: DocumentType.WATER_STUDY,

    DocumentSubtype.DETAILED_PROJECT_REPORT: DocumentType.DPR,
    DocumentSubtype.CONSENT_TO_ESTABLISH: DocumentType.PLANNING,
    DocumentSubtype.ENVIRONMENTAL_CLEARANCE: DocumentType.PLANNING,
    DocumentSubtype.ZONING_LAND_ALLOTMENT: DocumentType.PLANNING,
    DocumentSubtype.SURVEY_OF_INDIA_TOPOSHEET: DocumentType.PLANNING,

    DocumentSubtype.MISCELLANEOUS: DocumentType.OTHER,
}


class FieldKey(str, Enum):
    """Standardized extraction keys matching API_CONTRACTS.md and resource engines."""
    # Power
    SANCTIONED_GRID_MW = "sanctioned_grid_mw"
    CONTRACT_DEMAND_MVA = "contract_demand_mva"
    SUPPLY_VOLTAGE_KV = "supply_voltage_kv"
    SUBSTATION_NAME = "substation_name"
    FEEDER_VOLTAGE_KV = "feeder_voltage_kv"
    REDUNDANCY_LEVEL = "redundancy_level"  # e.g., "2N", "N+1", "DUAL_FEED"
    CAPTIVE_RE_MW = "captive_re_mw"

    # Water (canonical unit: KLD = kilo-litres per day)
    WATER_ALLOCATION_KLD = "water_allocation_kld"
    PEAK_SUMMER_WATER_KLD = "peak_summer_water_kld"
    TREATED_WASTEWATER_KLD = "treated_wastewater_kld"
    GROUNDWATER_PERMITTED_KLD = "groundwater_permitted_kld"
    WATER_SUPPLY_SOURCE = "water_supply_source"

    # Siting, Campus & Planning
    SITE_AREA_HECTARES = "site_area_hectares"
    TOTAL_BUILTUP_SQFT = "total_builtup_sqft"
    PLANNED_IT_CAPACITY_MW = "planned_it_capacity_mw"
    FACILITY_PEAK_MW = "facility_peak_mw"
    TARGET_PUE = "target_pue"

    # Governance & Dates
    DOCUMENT_REFERENCE_NUMBER = "document_reference_number"
    ISSUING_AUTHORITY = "issuing_authority"
    APPLICANT_NAME = "applicant_name"
    APPLICATION_DATE = "application_date"
    SANCTION_DATE = "sanction_date"
    VALIDITY_EXPIRY_DATE = "validity_expiry_date"


# Expected canonical units per field
FIELD_CANONICAL_UNITS: Dict[FieldKey, str] = {
    FieldKey.SANCTIONED_GRID_MW: "MW",
    FieldKey.CONTRACT_DEMAND_MVA: "MVA",
    FieldKey.SUPPLY_VOLTAGE_KV: "kV",
    FieldKey.SUBSTATION_NAME: "",
    FieldKey.FEEDER_VOLTAGE_KV: "kV",
    FieldKey.REDUNDANCY_LEVEL: "",
    FieldKey.CAPTIVE_RE_MW: "MW",
    FieldKey.WATER_ALLOCATION_KLD: "KLD",
    FieldKey.PEAK_SUMMER_WATER_KLD: "KLD",
    FieldKey.TREATED_WASTEWATER_KLD: "KLD",
    FieldKey.GROUNDWATER_PERMITTED_KLD: "KLD",
    FieldKey.WATER_SUPPLY_SOURCE: "",
    FieldKey.SITE_AREA_HECTARES: "hectares",
    FieldKey.TOTAL_BUILTUP_SQFT: "sq ft",
    FieldKey.PLANNED_IT_CAPACITY_MW: "MW",
    FieldKey.FACILITY_PEAK_MW: "MW",
    FieldKey.TARGET_PUE: "ratio",
    FieldKey.DOCUMENT_REFERENCE_NUMBER: "",
    FieldKey.ISSUING_AUTHORITY: "",
    FieldKey.APPLICANT_NAME: "",
    FieldKey.APPLICATION_DATE: "YYYY-MM-DD",
    FieldKey.SANCTION_DATE: "YYYY-MM-DD",
    FieldKey.VALIDITY_EXPIRY_DATE: "YYYY-MM-DD",
}


# Known Indian infrastructure authorities for regex / classification grounding
KNOWN_AUTHORITIES: Dict[str, List[str]] = {
    "Telangana": [
        "TSSPDCL", "TSNPDCL", "TSTRANSCO", "TSIIC", "HMWSSB", "TSPCB"
    ],
    "Maharashtra": [
        "MSEDCL", "MSETCL", "MIDC", "MCGM", "CIDCO", "MPCB"
    ],
    "Karnataka": [
        "BESCOM", "KPTCL", "KIADB", "BWSSB", "KSPCB"
    ],
    "Tamil Nadu": [
        "TANGEDCO", "TANTRANSCO", "SIPCOT", "CMWSSB", "TNPCB"
    ],
    "National": [
        "CEA", "NITI Aayog", "CGWA", "CPCB", "MeitY", "MoEFCC"
    ]
}
