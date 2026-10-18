import React from 'react';
import type { DataStatus } from '../../types';
import { DATA_STATUS_LABELS } from '../../theme/tokens';

/**
 * PanelShell — implemented as `Card` for historical reasons.
 * One panel anatomy for dashboard panels, page sections and report blocks:
 * header (title · status chip · actions), scrollable body, footer (units/provenance).
 */
interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Panel title — sentence case, must match panel content. */
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Derived state chip text (counts/mode) — never hardcoded copy. */
  status?: React.ReactNode;
  statusTone?: 'neutral' | 'warning' | 'critical';
  /** Footer provenance line (status + source organization). */
  source?: { organization: string; status: DataStatus } | null;
  /** Header-right controls. */
  actions?: React.ReactNode;
  /** Custom footer (units, disclaimers). Takes precedence over `source`. */
  footer?: React.ReactNode;
  /** When true the body scrolls internally instead of growing. */
  scroll?: boolean;
  bodyClassName?: string;
  /** Legacy alias for `actions`. */
  headerAction?: React.ReactNode;
}

const statusToneStyles = {
  neutral: 'text-eco-muted',
  warning: 'text-eco-warning',
  critical: 'text-eco-critical',
} as const;

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  icon,
  status,
  statusTone = 'neutral',
  source,
  actions,
  footer,
  scroll = false,
  bodyClassName = 'p-4',
  headerAction,
}) => {
  const hasHeader = Boolean(title || subtitle || status || actions || headerAction);
  const footerNode =
    footer ??
    (source ? (
      <span className="font-mono text-micro uppercase tracking-[0.06em]">
        {DATA_STATUS_LABELS[source.status]}
        {source.organization ? ` · ${source.organization}` : ''}
      </span>
    ) : null);

  return (
    <section className={`flex flex-col overflow-hidden rounded-md border border-eco-border bg-eco-surface text-eco-text ${className}`}>
      {hasHeader && (
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-eco-border bg-eco-surface-secondary/60 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="shrink-0 text-eco-muted">{icon}</span>}
            <div className="min-w-0">
              {title && <h3 className="truncate text-body font-semibold text-eco-text">{title}</h3>}
              {subtitle && <p className="truncate text-meta font-normal text-eco-muted">{subtitle}</p>}
            </div>
            {status && (
              <span className={`shrink-0 font-mono text-micro uppercase tracking-[0.06em] ${statusToneStyles[statusTone]}`}>
                {status}
              </span>
            )}
          </div>
          {(actions || headerAction) && (
            <div className="flex shrink-0 items-center gap-1">{actions ?? headerAction}</div>
          )}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName} ${scroll ? 'overflow-y-auto' : ''}`}>{children}</div>
      {footerNode && (
        <footer className="shrink-0 border-t border-eco-border px-3 py-1.5 text-meta text-eco-muted">{footerNode}</footer>
      )}
    </section>
  );
};

export type { CardProps };
