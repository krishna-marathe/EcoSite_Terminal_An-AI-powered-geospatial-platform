"""Evaluation metrics for document classification and candidate field extraction."""

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Set, Tuple


@dataclass
class ClassificationMetrics:
    """Document classification performance metrics."""
    total_samples: int = 0
    correct_predictions: int = 0
    accuracy: float = 0.0
    macro_precision: float = 0.0
    macro_recall: float = 0.0
    macro_f1: float = 0.0
    per_class_metrics: Dict[str, Dict[str, float]] = field(default_factory=dict)
    confusion_matrix: Dict[str, Dict[str, int]] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_samples": self.total_samples,
            "correct_predictions": self.correct_predictions,
            "accuracy": round(self.accuracy, 4),
            "macro_precision": round(self.macro_precision, 4),
            "macro_recall": round(self.macro_recall, 4),
            "macro_f1": round(self.macro_f1, 4),
            "per_class_metrics": self.per_class_metrics,
            "confusion_matrix": self.confusion_matrix,
        }


@dataclass
class ExtractionMetrics:
    """Candidate field extraction performance metrics."""
    total_expected_fields: int = 0
    total_extracted_candidates: int = 0
    true_positives: int = 0
    false_positives: int = 0
    false_negatives: int = 0
    page_number_matches: int = 0
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    page_accuracy: float = 0.0
    per_field_metrics: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_expected_fields": self.total_expected_fields,
            "total_extracted_candidates": self.total_extracted_candidates,
            "true_positives": self.true_positives,
            "false_positives": self.false_positives,
            "false_negatives": self.false_negatives,
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1_score": round(self.f1_score, 4),
            "page_accuracy": round(self.page_accuracy, 4),
            "per_field_metrics": self.per_field_metrics,
        }


def compute_classification_metrics(
    y_true: List[str],
    y_pred: List[str]
) -> ClassificationMetrics:
    """Compute accuracy, precision, recall, and F1 across document classes."""
    n = len(y_true)
    if n == 0:
        return ClassificationMetrics()

    classes = sorted(list(set(y_true + y_pred)))
    matrix = {c1: {c2: 0 for c2 in classes} for c1 in classes}
    for t, p in zip(y_true, y_pred):
        matrix[t][p] += 1

    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    acc = correct / n

    per_class = {}
    precisions = []
    recalls = []
    f1s = []

    for c in classes:
        tp = matrix[c][c]
        fp = sum(matrix[other][c] for other in classes if other != c)
        fn = sum(matrix[c][other] for other in classes if other != c)

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

        precisions.append(prec)
        recalls.append(rec)
        f1s.append(f1)

        per_class[c] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "support": sum(matrix[c].values())
        }

    macro_prec = sum(precisions) / len(classes)
    macro_rec = sum(recalls) / len(classes)
    macro_f1 = sum(f1s) / len(classes)

    return ClassificationMetrics(
        total_samples=n,
        correct_predictions=correct,
        accuracy=acc,
        macro_precision=macro_prec,
        macro_recall=macro_rec,
        macro_f1=macro_f1,
        per_class_metrics=per_class,
        confusion_matrix=matrix
    )
