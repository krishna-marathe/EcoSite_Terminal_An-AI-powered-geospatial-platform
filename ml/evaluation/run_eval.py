"""CLI evaluation runner for EcoSite India document intelligence.

Evaluates both:
1. Original Synthetic Benchmark (ml/data/synthetic/)
2. Genuinely Held-Out Benchmark (ml/data/held_out/)
with per-class precision, recall, F1, abstention analysis, and safe input verification.
"""

import json
from pathlib import Path
import sys

from ml.evaluation.evaluator import DocumentEvaluator


def print_metrics_table(c_metrics: dict, e_metrics: dict):
    print(f"Overall Classification Accuracy: {c_metrics['accuracy'] * 100:.1f}%")
    print(f"Overall Classification Macro F1: {c_metrics['macro_f1']:.4f}")
    print(f"Overall Classification Macro Precision: {c_metrics['macro_precision']:.4f}")
    print(f"Overall Classification Macro Recall:    {c_metrics['macro_recall']:.4f}")
    print()
    print("  Per-Class Classification Performance:")
    print(f"    {'Class':<22} {'Precision':<10} {'Recall':<10} {'F1-Score':<10} {'Support':<8}")
    print(f"    {'-'*22} {'-'*10} {'-'*10} {'-'*10} {'-'*8}")
    for cls_name, vals in c_metrics.get("per_class_metrics", {}).items():
        print(f"    {cls_name:<22} {vals['precision']*100:<9.1f}% {vals['recall']*100:<9.1f}% {vals['f1']:<10.4f} {vals['support']:<8}")

    print()
    print("  Confusion Matrix:")
    matrix = c_metrics.get("confusion_matrix", {})
    cols = sorted(list(matrix.keys()))
    row_label = "True \\ Pred"
    header = f"    {row_label:<22} " + " ".join(f"{c[:8]:<9}" for c in cols)
    print(header)
    print(f"    {'-'*len(header)}")
    for r in cols:
        row_str = f"    {r:<22} " + " ".join(f"{matrix[r].get(c, 0):<9}" for c in cols)
        print(row_str)

    print()
    print("  Candidate Field Extraction Metrics:")
    print(f"    Precision: {e_metrics['precision'] * 100:.1f}%")
    print(f"    Recall:    {e_metrics['recall'] * 100:.1f}%")
    print(f"    F1 Score:  {e_metrics['f1_score']:.4f}")
    print(f"    Page Accuracy: {e_metrics['page_accuracy'] * 100:.1f}%")
    print(f"    True Positives: {e_metrics['true_positives']} | False Positives: {e_metrics['false_positives']} | False Negatives: {e_metrics['false_negatives']}")


def main():
    base_dir = Path(__file__).resolve().parent.parent
    syn_gt = base_dir / "data" / "synthetic" / "ground_truth.json"
    syn_dir = base_dir / "data" / "synthetic" / "fixtures"

    held_gt = base_dir / "data" / "held_out" / "ground_truth.json"
    held_dir = base_dir / "data" / "held_out" / "fixtures"

    evaluator = DocumentEvaluator()
    print("=" * 78)
    print("EcoSite India — Document Intelligence Evaluation & Validation Suite")
    print("=" * 78)

    # 1. Evaluate Original Synthetic Benchmark
    print("\n" + "=" * 50)
    print("1. ORIGINAL SYNTHETIC BENCHMARK (ml/data/synthetic/)")
    print("=" * 50)
    syn_res = evaluator.evaluate_dataset(syn_gt, syn_dir, preferred_format="txt")
    print_metrics_table(syn_res["classification_type_metrics"], syn_res["extraction_metrics"])

    # 2. Evaluate Genuinely Held-Out Benchmark
    print("\n" + "=" * 50)
    print("2. GENUINELY HELD-OUT BENCHMARK (ml/data/held_out/)")
    print("   (Unseen states, missing fields, contradictions, degraded OCR, lease)")
    print("=" * 50)
    held_res = evaluator.evaluate_dataset(held_gt, held_dir, preferred_format="txt")
    print_metrics_table(held_res["classification_type_metrics"], held_res["extraction_metrics"])

    print("\n  Document-Level Diagnostic Details (Held-Out):")
    for d in held_res["detailed_documents"]:
        print(f"    - {d['document_id']:<38} True: {d['true_type']:<18} Pred: {d['predicted_type']:<18} Conf: {d['confidence']:<6.4f} Matched: {d['matched_count']}/{d['expected_count']}")

    # Save summary report
    summary_path = base_dir / "evaluation" / "benchmark_summary.json"
    report = {
        "synthetic_benchmark": syn_res,
        "held_out_benchmark": held_res
    }
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nSaved combined benchmark summary to {summary_path}")


if __name__ == "__main__":
    main()
