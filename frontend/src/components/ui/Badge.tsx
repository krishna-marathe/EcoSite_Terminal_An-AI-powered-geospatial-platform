import React from 'react';
import type { RiskLevel } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'warning' | 'critical' | 'neutral' | 'outline';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  const variantStyles = {
    primary: 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40',
    secondary: 'bg-sky-950/80 text-sky-400 border border-sky-500/40',
    warning: 'bg-amber-950/80 text-amber-400 border border-amber-500/40',
    critical: 'bg-rose-950/80 text-rose-400 border border-rose-500/40',
    neutral: 'bg-slate-800/80 text-slate-300 border border-slate-700/60',
    outline: 'bg-transparent text-slate-300 border border-slate-700',
  };

  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5 tracking-wider uppercase font-mono font-medium',
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-sm px-2.5 py-1 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm whitespace-nowrap ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};

export const RiskBadge: React.FC<{ level: RiskLevel; score?: number; className?: string }> = ({
  level,
  score,
  className = '',
}) => {
  const config = {
    critical: { variant: 'critical' as const, label: 'Critical Risk' },
    high: { variant: 'warning' as const, label: 'High Risk' },
    moderate: { variant: 'secondary' as const, label: 'Moderate Risk' },
    low: { variant: 'primary' as const, label: 'Low Risk' },
  }[level];

  return (
    <Badge variant={config.variant} size="sm" className={className}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {score !== undefined ? `${score}/100 • ` : ''}
      {config.label}
    </Badge>
  );
};
