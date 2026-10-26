import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Flame,
  FlaskConical,
  Leaf,
  LineChart,
  Radio,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { ActiveHotspotsPanel } from './ActiveHotspotsPanel';
import { LiveSignalsWirePanel } from './LiveSignalsWirePanel';
import { MacroTelemetryPanel } from './MacroTelemetryPanel';
import { PolicyNewsPanel } from './PolicyNewsPanel';
import { ScenarioEngine } from './ScenarioEngine';
import { DataQualityBanner } from './DataQualityBanner';
import { MainMap } from '../map/MainMap';
import { Card } from '../ui/Card';
import { IconButton } from '../ui/Button';
import { DataModeBadge } from '../ui/Badge';
import { useDashboardStore } from '../../stores/dashboardStore';
import { getPilotCity } from '../../data/pilotCities';
import { RISK_LEVEL_LABELS, riskColor, scoreColor } from '../../theme/tokens';
import type { RiskLevel, WorldMonitorLayerKey } from '../../types';

type PanelId = 'hotspots' | 'signals' | 'telemetry' | 'risk' | 'forecast' | 'mitigation' | 'news';

const PANEL_META: Record<PanelId, { title: string; icon: React.ReactNode }> = {
  hotspots: { title: 'Environmental hotspots', icon: <Flame className="h-3.5 w-3.5" /> },
  signals: { title: 'Facility signals', icon: <Radio className="h-3.5 w-3.5" /> },
  telemetry: { title: 'Macro telemetry', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  risk: { title: 'Risk posture', icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  forecast: { title: 'Environmental forecasts', icon: <LineChart className="h-3.5 w-3.5" /> },
  mitigation: { title: 'Mitigation actions', icon: <Sparkles className="h-3.5 w-3.5" /> },
  news: { title: 'Policy & environmental news', icon: <Radio className="h-3.5 w-3.5" /> },
};

const WORKSPACES: {
  id: string;
  label: string;
  description: string;
  layers: WorldMonitorLayerKey[];
  panels: PanelId[];
}[] = [
  {
    id: 'command',
    label: 'Command Center',
    description: 'City environmental situation picture',
    layers: ['hotspots', 'weather', 'outages', 'natural', 'waterways', 'economic'],
    panels: ['hotspots', 'signals', 'telemetry', 'risk', 'news'],
  },
  {
    id: 'water',
    label: 'Water Security',
    description: 'Aquifer stress, demand, and exposure',
    layers: ['hotspots', 'waterways', 'natural', 'weather'],
    panels: ['hotspots', 'telemetry', 'forecast', 'mitigation'],
  },
  {
    id: 'grid',
    label: 'Grid Resilience',
    description: 'Grid pressure, outages, and capacity',
    layers: ['hotspots', 'outages', 'economic', 'weather'],
    panels: ['signals', 'telemetry', 'risk', 'forecast'],
  },
  {
    id: 'datacenter',
    label: 'Data Centre Screening',
    description: 'Cooling, power, heat, and population exposure',
    layers: ['hotspots', 'bases', 'weather', 'outages', 'natural'],
    panels: ['hotspots', 'risk', 'forecast', 'mitigation'],
  },
  {
    id: 'renewables',
    label: 'Renewable Expansion',
    description: 'Land, biodiversity, water, and grid context',
    layers: ['hotspots', 'natural', 'waterways', 'economic'],
    panels: ['hotspots', 'telemetry', 'risk', 'mitigation'],
  },
];

/** Derived screening summary — no hardcoded posture numbers. */
const RiskPosture: React.FC = () => {
  const navigate = useNavigate();
  const { facilities, facilitiesStatus } = useDashboardStore();

  if (facilitiesStatus === 'loading') {
    return <div className="p-3 text-meta text-eco-muted">Loading screening posture…</div>;
  }

  if (facilitiesStatus === 'error' || facilities.length === 0) {
    return (
      <div className="space-y-2 p-3">
        <p className="text-meta leading-relaxed text-eco-muted">
          {facilitiesStatus === 'error'
            ? 'Screening data unavailable — the backend may be unreachable.'
            : 'No facility records available for this city in this mode.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/risk-analysis')}
          className="flex items-center gap-1 text-meta text-eco-primary hover:underline"
        >
          Open risk analysis <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const scored = facilities.filter((facility) => facility.overallRiskScore !== null);
  const meanScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, facility) => sum + facility.overallRiskScore, 0) / scored.length)
      : null;

  const distribution = (['critical', 'high', 'moderate', 'low'] as RiskLevel[]).map((level) => ({
    level,
    count: facilities.filter((facility) => facility.riskLevel === level).length,
  }));

  return (
    <div className="space-y-3 p-3">
      <div className="border-b border-eco-border pb-2">
        <div className="font-mono text-body font-semibold">
          {meanScore !== null ? (
            <>
              <span style={{ color: scoreColor(meanScore) }}>{meanScore}</span>
              <span className="text-meta text-eco-muted">/100</span>
            </>
          ) : (
            <span className="text-eco-muted">Unavailable</span>
          )}
        </div>
        <div className="text-micro uppercase tracking-widest text-eco-muted">
          Mean screening score · {scored.length} scored {scored.length === 1 ? 'record' : 'records'}
        </div>
      </div>

      <div className="space-y-1.5">
        {distribution.map(({ level, count }) => {
          const share = Math.round((count / facilities.length) * 100);
          return (
            <div key={level} className="space-y-1">
              <div className="flex justify-between text-meta">
                <span className="text-eco-text">{RISK_LEVEL_LABELS[level]}</span>
                <span className="font-mono text-eco-muted">
                  {count} · {share}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-eco-surface-secondary">
                <div
                  className="h-full"
                  style={{ width: `${share}%`, backgroundColor: riskColor(level) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate('/risk-analysis')}
        className="flex items-center gap-1 text-meta text-eco-primary hover:underline"
      >
        Open risk analysis <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
};

/** Preview of the stored demand series — projections themselves live on the Forecast page. */
const ForecastSummary: React.FC = () => {
  const navigate = useNavigate();
  const { facilities, selectedFacility } = useDashboardStore();

  const facility = selectedFacility ?? facilities[0] ?? null;
  const trend = facility?.historicalTrends ?? [];
  const first = trend[0];
  const last = trend[trend.length - 1];
  const deltaPct =
    first && last && first.waterDemandKld > 0
      ? ((last.waterDemandKld - first.waterDemandKld) / first.waterDemandKld) * 100
      : null;
  const maxValue = Math.max(...trend.map((point) => point.waterDemandKld), 1);

  if (!facility || trend.length === 0) {
    return (
      <div className="space-y-2 p-3">
        <p className="text-meta leading-relaxed text-eco-muted">
          No stored demand series for this selection. Open the Forecast page to run projections.
        </p>
        <button
          type="button"
          onClick={() => navigate('/forecast')}
          className="flex items-center gap-1 text-meta text-eco-primary hover:underline"
        >
          Open forecasts <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-md border border-eco-border bg-eco-surface-secondary p-2.5">
        <div className="flex items-center justify-between gap-2 text-micro text-eco-muted">
          <span className="truncate">Water demand · {facility.name}</span>
          <span className="shrink-0 font-mono">
            {first.year}–{last.year}
          </span>
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span
            className={`font-mono text-body font-semibold ${
              deltaPct !== null && deltaPct > 0 ? 'text-eco-warning' : 'text-eco-primary'
            }`}
          >
            {deltaPct !== null ? `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%` : '—'}
          </span>
          <span className="pb-0.5 text-micro text-eco-muted">change across stored series</span>
        </div>
        <div className="mt-2 flex h-9 items-end gap-1">
          {trend.map((point, index) => (
            <span
              key={point.year ?? index}
              className="flex-1 rounded-t bg-eco-primary/45"
              style={{ height: `${Math.max(8, Math.round((point.waterDemandKld / maxValue) * 100))}%` }}
              title={`${point.year}: ${point.waterDemandKld.toLocaleString()} kLD`}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-micro text-eco-muted">
        <span>Stored series — projections live on the Forecast page.</span>
        <button
          type="button"
          onClick={() => navigate('/forecast')}
          className="shrink-0 text-eco-primary hover:underline"
        >
          Open forecasts
        </button>
      </div>
    </div>
  );
};

/** Honest pointer to the mitigation planner — recommendations are generated there, not here. */
const MitigationSummary: React.FC = () => {
  const navigate = useNavigate();
  const { selectedFacility } = useDashboardStore();

  return (
    <div className="space-y-2 p-3">
      <p className="text-meta leading-relaxed text-eco-muted">
        {selectedFacility
          ? `Recommendations for ${selectedFacility.name} are generated from its risk drivers and the active scenario on the Mitigation page.`
          : 'Recommendations are generated per facility from its risk drivers and the active scenario on the Mitigation page.'}
      </p>
      <button
        type="button"
        onClick={() => navigate('/mitigation')}
        className="flex items-center gap-1 text-meta text-eco-primary hover:underline"
      >
        Open mitigation planner <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
};

export const EcoWorkspace: React.FC = () => {
  const { setAllWmLayers, setWmLayer, facilities, facilitiesStatus, dataMode, cityId } =
    useDashboardStore();
  const [workspaceId, setWorkspaceId] = useState('command');
  const [closedPanels, setClosedPanels] = useState<PanelId[]>([]);
  const [isMissionOpen, setIsMissionOpen] = useState(false);
  const [isPanelGuideOpen, setIsPanelGuideOpen] = useState(false);
  const [isScenarioOpen, setIsScenarioOpen] = useState(false);

  const city = getPilotCity(cityId);
  const workspace = WORKSPACES.find((item) => item.id === workspaceId) || WORKSPACES[0];

  const panelStatuses: Record<PanelId, string> = useMemo(() => {
    const recordCount =
      facilitiesStatus === 'loading'
        ? 'Loading'
        : facilitiesStatus === 'error'
          ? 'Unavailable'
          : `${facilities.length} records`;
    return {
      hotspots: `${recordCount} · risk-sorted`,
      signals: dataMode === 'api' ? 'Backend feed' : 'No provider in demo',
      telemetry: `${city.name} snapshot`,
      risk: `${recordCount} screened`,
      forecast: 'Stored series · projections on page',
      mitigation: 'Per-facility recommendations',
      news: '',
    };
  }, [facilitiesStatus, facilities.length, dataMode, city.name]);

  const panels = useMemo(() => {
    const content: Record<PanelId, React.ReactNode> = {
      hotspots: <ActiveHotspotsPanel />,
      signals: <LiveSignalsWirePanel />,
      telemetry: <MacroTelemetryPanel />,
      risk: <RiskPosture />,
      forecast: <ForecastSummary />,
      mitigation: <MitigationSummary />,
      news: <PolicyNewsPanel />,
    };
    return workspace.panels
      .filter((id) => !closedPanels.includes(id))
      .map((id) => ({ id, ...PANEL_META[id], status: panelStatuses[id], content: content[id] }));
  }, [closedPanels, workspace.panels, panelStatuses]);

  const applyWorkspace = (id: string) => {
    const next = WORKSPACES.find((item) => item.id === id) || WORKSPACES[0];
    setWorkspaceId(next.id);
    setClosedPanels([]);
    setAllWmLayers(false);
    next.layers.forEach((layer) => setWmLayer(layer, true));
    setIsMissionOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-eco-border bg-eco-bg">
      {/* Workspace toolbar */}
      <div className="relative flex h-10 shrink-0 items-center justify-between border-b border-eco-border bg-eco-surface px-3 text-meta">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMissionOpen((value) => !value)}
            aria-expanded={isMissionOpen}
            className={`flex items-center gap-2 rounded-sm border px-2.5 py-1 font-medium transition-colors ${
              isMissionOpen
                ? 'border-eco-primary/50 bg-eco-primary/10 text-eco-primary'
                : 'border-eco-border bg-eco-surface-secondary text-eco-text hover:border-eco-primary/40'
            }`}
          >
            <Leaf className="h-3.5 w-3.5 text-eco-primary" />
            <span>Workspace</span>
            <span className="text-eco-muted">{workspace.label}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <span className="hidden text-micro text-eco-muted md:inline">{workspace.description}</span>
        </div>
        <div className="flex items-center gap-2 text-micro text-eco-muted">
          <button
            type="button"
            onClick={() => setIsScenarioOpen((value) => !value)}
            aria-pressed={isScenarioOpen}
            className="flex items-center gap-1 rounded-sm border border-eco-border px-2 py-1 text-eco-primary hover:bg-eco-surface-secondary"
          >
            <FlaskConical className="h-3 w-3" /> Scenario
          </button>
          <DataModeBadge mode={dataMode} />
          <span className="hidden sm:inline">{panels.length} panels active</span>
        </div>

        {isMissionOpen && (
          <div className="absolute left-3 top-11 z-40 w-72 rounded-md border border-eco-border bg-eco-surface p-2 shadow-2xl">
            <div className="mb-2 flex items-center justify-between border-b border-eco-border px-1 pb-2">
              <span className="text-micro font-semibold uppercase tracking-widest text-eco-muted">
                Choose workspace
              </span>
              <IconButton
                size="sm"
                label="Close workspace menu"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => setIsMissionOpen(false)}
              />
            </div>
            <div className="space-y-1">
              {WORKSPACES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyWorkspace(item.id)}
                  className={`w-full rounded-sm px-2.5 py-2 text-left transition-colors ${
                    workspace.id === item.id
                      ? 'bg-eco-surface-secondary text-eco-primary'
                      : 'text-eco-text hover:bg-eco-surface-secondary'
                  }`}
                >
                  <div className="text-meta font-medium">{item.label}</div>
                  <div className="mt-0.5 text-micro text-eco-muted">{item.description}</div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => applyWorkspace('command')}
              className="mt-2 flex w-full items-center justify-center gap-1 border-t border-eco-border pt-2 text-micro text-eco-muted hover:text-eco-text"
            >
              <RotateCcw className="h-3 w-3" /> Reset workspace
            </button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        {isScenarioOpen && <ScenarioEngine onClose={() => setIsScenarioOpen(false)} />}

        {/* Map surface */}
        <section className="flex min-h-[400px] flex-[1.05] flex-col border-b border-eco-border bg-eco-bg">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-eco-border px-3 text-micro uppercase tracking-widest text-eco-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-eco-primary" />
              {city.name} environmental map
            </span>
            <span>Map · layers · selection</span>
          </div>
          <div className="relative flex-1 overflow-hidden p-2">
            <div className="h-full overflow-hidden rounded-md border border-eco-border">
              <MainMap />
            </div>
          </div>
          <DataQualityBanner />
        </section>

        {/* Intelligence panels */}
        <section className="flex min-h-64 flex-[0.95] flex-col bg-eco-bg">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-eco-border px-3">
            <span className="flex items-center gap-1.5 text-micro uppercase tracking-widest text-eco-muted">
              <SlidersHorizontal className="h-3 w-3 text-eco-primary" /> Intelligence panels
            </span>
            <button
              type="button"
              onClick={() => setIsPanelGuideOpen((value) => !value)}
              aria-expanded={isPanelGuideOpen}
              className="text-micro text-eco-muted hover:text-eco-text"
            >
              {isPanelGuideOpen ? 'Hide guide' : 'Panel guide'}
            </button>
          </div>
          {isPanelGuideOpen && (
            <div className="border-b border-eco-border bg-eco-surface px-3 py-2 text-micro text-eco-muted">
              Panels are source-aware: synthetic demo records are labelled as such. Close panels that are not
              relevant to the current workspace; each panel links to its detailed view.
            </div>
          )}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-2 md:grid-cols-2 xl:grid-cols-4">
            {panels.map((panel) => (
              <Card
                key={panel.id}
                title={panel.title}
                status={panel.status}
                icon={panel.icon}
                className="min-h-[150px] min-w-0"
                bodyClassName="p-0"
                actions={
                  <IconButton
                    size="sm"
                    label={`Close ${panel.title}`}
                    icon={<X className="h-3.5 w-3.5" />}
                    onClick={() => setClosedPanels((current) => [...current, panel.id])}
                  />
                }
              >
                {panel.content}
              </Card>
            ))}
            {panels.length < 4 && (
              <button
                type="button"
                onClick={() => setClosedPanels([])}
                className="flex min-h-[150px] flex-col items-center justify-center rounded-md border border-dashed border-eco-border text-eco-muted transition-colors hover:border-eco-primary/50 hover:text-eco-primary"
              >
                <span className="text-xl">+</span>
                <span className="text-micro uppercase tracking-widest">Restore panels</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
