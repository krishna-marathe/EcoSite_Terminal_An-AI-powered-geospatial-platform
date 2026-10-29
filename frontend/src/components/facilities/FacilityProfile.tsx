import { ExternalLink, MapPin, Server } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import type { CapacityType, PublicFacility } from '../../types/publicFacilities';
import { DataCentreAiInsightsCard } from './DataCentreAiInsightsCard';

const CAPACITY_LABELS: Record<CapacityType, string> = {
  it_load: 'IT load',
  total_power: 'Total facility power',
  power_capacity: 'Power capacity',
  power_capacity_unspecified: 'Published capacity',
};

const VERIFICATION_LABELS: Record<PublicFacility['verification']['status'], string> = {
  government_verified: 'Government verified',
  public_operator_confirmed: 'Operator confirmed',
  credible_public_report: 'Credible public report',
};

export interface FacilityProfileProps {
  facility: PublicFacility;
}

export function FacilityProfile({ facility }: FacilityProfileProps) {
  return (
    <div className="space-y-4">
      <Card
        title={facility.name}
        subtitle={facility.operator}
        icon={<Server className="h-4 w-4" />}
        actions={<Badge size="xs" variant="primary">Operational</Badge>}
      >
        <dl className="grid gap-4 text-meta sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-eco-muted">Public location</dt>
            <dd className="mt-1 flex gap-1.5 text-eco-text">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-eco-primary" />
              <span>{facility.locality}, {facility.city}, {facility.state}</span>
            </dd>
            <p className="mt-1 text-micro uppercase text-eco-warning">Generalised {facility.locationPrecision}</p>
          </div>
          <div><dt className="text-eco-muted">Facility type</dt><dd className="mt-1 capitalize text-eco-text">{facility.facilityType}</dd></div>
          <div><dt className="text-eco-muted">Ownership</dt><dd className="mt-1 capitalize text-eco-text">{facility.ownershipCategory}</dd></div>
          <div><dt className="text-eco-muted">Operating since</dt><dd className="mt-1 text-eco-text">{facility.operationalSince ?? 'Not publicly disclosed'}</dd></div>
        </dl>
      </Card>

      <Card
        title="Published capacities"
        subtitle="Original units and measurement boundaries are retained"
        footer="Capacity types are shown separately and are never added together."
      >
        {facility.capacityDisclosures.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facility.capacityDisclosures.map((capacity, index) => (
              <div key={`${capacity.capacityType}-${capacity.scope}-${index}`} className="rounded border border-eco-border bg-eco-surface-secondary/40 p-3">
                <p className="font-mono text-h2 text-eco-primary">{capacity.value} {capacity.unit}</p>
                <p className="mt-1 text-body text-eco-text">{CAPACITY_LABELS[capacity.capacityType]}</p>
                <p className="mt-1 text-meta text-eco-muted">{capacity.scope}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-body text-eco-muted">Capacity has not been publicly disclosed.</p>}
      </Card>

      <DataCentreAiInsightsCard facility={facility} />

      <Card title="Verification and provenance">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge size="xs" variant="outline">{VERIFICATION_LABELS[facility.verification.status]}</Badge>
            <p className="mt-2 text-body text-eco-text">{facility.verification.source.title}</p>
            <p className="text-meta text-eco-muted">{facility.verification.source.publisher} &middot; {facility.verification.source.sourceClass.replaceAll('_', ' ')}</p>
          </div>
          <div className="text-meta text-eco-muted">
            <p>Verified {facility.verification.verifiedAt}</p>
            <p>Revalidate by {facility.verification.expiresAt}</p>
            <a className="mt-2 inline-flex items-center gap-1 text-eco-primary hover:underline" href={facility.verification.source.url} target="_blank" rel="noreferrer">
              Open source <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}

