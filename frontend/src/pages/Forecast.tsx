import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Cpu,
  Code2,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { getForecast, type ForecastRequest } from '../services/forecasts';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { ForecastResponse } from '../types';

export const Forecast: React.FC = () => {
  const [selectedMetric, setSelectedMetric] = useState('electricity_demand');
  const [selectedLocation, setSelectedLocation] = useState('maharashtra');
  const [selectedHorizon, setSelectedHorizon] = useState(24);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [showApiInspector, setShowApiInspector] = useState(false);

  const metrics = [
    { id: 'electricity_demand', label: 'Electricity Demand Growth', unit: 'MW Peak', location: 'maharashtra' },
    { id: 'air_quality', label: 'Ambient Air Quality (PM2.5)', unit: 'µg/m³ 30d mean', location: 'ncr' },
    { id: 'groundwater', label: 'Groundwater Table Depletion', unit: 'm below ground', location: 'karnataka' },
    { id: 'temperature', label: 'Surface Heat Island Anomaly', unit: '°C Max Summer', location: 'gujarat' },
    { id: 'environmental_risk', label: 'National Compound Stress Index', unit: 'Index 0-100', location: 'panindia' },
  ];

  const locations = [
    { id: 'maharashtra', name: 'Maharashtra (Western Grid Corridor)' },
    { id: 'ncr', name: 'Delhi-NCR & Western UP Corridor' },
    { id: 'karnataka', name: 'Karnataka (Bengaluru Urban Watershed)' },
    { id: 'gujarat', name: 'Gujarat (Khambhat & Dholera Belt)' },
    { id: 'panindia', name: 'Pan-India National Stress Index' },
  ];

  // Fetch forecast data when parameters change
  useEffect(() => {
    let isMounted = true;

    const req: ForecastRequest = {
      location_id: selectedLocation,
      metric: selectedMetric,
      horizon_months: selectedHorizon,
    };

    getForecast(req)
      .then((res) => {
        if (isMounted) {
          setForecastData(res);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedMetric, selectedLocation, selectedHorizon]);

  // Handle metric change and sync default recommended location
  const handleMetricSelect = (metricId: string) => {
    setSelectedMetric(metricId);
    const metricObj = metrics.find((m) => m.id === metricId);
    if (metricObj) {
      setSelectedLocation(metricObj.location);
    }
  };

  // Calculate summary metrics
  const points = forecastData?.forecast || [];
  const latestPrediction = points[points.length - 1]?.prediction || 0;
  const initialPrediction = points[0]?.prediction || 0;
  const percentChange = initialPrediction > 0
    ? (((latestPrediction - initialPrediction) / initialPrediction) * 100).toFixed(1)
    : '0';

  const peakPoint = [...points].sort((a, b) => b.prediction - a.prediction)[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080D16] overflow-y-auto p-4 md:p-6 space-y-6 select-none font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#263447]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-wider text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
              Module 03
            </span>
            <h1 className="text-lg md:text-xl font-bold text-slate-100 font-mono tracking-tight">
              ML Environmental & Infrastructure Forecasting
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Multi-horizon statistical and machine-learning projections estimating regional grid pressure, aquifer depletion rates, and extreme heat trajectories through 2027.
          </p>
        </div>

        {/* API Contract Inspector Toggle */}
        <Button
          variant="outline"
          size="xs"
          icon={<Code2 className="w-3.5 h-3.5 text-sky-400" />}
          onClick={() => setShowApiInspector(!showApiInspector)}
        >
          {showApiInspector ? 'Hide FastAPI Contract' : 'FastAPI Contract Inspector'}
        </Button>
      </div>

      {/* Synthetic Demo Banner Notice */}
      <div className="p-3 bg-[#111827] border border-[#263447] rounded-sm flex items-start justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 font-mono text-[11px] uppercase">
                Synthetic Machine Learning Demonstration Engine
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-500/40">
                ILLUSTRATIVE DEMO DATA
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              These trajectories are generated by client-side ML simulation adapters representing expected Python FastAPI inference returns (XGBoost + Seasonal Prophet).
            </p>
          </div>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#111827] border border-[#263447] rounded-sm p-3 font-mono text-xs">
        {/* Metric Selector */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block">
            Environmental Metric
          </label>
          <select
            value={selectedMetric}
            onChange={(e) => handleMetricSelect(e.target.value)}
            className="w-full bg-[#172131] border border-[#263447] rounded-sm px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.unit})
              </option>
            ))}
          </select>
        </div>

        {/* Location Selector */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block">
            Region / Spatial Polygon
          </label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full bg-[#172131] border border-[#263447] rounded-sm px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Horizon Selector */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block">
            Forecast Horizon
          </label>
          <div className="grid grid-cols-3 gap-1">
            {[6, 12, 24].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setSelectedHorizon(h)}
                className={`py-1.5 rounded-sm border uppercase text-center transition-colors ${
                  selectedHorizon === h
                    ? 'bg-[#1E2C42] text-sky-400 border-sky-500 font-bold'
                    : 'bg-[#172131] text-slate-400 border-[#263447] hover:text-slate-200'
                }`}
              >
                {h} Months
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
        <div className="bg-[#111827] border border-[#263447] rounded-sm p-3 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase block">Current Baseline</span>
          <div className="text-xl font-bold text-slate-100">
            {initialPrediction.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{forecastData?.unit}</span>
          </div>
          <span className="text-[10px] text-slate-500">Historical Observation Q1 2024</span>
        </div>

        <div className="bg-[#111827] border border-[#263447] rounded-sm p-3 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase block">Horizon End Target</span>
          <div className="text-xl font-bold text-sky-400">
            {latestPrediction.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{forecastData?.unit}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>+{percentChange}% Projected Delta</span>
          </span>
        </div>

        <div className="bg-[#111827] border border-[#263447] rounded-sm p-3 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase block">Projected Peak Value</span>
          <div className="text-xl font-bold text-amber-400">
            {peakPoint?.prediction.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{forecastData?.unit}</span>
          </div>
          <span className="text-[10px] text-slate-400">Expected: {peakPoint?.date}</span>
        </div>

        <div className="bg-[#111827] border border-[#263447] rounded-sm p-3 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase block">Active ML Architecture</span>
          <div className="text-sm font-bold text-slate-200 truncate">
            {forecastData?.model || 'XGBoost Ensemble'}
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            Version: {forecastData?.modelVersion || 'v2.4'}
          </span>
        </div>
      </div>

      {/* Main Forecast Chart Card */}
      <Card
        title={`Trajectory Forecast: ${forecastData?.locationName || 'Selected Corridor'}`}
        subtitle={`Historical actuals vs. ML projection with 95% confidence uncertainty envelope (${forecastData?.unit})`}
        icon={<TrendingUp className="w-4 h-4 text-sky-400" />}
      >
        <div className="h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid stroke="#1E2C42" strokeDasharray="3 3" opacity={0.6} />
              <XAxis
                dataKey="date"
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
              />
              <YAxis
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[#111827] border border-[#263447] p-3 rounded shadow-xl text-xs font-mono space-y-1">
                        <p className="font-bold text-slate-200 border-b border-[#263447] pb-1">{d.date}</p>
                        {d.historical !== undefined ? (
                          <p className="text-emerald-400">
                            Historical Actual: <strong>{d.historical} {forecastData?.unit}</strong>
                          </p>
                        ) : (
                          <>
                            <p className="text-sky-400">
                              ML Prediction: <strong>{d.prediction} {forecastData?.unit}</strong>
                            </p>
                            <p className="text-slate-400 text-[10px]">
                              95% Confidence Range: [{d.lower_bound} - {d.upper_bound}]
                            </p>
                          </>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '10px' }}
              />

              {/* Shaded Uncertainty Envelope */}
              <Area
                type="monotone"
                dataKey="upper_bound"
                name="Uncertainty Range (95% CI)"
                stroke="transparent"
                fill="#38BDF8"
                fillOpacity={0.12}
              />
              <Area
                type="monotone"
                dataKey="lower_bound"
                name="Lower Bound"
                stroke="transparent"
                fill="#080D16"
                fillOpacity={0.9}
              />

              {/* Predicted Values Trajectory */}
              <Line
                type="monotone"
                dataKey="prediction"
                name="ML Trajectory Projection"
                stroke="#38BDF8"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#38BDF8' }}
              />

              {/* Historical Telemetry Baseline */}
              <Line
                type="monotone"
                dataKey="historical"
                name="Historical Actual Telemetry"
                stroke="#22C55E"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#22C55E' }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Model Methodology Notes Footer */}
        <div className="mt-4 pt-3 border-t border-[#263447] text-xs font-mono text-slate-400 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>Methodology: {forecastData?.methodologyNotes}</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Status: Illustrative Demonstration Model
          </div>
        </div>
      </Card>

      {/* FastAPI Backend Contract Inspector (Collapsible) */}
      {showApiInspector && (
        <Card
          title="FastAPI Integration Contract (POST /api/v1/forecasts)"
          subtitle="Exact typed JSON request and response payloads matching backend specification"
          icon={<Code2 className="w-4 h-4 text-sky-400" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div>
              <span className="text-[10px] uppercase text-slate-400 block mb-1">
                HTTP Request Payload
              </span>
              <pre className="p-3 bg-[#080D16] border border-[#263447] rounded text-emerald-400 overflow-x-auto text-[11px]">
{JSON.stringify(
  {
    location_id: selectedLocation,
    metric: selectedMetric,
    horizon_months: selectedHorizon,
  },
  null,
  2
)}
              </pre>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block mb-1">
                FastAPI JSON Response Payload
              </span>
              <pre className="p-3 bg-[#080D16] border border-[#263447] rounded text-sky-300 overflow-x-auto text-[11px] max-h-56 overflow-y-auto">
{JSON.stringify(
  {
    metric: selectedMetric,
    unit: forecastData?.unit,
    model: forecastData?.model,
    model_version: forecastData?.modelVersion,
    data_status: forecastData?.dataStatus,
    forecast: forecastData?.forecast?.slice(0, 4),
  },
  null,
  2
)}
              </pre>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
