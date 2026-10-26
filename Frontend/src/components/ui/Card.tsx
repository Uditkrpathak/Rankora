import React, { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  children,
  noPadding = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 ${
        noPadding ? '' : 'p-3.5 sm:p-4'
      } ${className}`}
      {...props}
    >
      {(title || subtitle || action) && (
        <div
          className={`flex items-center justify-between gap-3 mb-3 ${
            noPadding ? 'p-3.5 sm:p-4 pb-0' : ''
          }`}
        >
          <div className="min-w-0">
            {typeof title === 'string' ? (
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight truncate">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-1.5 shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
