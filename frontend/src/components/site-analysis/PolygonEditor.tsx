import { useEffect, useRef, useState } from 'react';
import { SiteMapPicker } from './SiteMapPicker';
import { Button } from '../ui/Button';
import { parsePolygon, type PolygonGeometry } from '../../services/projects';

export function PolygonEditor({ value, onChange, disabled = false }: { value: PolygonGeometry | null; onChange: (polygon: PolygonGeometry | null) => void; disabled?: boolean }) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  const importText = (text: string) => {
    if (!mounted.current) return;
    try { onChange(parsePolygon(JSON.parse(text))); setDraft([]); setDrawing(false); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Invalid GeoJSON.'); }
  };
  const append = ({ longitude, latitude }: { longitude: number; latitude: number }) => {
    if (!drawing || disabled) return;
    const next = [...draft, [longitude, latitude] as [number, number]];
    if (next.length >= 1999) { setError('Polygon vertex limit reached.'); return; }
    setDraft(next);
    onChange(next.length >= 3 ? { type: 'Polygon', coordinates: [[...next, next[0]]] } : null);
  };
  const move = (ringIndex: number, index: number, axis: number, number: number) => {
    if (!value || disabled || !Number.isFinite(number)) return;
    const coordinates = value.coordinates.map(ring => ring.map(point => [...point] as [number, number]));
    coordinates[ringIndex][index][axis] = number;
    if (index === 0) coordinates[ringIndex][coordinates[ringIndex].length - 1] = [...coordinates[ringIndex][0]];
    onChange({ type: 'Polygon', coordinates });
    setDrawing(false);
  };
  return <div className="space-y-3">
    <p>WGS84 polygon draft. Area and India containment are validated by the server; drawing does not establish land ownership or readiness.</p>
    <SiteMapPicker latitude={18.5204} longitude={73.8567} siteName="Candidate polygon" polygon={value} onCoordinatesChange={append} />
    <div className="flex gap-2 flex-wrap">
      <Button type="button" disabled={disabled} onClick={() => { setDrawing(true); setDraft([]); onChange(null); setError(''); }}>Draw new polygon</Button>
      <Button type="button" disabled={disabled || !drawing || draft.length < 3} onClick={() => setDrawing(false)}>Finish drawing</Button>
      <span role="status">{drawing ? draft.length + ' vertices; click the map to add another' : 'Edit vertices or import GeoJSON'}</span>
    </div>
    <label className="block">GeoJSON Polygon or Feature<textarea aria-label="GeoJSON polygon" className="block w-full border p-2 bg-eco-surface" value={json} disabled={disabled} onChange={e => setJson(e.target.value)} /></label>
    <Button type="button" disabled={disabled} onClick={() => importText(json)}>Import GeoJSON</Button>
    <label className="block">Import GeoJSON file<input type="file" accept=".json,.geojson,application/json" disabled={disabled} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 262144) { setError('GeoJSON file exceeds 256 KiB.'); return; } try { importText(await file.text()); } catch { setError('GeoJSON file could not be read.'); } }} /></label>
    {error && <p role="alert">{error}</p>}
    {value && <details><summary>Edit polygon vertex coordinates</summary>{value.coordinates.map((ring, ri) => <div key={ri}>
      <p>{ri === 0 ? 'Exterior ring' : 'Hole ' + ri}</p>
      {ring.slice(0, -1).map((point, i) => <div className="flex gap-2" key={i}>{point.map((n, axis) => <label key={axis}>{axis === 0 ? 'Longitude' : 'Latitude'} {i + 1}<input type="number" step="any" aria-label={'Ring ' + ri + ' vertex ' + (i + 1) + (axis === 0 ? ' longitude' : ' latitude')} value={n} disabled={disabled} onChange={e => move(ri, i, axis, Number(e.target.value))} /></label>)}</div>)}
    </div>)}</details>}
  </div>;
}
