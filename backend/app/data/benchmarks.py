"""Official published industry benchmarks for data center operators.

Maintains verified historical metrics from official sustainability reports and ESG filings
(Nxtra, STT GDC India, CtrlS, Google, Microsoft, AWS).

Epistemic rules:
1. Portfolio averages are explicitly flagged (`is_portfolio_average = True`) and must never be treated
   as site-specific verified observations.
2. Missing metrics are recorded with `status = "UNAVAILABLE"` and `value = None`; no values are fabricated.
3. Every metric carries official document citations, years, units, accounting boundaries and source URLs.
4. Clearly distinguishes design PUE from measured operating PUE.
5. Clearly distinguishes company-wide renewable matching from data-centre-specific renewable consumption.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from ..schemas.benchmarks import IndustryBenchmark

INDUSTRY_BENCHMARKS: List[Dict[str, Any]] = [
    # -------------------------------------------------------------------------
    # 1. Nxtra by Airtel (India Core Colocation Operator)
    # -------------------------------------------------------------------------
    {
        "id": "bmk-nxtra-pue-2024",
        "operator": "Nxtra by Airtel",
        "reporting_year": 2024,
        "metric": "measured_operating_pue",
        "value": 1.56,
        "unit": "ratio",
        "status": "PUBLISHED",
        "reporting_scope": "Portfolio India (12 large core and 120 edge/core facilities)",
        "boundary_notes": "Measured operating PUE: Fleet-wide weighted average operational Power Usage Effectiveness across operational core data centers in India. Excludes edge telecommunication towers.",
        "is_portfolio_average": True,
        "document_title": "Bharti Airtel Integrated Report and Sustainability Disclosures 2023-24",
        "source_url": "https://www.airtel.in/sustainability-file/Airtel-Integrated-Report-2023-24.pdf",
        "page_or_reference": "Natural Capital / Data Centre PUE Performance Table, page 164",
        "quality_notes": "Measured fleet operating PUE. Design PUE for newly engineered campuses (Pune, Chennai, Mumbai) is targeted at 1.35.",
    },
    {
        "id": "bmk-nxtra-re-2024",
        "operator": "Nxtra by Airtel",
        "reporting_year": 2024,
        "metric": "datacenter_renewable_share_percent",
        "value": 42.0,
        "unit": "%",
        "status": "PUBLISHED",
        "reporting_scope": "Nxtra Data Centers India",
        "boundary_notes": "Data-centre-specific renewable energy consumption: 42% of electricity consumed by Nxtra data centers was sourced from contracted captive solar and wind PPAs under Indian Open Access rules.",
        "is_portfolio_average": True,
        "document_title": "Bharti Airtel Integrated Report and Sustainability Disclosures 2023-24",
        "source_url": "https://www.airtel.in/sustainability-file/Airtel-Integrated-Report-2023-24.pdf",
        "page_or_reference": "BRSR Principle 6 Disclosures - Energy Consumption & Open Access Renewables",
        "quality_notes": "Represents verified open-access green energy off-take across Maharashtra, Karnataka, and Tamil Nadu sites.",
    },

    # -------------------------------------------------------------------------
    # 2. STT GDC India (Major Colocation Provider)
    # -------------------------------------------------------------------------
    {
        "id": "bmk-stt-pue-2023",
        "operator": "STT GDC India",
        "reporting_year": 2023,
        "metric": "measured_operating_pue",
        "value": 1.62,
        "unit": "ratio",
        "status": "PUBLISHED",
        "reporting_scope": "STT GDC India Portfolio (28 facilities across 10 cities)",
        "boundary_notes": "Measured operating PUE: Fleet-wide weighted average measured operational PUE across operational colocation footprint in India.",
        "is_portfolio_average": True,
        "document_title": "STT GDC Environmental, Social and Governance (ESG) Report 2023",
        "source_url": "https://www.sttelemediagdc.com/sustainability",
        "page_or_reference": "Energy & Climate Section - Annual PUE Disclosures, page 24",
        "quality_notes": "Operational measured average. Design PUE for newer hyperscale builds (e.g. Pune DC3, Noida DC1) is engineered at 1.30 to 1.35.",
    },
    {
        "id": "bmk-stt-re-2023",
        "operator": "STT GDC India",
        "reporting_year": 2023,
        "metric": "datacenter_renewable_share_percent",
        "value": 38.0,
        "unit": "%",
        "status": "PUBLISHED",
        "reporting_scope": "STT GDC India Data Center Operations",
        "boundary_notes": "Data-centre-specific renewable electricity consumption: 38% of power consumed at STT GDC India data centers was sourced via renewable PPAs and green power tariffs.",
        "is_portfolio_average": True,
        "document_title": "STT GDC Environmental, Social and Governance (ESG) Report 2023",
        "source_url": "https://www.sttelemediagdc.com/sustainability",
        "page_or_reference": "Renewable Energy Adoption & Sourcing Portfolio",
        "quality_notes": "Reflects actual grid-injected and settled green power under Indian open access.",
    },

    # -------------------------------------------------------------------------
    # 3. CtrlS Datacenters (Rated-4 Hyperscale Specialist)
    # -------------------------------------------------------------------------
    {
        "id": "bmk-ctrls-pue-2024",
        "operator": "CtrlS",
        "reporting_year": 2024,
        "metric": "design_pue",
        "value": 1.35,
        "unit": "ratio",
        "status": "PUBLISHED",
        "reporting_scope": "Rated-4 Hyperscale Facilities (Mumbai DC2 / Hyderabad / Bangalore)",
        "boundary_notes": "Design PUE: Engineered design PUE under full design load condition using modular central chilled water plant and hot/cold aisle containment. Distinct from operating partial-load PUE.",
        "is_portfolio_average": False,
        "document_title": "CtrlS Corporate Sustainability and Energy Architecture Disclosures 2024",
        "source_url": "https://www.ctrls.in/sustainability.html",
        "page_or_reference": "Engineering Specifications - Rated-4 Hyperscale Campus Standards",
        "quality_notes": "Facility design benchmark; actual annualized operational PUE varies with partial load ramp-up phases.",
    },
    {
        "id": "bmk-ctrls-wue-2024",
        "operator": "CtrlS",
        "reporting_year": 2024,
        "metric": "wue_liters_per_kwh",
        "value": None,
        "unit": "L/kWh",
        "status": "UNAVAILABLE",
        "reporting_scope": "India Facilities",
        "boundary_notes": "CtrlS publishes adoption of Zero Liquid Discharge (ZLD) effluent plants and rainwater harvesting, but a numerical fleet Water Usage Effectiveness (L/kWh) audit is not publicly published.",
        "is_portfolio_average": True,
        "document_title": "CtrlS Environmental Policy 2024",
        "source_url": "https://www.ctrls.in/sustainability.html",
        "page_or_reference": "Water Conservation & ZLD Architecture",
        "quality_notes": "Marked UNAVAILABLE: EcoSite strictly refuses to fabricate an estimated WUE value when official auditor disclosure is not published.",
    },

    # -------------------------------------------------------------------------
    # 4. Google (Global Hyperscaler)
    # -------------------------------------------------------------------------
    {
        "id": "bmk-google-pue-2023",
        "operator": "Google",
        "reporting_year": 2023,
        "metric": "measured_operating_pue",
        "value": 1.10,
        "unit": "ratio",
        "status": "PUBLISHED",
        "reporting_scope": "Global fleet average (all Google-owned data centers)",
        "boundary_notes": "Measured operating PUE: Comprehensive annual fleet-wide PUE covering all Google-owned operational data centers globally, calculated across all hours of operation.",
        "is_portfolio_average": True,
        "document_title": "Google 2024 Environmental Report",
        "source_url": "https://www.gstatic.com/gumdrop/sustainability/google-2024-environmental-report.pdf",
        "page_or_reference": "Page 31, 'Data Center Efficiency' chart",
        "quality_notes": "Global portfolio average. Must not be used as an assumed site-specific observation for Indian leased cloud regions.",
    },
    {
        "id": "bmk-google-wue-2023",
        "operator": "Google",
        "reporting_year": 2023,
        "metric": "wue_liters_per_kwh",
        "value": 1.07,
        "unit": "L/kWh",
        "status": "PUBLISHED",
        "reporting_scope": "Global fleet average (all Google data centers)",
        "boundary_notes": "Global fleet average water intensity: 1.07 liters of water consumed per kilowatt-hour of IT equipment energy.",
        "is_portfolio_average": True,
        "document_title": "Google 2024 Environmental Report",
        "source_url": "https://www.gstatic.com/gumdrop/sustainability/google-2024-environmental-report.pdf",
        "page_or_reference": "Page 35, 'Water Stewardship - Data Center Water Intensity'",
        "quality_notes": "Global portfolio metric. Cooling water intensity varies dramatically based on ambient wet-bulb conditions.",
    },

    # -------------------------------------------------------------------------
    # 5. Microsoft (Global Hyperscaler)
    # -------------------------------------------------------------------------
    {
        "id": "bmk-msft-pue-2023",
        "operator": "Microsoft",
        "reporting_year": 2023,
        "metric": "design_pue",
        "value": 1.12,
        "unit": "ratio",
        "status": "PUBLISHED",
        "reporting_scope": "New Generation Hyperscale Cloud Infrastructure",
        "boundary_notes": "Design PUE: Engineered design PUE for modern Generation hyperscale cloud infrastructure under peak design efficiency conditions. Distinct from measured operational PUE in multi-tenant leased facilities.",
        "is_portfolio_average": False,
        "document_title": "Microsoft 2024 Environmental Sustainability Report",
        "source_url": "https://www.microsoft.com/en-us/corporate-responsibility/sustainability/reports",
        "page_or_reference": "Section: Energy & Carbon / Cloud Efficiency Standards, page 28",
        "quality_notes": "Engineering design ceiling for new builds. Regional metrics in India governed by local colocation and dedicated campus contracts.",
    },
    {
        "id": "bmk-msft-re-2023",
        "operator": "Microsoft",
        "reporting_year": 2023,
        "metric": "company_wide_renewable_matching_percent",
        "value": 100.0,
        "unit": "%",
        "status": "PUBLISHED",
        "reporting_scope": "Global Corporate Operations (Scope 2 market-based electricity)",
        "boundary_notes": "Company-wide renewable matching: 100% of global operational electricity matched on an annual basis with contracted renewable energy PPAs, including active solar/wind projects in India. This is an annualized company-wide matching figure, not data-centre-specific physical 24/7 consumption.",
        "is_portfolio_average": True,
        "document_title": "Microsoft 2024 Environmental Sustainability Report",
        "source_url": "https://www.microsoft.com/en-us/corporate-responsibility/sustainability/reports",
        "page_or_reference": "Scope 2 Market-Based Electricity Accounting Table, page 34",
        "quality_notes": "Company-wide matching benchmark. Data-centre-specific hourly 24/7 carbon-free energy matching is tracked separately.",
    },

    # -------------------------------------------------------------------------
    # 6. Amazon Web Services (AWS) (Global Hyperscaler)
    # -------------------------------------------------------------------------
    {
        "id": "bmk-aws-wue-2023",
        "operator": "AWS",
        "reporting_year": 2023,
        "metric": "wue_liters_per_kwh",
        "value": 0.18,
        "unit": "L/kWh",
        "status": "PUBLISHED",
        "reporting_scope": "AWS Global Data Center Fleet",
        "boundary_notes": "Data-centre-specific water efficiency: AWS global data center fleet water use effectiveness: 0.18 liters of water consumed per kilowatt-hour of IT energy.",
        "is_portfolio_average": True,
        "document_title": "Amazon 2023 Sustainability Report",
        "source_url": "https://sustainability.aboutamazon.com/2023-sustainability-report.pdf",
        "page_or_reference": "Pages 22-26, 'Water Stewardship in AWS Data Centers'",
        "quality_notes": "Global fleet average. Achieved through extensive direct evaporative cooling optimization and recycled water off-take.",
    },
    {
        "id": "bmk-aws-re-2023",
        "operator": "AWS",
        "reporting_year": 2023,
        "metric": "company_wide_renewable_matching_percent",
        "value": 100.0,
        "unit": "%",
        "status": "PUBLISHED",
        "reporting_scope": "Amazon Global Operations (including AWS)",
        "boundary_notes": "Company-wide renewable matching: 100% of the electricity consumed across all Amazon operations (AWS data centers, fulfillment centers, corporate offices) was matched with renewable energy in 2023. Annualized matching; not data-centre-specific hourly consumption.",
        "is_portfolio_average": True,
        "document_title": "Amazon 2023 Sustainability Report",
        "source_url": "https://sustainability.aboutamazon.com/2023-sustainability-report.pdf",
        "page_or_reference": "Renewable Energy Commitments Table, page 18",
        "quality_notes": "Company-wide matching benchmark across corporate operations.",
    },
]


def get_all_benchmarks() -> List[IndustryBenchmark]:
    """Return all configured industry benchmarks."""
    return [IndustryBenchmark(**b) for b in INDUSTRY_BENCHMARKS]


def get_benchmark_by_id(benchmark_id: str) -> Optional[IndustryBenchmark]:
    """Find a specific benchmark by ID."""
    for b in INDUSTRY_BENCHMARKS:
        if b["id"] == benchmark_id:
            return IndustryBenchmark(**b)
    return None
