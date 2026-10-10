import React from 'react';
import { ShieldCheck, Sparkles, Database, AlertCircle } from 'lucide-react';
import type { DataProvenance, DataStatus } from '../../types';

interface DataConfidenceTagProps {
  provenance: DataProvenance;
  showDetails?: boolean;
  className?: string;
}

export const DataConfidenceTag: React.FC<DataConfidenceTagProps> = ({
  provenance,
  showDetails = false,
  className = '',
}) => {
  const getStatusConfig = (status: DataStatus) => {
    switch (status) {
      case 'observed':
        return {
          icon: <ShieldCheck className="w-3 h-3 text-emerald-400" />,
          label: 'Observed Telemetry',
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-950/40',
          text: 'text-emerald-300',
        };
      case 'estimated':
        return {
          icon: <Database className="w-3 h-3 text-sky-400" />,
          label: 'Spatial Estimate',
          border: 'border-sky-500/30',
          bg: 'bg-sky-950/40',
          text: 'text-sky-300',
        };
      case 'synthetic':
        return {
          icon: <Sparkles className="w-3 h-3 text-amber-400" />,
          label: 'Demo Synthetic Data',
          border: 'border-amber-500/30',
          bg: 'bg-amber-950/40',
          text: 'text-amber-300',
        };
      default:
        return {
          icon: <AlertCircle className="w-3 h-3 text-rose-400" />,
          label: 'Data Unavailable',
          border: 'border-rose-500/30',
          bg: 'bg-rose-950/40',
          text: 'text-rose-300',
        };
    }
  };

  const config = getStatusConfig(provenance.dataStatus);

  return (
    <div
      className={`inline-flex flex-col gap-1 text-xs ${className}`}
      title={`Source: ${provenance.sourceOrganization} (${provenance.publicationDate})`}
    >
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border ${config.border} ${config.bg} ${config.text} font-mono`}
      >
        {config.icon}
        <span className="font-medium">{config.label}</span>
        <span className="text-slate-400 font-normal">| {provenance.confidenceScore}% conf</span>
      </div>

      {showDetails && (
        <div className="text-[11px] text-slate-400 pl-0.5 space-y-0.5">
          <p className="truncate">
            <span className="text-slate-500">Source:</span> {provenance.sourceOrganization}
          </p>
          <p className="text-[10px] text-slate-500">
            Updated: {provenance.lastUpdated} • Res: {provenance.geographicResolution}
          </p>
        </div>
      )}
    </div>
  );
};
