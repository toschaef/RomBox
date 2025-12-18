import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="flex h-screen w-full bg-bg-primary text-fg-primary font-sans">
      {/* sidebar */}
      <aside className="w-64 flex flex-col border-r border-border-subtle bg-bg-secondary/30">
        <div className="p-6">
          <div className="text-xl font-black tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-accent-primary to-accent-secondary">
            ROMBOX
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavLink 
            to="/" 
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all
              ${isActive ? 'bg-bg-muted text-fg-primary border border-border-highlight' : 'text-fg-muted hover:bg-bg-muted hover:text-fg-primary'}
            `}
          >
            Library
          </NavLink>
          
          <NavLink 
            to="/settings" 
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all
              ${isActive ? 'bg-bg-muted text-fg-primary border border-border-highlight' : 'text-fg-muted hover:bg-bg-muted hover:text-fg-primary'}
            `}
          >
            Settings
          </NavLink>
        </nav>

        <div className="p-6 text-xs text-fg-muted opacity-50 text-center">
          <a href="https://github.com/toschaef/RomBox" target="_blank" rel="noreferrer" className="underline hover:text-fg-primary">
            Codebase
          </a>  
        </div>
      </aside>

      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
}