"""Held-out benchmark fixture generator for EcoSite India document intelligence.

Features unseen templates, missing fields, contradictory values,
malformed/compact OCR text, and out-of-domain residential lease agreements.
"""

from dataclasses import asdict
import json
from pathlib import Path
from typing import Any, Dict, List

from ml.data.synthetic.generator import create_minimal_docx_bytes, create_minimal_pdf_bytes


HELD_OUT_DOCUMENTS_SPEC = [
    {
        "document_id": "doc-held-001-up-power-sanction",
        "filename": "PVVNL_InPrinciple_Grid_Sanction_Noida.pdf",
        "file_formats": ["pdf", "txt"],
        "true_document_type": "UTILITY_SANCTION",
        "true_document_subtype": "GRID_SANCTION_LETTER",
        "jurisdiction": "Uttar Pradesh",
        "issuing_authority": "PVVNL",
        "pages": [
            """PASCHIMANCHAL VIDYUT VITRAN NIGAM LIMITED (PVVNL)
Corporate Office: Urja Bhawan, Victoria Park, Meerut - 250001
COMMERCIAL & PLANNING CELL

Memorandum No: PVVNL/COMM/EHV/2026/7710

To:
M/s Noida Hyperscale Data Infra Ltd
Plot Tech-14, Data Centre Park, Sector 154, Noida, District Gautam Buddha Nagar.

SUBJECT: IN-PRINCIPLE SANCTION OF EXTRA HIGH VOLTAGE (EHV) POWER GRID CONNECTIVITY
Reference: Developer Online Portal Application UP-EHV-2026-0811.

In accordance with UP Data Centre Policy guidelines and UPPTCL load-flow clearance, in-principle sanction
is hereby communicated for grid power interconnection:

1. Sanctioned Load: 60.0 MVA at 132 kV voltage grade
2. Proposed Transmission Line: Double circuit 132 kV underground XLPE line
3. Source Interconnection: from Sector 148 Substation (Dedicated 132 kV bay)
4. Phase Scope: Phase 1 Commercial Operations
5. Commissioning Schedule: Target Commercial Operation by 31-10-2028
6. Valid up to: 30-10-2028

The applicant is advised to sign the formal EHV power supply agreement within 60 days.

Superintending Engineer (EHV Commercial)
PVVNL, Meerut"""
        ],
        "expected_fields": [
            {
                "field_key": "contract_demand_mva",
                "page_number": 1,
                "raw_text": "1. Sanctioned Load: 60.0 MVA",
                "normalized_value": 60.0,
                "unit": "MVA",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "supply_voltage_kv",
                "page_number": 1,
                "raw_text": "at 132 kV voltage grade",
                "normalized_value": 132.0,
                "unit": "kV",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "substation_name",
                "page_number": 1,
                "raw_text": "from Sector 148 Substation",
                "normalized_value": "Sector 148 Substation",
                "unit": None,
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "document_reference_number",
                "page_number": 1,
                "raw_text": "Memorandum No: PVVNL/COMM/EHV/2026/7710",
                "normalized_value": "PVVNL/COMM/EHV/2026/7710",
                "unit": None,
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "validity_expiry_date",
                "page_number": 1,
                "raw_text": "Valid up to: 30-10-2028",
                "normalized_value": "2028-10-30",
                "unit": "YYYY-MM-DD",
                "phase_scope": "PHASE_1"
            }
        ]
    },
    {
        "document_id": "doc-held-002-gj-water-allotment",
        "filename": "DICDL_Water_Allotment_Dholera_SIR.docx",
        "file_formats": ["docx", "txt"],
        "true_document_type": "WATER_ALLOCATION",
        "true_document_subtype": "MUNICIPAL_BULK_WATER_ALLOCATION",
        "jurisdiction": "Gujarat",
        "issuing_authority": "DICDL",
        "pages": [
            """DHOLERA INDUSTRIAL CITY DEVELOPMENT LIMITED (DICDL)
Joint Venture of Government of India and Government of Gujarat
Administrative Building, Dholera SIR, Ahmedabad District - 382455

Allotment Reference: DICDL/WATER/2026/ALLOT-449                      Date: 15-04-2026

SUBJECT: ALLOTMENT OF INDUSTRIAL RAW WATER IN DHOLERA SPECIAL INVESTMENT REGION (DSIR)
To: M/s Sabarmati Cloud Compute Pvt Ltd, Plot 104, Activation Area, DSIR.

With reference to your water requisition, allotment of external industrial raw water is sanctioned:

1. Permitted Normal Water Allocation: 2500 cum/day
2. Seasonal Peak Water: 3200 cum/day
3. Treated STP Effluent mandatory off-take: 1000 cum/day
4. Water Supply Pipeline: Dedicated 300 mm DI connection from GWSSB master reservoir
5. Valid for 10 years expiring on: 14-04-2036

General Manager (Utilities)
DICDL, Dholera"""
        ],
        "expected_fields": [
            {
                "field_key": "water_allocation_kld",
                "page_number": 1,
                "raw_text": "Permitted Normal Water Allocation: 2500 cum/day",
                "normalized_value": 2500.0,
                "unit": "KLD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "peak_summer_water_kld",
                "page_number": 1,
                "raw_text": "Seasonal Peak Water: 3200 cum/day",
                "normalized_value": 3200.0,
                "unit": "KLD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "treated_wastewater_kld",
                "page_number": 1,
                "raw_text": "Treated STP Effluent mandatory off-take: 1000 cum/day",
                "normalized_value": 1000.0,
                "unit": "KLD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "document_reference_number",
                "page_number": 1,
                "raw_text": "Allotment Reference: DICDL/WATER/2026/ALLOT-449",
                "normalized_value": "DICDL/WATER/2026/ALLOT-449",
                "unit": None,
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "sanction_date",
                "page_number": 1,
                "raw_text": "Date: 15-04-2026",
                "normalized_value": "2026-04-15",
                "unit": "YYYY-MM-DD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "validity_expiry_date",
                "page_number": 1,
                "raw_text": "expiring on: 14-04-2036",
                "normalized_value": "2036-04-14",
                "unit": "YYYY-MM-DD",
                "phase_scope": "CAMPUS_WIDE"
            }
        ]
    },
    {
        "document_id": "doc-held-003-missing-fields-feasibility",
        "filename": "KPTCL_Preliminary_Feasibility_Study.pdf",
        "file_formats": ["pdf", "txt"],
        "true_document_type": "UTILITY_APPLICATION",
        "true_document_subtype": "DISCOM_POWER_APPLICATION",
        "jurisdiction": "Karnataka",
        "issuing_authority": "KPTCL",
        "pages": [
            """KARNATAKA POWER TRANSMISSION CORPORATION LIMITED (KPTCL)
Office of the Chief Engineer (Transmission Zones)

Application Reference: KPTCL/CEE/SLDC/2026/FS-302                  Date: 28-02-2026

PRELIMINARY FEASIBILITY INTIMATION
To: M/s Bangalore HyperScale Tech Parks Ltd

Technical feasibility is cleared in-principle for grid interconnection at 220 kV level
from Hoodi Substation.

CRITICAL NOTICE ON UNCONFIRMED METRICS:
Please note that the final sanctioned active load (MW) and contract demand (MVA) are
NOT determined in this document and remain pending completion of dynamic stability studies.
No spare firm capacity is sanctioned under this preliminary intimation.

Chief Engineer (Transmission Planning)
KPTCL"""
        ],
        "expected_fields": [
            {
                "field_key": "supply_voltage_kv",
                "page_number": 1,
                "raw_text": "interconnection at 220 kV level",
                "normalized_value": 220.0,
                "unit": "kV",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "substation_name",
                "page_number": 1,
                "raw_text": "from Hoodi Substation",
                "normalized_value": "Hoodi Substation",
                "unit": None,
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "document_reference_number",
                "page_number": 1,
                "raw_text": "Application Reference: KPTCL/CEE/SLDC/2026/FS-302",
                "normalized_value": "KPTCL/CEE/SLDC/2026/FS-302",
                "unit": None,
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "application_date",
                "page_number": 1,
                "raw_text": "Date: 28-02-2026",
                "normalized_value": "2026-02-28",
                "unit": "YYYY-MM-DD",
                "phase_scope": "CAMPUS_WIDE"
            }
        ]
    },
    {
        "document_id": "doc-held-004-conflicting-power-values",
        "filename": "MSEDCL_Sanction_Phased_Contradiction.pdf",
        "file_formats": ["pdf", "txt"],
        "true_document_type": "UTILITY_SANCTION",
        "true_document_subtype": "GRID_SANCTION_LETTER",
        "jurisdiction": "Maharashtra",
        "issuing_authority": "MSEDCL",
        "pages": [
            """MAHARASHTRA STATE ELECTRICITY DISTRIBUTION COMPANY LIMITED (MSEDCL)
Order No: MSEDCL/COMM/DC/2026/901                                  Date: 11-03-2026

SUBJECT: SANCTION OF HT POWER SUPPLY - ULTIMATE MASTER PLAN
To: M/s Navi Mumbai Cloud Hub Private Limited

Approval is hereby communicated for grid power connectivity for the candidate data centre.
Ultimate Full Campus Master Plan Capacity: 80.0 MW grid demand.""",
            """CHAPTER 2: OPERATIONAL CEILING AND PHASE 1 RESTRICTION
Notwithstanding the ultimate master capacity in Chapter 1, the immediate sanctioned load energized
under Phase 1 shall be strictly restricted as follows:
Phase 1 Power Sanction: 40.0 MW grid sanction at 220 kV
Contracted Maximum Demand: 44.4 MVA
Interconnection Substation: Airoli GIS Substation

Any load escalation beyond 40 MW requires fresh statutory submission.

Superintending Engineer
MSEDCL"""
        ],
        "expected_fields": [
            {
                "field_key": "document_reference_number",
                "page_number": 1,
                "raw_text": "Order No: MSEDCL/COMM/DC/2026/901",
                "normalized_value": "MSEDCL/COMM/DC/2026/901",
                "unit": None,
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "sanction_date",
                "page_number": 1,
                "raw_text": "Date: 11-03-2026",
                "normalized_value": "2026-03-11",
                "unit": "YYYY-MM-DD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "sanctioned_grid_mw",
                "page_number": 2,
                "raw_text": "Phase 1 Power Sanction: 40.0 MW grid sanction",
                "normalized_value": 40.0,
                "unit": "MW",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "contract_demand_mva",
                "page_number": 2,
                "raw_text": "Contracted Maximum Demand: 44.4 MVA",
                "normalized_value": 44.4,
                "unit": "MVA",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "supply_voltage_kv",
                "page_number": 2,
                "raw_text": "at 220 kV",
                "normalized_value": 220.0,
                "unit": "kV",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "substation_name",
                "page_number": 2,
                "raw_text": "Interconnection Substation: Airoli GIS Substation",
                "normalized_value": "Airoli GIS Substation",
                "unit": None,
                "phase_scope": "PHASE_1"
            }
        ]
    },
    {
        "document_id": "doc-held-005-malformed-ocr-text",
        "filename": "TSSPDCL_Degraded_OCR_Sanction.txt",
        "file_formats": ["txt"],
        "true_document_type": "UTILITY_SANCTION",
        "true_document_subtype": "GRID_SANCTION_LETTER",
        "jurisdiction": "Telangana",
        "issuing_authority": "TSSPDCL",
        "pages": [
            """TSSPDCL---OFFICIALSANCTION---Ref:TSSPDCL/HT/2026/9912---Date:18-05-2026
SANCTIONEDGRIDLOAD:30.0MW SUPPLYVOLTAGE:33kV
SUBSTATION:Gachibowli33kVSwitchyard
VALIDUNTIL:17-05-2028"""
        ],
        "expected_fields": [
            {
                "field_key": "sanctioned_grid_mw",
                "page_number": 1,
                "raw_text": "SANCTIONEDGRIDLOAD:30.0MW",
                "normalized_value": 30.0,
                "unit": "MW",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "supply_voltage_kv",
                "page_number": 1,
                "raw_text": "SUPPLYVOLTAGE:33kV",
                "normalized_value": 33.0,
                "unit": "kV",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "substation_name",
                "page_number": 1,
                "raw_text": "SUBSTATION:Gachibowli33kVSwitchyard",
                "normalized_value": "Gachibowli33kVSwitchyard",
                "unit": None,
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "document_reference_number",
                "page_number": 1,
                "raw_text": "Ref:TSSPDCL/HT/2026/9912",
                "normalized_value": "TSSPDCL/HT/2026/9912",
                "unit": None,
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "sanction_date",
                "page_number": 1,
                "raw_text": "Date:18-05-2026",
                "normalized_value": "2026-05-18",
                "unit": "YYYY-MM-DD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "validity_expiry_date",
                "page_number": 1,
                "raw_text": "VALIDUNTIL:17-05-2028",
                "normalized_value": "2028-05-17",
                "unit": "YYYY-MM-DD",
                "phase_scope": "CAMPUS_WIDE"
            }
        ]
    },
    {
        "document_id": "doc-held-006-out-of-domain-lease",
        "filename": "Apartment_Residential_Lease_Agreement.docx",
        "file_formats": ["docx", "txt"],
        "true_document_type": "OTHER",
        "true_document_subtype": "MISCELLANEOUS",
        "jurisdiction": "Private",
        "issuing_authority": "Individual",
        "pages": [
            """RESIDENTIAL APARTMENT LEASE AGREEMENT
This agreement is executed between Landlord and Tenant for residential Flat No 402,
Green Acres Residency, Outer Ring Road, Bangalore.

TERMS AND CONDITIONS:
1. Monthly Rent: INR 65,000 payable on or before the 5th of each calendar month.
2. Refundable Security Deposit: INR 350,000 paid via RTGS.
3. The premises shall be used purely for residential living and not for data centre or commercial usage.
4. Domestic water supply shall be billed as per sub-meter.
5. BESCOM domestic power meter account is transferred for billing purposes.

Signed by Landlord and Tenant."""
        ],
        "expected_fields": []
    }
]


def generate_held_out_dataset(output_dir: Path) -> Dict[str, Any]:
    """Generate held-out files (PDF, DOCX, TXT) and ground_truth.json."""
    output_dir.mkdir(parents=True, exist_ok=True)
    fixtures_dir = output_dir / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)

    records = []
    for spec in HELD_OUT_DOCUMENTS_SPEC:
        doc_id = spec["document_id"]
        base_name = Path(spec["filename"]).stem
        pages_text = spec["pages"]

        # 1. TXT
        txt_path = fixtures_dir / f"{base_name}.txt"
        txt_path.write_text("\n\n--- [Page Break] ---\n\n".join(pages_text), encoding="utf-8")

        # 2. PDF
        if "pdf" in spec["file_formats"]:
            pdf_path = fixtures_dir / f"{base_name}.pdf"
            pdf_bytes = create_minimal_pdf_bytes(pages_text)
            pdf_path.write_bytes(pdf_bytes)

        # 3. DOCX
        if "docx" in spec["file_formats"]:
            docx_path = fixtures_dir / f"{base_name}.docx"
            paragraphs = []
            for i, p in enumerate(pages_text):
                if i > 0:
                    paragraphs.append("--- PAGE BREAK ---")
                paragraphs.extend(p.split("\n"))
            docx_bytes = create_minimal_docx_bytes(paragraphs)
            docx_path.write_bytes(docx_bytes)

        records.append({
            "document_id": doc_id,
            "filename": spec["filename"],
            "true_document_type": spec["true_document_type"],
            "true_document_subtype": spec["true_document_subtype"],
            "jurisdiction": spec["jurisdiction"],
            "issuing_authority": spec["issuing_authority"],
            "page_count": len(pages_text),
            "expected_fields": spec["expected_fields"]
        })

    master = {
        "dataset_version": "1.0.0-held-out",
        "description": "Genuinely held-out test fixtures: unseen states, missing values, contradictions, OCR noise, and non-DC lease",
        "total_documents": len(records),
        "documents": records
    }

    gt_file = output_dir / "ground_truth.json"
    with open(gt_file, "w", encoding="utf-8") as f:
        json.dump(master, f, indent=2)

    return master


if __name__ == "__main__":
    out = Path(__file__).parent
    res = generate_held_out_dataset(out)
    print(f"Generated {res['total_documents']} held-out fixtures in {out}")
