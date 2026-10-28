import { MapPin } from 'lucide-react';
import type { StationContext as StationContextType } from '../../types/environmentalMonitoring';

export interface StationContextProps {
  station: StationContextType | null;
  contextNotice?: string | null;
}

export function StationContext({ station, contextNotice }: StationContextProps) {
  if (!station) {
    return <p className="text-meta text-eco-muted">No eligible public monitoring station is linked.</p>;
  }
  return (
    <div className="space-y-1 text-meta">
      <p className="flex items-start gap-1.5 text-eco-text">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-eco-primary" />
        <span>{station.name} <span className="text-eco-muted">({station.distanceKm.toFixed(1)} km)</span></span>
      </p>
      <p className="text-eco-muted">{station.provider} &middot; {station.selectionMethod.replaceAll('_', ' ')}</p>
      {contextNotice && <p className="text-micro text-eco-warning">{contextNotice}</p>}
    </div>
  );
}

