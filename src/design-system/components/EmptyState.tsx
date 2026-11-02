import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`p-10 text-center flex flex-col items-center justify-center border border-dashed border-[#E8E8E5] rounded-lg bg-[#FAF9F7]/60 ${className}`}>
      {icon && (
        <div className="w-10 h-10 rounded-full bg-[#EFECE6] text-[#736959] flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-medium text-[#252525]">{title}</h4>
      {description && (
        <p className="text-xs text-[#777777] max-w-sm mt-1 mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
