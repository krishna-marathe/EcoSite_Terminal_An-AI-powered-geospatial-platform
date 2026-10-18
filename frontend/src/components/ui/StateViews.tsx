import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Inbox, Info, RefreshCw } from 'lucide-react';

/**
 * State views — one implementation of loading / empty / error / inline notice
 * for every async surface. Copy rules: name the scope, offer a next step,
 * never leave a dead end.
 */

interface LoadingSkeletonProps {
  rows?: number;
  variant?: 'rows' | 'tiles' | 'chart';
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ rows = 3, variant = 'rows', className = '' }) => {
  if (variant === 'tiles') {
    return (
      <div className={`grid grid-cols-2 gap-2 md:grid-cols-3 ${className}`} aria-busy="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-sm border border-eco-border bg-eco-surface-secondary" />
        ))}
      </div>
    );
  }
  if (variant === 'chart') {
    return <div className={`h-40 animate-pulse rounded-sm border border-eco-border bg-eco-surface-secondary ${className}`} aria-busy="true" />;
  }
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 animate-pulse rounded-sm bg-eco-surface-secondary" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
};

interface EmptyStateProps {
  title: string;
  body?: string;
  action?: { label: string; to?: string; onClick?: () => void };
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, body, action, icon, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-2 px-4 py-8 text-center ${className}`}>
    <span className="text-eco-muted">{icon ?? <Inbox className="h-5 w-5" />}</span>
    <p className="text-body font-medium text-eco-text">{title}</p>
    {body && <p className="max-w-sm text-meta text-eco-muted">{body}</p>}
    {action &&
      (action.to ? (
        <Link
          to={action.to}
          className="mt-1 rounded-sm border border-eco-border bg-eco-surface-secondary px-2.5 py-1.5 text-meta font-medium text-eco-text transition-colors hover:border-eco-primary/40"
        >
          {action.label}
        </Link>
      ) : (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 rounded-sm border border-eco-border bg-eco-surface-secondary px-2.5 py-1.5 text-meta font-medium text-eco-text transition-colors hover:border-eco-primary/40"
        >
          {action.label}
        </button>
      ))}
  </div>
);

interface ErrorStateProps {
  title: string;
  cause?: string;
  onRetry?: () => void;
  /** Renders "Switch to Synthetic demo" — only for data-mode-related failures. */
  onDemo?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title, cause, onRetry, onDemo, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-2 px-4 py-8 text-center ${className}`} role="alert">
    <AlertTriangle className="h-5 w-5 text-eco-critical" />
    <p className="text-body font-medium text-eco-text">{title}</p>
    {cause && <p className="max-w-sm text-meta text-eco-muted">{cause}</p>}
    {(onRetry || onDemo) && (
      <div className="mt-1 flex items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-sm border border-eco-border bg-eco-surface-secondary px-2.5 py-1.5 text-meta font-medium text-eco-text transition-colors hover:border-eco-primary/40"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        )}
        {onDemo && (
          <button
            type="button"
            onClick={onDemo}
            className="rounded-sm border border-eco-border bg-eco-surface-secondary px-2.5 py-1.5 text-meta font-medium text-eco-text transition-colors hover:border-eco-primary/40"
          >
            Switch to Synthetic demo
          </button>
        )}
      </div>
    )}
  </div>
);

interface InlineAlertProps {
  tone?: 'info' | 'warning' | 'critical';
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

const alertTones = {
  info: {
    wrap: 'border-eco-primary/30 bg-eco-primary/5',
    icon: <Info className="h-4 w-4 text-eco-primary" />,
  },
  warning: {
    wrap: 'border-eco-warning/30 bg-eco-warning/5',
    icon: <AlertTriangle className="h-4 w-4 text-eco-warning" />,
  },
  critical: {
    wrap: 'border-eco-critical/40 bg-eco-critical/10',
    icon: <AlertTriangle className="h-4 w-4 text-eco-critical" />,
  },
} as const;

export const InlineAlert: React.FC<InlineAlertProps> = ({ tone = 'info', title, action, className = '', children }) => (
  <div className={`flex items-start gap-2 rounded-sm border px-3 py-2 ${alertTones[tone].wrap} ${className}`} role={tone === 'info' ? 'status' : 'alert'}>
    <span className="mt-0.5 shrink-0">{alertTones[tone].icon}</span>
    <div className="min-w-0 flex-1 text-meta text-eco-text">
      {title && <p className="font-medium">{title}</p>}
      {children}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
