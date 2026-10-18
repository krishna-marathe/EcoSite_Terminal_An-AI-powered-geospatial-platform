import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-eco-primary text-eco-bg font-semibold hover:bg-eco-secondary active:bg-eco-primary/90',
  secondary: 'bg-eco-surface-secondary text-eco-text border border-eco-border hover:border-eco-primary/40',
  outline: 'bg-transparent text-eco-text border border-eco-border hover:bg-eco-surface-secondary',
  ghost: 'bg-transparent text-eco-muted hover:text-eco-text hover:bg-eco-surface-secondary',
  danger: 'bg-eco-critical/15 text-eco-critical border border-eco-critical/40 hover:bg-eco-critical/25',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'text-meta px-2 py-1 gap-1',
  sm: 'text-meta px-2.5 py-1.5 gap-1.5',
  md: 'text-body px-3.5 py-2 gap-2',
  lg: 'text-body px-4 py-2.5 gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'sm',
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`inline-flex select-none items-center justify-center rounded-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — rendered as aria-label and title. */
  label: string;
  icon: React.ReactNode;
  size?: 'sm' | 'md';
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  icon,
  size = 'md',
  className = '',
  ...props
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`inline-flex shrink-0 items-center justify-center rounded-sm border border-transparent text-eco-muted transition-colors hover:border-eco-border hover:bg-eco-surface-secondary hover:text-eco-text disabled:cursor-not-allowed disabled:opacity-50 ${size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'} ${className}`}
    {...props}
  >
    {icon}
  </button>
);
