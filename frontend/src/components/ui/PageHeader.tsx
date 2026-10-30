import React from 'react';

/**
 * PageHeader — one orientation pattern for every route: where am I, what is
 * this, what can I do. Exactly one <h1> per page.
 */
interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  /** One sentence (<=120 chars) describing what this page does. */
  purpose: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** `compact` is for full-bleed surfaces (the dashboard) that cannot spare display-size chrome. */
  size?: 'default' | 'compact';
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  purpose,
  meta,
  actions,
  className = '',
  size = 'default',
}) => {
  const compact = size === 'compact';
  return (
    <header className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className={`min-w-0 ${compact ? 'space-y-0.5' : 'space-y-1'}`}>
        {eyebrow && <p className="font-mono text-micro uppercase tracking-[0.06em] text-eco-muted">{eyebrow}</p>}
        <h1 className={`${compact ? 'text-h2' : 'text-display'} font-semibold text-eco-text`}>{title}</h1>
        <p className={`${compact ? 'text-meta' : 'text-body'} max-w-3xl text-eco-muted`}>{purpose}</p>
        {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
};

/**
 * PageShell — standard page container: full-height scroll area with a centered
 * max-width column. Dashboard is the only full-bleed surface.
 */
interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export const PageShell: React.FC<PageShellProps> = ({ children, className = '' }) => (
  <div className={`flex-1 overflow-y-auto bg-eco-bg p-4 md:p-6 ${className}`}>
    <div className="mx-auto w-full max-w-[1200px] space-y-6">{children}</div>
  </div>
);
