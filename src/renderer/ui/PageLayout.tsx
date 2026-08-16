import { ReactNode } from 'react';

interface PageLayoutProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  noPadding?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  empty?: ReactNode;
}

export default function PageLayout({
  title,
  children,
  actions,
  noPadding = false,
  loading = false,
  loadingMessage = 'Loading...',
  empty,
}: PageLayoutProps) {
  return (
    <div className="flex flex-col h-full w-full bg-bg-primary text-fg-primary overflow-hidden">
      <header className="
        shrink-0
        flex items-center justify-between gap-6
        px-6 py-4 md:p-6
        border-b border-border-subtle
        bg-bg-secondary/50 backdrop-blur-sm
      ">
        <h1 data-testid="page-title" className="
          text-lg font-bold uppercase tracking-wider
          text-accent-primary drop-shadow-sm
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
        {loading ? <div className="p-6 text-fg-muted">{loadingMessage}</div> : empty ?? children}
      </div>
    </div>
  );
}
