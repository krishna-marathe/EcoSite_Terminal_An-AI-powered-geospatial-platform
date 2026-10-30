import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, ShieldCheck, X } from 'lucide-react';
import { PRIMARY_NAV, WORKSPACE_NAV, isActivePath } from './navigation';

const itemClass = (active: boolean) =>
  `flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-meta font-medium transition-colors ${
    active
      ? 'border border-eco-border bg-eco-surface text-eco-primary'
      : 'border border-transparent text-eco-muted hover:bg-eco-surface-secondary hover:text-eco-text'
  }`;

function useCloseOnNavigate(pathname: string, close: () => void) {
  useEffect(() => {
    close();
  }, [pathname, close]);
}

export const AppNav: React.FC = () => {
  const { pathname } = useLocation();
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const workspacesRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const closeWorkspaces = React.useCallback(() => setWorkspacesOpen(false), []);
  useCloseOnNavigate(pathname, closeWorkspaces);

  useEffect(() => {
    if (!workspacesOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWorkspacesOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (workspacesRef.current && !workspacesRef.current.contains(event.target as Node)) {
        setWorkspacesOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [workspacesOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    drawerCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  // Return focus to the trigger when the drawer closes, but never steal focus on mount.
  const hasOpenedDrawer = useRef(false);
  useEffect(() => {
    if (drawerOpen) {
      hasOpenedDrawer.current = true;
    } else if (hasOpenedDrawer.current) {
      triggerRef.current?.focus();
    }
  }, [drawerOpen]);

  const workspacesActive = WORKSPACE_NAV.some((group) =>
    group.items.some((item) => isActivePath(pathname, item.to)),
  );

  return (
    <>
      {/* Desktop navigation */}
      <nav className="hidden items-center gap-1 rounded-md border border-eco-border/60 bg-eco-surface-secondary/60 p-1 md:flex">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            aria-current={isActivePath(pathname, item.to) ? 'page' : undefined}
            className={itemClass(isActivePath(pathname, item.to))}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div ref={workspacesRef} className="relative">
          <button
            type="button"
            aria-expanded={workspacesOpen}
            aria-haspopup="true"
            aria-controls="workspaces-menu"
            onClick={() => setWorkspacesOpen((open) => !open)}
            className={`${itemClass(workspacesActive || workspacesOpen)} cursor-pointer`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Workspaces</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${workspacesOpen ? 'rotate-180' : ''}`} />
          </button>

          {workspacesOpen && (
            <div
              id="workspaces-menu"
              className="absolute left-0 top-full z-50 mt-2 w-[22rem] rounded-md border border-eco-border bg-eco-surface p-2 shadow-xl"
            >
              {WORKSPACE_NAV.map((group) => (
                <section key={group.id} className="mb-2 last:mb-0">
                  <h2 className="px-2 pb-1 font-mono text-micro uppercase tracking-[0.06em] text-eco-muted">
                    {group.label}
                  </h2>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      aria-current={isActivePath(pathname, item.to) ? 'page' : undefined}
                      className={`flex items-start gap-2 rounded-sm px-2 py-1.5 transition-colors ${
                        isActivePath(pathname, item.to)
                          ? 'bg-eco-surface-secondary text-eco-primary'
                          : 'text-eco-text hover:bg-eco-surface-secondary/60'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-eco-muted">{item.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-body">{item.label}</span>
                        <span className="block text-micro text-eco-muted">{item.description}</span>
                      </span>
                    </NavLink>
                  ))}
                </section>
              ))}
              <p className="border-t border-eco-border px-2 pt-2 text-micro text-eco-muted">
                Restricted workspaces currently use a local demo identity — this build has no sign-in.
              </p>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={drawerOpen}
        aria-controls="app-mobile-nav"
        onClick={() => setDrawerOpen(true)}
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-eco-border bg-eco-surface px-2.5 py-1.5 text-meta text-eco-muted md:hidden"
      >
        <Menu className="h-4 w-4" />
        <span>Menu</span>
      </button>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-eco-surface/70"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            ref={drawerRef}
            id="app-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col border-l border-eco-border bg-eco-surface"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-eco-border px-4">
              <span className="font-mono text-body font-semibold text-eco-text">
                Eco<span className="text-eco-primary"> Terminal</span>
              </span>
              <button
                ref={drawerCloseRef}
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="cursor-pointer rounded-sm border border-eco-border p-1.5 text-eco-muted hover:text-eco-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-3">
              <div className="space-y-1">
                {PRIMARY_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    aria-current={isActivePath(pathname, item.to) ? 'page' : undefined}
                    className={`flex items-start gap-2 rounded-sm border px-3 py-2 ${
                      isActivePath(pathname, item.to)
                        ? 'border-eco-border bg-eco-surface-secondary text-eco-primary'
                        : 'border-transparent text-eco-text'
                    }`}
                  >
                    <span className="mt-0.5 text-eco-muted">{item.icon}</span>
                    <span>
                      <span className="block text-body font-medium">{item.label}</span>
                      <span className="block text-micro text-eco-muted">{item.description}</span>
                    </span>
                  </NavLink>
                ))}
              </div>

              {WORKSPACE_NAV.map((group) => (
                <section key={group.id} className="border-t border-eco-border pt-3">
                  <h2 className="px-3 pb-1 font-mono text-micro uppercase tracking-[0.06em] text-eco-muted">
                    {group.label}
                  </h2>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      aria-current={isActivePath(pathname, item.to) ? 'page' : undefined}
                      className={`flex items-start gap-2 rounded-sm px-3 py-2 ${
                        isActivePath(pathname, item.to) ? 'bg-eco-surface-secondary text-eco-primary' : 'text-eco-text'
                      }`}
                    >
                      <span className="mt-0.5 text-eco-muted">{item.icon}</span>
                      <span>
                        <span className="block text-body font-medium">{item.label}</span>
                        <span className="block text-micro text-eco-muted">{item.description}</span>
                      </span>
                    </NavLink>
                  ))}
                </section>
              ))}

              <p className="border-t border-eco-border px-3 pt-3 text-micro text-eco-muted">
                Restricted workspaces currently use a local demo identity — this build has no sign-in.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
