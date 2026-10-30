import React, { useState } from 'react';
import {
  calculateEnergyWaterScenario,
  COOLING_PROFILES,
  type CoolingArchitecture,
} from '../../domain/scenarios';
import { Card } from '../ui/Card';

interface ScenarioCalculatorProps {
  initialItMw?: number;
  initialParcelAreaHa?: number;
  siteName?: string;
}

export function EnergyWaterScenarioCalculator({
  initialItMw = 40,
  initialParcelAreaHa = 15,
  siteName,
}: ScenarioCalculatorProps) {
  const [itMw, setItMw] = useState<number>(initialItMw);
  const [capacityFactor, setCapacityFactor] = useState<number>(0.8);
  const [coolingArch, setCoolingArch] = useState<CoolingArchitecture>('EVAPORATIVE_HYBRID');
  const [customPue, setCustomPue] = useState<string>('');
  const parcelHa = initialParcelAreaHa;
  const [showFormulas, setShowFormulas] = useState(false);

  const scenario = calculateEnergyWaterScenario({
    it_capacity_mw: itMw,
    capacity_factor: capacityFactor,
    cooling_architecture: coolingArch,
    custom_pue: customPue ? Number(customPue) : undefined,
    parcel_area_ha: parcelHa,
  });

  return (
    <Card
      title="Energy & Water Scenario Exploration (OpenDC-LCA Physics)"
      subtitle={
        siteName
          ? `Grounded engineering scenarios for ${siteName} · Sensitivity & On-Site Rainwater Offset`
          : 'Grounded engineering scenarios · Sensitivity & On-Site Rainwater Offset'
      }
      status="SCENARIO_PROJECTION"
    >
      <div className="space-y-5">
        {/* Epistemic Honesty Banner */}
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p className="font-semibold uppercase tracking-wider text-[11px] text-amber-400">
            ⚠️ Hypothetical Exploratory Scenarios — Not Binding Sanctions
          </p>
          <p className="mt-1 leading-relaxed">
            All values are deterministic engineering scenario calculations for cooling options and resource sensitivity.
            They <strong>must never</strong> be cited as official utility interconnection sanctions, DISCOM capacity allocations, or certified operating PUE.
          </p>
        </div>

        {/* Input Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* IT Load */}
          <div className="rounded border border-eco-border bg-eco-surface-2 p-3 space-y-1.5">
            <label className="text-eco-muted font-medium block">
              IT Capacity (MW)
            </label>
            <input
              type="number"
              min={1}
              max={500}
              step={5}
              value={itMw}
              onChange={(e) => setItMw(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded border border-eco-border bg-eco-surface p-1.5 font-mono text-sm text-slate-100"
            />
            <span className="text-[10px] text-eco-muted block">
              Campus IT design ceiling
            </span>
          </div>

          {/* Cooling Architecture */}
          <div className="rounded border border-eco-border bg-eco-surface-2 p-3 space-y-1.5">
            <label className="text-eco-muted font-medium block">
              Cooling Architecture
            </label>
            <select
              value={coolingArch}
              onChange={(e) => {
                setCoolingArch(e.target.value as CoolingArchitecture);
                setCustomPue('');
              }}
              className="w-full rounded border border-eco-border bg-eco-surface p-1.5 text-xs text-slate-100"
            >
              <option value="EVAPORATIVE_HYBRID">Evaporative Hybrid Towers</option>
              <option value="AIR_COOLED_DRY">Air-Cooled with Economizers</option>
              <option value="LIQUID_DLC">Direct-to-Chip Liquid (DLC)</option>
              <option value="IMMERSION_COOLING">Immersion Cooling</option>
            </select>
            <span className="text-[10px] text-eco-muted block">
              WUE: {scenario.wue_liters_per_kwh} L/kWh
            </span>
          </div>

          {/* Capacity Factor */}
          <div className="rounded border border-eco-border bg-eco-surface-2 p-3 space-y-1.5">
            <label className="text-eco-muted font-medium flex justify-between">
              <span>Capacity Factor</span>
              <span className="font-mono text-slate-200">{(capacityFactor * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={1.0}
              step={0.05}
              value={capacityFactor}
              onChange={(e) => setCapacityFactor(Number(e.target.value))}
              className="w-full accent-eco-primary"
            />
            <span className="text-[10px] text-eco-muted block">
              Steady-state IT utilization
            </span>
          </div>

          {/* PUE Custom Override */}
          <div className="rounded border border-eco-border bg-eco-surface-2 p-3 space-y-1.5">
            <label className="text-eco-muted font-medium flex justify-between">
              <span>Design PUE</span>
              <span className="font-mono text-emerald-400 font-bold">{scenario.effective_pue}</span>
            </label>
            <input
              type="number"
              min={1.05}
              max={2.0}
              step={0.01}
              placeholder={String(COOLING_PROFILES[coolingArch].defaultPue)}
              value={customPue}
              onChange={(e) => setCustomPue(e.target.value)}
              className="w-full rounded border border-eco-border bg-eco-surface p-1.5 font-mono text-sm text-slate-100"
            />
            <span className="text-[10px] text-eco-muted block">
              Default: {COOLING_PROFILES[coolingArch].defaultPue}
            </span>
          </div>
        </div>

        {/* Results Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Energy Projections */}
          <div className="rounded border border-eco-border bg-eco-surface-2/40 p-4 space-y-3">
            <div className="flex justify-between items-center border-b border-eco-border pb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <span>⚡</span> Annual Energy Demand Decomposition
              </h4>
              <span className="text-xs font-mono text-eco-primary font-bold">
                PUE {scenario.effective_pue}
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-eco-muted">Useful IT Energy (E_IT):</span>
                <span className="text-slate-100 font-bold">
                  {scenario.annual_it_energy_mwh.toLocaleString()} MWh/yr
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-eco-muted">Cooling & Electrical Overhead:</span>
                <span className="text-amber-400">
                  +{scenario.annual_overhead_energy_mwh.toLocaleString()} MWh/yr
                </span>
              </div>
              <div className="flex justify-between border-t border-eco-border/60 pt-1.5 font-semibold">
                <span className="text-slate-300">Total Facility Energy (E_fac):</span>
                <span className="text-emerald-400 text-sm">
                  {scenario.annual_facility_energy_mwh.toLocaleString()} MWh/yr
                </span>
              </div>
            </div>

            <div className="rounded bg-eco-surface p-2 text-[11px] border border-eco-border/40 text-eco-muted">
              <strong>Sensitivity Range:</strong> Ambient temperature fluctuation [PUE {scenario.sensitivity.pue_min} – {scenario.sensitivity.pue_max}] yields{' '}
              <span className="font-mono text-slate-200">
                {scenario.sensitivity.facility_energy_min_mwh.toLocaleString()} – {scenario.sensitivity.facility_energy_max_mwh.toLocaleString()} MWh/yr
              </span>.
            </div>
          </div>

          {/* Water Projections */}
          <div className="rounded border border-eco-border bg-eco-surface-2/40 p-4 space-y-3">
            <div className="flex justify-between items-center border-b border-eco-border pb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <span>💧</span> Water Consumption & Rainwater Offset
              </h4>
              <span className="text-xs font-mono text-sky-400 font-bold">
                WUE {scenario.wue_liters_per_kwh} L/kWh
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-eco-muted">Annual Water Volume:</span>
                <span className="text-slate-100 font-bold">
                  {scenario.annual_water_consumption_m3.toLocaleString()} m³/yr
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-eco-muted">Average Daily Demand:</span>
                <span className="text-sky-300 font-bold">
                  {scenario.daily_average_water_kld.toLocaleString()} KLD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-eco-muted">Peak Summer Surge (1.45×):</span>
                <span className="text-amber-400 font-bold">
                  {scenario.peak_summer_water_kld.toLocaleString()} KLD
                </span>
              </div>
              <div className="flex justify-between border-t border-eco-border/60 pt-1.5">
                <span className="text-slate-300">On-Site Rainwater Harvesting:</span>
                <span className="text-emerald-400 font-bold">
                  +{scenario.rainwater_harvest_potential_kld} KLD ({scenario.rainwater_offset_percentage}% offset)
                </span>
              </div>
            </div>

            <div className="rounded bg-eco-surface p-2 text-[11px] border border-eco-border/40 text-eco-muted">
              <strong>Peak Summer Deficit Sensitivity:</strong> Summer wet-bulb spike range is{' '}
              <span className="font-mono text-slate-200">
                {scenario.sensitivity.daily_water_min_kld.toLocaleString()} – {scenario.sensitivity.daily_water_max_kld.toLocaleString()} KLD
              </span>.
            </div>
          </div>
        </div>

        {/* Explainable Formulas and Scientific Assumptions Toggle */}
        <div className="border-t border-eco-border pt-2">
          <button
            type="button"
            onClick={() => setShowFormulas(!showFormulas)}
            className="text-xs text-eco-primary hover:underline flex items-center gap-1 font-medium"
          >
            <span>{showFormulas ? '▾ Hide' : '▸ Show'} Explainable Formulas & Scientific Assumptions</span>
          </button>

          {showFormulas && (
            <div className="mt-3 rounded border border-eco-border bg-eco-surface-2 p-3 space-y-3 text-xs">
              <div>
                <p className="font-semibold text-slate-200 text-[11px] uppercase tracking-wider mb-1.5">
                  Mathematical Formulas (OpenDC-LCA & BIS IS 15797:2008):
                </p>
                <div className="space-y-1 font-mono text-[11px] text-emerald-300/90 bg-slate-950/70 p-2.5 rounded border border-slate-800">
                  <p>• {scenario.formulas.it_energy}</p>
                  <p>• {scenario.formulas.facility_energy}</p>
                  <p>• {scenario.formulas.water_consumption}</p>
                  <p>• {scenario.formulas.rwh_potential}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-200 text-[11px] uppercase tracking-wider mb-1">
                  Engineered Modeling Assumptions:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-eco-muted text-[11px]">
                  {scenario.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

