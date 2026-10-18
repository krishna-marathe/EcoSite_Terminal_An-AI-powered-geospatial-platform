import React, { useState } from 'react';
import { FlaskConical, Play, RotateCcw, X } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { Button, IconButton } from '../ui/Button';
import type { ScenarioType } from '../../types';

const SCENARIOS: { type: ScenarioType; label: string; description: string }[] = [
  { type: 'water_reduction', label: 'Water availability reduction', description: 'Reduce available water for cooling and operations.' },
  { type: 'heatwave', label: 'Extreme heatwave', description: 'Increase heat exposure and cooling demand.' },
  { type: 'grid_curtailment', label: 'Grid curtailment', description: 'Reduce available grid capacity around assets.' },
  { type: 'flood_event', label: 'Flood event', description: 'Increase flood exposure around vulnerable facilities.' },
];

export const ScenarioEngine: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { scenario, setScenario } = useDashboardStore();
  const [type, setType] = useState<ScenarioType>(scenario?.type || 'water_reduction');
  const [severity, setSeverity] = useState(scenario?.severity || 30);

  return (
    <div className="absolute left-3 top-11 z-40 w-[min(360px,calc(100vw-24px))] rounded-md border border-eco-border bg-eco-surface/95 p-3 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-eco-border pb-2">
        <div className="flex min-w-0 items-center gap-2 text-body font-semibold text-eco-text">
          <FlaskConical className="h-4 w-4 shrink-0 text-eco-primary" />
          <span className="truncate">Scenario engine</span>
          <span className="truncate text-meta font-normal text-eco-muted">what-if analysis</span>
        </div>
        <IconButton
          label="Close scenario panel"
          size="sm"
          onClick={onClose}
          icon={<X className="h-4 w-4" />}
        />
      </div>

      <div className="space-y-2">
        {SCENARIOS.map((item) => (
          <button
            key={item.type}
            type="button"
            aria-pressed={type === item.type}
            onClick={() => setType(item.type)}
            className={`block w-full rounded-sm border px-2.5 py-2 text-left transition-colors ${
              type === item.type
                ? 'border-eco-primary/40 bg-eco-primary/10 text-eco-text'
                : 'border-eco-border text-eco-muted hover:bg-eco-surface-secondary hover:text-eco-text'
            }`}
          >
            <span className="block text-body font-medium">{item.label}</span>
            <span className="mt-0.5 block text-meta text-eco-muted">{item.description}</span>
          </button>
        ))}
      </div>

      <label className="mt-3 block text-meta text-eco-muted">
        Severity <span className="font-medium text-eco-text">{severity}%</span>
        <input
          aria-label="Scenario severity"
          className="mt-2 w-full accent-eco-primary"
          type="range"
          min="10"
          max="80"
          step="5"
          value={severity}
          onChange={(event) => setSeverity(Number(event.target.value))}
        />
      </label>

      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          icon={<Play className="h-3 w-3" />}
          onClick={() => setScenario({ type, severity })}
        >
          Apply scenario
        </Button>
        <IconButton
          label="Clear scenario"
          size="sm"
          onClick={() => setScenario(null)}
          icon={<RotateCcw className="h-3.5 w-3.5" />}
        />
      </div>

      {scenario && (
        <div className="mt-2 rounded-sm border border-eco-primary/30 bg-eco-primary/5 p-2 text-meta text-eco-text">
          Scenario active. Hotspot scores and facility dossier indicators now reflect a {scenario.severity}% stress adjustment.
        </div>
      )}
    </div>
  );
};
