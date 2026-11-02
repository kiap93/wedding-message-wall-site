import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string; onClick?: () => void }>;
  actions?: React.ReactNode;
  editorial?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
  editorial = false,
}) => {
  return (
    <div className="pb-6 mb-6 border-b border-[#E8E8E5]">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-[#777777] mb-2 font-normal">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {crumb.onClick || crumb.href ? (
                  <button
                    onClick={crumb.onClick}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className={isLast ? 'text-[#252525] font-medium' : ''}>
                    {crumb.label}
                  </span>
                )}
                {!isLast && <span className="text-[#B0ADA8]">/</span>}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={editorial ? 'font-serif text-3xl font-normal text-[#252525] tracking-tight' : 'text-xl font-semibold tracking-tight text-[#252525]'}>
            {title}
          </h1>
          {description && (
            <p className="text-xs text-[#777777] mt-1 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
