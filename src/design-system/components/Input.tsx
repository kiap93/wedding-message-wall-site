import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-[#252525]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 text-[#777777] pointer-events-none flex items-center justify-center">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full h-9 px-3 text-xs bg-white text-[#252525] placeholder:text-[#999999] border rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-[#8B806F] focus:border-[#8B806F] disabled:bg-[#F7F7F5] disabled:cursor-not-allowed ${
            leftIcon ? 'pl-9' : ''
          } ${rightIcon ? 'pr-9' : ''} ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-[#E8E8E5] hover:border-[#D4D4CE]'
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 text-[#777777] flex items-center justify-center">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-red-600 font-normal leading-normal">{error}</p>
      )}
      {!error && hint && (
        <p className="text-[11px] text-[#777777] leading-normal">{hint}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
