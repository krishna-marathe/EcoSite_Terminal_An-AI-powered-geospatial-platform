import type { ReactNode } from 'react';

export type PanelLoadState = {
  isLoading?: boolean;
  error?: string | null;
};

export function DashboardPanel({ title, eyebrow, children, className = '' }: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-eco-border bg-eco-surface/95 p-4 shadow-sm ${className}`}>
      {eyebrow && <p className="mb-1 font-mono text-micro uppercase tracking-[0.1em] text-eco-muted">{eyebrow}</p>}
      <h2 className="text-sm font-semibold text-eco-text">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PanelState({ kind, message }: {
  kind: 'loading' | 'error' | 'empty' | 'not-covered';
  message?: string;
}) {
  const copy = {
    loading: 'Loading current data…',
    error: 'Data could not be loaded.',
    empty: 'No records are available.',
    'not-covered': 'NOT_COVERED — no suitable public source covers this metric.',
  }[kind];
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-md border px-3 py-4 text-sm ${kind === 'error' ? 'border-eco-critical/40 bg-eco-critical/10 text-eco-critical' : 'border-eco-border bg-eco-surface-secondary text-eco-muted'}`}
    >
      {message ?? copy}
    </div>
  );
}

