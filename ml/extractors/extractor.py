"""Candidate Field Extractor for EcoSite India.

Extracts structured engineering, regulatory, and resource candidates matching
the API_CONTRACTS.md Section 4 ExtractionCandidate specification.
"""

from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple, Union

from ml.classifiers.classifier import DocumentClassifier
from ml.contracts.schemas import (
    ExtractionCandidate,
    ExtractionMethod,
    ParsedDocument,
    ParsedPage,
    PhaseScope,
    ReviewStatus,
)
from ml.contracts.taxonomy import DocumentType, FieldKey
from ml.extractors.normalizers import (
    normalize_area_hectares,
    normalize_date_string,
    normalize_numeric_string,
    normalize_power_mva,
    normalize_power_mw,
    normalize_voltage_kv,
    normalize_water_kld,
)


def detect_phase_scope(text_context: str) -> str:
    """Detect project phase from sentence or surrounding context."""
    lower = text_context.lower()
    if re.search(r"\bphase\s*1\b|\bphase\s*i\b|\bstage\s*1\b", lower):
        return PhaseScope.PHASE_1.value
    elif re.search(r"\bphase\s*2\b|\bphase\s*ii\b|\bstage\s*2\b", lower):
        return PhaseScope.PHASE_2.value
    elif re.search(r"\bphase\s*3\b|\bphase\s*iii\b|\bstage\s*3\b", lower):
        return PhaseScope.PHASE_3.value
    elif re.search(r"\bfull\s*campus\b|\bentire\s*campus\b|\bcampus\b|\bcumulative\b|\bmaster\s*plan\b", lower):
        return PhaseScope.CAMPUS_WIDE.value
    return PhaseScope.CAMPUS_WIDE.value


class CandidateExtractor:
    """Extracts typed candidate fields from parsed documents."""

    def __init__(self, classifier: Optional[DocumentClassifier] = None):
        self.classifier = classifier or DocumentClassifier()

    def extract_candidates(
        self,
        doc: ParsedDocument,
        document_type: Optional[str] = None
    ) -> List[ExtractionCandidate]:
        """Extract candidate values across all pages of a document."""
        # If document_type not provided, run classifier first
        if not document_type:
            cls_res = self.classifier.classify_document(doc)
            document_type = cls_res.predicted_type

        # If document is OTHER or non-infrastructure, return empty candidates
        if document_type == DocumentType.OTHER.value:
            return []

        candidates: List[ExtractionCandidate] = []
        seen_keys_per_page: set = set()

        for page in doc.pages:
            page_candidates = self._extract_page_candidates(
                page=page,
                document_id=doc.document_id,
                document_type=document_type,
                doc_full_text=doc.raw_text
            )
            for cand in page_candidates:
                dedup_key = (cand.page_number, cand.field_key, str(cand.normalized_value), cand.phase_scope)
                if dedup_key not in seen_keys_per_page:
                    seen_keys_per_page.add(dedup_key)
                    candidates.append(cand)

        return candidates

    def _extract_page_candidates(
        self,
        page: ParsedPage,
        document_id: str,
        document_type: str,
        doc_full_text: str
    ) -> List[ExtractionCandidate]:
        """Extract candidates from a single parsed page."""
        candidates: List[ExtractionCandidate] = []
        text = page.text
        lines = [line.strip() for line in text.split("\n") if line.strip()]

        for line in lines:
            # 1. Sanctioned Grid Load / Peak Load (MW)
            m_grid = re.search(
                r"(?:Sanctioned\s*(?:Grid\s*)?Load|Estimated\s+Peak\s+Active\s+Load|Phase\s+\d+\s+Power\s+Sanction):?\s*([\d\.,]+)\s*(MW|kW|GW)",
                line,
                re.IGNORECASE
            )
            if m_grid:
                raw_val = normalize_numeric_string(m_grid.group(1))
                norm_val = normalize_power_mw(raw_val, m_grid.group(2))
                phase = detect_phase_scope(line)
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.SANCTIONED_GRID_MW.value,
                    raw_text=line,
                    normalized_value=norm_val,
                    unit="MW",
                    phase_scope=phase,
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.92,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 2. Contract Demand (MVA)
            m_mva = re.search(
                r"(?:Contracted\s+Maximum\s+Demand|Proposed\s+Contract\s+Demand|Contract\s+Demand|Sanctioned\s*(?:Grid\s*)?(?:Load|Demand)):?\s*([\d\.,]+)\s*(MVA|kVA)",
                line,
                re.IGNORECASE
            )
            if m_mva:
                raw_val = normalize_numeric_string(m_mva.group(1))
                norm_val = normalize_power_mva(raw_val, m_mva.group(2))
                phase = detect_phase_scope(line)
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.CONTRACT_DEMAND_MVA.value,
                    raw_text=line,
                    normalized_value=norm_val,
                    unit="MVA",
                    phase_scope=phase,
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.94,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 3. Supply Voltage (kV)
            m_kv = re.search(
                r"(?:Supply\s+Voltage|Desired\s+Supply\s+Voltage|voltage\s+grade|interconnection\s+at|at)\s*:?\s*([\d\.,]+)\s*(kV|V)",
                line,
                re.IGNORECASE
            )
            if m_kv:
                raw_val = normalize_numeric_string(m_kv.group(1))
                norm_val = normalize_voltage_kv(raw_val, m_kv.group(2))
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.SUPPLY_VOLTAGE_KV.value,
                    raw_text=line,
                    normalized_value=norm_val,
                    unit="kV",
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.90,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 4. Substation Name
            m_sub = re.search(
                r"(?:Interconnection\s+Substation|Nearest\s+(?:[\d/]+\s*kV\s+)?[A-Za-z0-9]+\s+Substation|from|Substation):?\s*([A-Za-z0-9\s/]+(?:Substation|GIS(?:\s+Substation)?|Switchyard))",
                line,
                re.IGNORECASE
            )
            if m_sub:
                sub_name = m_sub.group(1).strip()
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.SUBSTATION_NAME.value,
                    raw_text=line,
                    normalized_value=sub_name,
                    unit=None,
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.88,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 5. Water Allocation (KLD)
            m_wtr = re.search(
                r"(?:Permitted\s+(?:Normal\s+)?Water\s+Allocation|Water\s+Allocation|Allotted\s+Quantity):?\s*([\d\.,]+)\s*(KLD|MLD|kL/day|m3/day|m3/d|cum/day|cubic\s+meters?\s+per\s+day)",
                line,
                re.IGNORECASE
            )
            if m_wtr:
                raw_val = normalize_numeric_string(m_wtr.group(1))
                norm_val = normalize_water_kld(raw_val, m_wtr.group(2))
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.WATER_ALLOCATION_KLD.value,
                    raw_text=line,
                    normalized_value=norm_val,
                    unit="KLD",
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.95,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 6. Peak Summer Water (KLD)
            m_psw = re.search(
                r"(?:Peak\s+Summer\s+Water\s+(?:Cap|Demand)|Seasonal\s+Peak(?:\s+Water)?):?\s*([\d\.,]+)\s*(KLD|MLD|kL/day|m3/day|cum/day)",
                line,
                re.IGNORECASE
            )
            if m_psw:
                raw_val = normalize_numeric_string(m_psw.group(1))
                norm_val = normalize_water_kld(raw_val, m_psw.group(2))
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.PEAK_SUMMER_WATER_KLD.value,
                    raw_text=line,
                    normalized_value=norm_val,
                    unit="KLD",
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.93,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 7. Treated Wastewater (KLD)
            m_tww = re.search(
                r"(?:Mandatory\s+Treated\s+Wastewater\s+Supply|Treated\s+(?:STP\s+Effluent|Wastewater)\s+(?:mandatory\s+off-take|Recycle\s+Component)):?\s*([\d\.,]+)\s*(KLD|MLD|cum/day|m3/day)",
                line,
                re.IGNORECASE
            )
            if m_tww:
                raw_val = normalize_numeric_string(m_tww.group(1))
                norm_val = normalize_water_kld(raw_val, m_tww.group(2))
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.TREATED_WASTEWATER_KLD.value,
                    raw_text=line,
                    normalized_value=norm_val,
                    unit="KLD",
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.91,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 8. Groundwater Permitted (KLD)
            m_gw = re.search(
                r"(?:Permitted\s+Daily\s+Ground\s+Water\s+Withdrawal):?\s*([\d\.,]+)\s*(KLD|MLD|m3/day|cum/day)",
                line,
                re.IGNORECASE
            )
            if m_gw:
                raw_val = normalize_numeric_string(m_gw.group(1))
                norm_val = normalize_water_kld(raw_val, m_gw.group(2))
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.GROUNDWATER_PERMITTED_KLD.value,
                    raw_text=line,
                    normalized_value=norm_val,
                    unit="KLD",
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.95,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 9. Site Area (Hectares)
            m_area = re.search(
                r"(?:Campus\s+Plot\s+Area|Plot\s+Area):?\s*([\d\.,]+)\s*(hectares|ha|acres)",
                line,
                re.IGNORECASE
            )
            if m_area:
                raw_val = normalize_numeric_string(m_area.group(1))
                norm_val = normalize_area_hectares(raw_val, m_area.group(2))
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.SITE_AREA_HECTARES.value,
                    raw_text=line,
                    normalized_value=norm_val,
                    unit="hectares",
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.90,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 10. Total Builtup Area (Sq Ft)
            m_bua = re.search(
                r"(?:Total\s+(?:Permissible\s+)?Built-up\s+Area):?\s*([\d\.,]+)\s*(sq\s*ft|sqft)",
                line,
                re.IGNORECASE
            )
            if m_bua:
                val = normalize_numeric_string(m_bua.group(1))
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.TOTAL_BUILTUP_SQFT.value,
                    raw_text=line,
                    normalized_value=val,
                    unit="sq ft",
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.92,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 11. Planned IT Capacity (MW)
            m_it = re.search(
                r"(?:Planned\s+IT\s+Capacity):?\s*([\d\.,]+)\s*(MW|kW)",
                line,
                re.IGNORECASE
            )
            if m_it:
                raw_val = normalize_numeric_string(m_it.group(1))
                norm_val = normalize_power_mw(raw_val, m_it.group(2))
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.PLANNED_IT_CAPACITY_MW.value,
                    raw_text=line,
                    normalized_value=norm_val,
                    unit="MW",
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.92,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 12. Target PUE
            m_pue = re.search(
                r"(?:Design\s+Power\s+Usage\s+Effectiveness\s+\(Target\s+PUE\)|Target\s+PUE):?\s*([\d\.]+)",
                line,
                re.IGNORECASE
            )
            if m_pue:
                pue_val = float(m_pue.group(1))
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.TARGET_PUE.value,
                    raw_text=line,
                    normalized_value=pue_val,
                    unit="ratio",
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.95,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 13. Captive RE Component (MW)
            m_re = re.search(
                r"(?:Captive\s+Renewable\s+Energy\s+Component):?\s*([\d\.,]+)\s*(MW|kW)",
                line,
                re.IGNORECASE
            )
            if m_re:
                raw_val = normalize_numeric_string(m_re.group(1))
                norm_val = normalize_power_mw(raw_val, m_re.group(2))
                candidates.append(ExtractionCandidate(
                    document_id=document_id,
                    document_type=document_type,
                    page_number=page.page_number,
                    field_key=FieldKey.CAPTIVE_RE_MW.value,
                    raw_text=line,
                    normalized_value=norm_val,
                    unit="MW",
                    phase_scope=detect_phase_scope(line),
                    method=ExtractionMethod.RULE_BASED.value,
                    confidence=0.92,
                    review_status=ReviewStatus.PENDING.value
                ))

            # 14. Document Reference Number
            # Negative lookahead/behind to avoid matching prose like "With reference to", "In reference of"
            # or incoming citations like "Your Online Application Ref:"
            is_prose_or_citation = bool(re.search(r"\b(?:with\s+reference|in\s+reference|your\s+(?:online\s+)?application)\b", line, re.IGNORECASE))
            if not is_prose_or_citation:
                m_ref = re.search(
                    r"\b(?:Ref|Order\s+No|Application\s+(?:ID|Reference)|NOC\s+No|Document\s+No|Allotment\s+Reference|Memorandum\s+No)\.?\s*:?\s*([A-Za-z0-9_/-]{6,})",
                    line,
                    re.IGNORECASE
                )
                if m_ref and "date" not in m_ref.group(1).lower():
                    ref_val = m_ref.group(1).strip()
                    # Filter out partial words like 'erence'
                    if ref_val.lower() not in ["erence", "number", "dated"]:
                        candidates.append(ExtractionCandidate(
                            document_id=document_id,
                            document_type=document_type,
                            page_number=page.page_number,
                            field_key=FieldKey.DOCUMENT_REFERENCE_NUMBER.value,
                            raw_text=line,
                            normalized_value=ref_val,
                            unit=None,
                            phase_scope=detect_phase_scope(line),
                            method=ExtractionMethod.RULE_BASED.value,
                            confidence=0.92,
                            review_status=ReviewStatus.PENDING.value
                        ))

            # 15. Dates (Sanction Date / Application Date / Expiry Date)
            # Avoid Commercial Operation Date (CoD) being captured as application or sanction date
            is_cod = bool(re.search(r"\b(?:commercial\s+operation\s+date|cod|target\s+cod|commissioning\s+target)\b", line, re.IGNORECASE))
            if not is_cod:
                m_date = re.search(
                    r"\bDate:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}-\d{2}-\d{2})",
                    line,
                    re.IGNORECASE
                )
                if m_date:
                    iso_date = normalize_date_string(m_date.group(1))
                    if iso_date and document_type != DocumentType.DPR.value:
                        fkey = FieldKey.SANCTION_DATE.value if "application" not in document_type.lower() else FieldKey.APPLICATION_DATE.value
                        candidates.append(ExtractionCandidate(
                            document_id=document_id,
                            document_type=document_type,
                            page_number=page.page_number,
                            field_key=fkey,
                            raw_text=line,
                            normalized_value=iso_date,
                            unit="YYYY-MM-DD",
                            phase_scope=detect_phase_scope(line),
                            method=ExtractionMethod.RULE_BASED.value,
                            confidence=0.91,
                            review_status=ReviewStatus.PENDING.value
                        ))

            # Validity / Expiry Date
            m_val = re.search(
                r"(?:Valid\s+until|Valid\s+up\s+to|Valid\s+for:?\s*10\s*years\s+expiring\s+on|to):?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}-\d{2}-\d{2})",
                line,
                re.IGNORECASE
            )
            if m_val:
                iso_exp = normalize_date_string(m_val.group(1))
                if iso_exp:
                    candidates.append(ExtractionCandidate(
                        document_id=document_id,
                        document_type=document_type,
                        page_number=page.page_number,
                        field_key=FieldKey.VALIDITY_EXPIRY_DATE.value,
                        raw_text=line,
                        normalized_value=iso_exp,
                        unit="YYYY-MM-DD",
                        phase_scope=detect_phase_scope(line),
                        method=ExtractionMethod.RULE_BASED.value,
                        confidence=0.90,
                        review_status=ReviewStatus.PENDING.value
                    ))

        return candidates
