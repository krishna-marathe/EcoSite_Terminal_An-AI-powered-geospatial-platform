/**
 * EcoSite India — Explainable Rule-Based Site Constraints Engine
 *
 * Implements deterministic hard eligibility gates and environmental screening rules
 * adhering to Loadstar/CERF research principles and the EcoSite external reuse matrix.
 *
 * Epistemic Rules:
 * 1. Missing or unverified data evaluates to UNKNOWN, never zero risk or synthetic safety.
 * 2. Substation proximity does NOT equate to available grid MW or dedicated feeder sanction.
 * 3. Every rule outcome explicitly reports its input value, threshold, rationale, and authoritative source.
 */

import type { CandidateSite } from '../services/projects';
import type { Observation } from '../services/observations';
import type { Assertion } from '../types/evidence';

export type ConstraintStatus = 'BLOCKED' | 'ATTENTION_REQUIRED' | 'CLEAR' | 'UNKNOWN';

export interface SiteConstraintRuleResult {
  rule_id: string;
  rule_name: string;
  category: 'SPATIAL_BOUNDARY' | 'SURFACE_WATER_FLOOD' | 'POWER_HEADROOM' | 'WATER_DEFICIT' | 'CLIMATE_HEAT';
  status: ConstraintStatus;
  input_value: string;
  threshold: string;
  rationale: string;
  source: string;
  mandatory_gate: boolean;
}

export interface SiteConstraintsEvaluation {
  site_id: string;
  site_name: string;
  overall_status: ConstraintStatus;
  blocked_count: number;
  attention_count: number;
  clear_count: number;
  unknown_count: number;
  rules: SiteConstraintRuleResult[];
}

export function evaluateSiteConstraints(
  site: CandidateSite,
  observations: Observation[] = [],
  assertions: Assertion[] = []
): SiteConstraintsEvaluation {
  const rules: SiteConstraintRuleResult[] = [];

  // --------------------------------------------------------------------------
  // Rule 1: Focus State ADM1 Boundary Screening Gate (Mandatory Hard Gate)
  // --------------------------------------------------------------------------
  const boundaryStatus = site.boundary_screening?.status;
  if (!boundaryStatus) {
    rules.push({
      rule_id: 'GATE-01-SPATIAL',
      rule_name: 'Focus State ADM1 Screening Boundary',
      category: 'SPATIAL_BOUNDARY',
      status: 'UNKNOWN',
      input_value: 'Unscreened boundary',
      threshold: 'inside_screening_boundary',
      rationale: 'Parcel boundary screening has not been validated against the focus state ADM1 polygon dataset.',
      source: site.boundary_source || 'geoBoundaries IND ADM1 screening layer',
      mandatory_gate: true,
    });
  } else if (boundaryStatus !== 'inside_screening_boundary') {
    rules.push({
      rule_id: 'GATE-01-SPATIAL',
      rule_name: 'Focus State ADM1 Screening Boundary',
      category: 'SPATIAL_BOUNDARY',
      status: 'BLOCKED',
      input_value: boundaryStatus,
      threshold: 'inside_screening_boundary',
      rationale: 'Candidate parcel extends outside or intersects the focus state boundary. Pre-investment siting cannot proceed without Survey of India boundary verification.',
      source: site.boundary_source || 'geoBoundaries IND ADM1 screening layer',
      mandatory_gate: true,
    });
  } else {
    rules.push({
      rule_id: 'GATE-01-SPATIAL',
      rule_name: 'Focus State ADM1 Screening Boundary',
      category: 'SPATIAL_BOUNDARY',
      status: 'CLEAR',
      input_value: 'Inside screening boundary',
      threshold: 'inside_screening_boundary',
      rationale: 'Parcel is fully enclosed within the pinned state screening boundary (screening only; non-legal).',
      source: site.boundary_source || 'geoBoundaries IND ADM1 screening layer',
      mandatory_gate: true,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 2: Permanent Surface Water & Flood Plain Gate
  // --------------------------------------------------------------------------
  const waterObs = observations.find(
    (o) => o.indicator === 'historical_water_occurrence_overlap_fraction'
  );

  if (!waterObs || waterObs.status === 'SOURCE_UNAVAILABLE' || waterObs.value === null) {
    rules.push({
      rule_id: 'GATE-02-WATER-OCCURRENCE',
      rule_name: 'Historical Surface Water Overlap',
      category: 'SURFACE_WATER_FLOOD',
      status: 'UNKNOWN',
      input_value: 'No observation recorded',
      threshold: '≤ 1.0% overlap',
      rationale: 'JRC Global Surface Water connector was not run or returned no valid data. Missing water data is treated as UNKNOWN risk, never zero flood probability.',
      source: 'European Commission Joint Research Centre (JRC GSW v1.5)',
      mandatory_gate: true,
    });
  } else {
    const overlapPct = waterObs.value * 100;
    if (overlapPct > 5.0) {
      rules.push({
        rule_id: 'GATE-02-WATER-OCCURRENCE',
        rule_name: 'Historical Surface Water Overlap',
        category: 'SURFACE_WATER_FLOOD',
        status: 'BLOCKED',
        input_value: `${overlapPct.toFixed(2)}% parcel overlap`,
        threshold: '≤ 5.0% overlap',
        rationale: `Parcel contains significant historical permanent or semi-permanent surface water (${overlapPct.toFixed(1)}%). Violates dry-parcel data centre siting constraints.`,
        source: 'JRC GSW v1.5 (1984-2024 Landsat 30m composite)',
        mandatory_gate: true,
      });
    } else if (overlapPct > 0.1) {
      rules.push({
        rule_id: 'GATE-02-WATER-OCCURRENCE',
        rule_name: 'Historical Surface Water Overlap',
        category: 'SURFACE_WATER_FLOOD',
        status: 'ATTENTION_REQUIRED',
        input_value: `${overlapPct.toFixed(2)}% parcel overlap`,
        threshold: '≤ 0.1% overlap',
        rationale: `Seasonal or ephemeral water occurrence (${overlapPct.toFixed(2)}%) detected inside parcel. Requires on-site topographical drainage and flood mitigation study.`,
        source: 'JRC GSW v1.5 (1984-2024 Landsat 30m composite)',
        mandatory_gate: false,
      });
    } else {
      rules.push({
        rule_id: 'GATE-02-WATER-OCCURRENCE',
        rule_name: 'Historical Surface Water Overlap',
        category: 'SURFACE_WATER_FLOOD',
        status: 'CLEAR',
        input_value: `${overlapPct.toFixed(2)}% parcel overlap`,
        threshold: '≤ 0.1% overlap',
        rationale: 'Zero to negligible historical surface water occurrence detected within parcel boundary.',
        source: 'JRC GSW v1.5 (1984-2024 Landsat 30m composite)',
        mandatory_gate: true,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Rule 3: Substantiated Grid Delivery vs Proximity Gate
  // --------------------------------------------------------------------------
  const verifiedPower = assertions.filter(
    (a) =>
      (a.field_key === 'sanctioned_grid_mw' || a.field_key === 'power_sanctioned_mw') &&
      a.status === 'VERIFIED_WITHIN_SCOPE'
  );
  const totalVerifiedMw = verifiedPower.reduce((sum, a) => sum + (Number(a.value) || 0), 0);

  if (verifiedPower.length === 0 || totalVerifiedMw === 0) {
    rules.push({
      rule_id: 'GATE-03-POWER-SANCTION',
      rule_name: 'Grid Headroom & Sanction Verification',
      category: 'POWER_HEADROOM',
      status: 'ATTENTION_REQUIRED',
      input_value: `${totalVerifiedMw} MW Verified Delivery`,
      threshold: '≥ 1 Verified Utility Sanction',
      rationale: 'Substation proximity does NOT establish spare grid capacity or line headroom. Siting is unbacked without an authoritative STU/DISCOM feasibility sanction.',
      source: 'Central Electricity Authority & State Utility Grid Regulations',
      mandatory_gate: false,
    });
  } else {
    rules.push({
      rule_id: 'GATE-03-POWER-SANCTION',
      rule_name: 'Grid Headroom & Sanction Verification',
      category: 'POWER_HEADROOM',
      status: 'CLEAR',
      input_value: `${totalVerifiedMw} MW Verified Delivery`,
      threshold: '≥ 1 Verified Utility Sanction',
      rationale: `Site has ${verifiedPower.length} third-party or reviewer-verified utility commitment(s) totaling ${totalVerifiedMw} MW firm delivery.`,
      source: 'Official Utility Feasibility / Sanction Letter',
      mandatory_gate: false,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 4: Water Supply Deficit & Allocation Gate
  // --------------------------------------------------------------------------
  const waterAssertions = assertions.filter(
    (a) => a.field_key === 'water_allocation_kld' || a.field_key === 'evidenced_water_supply_kld'
  );
  const verifiedWater = waterAssertions.filter((a) => a.status === 'VERIFIED_WITHIN_SCOPE');
  const conflictingWater = waterAssertions.filter((a) => a.status === 'CONFLICTING');

  if (conflictingWater.length > 0) {
    rules.push({
      rule_id: 'GATE-04-WATER-DELIVERABILITY',
      rule_name: 'Water Supply Entitlement & Allocation',
      category: 'WATER_DEFICIT',
      status: 'ATTENTION_REQUIRED',
      input_value: `${conflictingWater.length} conflicting water claims`,
      threshold: 'Unconflicted allocation record',
      rationale: 'Contradictory water demand or allocation assertions exist across submitted project documents. Resolution required before passport sign-off.',
      source: 'Project Evidence Ledger (DPR vs Authority Sanctions)',
      mandatory_gate: false,
    });
  } else if (waterAssertions.length === 0) {
    rules.push({
      rule_id: 'GATE-04-WATER-DELIVERABILITY',
      rule_name: 'Water Supply Entitlement & Allocation',
      category: 'WATER_DEFICIT',
      status: 'UNKNOWN',
      input_value: 'Zero water evidence submitted',
      threshold: 'Documented Municipal/MIDC Allocation',
      rationale: 'No municipal, industrial, or groundwater allocation document has been uploaded. Water availability is completely UNKNOWN.',
      source: 'Project Evidence Ledger',
      mandatory_gate: false,
    });
  } else if (verifiedWater.length === 0) {
    rules.push({
      rule_id: 'GATE-04-WATER-DELIVERABILITY',
      rule_name: 'Water Supply Entitlement & Allocation',
      category: 'WATER_DEFICIT',
      status: 'ATTENTION_REQUIRED',
      input_value: 'Documented but unverified',
      threshold: 'Verified water allocation sanction',
      rationale: 'Water supply allocation is documented but has not undergone formal third-party or simulated verification.',
      source: 'Submitted Water Authority Evidence',
      mandatory_gate: false,
    });
  } else {
    const totalWaterKld = verifiedWater.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
    rules.push({
      rule_id: 'GATE-04-WATER-DELIVERABILITY',
      rule_name: 'Water Supply Entitlement & Allocation',
      category: 'WATER_DEFICIT',
      status: 'CLEAR',
      input_value: `${totalWaterKld} KLD Verified Allocation`,
      threshold: 'Verified water allocation sanction',
      rationale: `Verified industrial water allocation of ${totalWaterKld} KLD substantiated by authority documentation.`,
      source: 'Verified Water Allocation Sanction',
      mandatory_gate: false,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 5: Extreme Ambient Heat Envelope
  // --------------------------------------------------------------------------
  const tempMaxObs = observations.find((o) => o.indicator === 'ambient_temperature_max_c');

  if (!tempMaxObs || tempMaxObs.value === null || tempMaxObs.status === 'SOURCE_UNAVAILABLE') {
    rules.push({
      rule_id: 'GATE-05-HEAT-ENVELOPE',
      rule_name: 'Maximum Ambient Heat Envelope',
      category: 'CLIMATE_HEAT',
      status: 'UNKNOWN',
      input_value: 'No temperature observation',
      threshold: '< 45.0°C maximum daily temperature',
      rationale: 'NASA POWER climate reanalysis connector was not run. Extreme ambient heat exposure is UNKNOWN.',
      source: 'NASA POWER Daily Meteorology (MERRA-2 reanalysis)',
      mandatory_gate: false,
    });
  } else if (tempMaxObs.value >= 45.0) {
    rules.push({
      rule_id: 'GATE-05-HEAT-ENVELOPE',
      rule_name: 'Maximum Ambient Heat Envelope',
      category: 'CLIMATE_HEAT',
      status: 'ATTENTION_REQUIRED',
      input_value: `${tempMaxObs.value.toFixed(1)}°C max ambient`,
      threshold: '< 45.0°C maximum daily temperature',
      rationale: `Maximum ambient temperature reaches ${tempMaxObs.value.toFixed(1)}°C, exceeding standard air-cooled chiller dry-bulb design thresholds. High risk of thermal derating and elevated summer PUE.`,
      source: 'NASA POWER Daily Meteorology (MERRA-2 reanalysis)',
      mandatory_gate: false,
    });
  } else {
    rules.push({
      rule_id: 'GATE-05-HEAT-ENVELOPE',
      rule_name: 'Maximum Ambient Heat Envelope',
      category: 'CLIMATE_HEAT',
      status: 'CLEAR',
      input_value: `${tempMaxObs.value.toFixed(1)}°C max ambient`,
      threshold: '< 45.0°C maximum daily temperature',
      rationale: `Maximum daily ambient temperature (${tempMaxObs.value.toFixed(1)}°C) falls within standard datacenter mechanical chiller design envelope.`,
      source: 'NASA POWER Daily Meteorology (MERRA-2 reanalysis)',
      mandatory_gate: false,
    });
  }

  // --------------------------------------------------------------------------
  // Overall Evaluation Synthesis
  // --------------------------------------------------------------------------
  const blockedCount = rules.filter((r) => r.status === 'BLOCKED').length;
  const attentionCount = rules.filter((r) => r.status === 'ATTENTION_REQUIRED').length;
  const unknownCount = rules.filter((r) => r.status === 'UNKNOWN').length;
  const clearCount = rules.filter((r) => r.status === 'CLEAR').length;

  let overallStatus: ConstraintStatus = 'CLEAR';
  if (blockedCount > 0) {
    overallStatus = 'BLOCKED';
  } else if (attentionCount > 0) {
    overallStatus = 'ATTENTION_REQUIRED';
  } else if (unknownCount > 0) {
    overallStatus = 'UNKNOWN';
  }

  return {
    site_id: site.id,
    site_name: site.name,
    overall_status: overallStatus,
    blocked_count: blockedCount,
    attention_count: attentionCount,
    clear_count: clearCount,
    unknown_count: unknownCount,
    rules,
  };
}

