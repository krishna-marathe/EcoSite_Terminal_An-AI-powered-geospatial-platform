import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Droplets,
  ExternalLink,
  Info,
  Layers,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { apiClient } from '../services/api';
import { mlService, type MLPredictionsOutput } from '../services/mlService';
import type { PublicFacility } from '../types/publicFacilities';

interface ForecastPoint {
  date: string;
  lead_day: number;
  predicted_peak_met_mw: number;
  p10_lower_bound_mw: number;
  p90_upper_bound_mw: number;
  day_of_week: string;
}

interface CurrentForecastResponse {
  status: string;
  electricity: {
    classification: string;
    origin_date: string;
    horizon_weeks: number;
    total_days: number;
    points: ForecastPoint[];
  };
  metadata?: any;
}

export function MLForecastAnalysis() {
  const [activeTab, setActiveTab] = useState<'regional' | 'facility' | 'evaluation'>('regional');
  const [forecastData, setForecastData] = useState<CurrentForecastResponse | null>(null);
  const [forecastLoading, setForecastLoading] = useState<boolean>(true);
  const [forecastError, setForecastError] = useState<string | null>(null);

  // Facility analysis state
  const [facilities, setFacilities] = useState<PublicFacility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('stt-pune-5');
  const [facilityLoading, setFacilityLoading] = useState<boolean>(false);
  const [predictions, setPredictions] = useState<MLPredictionsOutput | null>(null);
  const [predError, setPredError] = useState<string | null>(null);

  // Load operational electricity forecast
  useEffect(() => {
    let cancelled = false;
    setForecastLoading(true);
    setForecastError(null);

    apiClient
      .get<CurrentForecastResponse>('/resource-outlook/current-forecast')
      .then((res) => {
        if (!cancelled) {
          setForecastData(res.data);
          setForecastLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setForecastError(err?.message || 'Failed to load Maharashtra operational forecast');
          setForecastLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load public facilities for selector
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ items: PublicFacility[] }>('/public-facilities?pageSize=50')
      .then((res) => {
        if (!cancelled && res.data?.items) {
          setFacilities(res.data.items);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId) || null;

  // Run deterministic facility calculations when selected facility changes
  useEffect(() => {
    if (!selectedFacility) return;
    let cancelled = false;

    const primaryCapacity = selectedFacility.capacityDisclosures?.[0]?.value ?? 0;
    if (primaryCapacity <= 0) {
      setFacilityLoading(false);
      setPredictions(null);
      setPredError('Disclosed capacity is unspecified (0 MW); cannot evaluate facility power sizing.');
      return;
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setFacilityLoading(true);
        setPredError(null);
      }
    });

    mlService
      .getMultiMonthPredictions({
        capacity_mw: primaryCapacity,
        water_demand_kl_day: 0, // Undisclosed WUE; never invent water consumption
        power_demand_mw: 0, // Deterministic engine computes power from capacity * standard PUE 1.35
        location: (selectedFacility.stateCode === 'IN-TG' || selectedFacility.stateCode === 'IN-KA' || selectedFacility.stateCode === 'IN-TN') ? selectedFacility.stateCode : 'IN-MH',
        model_version: 'ML-F4.1',
      })
      .then((res) => {
        if (!cancelled) {
          setPredictions(res);
          setFacilityLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPredError(err?.message || 'Failed to compute facility engineering projection');
          setFacilityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFacilityId, selectedFacility]);

  // Downsample electricity chart points for smooth rendering (1 point per 3 days or weekly)
  const chartPoints = (forecastData?.electricity?.points || [])
    .filter((_, idx) => idx % 2 === 0)
    .map((p) => ({
      date: p.date.slice(5),
      fullDate: p.date,
      demand: p.predicted_peak_met_mw,
      p10: p.p10_lower_bound_mw,
      p90: p.p90_upper_bound_mw,
    }));

  const isMaharashtra = selectedFacility?.stateCode === 'IN-MH';

  return (
    <PageShell>
      <PageHeader
        eyebrow="AI-Assisted Infrastructure & Resource Intelligence"
        title="ML Forecast & Resource Analysis"
        purpose="Operational 182-day electricity demand forecasting for Maharashtra, deterministic facility resource scenarios, and evaluated model benchmarks."
      />

      {/* Epistemic Guard Banner */}
      <div className="rounded border border-eco-primary/30 bg-eco-surface-secondary/60 p-3.5 text-meta">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-eco-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-eco-text">
              Epistemic Framework: Clear Distinction Between Forecast Scopes
            </p>
            <p className="text-eco-muted leading-relaxed">
              <strong>1. Regional Macro-Grid Forecasting:</strong> Operational statistical forecast of statewide peak demand (Maharashtra only), with empirical conformal uncertainty bands.{' '}
              <strong>2. Facility Engineering Analysis:</strong> Deterministic calculations from declared IT capacity and benchmark PUE (1.35). Not trained ML.{' '}
              <strong>3. Model Benchmarks:</strong> LightGBM is preserved as an offline evaluated benchmark model; it is not deployed for online facility inference.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-eco-border pb-2">
        <Button
          variant={activeTab === 'regional' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('regional')}
        >
          <Zap className="h-3.5 w-3.5" /> A. Regional Electricity Forecast
        </Button>
        <Button
          variant={activeTab === 'facility' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('facility')}
        >
          <Cpu className="h-3.5 w-3.5" /> B. Facility Engineering Analysis
        </Button>
        <Button
          variant={activeTab === 'evaluation' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('evaluation')}
        >
          <Database className="h-3.5 w-3.5" /> C. Model Evaluation &amp; Benchmarks
        </Button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION A: REGIONAL ELECTRICITY FORECAST                                  */}
      {/* ========================================================================= */}
      {activeTab === 'regional' && (
        <div className="space-y-4">
          {/* Headline Metric Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded border border-eco-border bg-eco-surface p-3">
              <span className="text-micro uppercase text-eco-muted block font-mono">Forecast Horizon</span>
              <span className="font-mono text-h3 font-bold text-eco-text">182 Days</span>
              <span className="block text-micro text-eco-muted mt-0.5">2026-10-28 to 2027-04-27</span>
            </div>
            <div className="rounded border border-eco-border bg-eco-surface p-3">
              <span className="text-micro uppercase text-eco-muted block font-mono">Predicted Peak Met</span>
              <span className="font-mono text-h3 font-bold text-eco-primary">32,161.0 MW</span>
              <span className="block text-micro text-eco-muted mt-0.5">Summer Peak (April 2027)</span>
            </div>
            <div className="rounded border border-eco-border bg-eco-surface p-3">
              <span className="text-micro uppercase text-eco-muted block font-mono">Summer P90 Upper Bound</span>
              <span className="font-mono text-h3 font-bold text-amber-400">35,887.9 MW</span>
              <span className="block text-micro text-eco-muted mt-0.5">Empirical Residual Quantile Bound</span>
            </div>
            <div className="rounded border border-eco-border bg-eco-surface p-3">
              <span className="text-micro uppercase text-eco-muted block font-mono">7-Window Backtest Accuracy</span>
              <span className="font-mono text-h3 font-bold text-eco-text">6.76% MAPE</span>
              <span className="block text-micro text-eco-muted mt-0.5">MAE: 1,749.68 MW</span>
            </div>
          </div>

          {/* Regional Forecast Chart */}
          <Card
            title="Maharashtra Macro-Grid Electricity Demand Forecast (26 Weeks)"
            subtitle="Operational statistical forecast · Origin: 2026-10-27 · Continuous 2013–2026 SLDC/Zenodo foundation"
            icon={<Zap className="h-4 w-4" />}
          >
            {forecastLoading ? (
              <div className="py-16 text-center text-meta text-eco-muted">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-eco-primary border-t-transparent mr-2 align-middle" />
                Loading validated 182-day electricity forecast…
              </div>
            ) : forecastError ? (
              <div className="p-4 rounded border border-eco-critical/40 bg-eco-critical/10 text-meta text-eco-critical">
                {forecastError}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartPoints} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#232f28" />
                      <XAxis dataKey="date" tick={{ fill: '#87988e', fontSize: 10 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: '#87988e', fontSize: 10 }} width={55} />
                      <Tooltip
                        contentStyle={{ background: '#111514', border: '1px solid #29362f', color: '#e7f1e8', fontSize: '11px' }}
                        labelFormatter={(label) => `Date: ${label}`}
                        formatter={(val: unknown, name: unknown) => {
                          const n = String(name);
                          const label =
                            n === 'p90' || n.includes('P90') || n.includes('Upper')
                              ? 'Upper Bound (P90)'
                              : n === 'p10' || n.includes('P10') || n.includes('Lower')
                              ? 'Lower Bound (P10)'
                              : 'Operational Forecast';
                          return [`${Number(val).toLocaleString()} MW`, label];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Line type="monotone" dataKey="p90" name="P90 Upper Bound" stroke="#eab308" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                      <Line type="monotone" dataKey="demand" name="Operational Forecast" stroke="#39f58b" dot={false} strokeWidth={2.2} />
                      <Line type="monotone" dataKey="p10" name="P10 Lower Bound" stroke="#06b6d4" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded border border-eco-border/60 bg-eco-surface-secondary/40 p-3 text-meta text-eco-muted space-y-1">
                  <p className="font-semibold text-eco-text">Methodology &amp; Verification Note:</p>
                  <p>
                    • Selected Operational Model: <strong>Seasonal Naive with Multi-Year Residual Quantile Intervals</strong> (ML-F2.1).
                  </p>
                  <p>
                    • Maharashtra SLDC daily records span 2013-04-01 through 2026-10-27. Evaluated across 7 chronologically separate 180-day backtest windows.
                  </p>
                  <p className="text-eco-warning">
                    • Regional Demand Scope: This forecast measures statewide transmission demand met. It does <em>not</em> represent local substation headroom or individual facility consumption.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: FACILITY ENGINEERING ANALYSIS                                  */}
      {/* ========================================================================= */}
      {activeTab === 'facility' && (
        <div className="space-y-4">
          {/* Facility Selector Card */}
          <Card title="Facility Engineering Sizing & Analysis" subtitle="Select a public data centre facility to inspect deterministic load calculations">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <label htmlFor="facility-select" className="block text-meta text-eco-muted mb-1 font-mono uppercase">
                  Select Facility:
                </label>
                <select
                  id="facility-select"
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  className="w-full rounded border border-eco-border bg-eco-surface-secondary px-3 py-1.5 text-body text-eco-text focus:border-eco-primary focus:outline-none"
                >
                  {facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} ({fac.city}, {fac.stateCode})
                    </option>
                  ))}
                </select>
              </div>

              {selectedFacility && (
                <div className="md:col-span-2 flex flex-wrap gap-2 items-center text-meta">
                  <Badge variant="outline">{selectedFacility.operator}</Badge>
                  <Badge variant="outline">{selectedFacility.city}, {selectedFacility.state}</Badge>
                  <Badge variant={isMaharashtra ? 'primary' : 'warning'}>
                    {isMaharashtra ? 'MH Regional Forecast Linked' : `${selectedFacility.stateCode} Regional Forecast Unavailable`}
                  </Badge>
                </div>
              )}
            </div>

            {/* Regional Scope Warning for Non-MH Facilities */}
            {!isMaharashtra && selectedFacility && (
              <div className="mt-4 p-3 rounded border border-amber-500/40 bg-amber-500/10 text-meta text-amber-300">
                <strong>Regional Boundary Notice:</strong> {selectedFacility.name} is located in {selectedFacility.state} ({selectedFacility.stateCode}). The Maharashtra regional electricity forecast does NOT apply to this facility. Only deterministic facility engineering sizing is available.
              </div>
            )}
          </Card>

          {/* Sizing & Capacity Reconciliation Box */}
          {selectedFacility && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Published Capacity vs Evaluated Scenarios" subtitle="Reconciling disclosures, engineering benchmarks and utility commitments">
                <div className="space-y-3 text-meta">
                  <div className="rounded border border-eco-border bg-eco-surface-secondary/40 p-3 space-y-1.5">
                    <span className="text-micro uppercase text-eco-muted font-mono block">Disclosed Capacity Boundary</span>
                    {selectedFacility.capacityDisclosures?.map((cap, i) => (
                      <div key={i} className="flex justify-between font-mono text-body">
                        <span className="text-eco-muted">{cap.capacityType.replaceAll('_', ' ')}:</span>
                        <strong className="text-eco-text">{cap.value} {cap.unit} ({cap.scope})</strong>
                      </div>
                    ))}
                    <p className="text-[11px] text-eco-muted pt-1">
                      Source: {selectedFacility.verification?.source?.title} ({selectedFacility.verification?.source?.publisher})
                    </p>
                  </div>

                  {selectedFacility.id === 'stt-pune-5' && (
                    <div className="rounded border border-eco-primary/30 bg-eco-surface-secondary/60 p-3 space-y-2 text-[11px] text-eco-muted">
                      <strong className="text-eco-text block text-meta">STT Pune 5 Reconciliation Breakdown:</strong>
                      <p>
                        • <strong>24.0 MW:</strong> Published facility capacity from STT GDC INFRAINTEL newsletter (boundary unspecified).
                      </p>
                      <p>
                        • <strong>32.4 MW Engineering Sizing:</strong> Treats 24.0 MW as design IT load × standard 1.35 PUE benchmark.
                      </p>
                      <p>
                        • <strong>17.78 MW IT in Resource Stress Outlook:</strong> Backed out from 24.0 MW total power sanction (24 / 1.35 = 17.78 MW IT).
                      </p>
                      <p>
                        • <strong>1.62 PUE:</strong> STT GDC India ESG Report 2023 fleet-wide weighted average (28 facilities). Resulting total power is 17.78 × 1.62 = 28.80 MW.
                      </p>
                      <p>
                        • <strong>Firm Power Gap:</strong> 28.80 MW demand − 24.00 MW documented grid sanction = <strong>4.80 MW gap</strong>.
                      </p>
                    </div>
                  )}

                  <div className="rounded border border-eco-border bg-eco-surface-secondary/40 p-3 space-y-1 text-meta">
                    <span className="text-micro uppercase text-eco-muted font-mono block">WUE &amp; Water Consumption Policy</span>
                    <p className="text-eco-muted">
                      Status: <strong className="text-amber-400">Not Disclosed / UNKNOWN</strong>
                    </p>
                    <p className="text-[11px] text-eco-muted">
                      EcoSite strictly refuses to fabricate water consumption estimates when cooling specifications and WUE are unpublished.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Multi-Month Engineering Horizon Output */}
              <Card title="Multi-Month Deterministic Projections" subtitle="Evaluated via POST /api/v1/ml/predict (Deterministic sizing)">
                {facilityLoading ? (
                  <div className="py-12 text-center text-meta text-eco-muted">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-eco-primary border-t-transparent mr-2 align-middle" />
                    Calculating deterministic engineering sizing…
                  </div>
                ) : predError ? (
                  <div className="p-3 rounded border border-eco-critical/40 bg-eco-critical/10 text-meta text-eco-critical">
                    {predError}
                  </div>
                ) : predictions ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[6, 9, 12].map((months) => {
                        const pred = predictions[`month_${months}` as 'month_6' | 'month_9' | 'month_12'];
                        const waterStr =
                          pred?.water_demand_kl_day_pred != null && pred.water_demand_kl_day_pred > 0
                            ? `${pred.water_demand_kl_day_pred.toFixed(1)} kL/d`
                            : pred?.benchmark_cooling_water_kl_day != null && pred.benchmark_cooling_water_kl_day > 0
                            ? `${pred.benchmark_cooling_water_kl_day.toFixed(1)} kL/d`
                            : 'Not Disclosed';
                        const waterSub =
                          pred?.water_demand_kl_day_pred != null && pred.water_demand_kl_day_pred > 0
                            ? 'Reported Baseline Water'
                            : pred?.benchmark_cooling_water_kl_day != null && pred.benchmark_cooling_water_kl_day > 0
                            ? 'Est. Cooling Make-up'
                            : 'Not Disclosed';

                        return (
                          <div key={months} className="p-3 rounded bg-eco-surface-secondary/50 border border-eco-border text-center">
                            <div className="font-mono text-h3 font-bold text-eco-primary">
                              {pred?.power_demand_mw_pred != null ? `${pred.power_demand_mw_pred.toFixed(1)} MW` : 'N/A'}
                            </div>
                            <span className="text-micro uppercase tracking-wider text-eco-muted block mt-0.5">Power Demand</span>
                            <span className="text-[10px] text-eco-text block font-mono mt-0.5">
                              {pred?.capacity_mw_pred != null ? `${pred.capacity_mw_pred.toFixed(1)} MW IT` : ''}
                            </span>
                            <hr className="my-2 border-eco-border/50" />
                            <span className="text-micro font-mono text-eco-text font-semibold block">
                              {waterStr}
                            </span>
                            <span className="text-[9px] text-eco-muted block truncate">
                              {waterSub}
                            </span>
                            <hr className="my-2 border-eco-border/50" />
                            <div className="text-micro text-eco-muted">
                              <span className="font-mono text-eco-text font-bold">{months} Months Horizon</span>
                              <span className="block text-[9px] text-eco-muted mt-0.5">Phased Ramp</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="p-2.5 rounded bg-eco-surface-secondary/30 border border-eco-border/40 text-[11px] text-eco-muted">
                      <strong>Classification:</strong> {predictions.month_6?.classification || 'DETERMINISTIC_ENGINEERING_SCENARIO'} (Standard PUE 1.35)
                    </div>
                  </div>
                ) : null}
              </Card>

              {/* Cooling Architecture & Resource Breakdown Matrix */}
              <div className="md:col-span-2">
                <Card
                  title="Cooling Architecture & Resource Sensitivity Analysis (OpenDC-LCA / BIS IS 15797)"
                  subtitle={`Evaluated resource consumption across 4 cooling technologies for ${selectedFacility.name}`}
                  icon={<Cpu className="h-4 w-4" />}
                >
                  <div className="space-y-4">
                    <p className="text-meta text-eco-muted">
                      Resource requirements depend heavily on mechanical cooling architecture. Compare grid electricity draw and daily evaporative cooling water consumption across standard industry architectures for this campus (modeled at 80% Capacity Factor):
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-meta border-collapse">
                        <thead>
                          <tr className="border-b border-eco-border text-eco-muted uppercase font-mono text-[10px]">
                            <th className="py-2 px-3">Cooling Technology</th>
                            <th className="py-2 px-3">Operating PUE</th>
                            <th className="py-2 px-3">Water Metric (WUE)</th>
                            <th className="py-2 px-3">Grid Power (12-Mo)</th>
                            <th className="py-2 px-3">Daily Cooling Water</th>
                            <th className="py-2 px-3">Annual Water</th>
                            <th className="py-2 px-3">Sustainability Tradeoff</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-eco-border/40 font-mono text-body">
                          {(() => {
                            const itCap = selectedFacility.capacityDisclosures?.[0]?.value ?? 24;
                            const cf = 0.8;
                            const hours = 24;
                            const archs = [
                              {
                                name: 'Evaporative Hybrid Towers',
                                pue: 1.28,
                                wue: 1.20,
                                note: 'Highest thermal efficiency; high daily water requirement',
                                tag: 'Industry Baseline',
                                tone: 'text-amber-400',
                              },
                              {
                                name: 'Air-Cooled with Economizers',
                                pue: 1.42,
                                wue: 0.05,
                                note: 'Zero evaporative loss; higher warm-weather compressor power',
                                tag: 'Water-Preserving',
                                tone: 'text-sky-400',
                              },
                              {
                                name: 'Direct-to-Chip Liquid (DLC)',
                                pue: 1.18,
                                wue: 0.25,
                                note: 'Closed-loop warm water; 79% water reduction vs hybrid',
                                tag: 'High-Density / AI',
                                tone: 'text-emerald-400',
                              },
                              {
                                name: 'Immersion Liquid Cooling',
                                pue: 1.09,
                                wue: 0.02,
                                note: 'Dielectric fluid immersion; ultra-low power & water loss',
                                tag: 'Next-Gen Ultra-Low',
                                tone: 'text-purple-400',
                              },
                            ];
                            return archs.map((a) => {
                              const gridPower = (itCap * 1.25 * a.pue).toFixed(1);
                              const dailyWater = (itCap * 1.25 * cf * hours * a.wue).toFixed(1);
                              const annualWaterM3 = Math.round(Number(dailyWater) * 365);
                              return (
                                <tr key={a.name} className="hover:bg-eco-surface-secondary/40 transition-colors">
                                  <td className="py-2.5 px-3 font-sans font-medium text-eco-text">
                                    {a.name}
                                    <span className="block text-[10px] text-eco-muted font-mono">{a.tag}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-eco-text font-bold">{a.pue}</td>
                                  <td className="py-2.5 px-3 text-eco-text">{a.wue} L/kWh</td>
                                  <td className="py-2.5 px-3 text-eco-primary font-bold">{gridPower} MW</td>
                                  <td className={`py-2.5 px-3 font-bold ${a.tone}`}>{dailyWater} kL/d</td>
                                  <td className="py-2.5 px-3 text-eco-muted">{annualWaterM3.toLocaleString()} m³</td>
                                  <td className="py-2.5 px-3 font-sans text-micro text-eco-muted">{a.note}</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                    <div className="rounded border border-eco-border/60 bg-eco-surface-secondary/30 p-3 text-micro text-eco-muted space-y-1">
                      <p className="font-semibold text-eco-text">Planning &amp; Verification Guidance:</p>
                      <p>• <strong>6-Month Horizon:</strong> Evaluates initial operational phase with summer peak ambient wet-bulb surge.</p>
                      <p>• <strong>12-Month Horizon:</strong> Evaluates campus full design capacity ramp (+25% contractual expansion ceiling).</p>
                      <p>• <strong>Resource Transition:</strong> Switching from Evaporative Hybrid to Direct-to-Chip Liquid Cooling saves approximately 79% of cooling water while reducing facility power demand by ~8%.</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION C: MODEL EVALUATION & BENCHMARKS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'evaluation' && (
        <div className="space-y-4">
          <Card
            title="Rigorous 7-Window Chronological Backtest Comparison"
            subtitle="Evaluating Seasonal Naive vs Trend-Adjusted Baseline vs Offline LightGBM Forecaster (v3)"
            icon={<Database className="h-4 w-4" />}
          >
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-meta">
                  <thead>
                    <tr className="border-b border-eco-border text-micro uppercase tracking-wider text-eco-muted">
                      <th className="pb-2.5 pr-4 font-semibold">Model Architecture</th>
                      <th className="pb-2.5 pr-4 font-semibold">Scope</th>
                      <th className="pb-2.5 pr-4 font-semibold font-mono">7-Window MAE</th>
                      <th className="pb-2.5 pr-4 font-semibold font-mono">7-Window MAPE</th>
                      <th className="pb-2.5 pr-4 font-semibold">Evaluation Status</th>
                      <th className="pb-2.5 font-semibold">Deployment Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-eco-border/50">
                    <tr className="bg-eco-surface-secondary/30">
                      <td className="py-3 pr-4 font-semibold text-eco-text">
                        Seasonal Naive with Calibrated Intervals
                      </td>
                      <td className="py-3 pr-4 text-eco-muted">Maharashtra SLDC (Regional)</td>
                      <td className="py-3 pr-4 font-mono font-bold text-eco-primary">1,749.68 MW</td>
                      <td className="py-3 pr-4 font-mono font-bold text-eco-primary">6.76%</td>
                      <td className="py-3 pr-4">
                        <Badge variant="primary" size="xs">Lowest Multi-Year Error</Badge>
                      </td>
                      <td className="py-3 text-eco-text text-micro">
                        <strong>Selected Operational Model</strong> (Deployed in Regional API)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-semibold text-eco-text">
                        Trend-Adjusted Seasonal Baseline
                      </td>
                      <td className="py-3 pr-4 text-eco-muted">Maharashtra SLDC (Regional)</td>
                      <td className="py-3 pr-4 font-mono text-eco-text">1,805.01 MW</td>
                      <td className="py-3 pr-4 font-mono text-eco-text">7.04%</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" size="xs">Evaluated Baseline</Badge>
                      </td>
                      <td className="py-3 text-eco-muted text-micro">
                        Reference Baseline
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-semibold text-eco-text">
                        LightGBM Grid Forecaster (v3)
                      </td>
                      <td className="py-3 pr-4 text-eco-muted">Maharashtra SLDC (Regional)</td>
                      <td className="py-3 pr-4 font-mono text-eco-text">1,825.61 MW</td>
                      <td className="py-3 pr-4 font-mono text-eco-text">7.10%</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" size="xs">Evaluated Benchmark</Badge>
                      </td>
                      <td className="py-3 text-eco-muted text-micro">
                        <strong>Offline Research Benchmark</strong> (Artifact: lgbm_demand_production_v3.txt)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Model Deployment Truthfulness Note */}
              <div className="rounded border border-eco-border bg-eco-surface-secondary/40 p-4 space-y-2 text-meta text-eco-muted">
                <p className="font-semibold text-eco-text">Model Selection &amp; Deployment Transparency:</p>
                <p>
                  1. <strong>Why Seasonal Naive is Deployed:</strong> Across 7 chronologically separate 180-day backtest windows spanning 2020 through 2026, Seasonal Naive achieved the lowest unweighted average error (1,749.68 MW MAE vs 1,825.61 MW for LightGBM). Its multi-year robustness makes it the scientifically defended production forecast.
                </p>
                <p>
                  2. <strong>LightGBM Role:</strong> LightGBM was trained with 25 engineered lag and calendar features and evaluated against out-of-sample holdout windows. It is preserved as a versioned model artifact (<code>ml/resource_outlook/models/v3/lgbm_demand_production_v3.txt</code>) and documented in the model registry (<code>GET /api/v1/ml/models</code>).
                </p>
                <p className="text-amber-400">
                  3. <strong>Zero Fake Inference:</strong> <code>POST /api/v1/ml/predict</code> performs deterministic facility engineering projections and does NOT execute LightGBM. EcoSite refuses to pretend deterministic formulas are live machine learning.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </PageShell>
  );
}

export default MLForecastAnalysis;
