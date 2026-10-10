import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  headerAction,
  title,
  subtitle,
  icon,
}) => {
  return (
    <div
      className={`bg-[#111827] border border-[#263447] rounded-md overflow-hidden text-slate-100 transition-all ${className}`}
    >
      {(title || headerAction) && (
        <div className="px-4 py-3 border-b border-[#263447] bg-[#172131]/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <span className="text-slate-400">{icon}</span>}
            <div>
              {title && <h3 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-400 font-normal">{subtitle}</p>}
            </div>
          </div>
          {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};
