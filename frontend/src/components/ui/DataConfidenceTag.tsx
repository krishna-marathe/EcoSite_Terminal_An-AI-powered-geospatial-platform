import React from 'react';
import { ShieldCheck, Sparkles, Database, AlertCircle } from 'lucide-react';
import type { DataProvenance, DataStatus } from '../../types';

interface DataConfidenceTagProps {
  provenance: DataProvenance;
  showDetails?: boolean;
  className?: string;
}

const statusConfig: Record<DataStatus, { Icon: React.ComponentType<{ className?: string }>; label: string; classes: string }> = {
  observed: {
    Icon: ShieldCheck,
    label: 'Observed telemetry',
    classes: 'border-eco-primary/40 bg-eco-primary/10 text-eco-primary',
  },
  estimated: {
    Icon: Database,
    label: 'Spatial estimate',
    classes: 'border-eco-border bg-eco-surface-secondary text-eco-text',
  },
  synthetic: {
    Icon: Sparkles,
    label: 'Synthetic demo data',
    classes: 'border-eco-warning/40 bg-eco-warning/10 text-eco-warning',
  },
  unavailable: {
    Icon: AlertCircle,
    label: 'Data unavailable',
    classes: 'border-eco-border bg-eco-surface-secondary text-eco-muted',
  },
};

/**
 * Provenance tag — the single place data trust is stated.
 * Confidence percentages are hidden for synthetic data: a fixture cannot carry
 * a meaningful calibration, so it must not appear to.
 */
export const DataConfidenceTag: React.FC<DataConfidenceTagProps> = ({
  provenance,
  showDetails = false,
  className = '',
}) => {
  const config = statusConfig[provenance.dataStatus];
  const showConfidence = provenance.dataStatus !== 'synthetic' && provenance.confidenceScore > 0;

  return (
    <div
      className={`inline-flex flex-col gap-1 ${className}`}
      title={`Source: ${provenance.sourceOrganization} (${provenance.publicationDate})`}
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-meta font-medium ${config.classes}`}
      >
        <config.Icon className="h-3 w-3" />
        <span>{config.label}</span>
        {showConfidence && <span className="font-normal opacity-80">· {provenance.confidenceScore}% confidence</span>}
      </span>

      {showDetails && (
        <div className="space-y-0.5 pl-0.5 text-meta text-eco-muted">
          <p className="truncate">
            <span>Source:</span> {provenance.sourceOrganization}
          </p>
          <p>
            Updated: {provenance.lastUpdated} · Resolution: {provenance.geographicResolution}
          </p>
        </div>
      )}
    </div>
  );
};
