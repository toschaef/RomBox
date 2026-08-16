import { NavLink } from "react-router-dom";

export default function SideBar() {
  const PAGES = [
    "", // Library
    "Controls",
    "Engines",
    "Bios",
    "Settings",
  ];

  return (
    <aside data-testid="sidebar" className="w-64 flex flex-col border-r border-border-subtle bg-bg-secondary/30">
      <div className="p-6">
        <div data-testid="brand" className="text-2xl font-black font-stretch-expanded tracking-wide text-transparent bg-clip-text bg-accent-primary">
          RomBox
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {PAGES.map((p) =>
          <NavLink 
            to={`/${p.toLowerCase()}`}
            key={p}
            draggable={false}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 border-l-2 transition-all font-semibold
              ${isActive 
                ? 'bg-bg-muted text-fg-primary border-accent-primary' 
                : 'text-fg-muted border-transparent hover:bg-bg-muted hover:text-fg-primary hover:border-border-muted'}
            `}
          >
            {p || "Library"}
          </NavLink>
        )}
      </nav>

      <div className="p-6 text-xs text-fg-muted opacity-50 text-center">
        <a href="https://github.com/toschaef/RomBox" target="_blank" rel="noreferrer" draggable={false} className="underline hover:text-fg-primary">
          Codebase
        </a>  
      </div>
    </aside>
  );
}