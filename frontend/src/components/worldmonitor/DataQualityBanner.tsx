import React from 'react';
import { AlertTriangle, Database, ExternalLink } from 'lucide-react';
import { DATA_PROVENANCE_CATALOG } from '../../data/demo/provenance';

export const DataQualityBanner: React.FC = () => {
  const staleSources = DATA_PROVENANCE_CATALOG.filter((source) => source.dataStatus !== 'observed' || source.confidenceScore < 90).slice(0, 3);

  return (
    <details className="mx-2 mb-2 shrink-0 rounded border border-amber-500/20 bg-amber-950/20 text-[10px] text-slate-300">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
        <span className="font-medium text-amber-200">Data quality & coverage</span>
        <span className="text-slate-500">{staleSources.length} source caveats detected</span>
      </summary>
      <div className="space-y-1 border-t border-amber-500/15 px-2.5 py-2">
        {staleSources.map((source) => (
          <div key={source.id} className="flex items-center gap-2">
            <Database className="h-3 w-3 shrink-0 text-amber-300" />
            <span className="min-w-0 flex-1 truncate">{source.datasetName} · {source.dataStatus} · {source.confidenceScore}% confidence</span>
            <a className="text-emerald-300 hover:text-emerald-200" href={source.portalUrl} target="_blank" rel="noreferrer" aria-label={`Open source for ${source.datasetName}`}><ExternalLink className="h-3 w-3" /></a>
          </div>
        ))}
        <div className="pt-1 text-slate-500">Demo records are not live telemetry. Connect the backend ingestion jobs before using scores for operational decisions.</div>
      </div>
    </details>
  );
};
