"""Evaluation harness for EcoSite India document intelligence pipeline."""

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ml.classifiers.classifier import DocumentClassifier
from ml.contracts.schemas import ExtractionCandidate, ParsedDocument
from ml.evaluation.metrics import (
    ClassificationMetrics,
    ExtractionMetrics,
    compute_classification_metrics,
)
from ml.extractors.extractor import CandidateExtractor
from ml.parsers.unified_parser import DocumentParser


def values_match(expected: Any, actual: Any, tol: float = 0.05) -> bool:
    """Check if normalized values match with numeric tolerance for floats."""
    if expected is None and actual is None:
        return True
    if expected is None or actual is None:
        return False

    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return math.isclose(float(expected), float(actual), rel_tol=tol, abs_tol=tol)

    # String comparison (case-insensitive and whitespace-stripped)
    return str(expected).strip().lower() == str(actual).strip().lower()


class DocumentEvaluator:
    """Benchmark evaluator for document classification and candidate extraction."""

    def __init__(
        self,
        parser: Optional[DocumentParser] = None,
        classifier: Optional[DocumentClassifier] = None,
        extractor: Optional[CandidateExtractor] = None,
    ):
        self.parser = parser or DocumentParser()
        self.classifier = classifier or DocumentClassifier()
        self.extractor = extractor or CandidateExtractor(self.classifier)

    def evaluate_dataset(
        self,
        ground_truth_path: Path,
        fixtures_dir: Path,
        preferred_format: str = "txt"
    ) -> Dict[str, Any]:
        """Evaluate pipeline against ground truth dataset."""
        with open(ground_truth_path, "r", encoding="utf-8") as f:
            gt_data = json.load(f)

        docs_spec = gt_data["documents"]

        y_true_types: List[str] = []
        y_pred_types: List[str] = []
        y_true_subtypes: List[str] = []
        y_pred_subtypes: List[str] = []

        total_expected = 0
        total_extracted = 0
        true_positives = 0
        page_matches = 0
        per_field_stats: Dict[str, Dict[str, int]] = {}

        detailed_results = []

        for spec in docs_spec:
            doc_id = spec["document_id"]
            base_name = Path(spec["filename"]).stem
            target_file = fixtures_dir / f"{base_name}.{preferred_format}"

            if not target_file.exists():
                # Fallback to txt
                target_file = fixtures_dir / f"{base_name}.txt"

            parsed_doc = self.parser.parse_file(target_file, document_id=doc_id)

            # 1. Classification
            cls_res = self.classifier.classify_document(parsed_doc)
            y_true_types.append(spec["true_document_type"])
            y_pred_types.append(cls_res.predicted_type)
            y_true_subtypes.append(spec["true_document_subtype"])
            y_pred_subtypes.append(cls_res.predicted_subtype or "MISCELLANEOUS")

            # 2. Extraction
            candidates = self.extractor.extract_candidates(
                parsed_doc,
                document_type=cls_res.predicted_type
            )
            total_extracted += len(candidates)

            expected_fields = spec.get("expected_fields", [])
            total_expected += len(expected_fields)

            matched_expected = set()
            for cand in candidates:
                cand_matched = False
                for idx, exp in enumerate(expected_fields):
                    if idx in matched_expected:
                        continue
                    if cand.field_key == exp["field_key"] and values_match(exp["normalized_value"], cand.normalized_value):
                        cand_matched = True
                        matched_expected.add(idx)
                        true_positives += 1
                        if cand.page_number == exp.get("page_number", 1):
                            page_matches += 1

                        fkey = cand.field_key
                        if fkey not in per_field_stats:
                            per_field_stats[fkey] = {"expected": 0, "matched": 0, "extracted": 0}
                        per_field_stats[fkey]["matched"] += 1
                        break

                fkey = cand.field_key
                if fkey not in per_field_stats:
                    per_field_stats[fkey] = {"expected": 0, "matched": 0, "extracted": 0}
                per_field_stats[fkey]["extracted"] += 1

            for exp in expected_fields:
                fkey = exp["field_key"]
                if fkey not in per_field_stats:
                    per_field_stats[fkey] = {"expected": 0, "matched": 0, "extracted": 0}
                per_field_stats[fkey]["expected"] += 1

            detailed_results.append({
                "document_id": doc_id,
                "filename": target_file.name,
                "true_type": spec["true_document_type"],
                "predicted_type": cls_res.predicted_type,
                "confidence": cls_res.confidence,
                "expected_count": len(expected_fields),
                "extracted_count": len(candidates),
                "matched_count": len(matched_expected)
            })

        # Compute classification metrics
        type_metrics = compute_classification_metrics(y_true_types, y_pred_types)
        subtype_metrics = compute_classification_metrics(y_true_subtypes, y_pred_subtypes)

        # Compute extraction metrics
        precision = true_positives / total_extracted if total_extracted > 0 else 0.0
        recall = true_positives / total_expected if total_expected > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        page_acc = page_matches / true_positives if true_positives > 0 else 0.0

        ext_metrics = ExtractionMetrics(
            total_expected_fields=total_expected,
            total_extracted_candidates=total_extracted,
            true_positives=true_positives,
            false_positives=total_extracted - true_positives,
            false_negatives=total_expected - true_positives,
            page_number_matches=page_matches,
            precision=precision,
            recall=recall,
            f1_score=f1,
            page_accuracy=page_acc,
            per_field_metrics=per_field_stats
        )

        return {
            "format_evaluated": preferred_format,
            "classification_type_metrics": type_metrics.to_dict(),
            "classification_subtype_metrics": subtype_metrics.to_dict(),
            "extraction_metrics": ext_metrics.to_dict(),
            "detailed_documents": detailed_results
        }
