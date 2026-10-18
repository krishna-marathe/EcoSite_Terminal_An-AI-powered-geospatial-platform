import React from 'react';
import type { DataStatus, RiskLevel } from '../../types';
import { DATA_STATUS_LABELS } from '../../theme/tokens';

/**
 * Badge family — the only place chips are styled.
 * Tones map to the eco palette; text is always present (never color-only).
 */
export type BadgeVariant = 'primary' | 'secondary' | 'warning' | 'critical' | 'neutral' | 'outline' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  /** `primary` = accent/positive, `secondary`/`neutral` = quiet, `warning`/`critical` = state, `info` = accent-neutral. */
  variant?: BadgeVariant;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: 'bg-eco-primary/10 text-eco-primary border border-eco-primary/40',
  secondary: 'bg-eco-surface-secondary text-eco-muted border border-eco-border',
  info: 'bg-eco-primary/10 text-eco-primary border border-eco-primary/40',
  warning: 'bg-eco-warning/10 text-eco-warning border border-eco-warning/40',
  critical: 'bg-eco-critical/10 text-eco-critical border border-eco-critical/40',
  neutral: 'bg-eco-surface-secondary text-eco-text border border-eco-border',
  outline: 'bg-transparent text-eco-muted border border-eco-border',
};

const sizeStyles = {
  xs: 'text-micro font-mono font-medium uppercase tracking-[0.06em] px-1.5 py-0.5',
  sm: 'text-meta font-medium px-2 py-0.5',
  md: 'text-body font-medium px-2.5 py-1',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};

/**
 * Risk pill — score and level always travel together; missing scores are called out,
 * never rendered as 0.
 */
export const RiskBadge: React.FC<{ level: RiskLevel; score?: number | null; className?: string }> = ({
  level,
  score,
  className = '',
}) => {
  if (score === null || score === undefined) {
    return (
      <Badge variant="outline" size="sm" className={className}>
        Insufficient data
      </Badge>
    );
  }
  const config = {
    critical: { variant: 'critical' as const, label: 'Critical risk' },
    high: { variant: 'critical' as const, label: 'High risk' },
    moderate: { variant: 'warning' as const, label: 'Moderate risk' },
    low: { variant: 'primary' as const, label: 'Low risk' },
  }[level];

  return (
    <Badge variant={config.variant} size="sm" className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {`${score}/100 · ${config.label}`}
    </Badge>
  );
};

/** Data-mode chip: demo/API/feed, always explicit. */
export const DataModeBadge: React.FC<{
  mode: 'demo' | 'api' | 'synthetic' | 'internet';
  className?: string;
}> = ({ mode, className = '' }) => {
  const config = {
    demo: { variant: 'warning' as const, label: 'Synthetic demo' },
    synthetic: { variant: 'warning' as const, label: 'Synthetic data' },
    api: { variant: 'primary' as const, label: 'Backend API' },
    internet: { variant: 'secondary' as const, label: 'Internet feed' },
  }[mode];

  return (
    <Badge variant={config.variant} size="xs" className={className}>
      {config.label}
    </Badge>
  );
};

/** Footer provenance tag: "Synthetic demo · CEA (fixture)". */
export const SourceTag: React.FC<{ organization: string; status: DataStatus; className?: string }> = ({
  organization,
  status,
  className = '',
}) => {
  const tone = status === 'synthetic' ? 'text-eco-warning' : status === 'observed' ? 'text-eco-primary' : 'text-eco-muted';
  return (
    <span className={`font-mono text-micro uppercase tracking-[0.06em] ${tone} ${className}`}>
      {DATA_STATUS_LABELS[status]}
      {organization ? ` · ${organization}` : ''}
    </span>
  );
};
