import React from 'react';

/**
 * MetricTile — numbers always carry a label, a unit and (optionally) context.
 * `value === null` renders "Unavailable"; it never pretends a missing value is 0.
 */
interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  caption?: string;
  tone?: 'default' | 'warning' | 'critical';
  className?: string;
}

const toneStyles = {
  default: 'text-eco-text',
  warning: 'text-eco-warning',
  critical: 'text-eco-critical',
} as const;

export const MetricTile: React.FC<MetricTileProps> = ({
  label,
  value,
  unit,
  caption,
  tone = 'default',
  className = '',
}) => (
  <div className={`rounded-sm border border-eco-border bg-eco-surface-secondary p-3 ${className}`}>
    <div className="text-meta text-eco-muted">{label}</div>
    <div className={`mt-1 font-mono text-data-lg tabular-nums ${toneStyles[tone]}`}>
      {value === null || value === undefined ? (
        <span className="font-sans text-meta text-eco-muted">Unavailable</span>
      ) : (
        <>
          {value}
          {unit && <span className="ml-1 font-sans text-meta text-eco-muted">{unit}</span>}
        </>
      )}
    </div>
    {caption && <div className="mt-1 text-meta text-eco-muted">{caption}</div>}
  </div>
);

/**
 * DefinitionRow — label/value pair for `<dl>` stacks.
 * Missing values render "Unavailable" with an optional reason tooltip.
 */
interface DefinitionRowProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  unavailableReason?: string;
  className?: string;
}

export const DefinitionRow: React.FC<DefinitionRowProps> = ({
  label,
  value,
  unit,
  unavailableReason,
  className = '',
}) => {
  const unavailable = value === null || value === undefined || value === '';
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${className}`}>
      <dt className="text-meta text-eco-muted">{label}</dt>
      <dd className="text-right text-meta text-eco-text tabular-nums" title={unavailable ? unavailableReason : undefined}>
        {unavailable ? (
          <span className="text-eco-muted">Unavailable</span>
        ) : (
          <>
            {value}
            {unit && <span className="ml-1 text-eco-muted">{unit}</span>}
          </>
        )}
      </dd>
    </div>
  );
};
