import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'taupe';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}, ref) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#8B806F] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap shrink-0';

  const sizeClasses = {
    sm: 'text-xs h-8 px-3 rounded gap-1.5',
    md: 'text-xs h-9 px-3.5 rounded-md gap-2',
    lg: 'text-sm h-10 px-4 rounded-md gap-2.5',
  };

  const variantClasses = {
    primary: 'bg-[#252525] text-white hover:bg-[#383838] active:bg-[#1A1A1A] shadow-sm',
    secondary: 'bg-[#FAF9F7] text-[#252525] border border-[#E8E8E5] hover:bg-[#F2EFE9] hover:border-[#D4D4CE]',
    outline: 'bg-transparent text-[#252525] border border-[#E8E8E5] hover:bg-[#F7F7F5] hover:border-[#D4D4CE]',
    ghost: 'bg-transparent text-[#555555] hover:text-[#252525] hover:bg-[#EFEFEA]',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
    taupe: 'bg-[#8B806F] text-white hover:bg-[#786E5E] active:bg-[#685F51] shadow-sm',
  };

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      <span>{children}</span>
      {!isLoading && rightIcon ? (
        <span className="shrink-0">{rightIcon}</span>
      ) : null}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
