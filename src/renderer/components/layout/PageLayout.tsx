import { ReactNode } from 'react';

interface PageLayoutProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  noPadding?: boolean;
}

export default function PageLayout({ title, children, actions, noPadding = false }: PageLayoutProps) {
  return (
    <div className="flex flex-col h-full w-full bg-bg-primary text-fg-primary overflow-hidden">
      <header className="
        shrink-0 
        flex items-center justify-between 
        px-6 py-4 md:p-6
        border-b border-border-subtle 
        bg-bg-secondary/50 backdrop-blur-sm
      ">
        <h1 className="
          text-lg font-bold uppercase tracking-wider 
          text-transparent bg-clip-text bg-linear-to-r from-accent-primary to-accent-secondary
          drop-shadow-sm
        ">
          {title}
        </h1>
        
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </header>

      <div className={`flex-1 min-h-0 overflow-y-auto ${noPadding ? '' : 'p-6'}`}>
        {children}
      </div>
    </div>
  );
}
