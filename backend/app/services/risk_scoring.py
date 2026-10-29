"""Deterministic environmental risk score (0-100) for a data-centre facility.

Design rules, in the same spirit as the connector contract:

* A parameter contributes **only** when the provider actually returned a value.
  A missing parameter is reported as missing with a reason; it is never scored as
  zero and never silently dropped from the narrative.
* Every threshold is written down here, in this file, with the standard it comes
  from. The score is arithmetic, not a model, and it is versioned.
* ``coverage`` is the share of the total weight that was actually measurable, so
  a score built from two of eight parameters cannot masquerade as complete.
* The score is a **screening signal** for planning, not a compliance
  determination and not an on-site measurement.

Scoring shape: each parameter is mapped through a piecewise-linear curve to a
risk value between 0 (benign) and 100 (worst observed/expected), then combined as
a weight-normalised mean over the available parameters. Normalising by available
weight keeps the score comparable across facilities with different provider
coverage; the coverage field keeps that normalisation visible.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime
from typing import Mapping

SCORE_VERSION = "risk-env-1.0.0"


@dataclass(frozen=True)
class CurvePoint:
    value: float
    risk: float


@dataclass(frozen=True)
class ParameterSpec:
    key: str
    label: str
    unit: str
    weight: float
    curve: tuple[CurvePoint, ...]
    note: str


PARAMETERS: tuple[ParameterSpec, ...] = (
    ParameterSpec(
        key="air.aqi_us",
        label="Air quality index",
        unit="AQI",
        weight=0.16,
        curve=(
            CurvePoint(0, 5), CurvePoint(50, 15), CurvePoint(100, 35),
            CurvePoint(150, 55), CurvePoint(200, 75), CurvePoint(300, 92),
            CurvePoint(500, 100),
        ),
        note="US EPA AQI bands: 0-50 good, 51-100 moderate, 101-150 unhealthy for sensitive groups, 151-200 unhealthy, 201-300 very unhealthy.",
    ),
    ParameterSpec(
        key="air.pm25",
        label="Fine particulate matter",
        unit="ug/m3",
        weight=0.10,
        curve=(
            CurvePoint(0, 3), CurvePoint(15, 25), CurvePoint(35, 50),
            CurvePoint(55, 70), CurvePoint(75, 88), CurvePoint(150, 100),
        ),
        note="WHO 24-hour guideline is 15 ug/m3; 75 ug/m3 is the CPCB 24-hour standard.",
    ),
    ParameterSpec(
        key="air.pm10",
        label="Coarse particulate matter",
        unit="ug/m3",
        weight=0.06,
        curve=(
            CurvePoint(0, 3), CurvePoint(45, 20), CurvePoint(100, 45),
            CurvePoint(150, 62), CurvePoint(250, 85), CurvePoint(430, 100),
        ),
        note="WHO 24-hour guideline is 45 ug/m3; 100 ug/m3 is the CPCB 24-hour standard.",
    ),
    ParameterSpec(
        key="heat.temperature_max",
        label="Daily maximum air temperature",
        unit="degC",
        weight=0.16,
        curve=(
            CurvePoint(20, 3), CurvePoint(30, 15), CurvePoint(35, 35),
            CurvePoint(38, 55), CurvePoint(42, 80), CurvePoint(46, 95),
            CurvePoint(50, 100),
        ),
        note="Cooling and water stress rise steeply above 35 degC; 42 degC and above is severe heat for a facility with air-cooled plant.",
    ),
    ParameterSpec(
        key="water.rainfall_24h",
        label="24-hour rainfall",
        unit="mm",
        weight=0.12,
        curve=(
            CurvePoint(0, 2), CurvePoint(10, 12), CurvePoint(50, 40),
            CurvePoint(100, 65), CurvePoint(150, 82), CurvePoint(250, 100),
        ),
        note="Heavy-rain bands: 50 mm/day is a heavy-rain event, 100 mm/day approaches an extreme event in most Indian districts.",
    ),
    ParameterSpec(
        key="water.river_discharge_percentile",
        label="River flow vs 12-month climatology",
        unit="percentile",
        weight=0.18,
        curve=(
            CurvePoint(0, 3), CurvePoint(50, 20), CurvePoint(80, 40),
            CurvePoint(95, 70), CurvePoint(99, 90), CurvePoint(100, 100),
        ),
        note="GloFAS modelled discharge ranked against the previous 365 days at the same grid cell. High flow is flood exposure; a low percentile is not scored as risk.",
    ),
    ParameterSpec(
        key="water.groundwater_depth",
        label="Groundwater depth below ground",
        unit="m",
        weight=0.12,
        curve=(
            CurvePoint(0, 5), CurvePoint(5, 20), CurvePoint(10, 35),
            CurvePoint(20, 60), CurvePoint(30, 80), CurvePoint(50, 95),
            CurvePoint(80, 100),
        ),
        note="Deeper water tables mean higher pumping cost and greater water-security risk. Source not connected: this parameter is reported unavailable.",
    ),
    ParameterSpec(
        key="water.surface_water_occurrence",
        label="Surface-water occurrence near site",
        unit="percent",
        weight=0.10,
        curve=(
            CurvePoint(0, 3), CurvePoint(10, 20), CurvePoint(25, 40),
            CurvePoint(50, 60), CurvePoint(75, 80), CurvePoint(100, 95),
        ),
        note="Share of surrounding land with mapped surface water. The JRC surface-water connector runs on candidate polygons, not on public facility points, so this parameter is reported unavailable.",
    ),
)

PARAMETER_BY_KEY: dict[str, ParameterSpec] = {parameter.key: parameter for parameter in PARAMETERS}
TOTAL_WEIGHT = sum(parameter.weight for parameter in PARAMETERS)
if abs(TOTAL_WEIGHT - 1.0) > 1e-9:  # pragma: no cover - guards a typo, not user input
    raise RuntimeError(f"Risk parameter weights must sum to 1.0, got {TOTAL_WEIGHT}")

BANDS: tuple[tuple[float, str], ...] = ((25.0, "low"), (50.0, "moderate"), (75.0, "high"))
TOP_BAND = "critical"


@dataclass(frozen=True)
class Reading:
    """A value a provider actually returned."""

    value: float
    observed_at: datetime
    provider: str
    source_url: str
    quality: str = "modelled"
    detail: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class Missing:
    """A parameter with no usable value, and why."""

    reason: str


@dataclass(frozen=True)
class ParameterAssessment:
    key: str
    label: str
    unit: str
    weight: float
    value: float | None
    score: float | None
    status: str
    note: str
    reason: str | None = None
    observed_at: datetime | None = None
    provider: str | None = None
    source_url: str | None = None
    quality: str | None = None
    detail: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class RiskAssessment:
    facility_id: str
    score: float | None
    band: str
    coverage: float
    available_weight: float
    parameters: tuple[ParameterAssessment, ...]
    generated_at: datetime
    score_version: str = SCORE_VERSION
    confidence: str = "low"
    notes: tuple[str, ...] = ()


def band_for(score: float | None) -> str:
    if score is None:
        return "unknown"
    for ceiling, name in BANDS:
        if score < ceiling:
            return name
    return TOP_BAND


def interpolate_risk(parameter: ParameterSpec, value: float) -> float:
    """Piecewise-linear risk for ``value``, clamped to the curve's ends."""
    curve = parameter.curve
    if value <= curve[0].value:
        return curve[0].risk
    if value >= curve[-1].value:
        return curve[-1].risk
    for left, right in zip(curve, curve[1:]):
        if left.value <= value <= right.value:
            span = right.value - left.value
            if span <= 0:
                return right.risk
            ratio = (value - left.value) / span
            return left.risk + ratio * (right.risk - left.risk)
    return curve[-1].risk  # pragma: no cover - unreachable for a sorted curve


def _confidence(coverage: float) -> str:
    if coverage >= 0.85:
        return "high"
    if coverage >= 0.6:
        return "medium"
    return "low"


def assess(
    facility_id: str,
    readings: Mapping[str, Reading | Missing],
    generated_at: datetime,
    *,
    extra_notes: tuple[str, ...] = (),
) -> RiskAssessment:
    """Score every parameter that has a value and report the rest as missing."""
    parameters: list[ParameterAssessment] = []
    weighted_total = 0.0
    available_weight = 0.0

    for spec in PARAMETERS:
        reading = readings.get(spec.key)
        if reading is None:
            parameters.append(
                ParameterAssessment(
                    key=spec.key, label=spec.label, unit=spec.unit, weight=spec.weight,
                    value=None, score=None, status="UNAVAILABLE", note=spec.note,
                    reason="No provider is configured for this parameter.",
                )
            )
            continue
        if isinstance(reading, Missing):
            parameters.append(
                ParameterAssessment(
                    key=spec.key, label=spec.label, unit=spec.unit, weight=spec.weight,
                    value=None, score=None, status="UNAVAILABLE", note=spec.note,
                    reason=reading.reason,
                )
            )
            continue
        if not math.isfinite(reading.value):
            parameters.append(
                ParameterAssessment(
                    key=spec.key, label=spec.label, unit=spec.unit, weight=spec.weight,
                    value=None, score=None, status="UNAVAILABLE", note=spec.note,
                    reason="The provider returned a non-finite value.",
                )
            )
            continue

        score = round(interpolate_risk(spec, reading.value), 1)
        weighted_total += score * spec.weight
        available_weight += spec.weight
        parameters.append(
            ParameterAssessment(
                key=spec.key, label=spec.label, unit=spec.unit, weight=spec.weight,
                value=reading.value, score=score, status="AVAILABLE", note=spec.note,
                observed_at=reading.observed_at, provider=reading.provider,
                source_url=reading.source_url, quality=reading.quality,
                detail=dict(reading.detail),
            )
        )

    coverage = available_weight / TOTAL_WEIGHT
    score = round(weighted_total / available_weight, 1) if available_weight else None
    notes = [
        "Screening risk from public provider context, not an on-site measurement or a compliance determination.",
        f"Score is a weight-normalised mean over {int(round(coverage * 100))}% of the parameter weight.",
        *extra_notes,
    ]
    return RiskAssessment(
        facility_id=facility_id,
        score=score,
        band=band_for(score),
        coverage=round(coverage, 4),
        available_weight=round(available_weight, 4),
        parameters=tuple(parameters),
        generated_at=generated_at,
        confidence=_confidence(coverage),
        notes=tuple(notes),
    )
