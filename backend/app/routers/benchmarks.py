"""Read-only router for official industry operator benchmarks.

Provides structured access to published operator sustainability metrics
(Nxtra, STT GDC India, CtrlS, Google, Microsoft, AWS).
"""
from __future__ import annotations

from typing import Optional
from collections import Counter
from fastapi import APIRouter, HTTPException, Query

from ..data.benchmarks import get_all_benchmarks, get_benchmark_by_id
from ..schemas.benchmarks import IndustryBenchmark, IndustryBenchmarkList

router = APIRouter(prefix="/benchmarks", tags=["Industry benchmarks"])


@router.get("", response_model=IndustryBenchmarkList)
def list_benchmarks(
    operator: Optional[str] = Query(default=None, description="Filter by operator name substring"),
    metric: Optional[str] = Query(default=None, description="Filter by exact metric key"),
    reporting_year: Optional[int] = Query(default=None, description="Filter by reporting year"),
    status: Optional[str] = Query(default=None, description="Filter by status (PUBLISHED, UNAVAILABLE)"),
) -> IndustryBenchmarkList:
    """List published industry benchmarks with optional operator and metric filtering."""
    all_benchmarks = get_all_benchmarks()
    filtered = all_benchmarks

    if operator:
        op_lower = operator.lower().strip()
        filtered = [b for b in filtered if op_lower in b.operator.lower()]
    if metric:
        metric_clean = metric.strip()
        filtered = [b for b in filtered if b.metric == metric_clean]
    if reporting_year:
        filtered = [b for b in filtered if b.reporting_year == reporting_year]
    if status:
        stat_upper = status.upper().strip()
        filtered = [b for b in filtered if b.status == stat_upper]

    operator_counts = dict(Counter(b.operator for b in all_benchmarks))
    metric_counts = dict(Counter(b.metric for b in all_benchmarks))

    return IndustryBenchmarkList(
        items=filtered,
        total=len(filtered),
        by_operator=operator_counts,
        by_metric=metric_counts,
    )


@router.get("/{benchmark_id}", response_model=IndustryBenchmark)
def get_benchmark(benchmark_id: str) -> IndustryBenchmark:
    """Fetch an individual benchmark by identifier with full provenance."""
    bmk = get_benchmark_by_id(benchmark_id)
    if bmk is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "benchmark_not_found",
                "message": f"Industry benchmark {benchmark_id!r} not found in the official registry.",
            },
        )
    return bmk

