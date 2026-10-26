import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  Key,
  CheckCircle2,
  Map,
  Shield,
  ExternalLink,
  Save,
} from 'lucide-react';
import { Button, IconButton } from './Button';
import { Field, Input } from './Field';
import { InlineAlert } from './StateViews';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [mapboxToken, setMapboxToken] = useState(
    () => localStorage.getItem('ECOSITE_MAPBOX_TOKEN') || import.meta.env.VITE_MAPBOX_TOKEN || ''
  );
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = useCallback(() => {
    setSavedSuccess(false);
    setSaveError('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  /** Only trimmed values are stored: whitespace never counts as a key. */
  const persistSettings = async () => {
    const mapbox = mapboxToken.trim();

    if (mapbox) {
      localStorage.setItem('ECOSITE_MAPBOX_TOKEN', mapbox);
    } else {
      localStorage.removeItem('ECOSITE_MAPBOX_TOKEN');
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    setSaveError('');
    try {
      // Success is only reported after the save callback has run to completion.
      await persistSettings();
      setSavedSuccess(true);
    } catch {
      setSaveError('Settings could not be saved in this browser. Check that local storage is available.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-modal-title"
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-lg border border-eco-border bg-eco-surface"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-eco-border bg-eco-surface-secondary/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-eco-border text-eco-primary">
              <Key className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 id="api-key-modal-title" className="text-h2 font-semibold text-eco-text">
                Basemap settings
              </h3>
              <p className="text-meta text-eco-muted">Manage optional public basemap tokens</p>
            </div>
          </div>
          <IconButton label="Close settings" icon={<X className="h-4 w-4" />} onClick={handleClose} autoFocus />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-meta">
          <InlineAlert tone="info" title="No API key is required to use EcoSite Terminal">
            All maps, facilities, forecasts, risk screening and mitigation catalogues run out of the box
            with open-source basemaps and built-in models. Keys are completely optional.
          </InlineAlert>

          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <section className="space-y-2">
              <h4 className="text-meta font-medium text-eco-text">Built-in (no key needed)</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-sm border border-eco-border bg-eco-surface-secondary p-2.5">
                  <Map className="h-4 w-4 shrink-0 text-eco-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-meta font-medium text-eco-text">OpenStreetMap & ESRI</p>
                    <p className="text-meta text-eco-primary">Active · no key needed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-sm border border-eco-border bg-eco-surface-secondary p-2.5">
                  <Shield className="h-4 w-4 shrink-0 text-eco-muted" />
                  <div className="min-w-0">
                    <p className="truncate text-meta font-medium text-eco-text">ML forecasting engine</p>
                    <p className="text-meta text-eco-muted">Runs locally</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t border-eco-border pt-4">
              <h4 className="text-meta font-medium text-eco-text">Optional public basemap token</h4>

              <Field
                label="Mapbox or MapTiler token (optional)"
                htmlFor="mapbox-token"
                hint="Only needed for custom Mapbox Studio basemap styles. Stored in this browser only."
              >
                <Input
                  id="mapbox-token"
                  type="password"
                  autoComplete="off"
                  placeholder="pk.ey… (leave blank to use built-in Carto/ESRI)"
                  value={mapboxToken}
                  onChange={(event) => {
                    setMapboxToken(event.target.value);
                    setSavedSuccess(false);
                  }}
                />
              </Field>
              <a
                href="https://account.mapbox.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-meta text-eco-primary hover:underline"
              >
                Open the Mapbox portal
                <ExternalLink className="h-3 w-3" />
              </a>
            </section>

            <div className="min-h-5 pt-3 text-meta">
              {saveError && (
                <p role="alert" className="text-eco-critical">
                  {saveError}
                </p>
              )}
              {!saveError && savedSuccess && (
                <p role="status" className="inline-flex items-center gap-1 text-eco-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Settings saved
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-eco-border pt-3">
              <Button variant="ghost" size="sm" type="button" onClick={handleClose}>
                Close
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={saving} icon={<Save className="h-3.5 w-3.5" />}>
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
