import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  hint,
  options,
  children,
  className = '',
  id,
  ...props
}, ref) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-medium text-[#252525]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <select
          ref={ref}
          id={selectId}
          className={`w-full h-9 pl-3 pr-8 text-xs bg-white text-[#252525] border rounded-md appearance-none transition-colors focus:outline-none focus:ring-1 focus:ring-[#8B806F] focus:border-[#8B806F] disabled:bg-[#F7F7F5] disabled:cursor-not-allowed ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-[#E8E8E5] hover:border-[#D4D4CE]'
          } ${className}`}
          {...props}
        >
          {options ? options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          )) : children}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-[#777777] absolute right-3 pointer-events-none" />
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

Select.displayName = 'Select';
export default Select;
