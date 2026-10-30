"""Synthetic document fixture generator for EcoSite India document intelligence.

Generates realistic, template-safe, labelled multi-state data center documents
in TXT, valid PDF-1.4, and valid DOCX (OpenXML ZIP) formats along with ground truth
annotations for classification and candidate extraction evaluation.
"""

from dataclasses import asdict
import json
import os
from pathlib import Path
import struct
from typing import Any, Dict, List
import uuid
import zipfile


def create_minimal_pdf_bytes(pages_text: List[str]) -> bytes:
    """Generate a valid, standards-compliant multi-page PDF 1.4 in pure Python."""
    objects: List[bytes] = []
    offsets: List[int] = []

    def add_object(content: bytes) -> int:
        obj_num = len(objects) + 1
        objects.append(content)
        return obj_num

    # Placeholder for catalog and pages (obj 1 and 2)
    # Obj 1: Catalog
    # Obj 2: Pages tree
    # Obj 3: Font
    font_obj_idx = 3

    # We will build objects sequentially
    # Catalog (obj 1): will reference Pages (obj 2)
    # Pages (obj 2): will reference page objects
    page_obj_indices = []

    # Determine page objects
    # For N pages: each page has a page obj and a content stream obj
    # obj 1: Catalog
    # obj 2: Pages
    # obj 3: Font
    # obj 4: Page 1, obj 5: Stream 1, etc.

    # Pre-calculate stream objects
    current_obj = 4
    stream_data_list = []
    for text in pages_text:
        page_idx = current_obj
        stream_idx = current_obj + 1
        page_obj_indices.append(page_idx)

        # Build PDF stream text instructions
        # BT /F1 12 Tf 50 750 Td 15 TL (line 1) Tj T* (line 2) Tj ... ET
        stream_commands = ["BT", "/F1 11 Tf", "50 750 Td", "14 TL"]
        lines = text.split("\n")
        for line in lines:
            # Escape PDF string literals
            safe_line = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            # Sanitize ASCII
            safe_line = "".join(c if 32 <= ord(c) < 127 else " " for c in safe_line)
            stream_commands.append(f"({safe_line}) Tj")
            stream_commands.append("T*")
        stream_commands.append("ET")
        stream_bytes = "\n".join(stream_commands).encode("latin-1")

        stream_data_list.append((page_idx, stream_idx, stream_bytes))
        current_obj += 2

    # Now assemble the object list
    # Obj 1: Catalog
    catalog = b"<< /Type /Catalog /Pages 2 0 R >>"

    # Obj 2: Pages
    kids_refs = " ".join(f"{idx} 0 R" for idx in page_obj_indices)
    pages_obj = f"<< /Type /Pages /Kids [ {kids_refs} ] /Count {len(page_obj_indices)} >>".encode("latin-1")

    # Obj 3: Font
    font_obj = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

    all_objs = [catalog, pages_obj, font_obj]

    for page_idx, stream_idx, stream_bytes in stream_data_list:
        page_dict = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 595 842 ] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {stream_idx} 0 R >>"
        ).encode("latin-1")
        all_objs.append(page_dict)

        stream_obj = (
            f"<< /Length {len(stream_bytes)} >>\nstream\n".encode("latin-1")
            + stream_bytes
            + b"\nendstream"
        )
        all_objs.append(stream_obj)

    # Build final binary PDF
    pdf_output = [b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"]
    xref_offsets = [0]  # object 0 special offset

    current_offset = len(pdf_output[0])
    for i, obj_content in enumerate(all_objs, start=1):
        xref_offsets.append(current_offset)
        obj_header = f"{i} 0 obj\n".encode("latin-1")
        obj_footer = b"\nendobj\n"
        chunk = obj_header + obj_content + obj_footer
        pdf_output.append(chunk)
        current_offset += len(chunk)

    xref_start = current_offset
    xref_table = [f"xref\n0 {len(all_objs) + 1}\n".encode("latin-1")]
    xref_table.append(b"0000000000 65535 f \n")
    for offset in xref_offsets[1:]:
        xref_table.append(f"{offset:010d} 00000 n \n".encode("latin-1"))

    trailer = (
        f"trailer\n<< /Size {len(all_objs) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_start}\n%%EOF\n"
    ).encode("latin-1")

    return b"".join(pdf_output + xref_table + [trailer])


def create_minimal_docx_bytes(paragraphs: List[str], tables_data: List[List[List[str]]] = None) -> bytes:
    """Generate a valid .docx file in pure Python using zipfile and OpenXML."""
    import io

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # [Content_Types].xml
        content_types = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '</Types>'
        )
        zf.writestr("[Content_Types].xml", content_types)

        # _rels/.rels
        rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>'
        )
        zf.writestr("_rels/.rels", rels)

        # word/document.xml
        body_xml = []
        for p in paragraphs:
            if p == "--- PAGE BREAK ---":
                body_xml.append('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
            else:
                escaped = p.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                body_xml.append(f'<w:p><w:r><w:t>{escaped}</w:t></w:r></w:p>')

        if tables_data:
            for table in tables_data:
                body_xml.append('<w:tbl>')
                for row in table:
                    body_xml.append('<w:tr>')
                    for cell in row:
                        c_esc = cell.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                        body_xml.append(f'<w:tc><w:p><w:r><w:t>{c_esc}</w:t></w:r></w:p></w:tc>')
                    body_xml.append('</w:tr>')
                body_xml.append('</w:tbl>')

        doc_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:body>' + "".join(body_xml) + '</w:body>'
            '</w:document>'
        )
        zf.writestr("word/document.xml", doc_xml)

    return buffer.getvalue()


# Document fixture definitions
SYNTHETIC_DOCUMENTS_SPEC = [
    {
        "document_id": "doc-syn-001-ts-power-sanction",
        "filename": "TSSPDCL_Grid_Sanction_FabCity_Phase1.pdf",
        "file_formats": ["pdf", "txt"],
        "true_document_type": "UTILITY_SANCTION",
        "true_document_subtype": "GRID_SANCTION_LETTER",
        "jurisdiction": "Telangana",
        "issuing_authority": "TSSPDCL",
        "pages": [
            """SOUTHERN POWER DISTRIBUTION COMPANY OF TELANGANA LIMITED (TSSPDCL)
Corporate Office: Mint Compound, Hyderabad - 500063
OFFICE OF THE CHIEF GENERAL MANAGER (COMMERCIAL)

Ref: TSSPDCL/CGM/COM/HT/2026/D-8841                                Date: 15-03-2026

To:
M/s Deccan Cloud Infrastructure Private Limited
Survey No. 42/1 & 43, Fab City, Raviryal Village,
Maheshwaram Mandal, Ranga Reddy District, Telangana.

Sub: Electricity - Sanction of HT Power Supply of 50 MW (55.5 MVA) at 220 kV level
     for Hyperscale Data Centre Campus (Phase 1) - Approval & Demand Note - Accorded.

Ref: Your Online Application Ref: TSSPDCL/HT/APP/2026/0419 dated 10-01-2026.

With reference to your application, technical feasibility report from TSTRANSCO, and approval
of the competent authority, sanction is hereby accorded for High Tension Power Supply as detailed:

1. Category: HT Category-I(A) Data Centre Industrial
2. Sanctioned Grid Load: 50.0 MW
3. Contracted Maximum Demand: 55.5 MVA
4. Supply Voltage: 220 kV
5. Interconnection Substation: Fab City 220/33kV GIS Substation (Dedicated Bay)
6. Feeder Voltage: 220 kV (Double Circuit Overhead / UG Line)
7. Power Redundancy Level: Dual Feed (2N Grid Redundancy from Two Independent Bus Sections)
8. Scope of Sanction: Phase 1 Commercial Operations (Target CoD: 30-10-2027)

CONDITIONS OF SANCTION:
a) The consumer shall execute HT Agreement within 30 days of receipt of this letter.
b) The sanction is valid for 24 months from the date of issue (Valid until: 14-03-2028).
c) Dedicated 220 kV metering terminal bay equipment shall be erected at consumer cost.

Yours faithfully,
Chief General Manager (Commercial)
TSSPDCL, Hyderabad"""
        ],
        "expected_fields": [
            {
                "field_key": "sanctioned_grid_mw",
                "page_number": 1,
                "raw_text": "Sanctioned Grid Load: 50.0 MW",
                "normalized_value": 50.0,
                "unit": "MW",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "contract_demand_mva",
                "page_number": 1,
                "raw_text": "Contracted Maximum Demand: 55.5 MVA",
                "normalized_value": 55.5,
                "unit": "MVA",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "supply_voltage_kv",
                "page_number": 1,
                "raw_text": "Supply Voltage: 220 kV",
                "normalized_value": 220.0,
                "unit": "kV",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "substation_name",
                "page_number": 1,
                "raw_text": "Interconnection Substation: Fab City 220/33kV GIS Substation",
                "normalized_value": "Fab City 220/33kV GIS Substation",
                "unit": None,
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "document_reference_number",
                "page_number": 1,
                "raw_text": "Ref: TSSPDCL/CGM/COM/HT/2026/D-8841",
                "normalized_value": "TSSPDCL/CGM/COM/HT/2026/D-8841",
                "unit": None,
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "sanction_date",
                "page_number": 1,
                "raw_text": "Date: 15-03-2026",
                "normalized_value": "2026-03-15",
                "unit": "YYYY-MM-DD",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "validity_expiry_date",
                "page_number": 1,
                "raw_text": "Valid until: 14-03-2028",
                "normalized_value": "2028-03-14",
                "unit": "YYYY-MM-DD",
                "phase_scope": "PHASE_1"
            }
        ]
    },
    {
        "document_id": "doc-syn-002-mh-water-allocation",
        "filename": "MIDC_Water_Allocation_Taloja_Campus.pdf",
        "file_formats": ["pdf", "txt", "docx"],
        "true_document_type": "WATER_ALLOCATION",
        "true_document_subtype": "MUNICIPAL_BULK_WATER_ALLOCATION",
        "jurisdiction": "Maharashtra",
        "issuing_authority": "MIDC",
        "pages": [
            """MAHARASHTRA INDUSTRIAL DEVELOPMENT CORPORATION (MIDC)
Office of the Executive Engineer, Water Works Division
Taloja Industrial Area, Navi Mumbai, Maharashtra - 410208

Order No: MIDC/EE/WATER/TALOJA/2026/W-104                           Date: 20-01-2026

SANCTION ORDER FOR INDUSTRIAL BULK WATER SUPPLY

To:
M/s Sahyadri Data Hubs LLP,
Plot No. PAP-V-12, Taloja Industrial Area,
District Raigad, Maharashtra.

Subject: Bulk Water Supply Commitment for 80 MW Green Cloud Data Centre Campus
Reference: Developer Application MIDC/WTR/APP/992 dated 05-11-2025.

Sanction is hereby accorded for external municipal raw and potable water connection as follows:

1. Permitted Normal Water Allocation: 1800 KLD (1.80 MLD)
2. Peak Summer Water Cap: 2200 KLD
3. Mandatory Treated Wastewater Supply: 800 KLD (from Taloja CETP Tertiary Facility)
4. Primary Water Source: Barvi Dam Industrial Gravity Main via MIDC 400mm Feeder
5. Applicable Tariff: Non-domestic Industrial IT Rate Rs. 38.50 per 1,000 Litres
6. Campus Scope: Entire Full Campus (Phase 1 through Phase 3 cumulative)

TERMS AND MONITORING:
- Total raw water extraction shall not exceed 1800 KLD during normal operating seasons.
- Peak summer drawl up to 2200 KLD is authorized strictly subject to tertiary recycle reuse.
- The applicant shall install dual ultrasonic flow meters calibrated by MIDC.
- Validity: 5 years from date of commissioning (Valid until: 19-01-2031).

Executive Engineer
MIDC Water Works Division"""
        ],
        "expected_fields": [
            {
                "field_key": "water_allocation_kld",
                "page_number": 1,
                "raw_text": "Permitted Normal Water Allocation: 1800 KLD",
                "normalized_value": 1800.0,
                "unit": "KLD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "peak_summer_water_kld",
                "page_number": 1,
                "raw_text": "Peak Summer Water Cap: 2200 KLD",
                "normalized_value": 2200.0,
                "unit": "KLD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "treated_wastewater_kld",
                "page_number": 1,
                "raw_text": "Mandatory Treated Wastewater Supply: 800 KLD",
                "normalized_value": 800.0,
                "unit": "KLD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "document_reference_number",
                "page_number": 1,
                "raw_text": "Order No: MIDC/EE/WATER/TALOJA/2026/W-104",
                "normalized_value": "MIDC/EE/WATER/TALOJA/2026/W-104",
                "unit": None,
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "sanction_date",
                "page_number": 1,
                "raw_text": "Date: 20-01-2026",
                "normalized_value": "2026-01-20",
                "unit": "YYYY-MM-DD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "validity_expiry_date",
                "page_number": 1,
                "raw_text": "Valid until: 19-01-2031",
                "normalized_value": "2031-01-19",
                "unit": "YYYY-MM-DD",
                "phase_scope": "CAMPUS_WIDE"
            }
        ]
    },
    {
        "document_id": "doc-syn-003-ka-grid-application",
        "filename": "BESCOM_HT_Power_Application_Devanahalli.pdf",
        "file_formats": ["pdf", "txt"],
        "true_document_type": "UTILITY_APPLICATION",
        "true_document_subtype": "DISCOM_POWER_APPLICATION",
        "jurisdiction": "Karnataka",
        "issuing_authority": "BESCOM",
        "pages": [
            """BANGALORE ELECTRICITY SUPPLY COMPANY LIMITED (BESCOM)
High Tension Power Supply Application Form (Form HT-1)

Application ID: BESCOM/APP/2026/HT-08914                           Date: 10-02-2026

APPLICANT DETAILS:
Applicant Enterprise: M/s Silicon Horizon Tech Parks Ltd
Project Title: Devanahalli AI Cloud Hub Phase 1
Location: KIADB IT Hardware Industrial Park, Devanahalli, Bengaluru Rural - 562110

LOAD SPECIFICATIONS:
1. Proposed Contract Demand: 42.0 MVA
2. Estimated Peak Active Load: 35.0 MW
3. Desired Supply Voltage: 66 kV
4. Nearest 220/66 kV KPTCL Substation: Devanahalli 220/66kV Substation (Distance: 2.4 km)
5. Proposed Phase Scope: Phase 1 Commencement
6. Anticipated Commercial Operation Date: 15-12-2027

UNDERTAKING:
We hereby apply for grid power feasibility and sanction for Phase 1. We undertake to construct
a 66 kV GIS terminal bay at our own cost.

Authorized Signatory
Silicon Horizon Tech Parks Ltd"""
        ],
        "expected_fields": [
            {
                "field_key": "contract_demand_mva",
                "page_number": 1,
                "raw_text": "Proposed Contract Demand: 42.0 MVA",
                "normalized_value": 42.0,
                "unit": "MVA",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "sanctioned_grid_mw",
                "page_number": 1,
                "raw_text": "Estimated Peak Active Load: 35.0 MW",
                "normalized_value": 35.0,
                "unit": "MW",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "supply_voltage_kv",
                "page_number": 1,
                "raw_text": "Desired Supply Voltage: 66 kV",
                "normalized_value": 66.0,
                "unit": "kV",
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "substation_name",
                "page_number": 1,
                "raw_text": "Devanahalli 220/66kV Substation",
                "normalized_value": "Devanahalli 220/66kV Substation",
                "unit": None,
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "document_reference_number",
                "page_number": 1,
                "raw_text": "Application ID: BESCOM/APP/2026/HT-08914",
                "normalized_value": "BESCOM/APP/2026/HT-08914",
                "unit": None,
                "phase_scope": "PHASE_1"
            },
            {
                "field_key": "application_date",
                "page_number": 1,
                "raw_text": "Date: 10-02-2026",
                "normalized_value": "2026-02-10",
                "unit": "YYYY-MM-DD",
                "phase_scope": "PHASE_1"
            }
        ]
    },
    {
        "document_id": "doc-syn-004-tn-campus-dpr",
        "filename": "Siruseri_Hyperscale_Campus_DPR.pdf",
        "file_formats": ["pdf", "txt", "docx"],
        "true_document_type": "DPR",
        "true_document_subtype": "DETAILED_PROJECT_REPORT",
        "jurisdiction": "Tamil Nadu",
        "issuing_authority": "SIPCOT",
        "pages": [
            """DETAILED PROJECT REPORT (DPR)
PROJECT: CHENNAI ONE HYPERSCALE GREEN DATA CENTRE CAMPUS
SIPCOT IT Park, Siruseri, Chengalpattu District, Tamil Nadu
Document No: DPR-CHE-2026-REV3                                   Date: 05-04-2026

CHAPTER 1: EXECUTIVE SITE SUMMARY & MASTER PLAN
1.1 Campus Plot Area: 14.16 hectares (35.0 acres allotted by SIPCOT)
1.2 Total Permissible Built-up Area: 450,000 sq ft across 3 modular data halls
1.3 Master Plan Planned IT Capacity: 60.0 MW
1.4 Facility Peak Load: 78.0 MW
1.5 Design Power Usage Effectiveness (Target PUE): 1.30
1.6 Campus Development Schedule:
    - Phase 1 (30 MW IT / 40 MW Grid): CoD Q1 2027
    - Phase 2 (Cumulative 60 MW IT / 78 MW Grid): CoD Q4 2028""",
            """CHAPTER 2: POWER INFRASTRUCTURE & SUBSTATION HEADROOM
2.1 Grid Interconnection: TANGEDCO 230/33 kV Siruseri Auto-Substation
2.2 Phase 1 Power Sanction: 40.0 MW grid sanction at 230 kV
2.3 Phase 2 Power Requirement: Cumulative 78.0 MW grid capacity
2.4 Captive Renewable Energy Component: 15.0 MW dedicated on-site/near-site solar PV
2.5 Dual-feed Redundancy: 2N independent feeder lines from TANGEDCO 230 kV busbars""",
            """CHAPTER 3: WATER RESOURCE ASSESSMENT & COOLING BALANCE
3.1 Cooling Architecture: Closed loop chilled water system with evaporative cooling assist
3.2 Baseline Average Water Demand: 950 KLD
3.3 Peak Summer Water Demand: 1500 KLD
3.4 Water Supply Source: CMWSSB Tertiary Treated Water pipeline (TTRO Siruseri terminal)
3.5 Evaporative Treated Wastewater Recycle Component: 900 KLD
3.6 Zero Liquid Discharge (ZLD): Internal STP treated effluent 150 KLD recycled for cooling towers"""
        ],
        "expected_fields": [
            {
                "field_key": "site_area_hectares",
                "page_number": 1,
                "raw_text": "Campus Plot Area: 14.16 hectares",
                "normalized_value": 14.16,
                "unit": "hectares",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "total_builtup_sqft",
                "page_number": 1,
                "raw_text": "Total Permissible Built-up Area: 450,000 sq ft",
                "normalized_value": 450000.0,
                "unit": "sq ft",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "planned_it_capacity_mw",
                "page_number": 1,
                "raw_text": "Master Plan Planned IT Capacity: 60.0 MW",
                "normalized_value": 60.0,
                "unit": "MW",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "target_pue",
                "page_number": 1,
                "raw_text": "Design Power Usage Effectiveness (Target PUE): 1.30",
                "normalized_value": 1.30,
                "unit": "ratio",
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
                "field_key": "captive_re_mw",
                "page_number": 2,
                "raw_text": "Captive Renewable Energy Component: 15.0 MW",
                "normalized_value": 15.0,
                "unit": "MW",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "peak_summer_water_kld",
                "page_number": 3,
                "raw_text": "Peak Summer Water Demand: 1500 KLD",
                "normalized_value": 1500.0,
                "unit": "KLD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "treated_wastewater_kld",
                "page_number": 3,
                "raw_text": "Treated Wastewater Recycle Component: 900 KLD",
                "normalized_value": 900.0,
                "unit": "KLD",
                "phase_scope": "CAMPUS_WIDE"
            }
        ]
    },
    {
        "document_id": "doc-syn-005-cgwa-groundwater-noc",
        "filename": "CGWA_Groundwater_Extraction_NOC.pdf",
        "file_formats": ["pdf", "txt"],
        "true_document_type": "WATER_ALLOCATION",
        "true_document_subtype": "GROUNDWATER_CGWA_NOC",
        "jurisdiction": "National",
        "issuing_authority": "CGWA",
        "pages": [
            """GOVERNMENT OF INDIA
CENTRAL GROUND WATER AUTHORITY (CGWA)
Ministry of Jal Shakti, Department of Water Resources
18/11, Jamnagar House, New Delhi - 110011

NOC No: CGWA/NOC/IND/ORIG/2026/19420                             Date: 12-01-2026

NO OBJECTION CERTIFICATE (NOC) FOR GROUND WATER ABSTRACTION

To:
M/s Deccan Cloud Infrastructure Private Limited
Fab City, Ranga Reddy District, Telangana.

1. Category of Assessment Unit: Semi-Critical
2. Purpose of Extraction: Emergency Standby & Potable Uses for Data Centre
3. Permitted Daily Ground Water Withdrawal: 50.0 KLD (Fifty Kilo-Litres per Day)
4. Permitted Annual Quantity: 18,250 m3/year
5. Number of Existing/Proposed Abstraction Structures: 2 Borewells
6. Validity: 3 Years from 12-01-2026 to 11-01-2029

SPECIAL CONDITIONS:
- Continuous digital water meter with telemetry shall be fitted.
- Ground water extraction shall NOT be utilized for regular cooling tower evaporation.
- Artificial recharge to groundwater structures (rainwater harvesting) must achieve minimum 150% recharge.

Member Secretary
Central Ground Water Authority"""
        ],
        "expected_fields": [
            {
                "field_key": "groundwater_permitted_kld",
                "page_number": 1,
                "raw_text": "Permitted Daily Ground Water Withdrawal: 50.0 KLD",
                "normalized_value": 50.0,
                "unit": "KLD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "document_reference_number",
                "page_number": 1,
                "raw_text": "NOC No: CGWA/NOC/IND/ORIG/2026/19420",
                "normalized_value": "CGWA/NOC/IND/ORIG/2026/19420",
                "unit": None,
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "sanction_date",
                "page_number": 1,
                "raw_text": "Date: 12-01-2026",
                "normalized_value": "2026-01-12",
                "unit": "YYYY-MM-DD",
                "phase_scope": "CAMPUS_WIDE"
            },
            {
                "field_key": "validity_expiry_date",
                "page_number": 1,
                "raw_text": "to 11-01-2029",
                "normalized_value": "2029-01-11",
                "unit": "YYYY-MM-DD",
                "phase_scope": "CAMPUS_WIDE"
            }
        ]
    },
    {
        "document_id": "doc-syn-006-negative-commercial-invoice",
        "filename": "Vendor_Server_Procurement_Invoice.txt",
        "file_formats": ["txt"],
        "true_document_type": "OTHER",
        "true_document_subtype": "MISCELLANEOUS",
        "jurisdiction": "Commercial",
        "issuing_authority": "Private Vendor",
        "pages": [
            """GLOBAL TECH HARDWARE SUPPLIES LLC
Invoice No: INV-2026-992384
Date: February 24, 2026
Bill To: CloudScale Data Systems India Pvt Ltd

Item Description:
1. 42U Server Racks with PDU: 120 units @ $1,800 = $216,000
2. 500kVA Lithium-Ion UPS Module: 4 units @ $45,000 = $180,000
3. Category 6A Cabling Spools: 50 reels @ $320 = $16,000

Total Taxable Value: $412,000
GST @ 18%: $74,160
Total Amount Payable: $486,160

Payment Terms: Net 30 days via Wire Transfer.
This document is a commercial invoice for equipment purchase and does not constitute
utility approval, environmental sanction or statutory regulatory clearance."""
        ],
        "expected_fields": []
    }
]


def generate_synthetic_dataset(output_dir: Path) -> Dict[str, Any]:
    """Generate all synthetic files and the master ground_truth.json dataset."""
    output_dir.mkdir(parents=True, exist_ok=True)
    fixtures_dir = output_dir / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)

    ground_truth_records = []

    for spec in SYNTHETIC_DOCUMENTS_SPEC:
        doc_id = spec["document_id"]
        base_name = Path(spec["filename"]).stem
        pages_text = spec["pages"]

        # Always save raw txt
        txt_path = fixtures_dir / f"{base_name}.txt"
        txt_path.write_text("\n\n--- [Page Break] ---\n\n".join(pages_text), encoding="utf-8")

        # Save PDF if requested
        if "pdf" in spec["file_formats"]:
            pdf_path = fixtures_dir / f"{base_name}.pdf"
            pdf_bytes = create_minimal_pdf_bytes(pages_text)
            pdf_path.write_bytes(pdf_bytes)

        # Save DOCX if requested
        if "docx" in spec["file_formats"]:
            docx_path = fixtures_dir / f"{base_name}.docx"
            paragraphs = []
            for i, p in enumerate(pages_text):
                if i > 0:
                    paragraphs.append("--- PAGE BREAK ---")
                paragraphs.extend(p.split("\n"))
            docx_bytes = create_minimal_docx_bytes(paragraphs)
            docx_path.write_bytes(docx_bytes)

        # Build ground truth annotation
        gt_record = {
            "document_id": doc_id,
            "filename": spec["filename"],
            "true_document_type": spec["true_document_type"],
            "true_document_subtype": spec["true_document_subtype"],
            "jurisdiction": spec["jurisdiction"],
            "issuing_authority": spec["issuing_authority"],
            "page_count": len(pages_text),
            "expected_fields": spec["expected_fields"]
        }
        ground_truth_records.append(gt_record)

    master_dataset = {
        "dataset_version": "1.0.0",
        "description": "Synthetic multi-state Indian data centre regulatory & utility document benchmark",
        "total_documents": len(ground_truth_records),
        "documents": ground_truth_records
    }

    gt_file = output_dir / "ground_truth.json"
    with open(gt_file, "w", encoding="utf-8") as f:
        json.dump(master_dataset, f, indent=2)

    return master_dataset


if __name__ == "__main__":
    synthetic_dir = Path(__file__).parent
    result = generate_synthetic_dataset(synthetic_dir)
    print(f"Generated {result['total_documents']} synthetic fixtures in {synthetic_dir}")
