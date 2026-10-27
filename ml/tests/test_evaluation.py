"""Tests for evaluation metrics and evaluator pipeline."""

from pathlib import Path
import unittest

from ml.evaluation.evaluator import DocumentEvaluator
from ml.evaluation.metrics import (
    ClassificationMetrics,
    ExtractionMetrics,
    compute_classification_metrics,
)


class TestEvaluation(unittest.TestCase):
    """Test metrics computation and benchmark evaluator."""

    def test_compute_classification_metrics(self):
        y_true = ["UTILITY_SANCTION", "WATER_ALLOCATION", "DPR", "OTHER"]
        y_pred = ["UTILITY_SANCTION", "WATER_ALLOCATION", "DPR", "OTHER"]
        metrics = compute_classification_metrics(y_true, y_pred)
        self.assertEqual(metrics.accuracy, 1.0)
        self.assertEqual(metrics.macro_f1, 1.0)
        self.assertEqual(metrics.correct_predictions, 4)

    def test_compute_classification_metrics_with_error(self):
        y_true = ["UTILITY_SANCTION", "WATER_ALLOCATION", "DPR"]
        y_pred = ["UTILITY_SANCTION", "WATER_ALLOCATION", "PLANNING"]
        metrics = compute_classification_metrics(y_true, y_pred)
        self.assertAlmostEqual(metrics.accuracy, 2 / 3, places=2)
        self.assertLess(metrics.macro_f1, 1.0)

    def test_evaluator_against_synthetic_dataset(self):
        base_dir = Path(__file__).resolve().parent.parent
        gt_path = base_dir / "data" / "synthetic" / "ground_truth.json"
        fixtures_dir = base_dir / "data" / "synthetic" / "fixtures"

        evaluator = DocumentEvaluator()
        res = evaluator.evaluate_dataset(gt_path, fixtures_dir, preferred_format="txt")

        c_metrics = res["classification_type_metrics"]
        e_metrics = res["extraction_metrics"]

        # Benchmarks
        self.assertEqual(c_metrics["accuracy"], 1.0)
        self.assertGreaterEqual(e_metrics["recall"], 0.95)
        self.assertGreaterEqual(e_metrics["f1_score"], 0.85)
        self.assertEqual(e_metrics["page_accuracy"], 1.0)

    def test_evaluator_against_held_out_dataset(self):
        base_dir = Path(__file__).resolve().parent.parent
        held_gt = base_dir / "data" / "held_out" / "ground_truth.json"
        held_dir = base_dir / "data" / "held_out" / "fixtures"

        evaluator = DocumentEvaluator()
        res = evaluator.evaluate_dataset(held_gt, held_dir, preferred_format="txt")

        c_metrics = res["classification_type_metrics"]
        e_metrics = res["extraction_metrics"]

        # Held-out benchmarks with missing fields and contradictions
        self.assertGreaterEqual(c_metrics["accuracy"], 0.60)
        self.assertGreaterEqual(e_metrics["precision"], 0.90)
        self.assertGreaterEqual(e_metrics["page_accuracy"], 0.95)


if __name__ == "__main__":
    unittest.main()
