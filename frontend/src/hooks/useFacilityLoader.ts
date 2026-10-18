import { useEffect } from 'react';
import { getFacilities } from '../services/facilities';
import { useDashboardStore } from '../stores/dashboardStore';

export function useFacilityLoader() {
  const cityId = useDashboardStore((state) => state.cityId);
  const dataMode = useDashboardStore((state) => state.dataMode);
  useEffect(() => {
    let active = true;
    useDashboardStore.setState({ facilitiesStatus: 'loading', facilitiesError: null });
    void getFacilities({ cityId }, dataMode).then((facilities) => {
      if (active) useDashboardStore.getState().setFacilities(facilities);
    }).catch((error: unknown) => {
      if (active) useDashboardStore.setState({ facilities: [], selectedFacility: null, selectedFacilityId: null, facilitiesStatus: 'error', facilitiesError: error instanceof Error ? error.message : 'Facility request failed' });
    });
    return () => { active = false; };
  }, [cityId, dataMode]);
}
