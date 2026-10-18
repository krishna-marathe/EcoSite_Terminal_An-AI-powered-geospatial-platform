import React from 'react';

/** Shared control skin — keeps inputs, selects and textareas identical everywhere. */
export const controlClass =
  'w-full rounded-sm border border-eco-border bg-eco-surface px-2 text-body text-eco-text placeholder:text-eco-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const controlHeights = {
  sm: 'h-7',
  md: 'h-9',
} as const;

type ControlSize = keyof typeof controlHeights;

export const Input = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: ControlSize }
>(({ className = '', size = 'md', ...props }, ref) => (
  <input ref={ref} className={`${controlClass} ${controlHeights[size]} ${className}`} {...props} />
));
Input.displayName = 'Input';

export const Select = React.forwardRef<
  HTMLSelectElement,
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { size?: ControlSize }
>(({ className = '', size = 'md', ...props }, ref) => (
  <select ref={ref} className={`${controlClass} ${controlHeights[size]} ${className}`} {...props} />
));
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea ref={ref} className={`${controlClass} min-h-[88px] py-2 ${className}`} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

interface FieldProps {
  /** Always visible — never rely on placeholders alone. */
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className = '',
  children,
}) => (
  <div className={`space-y-1 ${className}`}>
    <label htmlFor={htmlFor} className="block text-meta font-medium text-eco-text">
      {label}
      {required && <span className="text-eco-critical"> *</span>}
    </label>
    {children}
    {error ? (
      <p role="alert" className="text-meta text-eco-critical">
        {error}
      </p>
    ) : (
      hint && <p className="text-meta text-eco-muted">{hint}</p>
    )}
  </div>
);
