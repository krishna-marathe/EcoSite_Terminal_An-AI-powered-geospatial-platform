import React, { useState, useEffect } from "react";
import { Field } from "@/components/ui/Field";
import { MetricTile } from "@/components/ui/MetricTile";
import { mlService } from "@/services/mlService";
import type {
  MLPredictionOutput,
  MLPredictionsOutput,
} from "@/services/mlService";

interface MLPredictionsDashboardProps {
  facilityId?: string;
  facilityName?: string;
  initialCapacity?: number;
  initialWaterKL?: number;
  initialPowerMW?: number;
  location?: "IN-MH" | "IN-TG" | "IN-KA" | "IN-TN";
}

export const MLPredictionsDashboard: React.FC<MLPredictionsDashboardProps> = ({
  facilityName = "Data Centre",
  initialCapacity = 50,
  initialWaterKL = 0,
  initialPowerMW = 67.5,
  location = "IN-MH",
}) => {
  const [modelVersions, setModelVersions] = useState<string[]>(["ML-F4.1", "ML-F2.1", "ML-F3.4"]);
  const [selectedModel, setSelectedModel] = useState<string>("ML-F4.1");
  const [predictions, setPredictions] = useState<MLPredictionsOutput | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Load available modules
  useEffect(() => {
    let cancelled = false;
    mlService
      .getMLModels()
      .then((models) => {
        if (!cancelled && Array.isArray(models) && models.length > 0) {
          setModelVersions(models);
          if (!models.includes(selectedModel)) {
            setSelectedModel(models[0]);
          }
        }
      })
      .catch(() => {
        // Fallback silently
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch projections for this facility
  useEffect(() => {
    if (!selectedModel) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    mlService
      .getMultiMonthPredictions({
        capacity_mw: initialCapacity,
        water_demand_kl_day: initialWaterKL,
        power_demand_mw: initialPowerMW,
        location,
        model_version: selectedModel,
      })
      .then((res) => {
        if (!cancelled) {
          setPredictions(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err?.message || "Scenario calculation request failed"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedModel, initialCapacity, initialWaterKL, initialPowerMW, location]);

  const formatPrediction = (pred?: MLPredictionOutput) => ({
    power: pred?.power_demand_mw_pred != null ? `${pred.power_demand_mw_pred.toFixed(1)} MW` : "N/A",
    water: pred?.water_demand_kl_day_pred != null ? `${pred.water_demand_kl_day_pred.toFixed(1)} kL/day` : "Not Disclosed",
    capacity: pred?.capacity_mw_pred != null ? `${pred.capacity_mw_pred.toFixed(1)} MW` : "N/A",
    classification: pred?.classification ? pred.classification.replace(/_/g, " ") : "Deterministic Scenario",
    horizon: `${pred?.prediction_horizon_months ?? 6} months`,
    note: pred?.provenance_note || "",
  });

  const renderForecastCard = (months: number, pred?: MLPredictionOutput) => {
    const formatted = formatPrediction(pred);
    return (
      <MetricTile
        key={months}
        label={`${months}-Month Horizon`}
        value={formatted.power}
        unit="Power"
        caption={`${formatted.horizon} · ${formatted.classification}`}
      />
    );
  };

  return (
    <div className="space-y-4 rounded-lg border border-eco-border bg-eco-surface p-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-eco-border/60 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-eco-text uppercase tracking-wider">
            Facility Engineering Sizing &amp; Scenarios
          </h3>
          <p className="text-meta text-eco-muted">
            Deterministic engineering projections for {facilityName} ({initialCapacity} MW IT capacity, {location})
          </p>
        </div>
        <Field label="Assessment Module" htmlFor="model-version">
          <select
            id="model-version"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="mt-1 block rounded border border-eco-border bg-eco-surface-secondary px-2.5 py-1 text-meta text-eco-text shadow-sm focus:border-eco-primary focus:outline-none"
          >
            {modelVersions.map((version) => (
              <option key={version} value={version}>
                {version}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {loading && (
        <p className="text-meta text-eco-muted">Computing engineering scenario for {initialCapacity} MW load…</p>
      )}

      {error && (
        <p role="alert" className="text-meta text-eco-critical">{error}</p>
      )}

      {!loading && predictions && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[6, 9, 12].map((months) => {
            const pred =
              predictions[`month_${months}` as "month_6" | "month_9" | "month_12"];
            return renderForecastCard(months, pred);
          })}
        </div>
      )}

      {/* Detailed breakdown per horizon */}
      {!loading && predictions && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {[6, 9, 12].map((months) => {
            const pred =
              predictions[`month_${months}` as "month_6" | "month_9" | "month_12"];
            const formatted = formatPrediction(pred);
            return (
              <div
                key={months}
                className="space-y-1.5 p-3 rounded border border-eco-border/60 bg-eco-surface-secondary/40 text-meta"
              >
                <div className="flex justify-between items-center text-micro uppercase tracking-wide text-eco-primary font-mono font-semibold">
                  <span>{months}-Month Projection</span>
                  <span className="text-eco-muted text-[10px]">{formatted.classification}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-eco-muted">Power Demand:</span>
                  <span className="font-mono font-medium text-eco-text">{formatted.power}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-eco-muted">Water Demand:</span>
                  <span className={`font-mono font-medium ${formatted.water === "Not Disclosed" ? "text-eco-muted italic text-[11px]" : "text-eco-text"}`}>
                    {formatted.water}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-eco-muted">Design IT Capacity:</span>
                  <span className="font-mono font-medium text-eco-text">{formatted.capacity}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {predictions?.month_6?.provenance_note && (
        <p className="text-[11px] text-eco-muted border-t border-eco-border/40 pt-2 italic">
          Provenance: {predictions.month_6.provenance_note}
        </p>
      )}
    </div>
  );
};
