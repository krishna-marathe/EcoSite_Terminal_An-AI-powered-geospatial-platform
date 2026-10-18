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
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  purpose,
  meta,
  actions,
  className = '',
}) => (
  <header className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
    <div className="min-w-0 space-y-1">
      {eyebrow && <p className="font-mono text-micro uppercase tracking-[0.06em] text-eco-muted">{eyebrow}</p>}
      <h1 className="text-display font-semibold text-eco-text">{title}</h1>
      <p className="max-w-3xl text-body text-eco-muted">{purpose}</p>
      {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

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
