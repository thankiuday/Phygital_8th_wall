import { forwardRef, useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * FormInput — reusable labelled input field.
 * Supports text, email, password (with toggle), and error display.
 */
const FormInput = forwardRef(
  (
    {
      label,
      id,
      type = 'text',
      error,
      hint,
      className = '',
      containerClassName = '',
      required,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-[var(--text-primary)]"
          >
            {label}
            {required && <span className="ml-0.5 text-red-400">*</span>}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={inputType}
            className={cn(
              'input-base pr-4',
              isPassword && 'pr-12',
              error && 'border-red-500 focus:!border-red-500 focus:!shadow-[0_0_0_3px_rgba(239,68,68,0.15)]',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-1 top-1/2 inline-flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>

        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="flex items-center gap-1 text-xs text-red-400"
          >
            <AlertCircle size={12} />
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={`${id}-hint`} className="text-xs text-[var(--text-muted)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';
export default FormInput;
