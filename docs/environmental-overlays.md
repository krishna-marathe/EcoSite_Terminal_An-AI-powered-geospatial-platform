# Environmental overlays — Phase 01C.4

## Rendered demo inventory

All coordinates and feature properties remain bundled illustrations, not validated
observations. Feature counts describe the fixture, not current measurements.

| Store toggle | Source | Layer prefix | Features |
| --- | --- | --- | --- |
| env-groundwater-stress | src-gw-stress | layer-gw-stress | 5 |
| env-air-quality | src-air-quality | layer-air-quality | 2 |
| env-surface-temp | src-heat-anomaly | layer-heat-anomaly | 2 |
| env-flood-susceptibility | src-flood-hazard | layer-flood-hazard | 2 |
| env-protected-areas | src-protected-areas | layer-protected-areas | 2 |
| layer-transmission-lines | src-transmission-grid | layer-transmission-grid | 4 |

Each prefix has -fill and -line layers except transmission, which has only -line:
six sources and eleven layers. Demo settings control visibility/opacity. API mode
removes these layers before their sources. Mode changes never reconstruct the map.
One style.load handler consults current store state, including changes made while
the style was loading. Retry uses that same handler. The load handler and settings
effect use the same reconciliation path. Source guards prevent duplicate creation.

LULC, population density and the four predictive catalogue entries have no renderer;
they remain unavailable rather than claiming connected observations or models.
Infrastructure point markers continue to use the currently loaded facility records.
The ribbon is a set of twelve facility filters, not twelve environmental layers.
Its counts now describe matching records; the filtering criteria are unchanged.
Sidebar metadata identifies bundled geometry as synthetic, removes inherited
provider/date/confidence claims from displayed metadata, and disables unavailable
controls without erasing user settings. Facility provenance stays per record.

## Environmental data states

- DEMO_SYNTHETIC: bundled illustrative geometry, enabled only in Demo Mode.
- API_UNAVAILABLE: no suitable connected observation. This is the current API map state.
- API_SYNTHETIC: an available API record explicitly marked synthetic; never verified
  merely because it was transported through an API.
- SOURCE_BACKED: observed/estimated record with provider, source URL, publication
  date and spatial-resolution metadata. This describes attribution, not official
  verification. The classifier does not authorize rendering on its own.

The current backend environmental-layers endpoint returns cpcb-air-quality,
bhuvan-land-use, bhuvan-flood-hazard and cgwb-groundwater. All four explicitly have
isAvailable=false and dataStatus=unavailable; none contains observation geometry.
Provider links there are reference metadata, not proof that datasets were loaded.
There is no frontend environmental observation connector. No source-backed layer
is created in this checkpoint. API facility records may still be synthetic, and
banners retain their individual status labels. Reports include the environmental
state/message and retain unknown measurements as null.

## Future connector requirements (not implemented)

A future connector must supply explicit availability/status, provider and dataset
identity, source URL, observation/publication times, spatial coverage/resolution,
and validated geometry/CRS with units and methodology. It must reject insufficient
metadata or geometry, distinguish estimated from observed and synthetic values,
and define fetch cancellation, refresh/version handling and per-city coverage.
It must not reuse bundled geometry when an API observation is missing. No registry,
provider integration, dataset version or coverage claim is introduced here.

Live WebGL, network tile providers and browser visual layout were not exercised;
component tests mock MapLibre while enforcing source/layer uniqueness and safe
removal order. Existing marker, security, saved-context and CSV tests also run.
