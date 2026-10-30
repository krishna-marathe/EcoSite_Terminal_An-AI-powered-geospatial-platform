"""Pydantic schemas for industry operator benchmarks.

Maintains officially published, reproducible sustainability metrics from data center
operators separate from site-specific candidate evaluations and evidence graphs.
"""
from __future__ import annotations

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class IndustryBenchmark(BaseModel):
    """Officially published operator sustainability metric."""

    id: str = Field(..., description="Unique benchmark identifier")
    operator: str = Field(..., description="Operating company name (e.g. Nxtra, STT GDC, Google)")
    reporting_year: int = Field(..., description="Reporting financial/calendar year")
    metric: str = Field(..., description="Normalized metric key (e.g. annual_average_pue, wue_liters_per_kwh)")
    value: Optional[float] = Field(None, description="Numeric metric value or null if unavailable")
    unit: str = Field(..., description="Measurement unit (e.g. ratio, L/kWh, %)")
    status: str = Field(..., description="Benchmark reporting status (PUBLISHED, UNAVAILABLE, ESTIMATED)")
    reporting_scope: str = Field(..., description="Organizational or geographical reporting scope")
    boundary_notes: str = Field(..., description="Detailed accounting boundary and exclusions")
    is_portfolio_average: bool = Field(..., description="True if metric reflects corporate fleet average rather than verified site facility")
    document_title: str = Field(..., description="Official publication or sustainability report title")
    source_url: Optional[str] = Field(None, description="Public download or verification link")
    page_or_reference: Optional[str] = Field(None, description="Section, page number, or table reference")
    quality_notes: Optional[str] = Field(None, description="Epistemic caveats and interpretation notes")


class IndustryBenchmarkList(BaseModel):
    """Collection response for published industry benchmarks."""

    items: List[IndustryBenchmark]
    total: int
    by_operator: Dict[str, int]
    by_metric: Dict[str, int]

