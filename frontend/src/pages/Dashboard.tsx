import React, { useEffect, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorldMonitorLayerRibbon } from '../components/worldmonitor/WorldMonitorLayerRibbon';
import { InfrastructurePredictionsPanel } from '../components/worldmonitor/InfrastructurePredictionsPanel';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { MainMap } from '../components/map/MainMap';
import { EnvironmentalCoveragePanel, MinistryOperationsPanel, RegistryDistribution, RegistryKpiSummary } from '../components/data-centre-dashboard';
import { DataCentreMapDossier } from '../components/data-centre-map';
import { NewsFeedPanel } from '../components/news/NewsFeedPanel';
import { useDashboardStore } from '../stores/dashboardStore';
import type { TimeRange } from '../types';
import type { PublicFacility, PublicStateCode } from '../types/publicFacilities';
import { getPublicFacilities, getPublicFacilitySummary } from '../services/publicFacilities';
import { getEnvironmentalStateSummary, getFacilityEnvironmentalCurrent } from '../services/environmentalMonitoring';
import { getMinistryOverview } from '../services/ministryOperations';

const TARGET_STATES: PublicStateCode[] = ['IN-MH', 'IN-TG', 'IN-KA', 'IN-TN'];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : error ? 'The service is unavailable.' : undefined;

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedFacility, setSelectedFacility] = useState<PublicFacility | null>(null);
  const { setTimeRange, setViewMode, setWmLayer, setTypeFilter, fitToIndia, viewMode } = useDashboardStore();
  const facilities = useQuery({ queryKey: ['dashboard-public-data-centres'], queryFn: () => getPublicFacilities({ page: 1, pageSize: 100, freshness: 'current' }), retry: false });
  const registrySummary = useQuery({ queryKey: ['public-facility-summary'], queryFn: getPublicFacilitySummary, retry: false });
  const ministryOverview = useQuery({ queryKey: ['ministry-operations-overview'], queryFn: () => getMinistryOverview(), retry: false });
  const environmentalStates = useQueries({ queries: TARGET_STATES.map((state) => ({ queryKey: ['environmental-state-summary', state, '24h'], queryFn: () => getEnvironmentalStateSummary({ state, range: '24h' }), retry: false })) });
  const selectedEnvironment = useQuery({ queryKey: ['facility-environmental-current', selectedFacility?.id], queryFn: () => getFacilityEnvironmentalCurrent(selectedFacility!.id), enabled: Boolean(selectedFacility), retry: false });
  const environmentalData = environmentalStates.flatMap((query) => query.data ? [query.data] : []);
  const environmentalError = environmentalStates.find((query) => query.error)?.error;
  const failedEnvironmentalStates = environmentalStates.filter((query) => query.isError).length;

  useEffect(() => {
    setTypeFilter('data_centre');
    fitToIndia();
    const timeRangeParam = searchParams.get('timeRange');
    if (timeRangeParam && ['1h', '24h', '7d', '30d', 'all'].includes(timeRangeParam)) setTimeRange(timeRangeParam as TimeRange);
    const viewParam = searchParams.get('view');
    if (viewParam === 'global') setViewMode('map_only');
    else if (viewParam === 'grid') setViewMode('grid_only');
    else if (viewParam === 'split') setViewMode('split');
    const layersParam = searchParams.get('layers');
    if (layersParam) {
      const requestedKeys = new Set(layersParam.split(',').map((key) => key.trim()));
      setWmLayer('bases', requestedKeys.has('bases'));
    }
  }, [fitToIndia, searchParams, setTimeRange, setTypeFilter, setViewMode, setWmLayer]);

  const dashboardPanels = <>
    <RegistryKpiSummary summary={registrySummary.data} isLoading={registrySummary.isLoading} error={errorMessage(registrySummary.error)} />
    <RegistryDistribution summary={registrySummary.data} facilities={facilities.data?.items} isLoading={facilities.isLoading || registrySummary.isLoading} error={errorMessage(facilities.error ?? registrySummary.error)} />
    <EnvironmentalCoveragePanel
      states={environmentalData}
      isLoading={environmentalStates.some((query) => query.isLoading)}
      error={environmentalData.length === 0 ? errorMessage(environmentalError) : undefined}
      warning={environmentalData.length > 0 && failedEnvironmentalStates > 0 ? `${failedEnvironmentalStates} state summary could not be loaded; available states are shown.` : undefined}
    />
    <MinistryOperationsPanel overview={ministryOverview.data} isLoading={ministryOverview.isLoading} error={errorMessage(ministryOverview.error)} />
    <InfrastructurePredictionsPanel />
    <div className="xl:col-span-2"><NewsFeedPanel /></div>
  </>;
  const facilitiesStatus = facilities.isLoading ? 'loading' as const : facilities.error ? 'error' as const : 'ready' as const;
  const map = <MainMap publicDataCentres={facilities.data?.items} publicDataCentresStatus={facilitiesStatus} suppressLegacyFacilities selectedPublicFacilityId={selectedFacility?.id} onSelectPublicFacility={setSelectedFacility} />;
  const dossier = selectedFacility && <DataCentreMapDossier className="h-full select-text" facility={selectedFacility} environmentalCurrent={selectedEnvironment.data} environmentalError={errorMessage(selectedEnvironment.error)} onClose={() => setSelectedFacility(null)} onOpenProfile={(facility) => navigate(`/public-facilities/${facility.id}`)} />;

  return <div className="flex h-full w-full flex-col overflow-hidden bg-eco-bg text-eco-text">
    <WorldMonitorLayerRibbon dataCentreCount={facilities.data?.items.length} />
    <div className="relative flex flex-1 overflow-hidden">
      <LeftSidebar />
      {viewMode === 'grid_only' ? <main className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto bg-eco-bg p-4 xl:grid-cols-2" aria-label="Data-centre operations dashboard">{dashboardPanels}</main>
        : viewMode === 'split' ? <main className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden" aria-label="Data-centre map and operations dashboard">
          <div className="relative min-h-[50vh] min-w-0 flex-1">{map}</div>
          <aside className="w-full shrink-0 space-y-4 overflow-y-auto border-t border-eco-border bg-eco-bg p-3 lg:w-[410px] lg:border-l lg:border-t-0" aria-label="Registry and operational status">{dossier || dashboardPanels}</aside>
        </main>
          : <main className="relative h-full min-w-0 flex-1 overflow-hidden" aria-label="Data-centre map">{map}{dossier && <aside className="absolute bottom-4 right-4 top-4 z-20 w-[min(390px,calc(100%-2rem))]" aria-label="Selected data-centre details">{dossier}</aside>}</main>}
    </div>
  </div>;
};
