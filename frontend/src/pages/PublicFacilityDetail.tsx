import { ArrowLeft } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import {
  EnvironmentalCurrent,
  EnvironmentalTimeSeries,
  FacilityProfile,
  ResourceOutlookPanel,
  RiskScorePanel,
} from '../components/facilities';
import type {
  EnvironmentalCurrentResponse,
  EnvironmentalRange,
  EnvironmentalRangeResponse,
} from '../types/environmentalMonitoring';
import type { PublicFacility } from '../types/publicFacilities';
import type { RiskScoreResponse } from '../types/risk';
import type { ResourceOutlookResponse } from '../types/resourceOutlook';

export interface PublicFacilityDetailProps {
  facility: PublicFacility;
  current: EnvironmentalCurrentResponse | null;
  trend: EnvironmentalRangeResponse | null;
  risk?: RiskScoreResponse | null;
  resourceOutlook?: ResourceOutlookResponse | null;
  range: EnvironmentalRange;
  onRangeChange: (range: EnvironmentalRange) => void;
  onBack?: () => void;
  currentLoading?: boolean;
  trendLoading?: boolean;
  riskLoading?: boolean;
  riskError?: string;
  resourceOutlookLoading?: boolean;
  resourceOutlookError?: string;
}

/** Prop-driven route view; the router integration owns fetching and navigation. */
export function PublicFacilityDetail({
  facility,
  current,
  trend,
  risk,
  resourceOutlook,
  range,
  onRangeChange,
  onBack,
  currentLoading,
  trendLoading,
  riskLoading,
  riskError,
  resourceOutlookLoading,
  resourceOutlookError,
}: PublicFacilityDetailProps) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Public facility profile"
        title={facility.name}
        purpose="Verified public facility facts, nearby environmental monitoring, and regional resource stress outlook."
        meta={
          <>
            <Badge size="xs" variant="primary">
              Operational
            </Badge>
            <Badge size="xs" variant="outline">
              Generalised location
            </Badge>
          </>
        }
        actions={
          onBack ? (
            <Button variant="secondary" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Registry
            </Button>
          ) : undefined
        }
      />
      <FacilityProfile facility={facility} />
      <ResourceOutlookPanel
        data={resourceOutlook ?? null}
        loading={resourceOutlookLoading}
        error={resourceOutlookError}
      />
      <RiskScorePanel data={risk ?? null} loading={riskLoading} error={riskError} />
      <EnvironmentalCurrent data={current} loading={currentLoading} />
      <EnvironmentalTimeSeries
        data={trend}
        range={range}
        onRangeChange={onRangeChange}
        loading={trendLoading}
      />
    </PageShell>
  );
}
