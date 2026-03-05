import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { cn } from '../../lib/cn.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { Avatar } from '../ui/Avatar.js';
import { DropdownMenu } from '../ui/DropdownMenu.js';
import { useAuth } from '../../hooks/useAuth.js';

const portalNavItems = [
  { label: 'My Tickets', path: '/portal' },
  { label: 'Knowledge Base', path: '/portal/kb' },
];

export function PortalLayout() {
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const { logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-alt">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-20" role="banner">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <NavLink to="/portal" className="flex items-center gap-2">
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.name} className="h-8" />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SD</span>
                </div>
              )}
              <span className="font-semibold text-text-primary hidden sm:block">
                {tenant?.name || 'SupportDesk'}
              </span>
            </NavLink>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Portal navigation">
              {portalNavItems.map((item) => {
                const isActive =
                  item.path === '/portal'
                    ? location.pathname === '/portal' || location.pathname.startsWith('/portal/tickets')
                    : location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'text-primary bg-primary-light'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Right: user menu + mobile hamburger */}
          <div className="flex items-center gap-3">
            {user && (
              <DropdownMenu
                trigger={
                  <div className="flex items-center gap-2 cursor-pointer p-1 rounded-md hover:bg-surface-alt transition-colors">
                    <Avatar name={user.full_name} size="sm" />
                    <span className="text-sm font-medium text-text-primary hidden md:block">
                      {user.full_name}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-secondary hidden md:block" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                }
                items={[
                  {
                    label: 'Profile',
                    onClick: () => {
                      window.location.href = '/portal/profile';
                    },
                  },
                  {
                    label: 'Log Out',
                    onClick: () => {
                      void logout();
                    },
                    danger: true,
                  },
                ]}
              />
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-md text-text-secondary hover:bg-surface-alt"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-border px-4 py-2" aria-label="Mobile navigation">
            {portalNavItems.map((item) => {
              const isActive =
                item.path === '/portal'
                  ? location.pathname === '/portal' || location.pathname.startsWith('/portal/tickets')
                  : location.pathname.startsWith(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'block px-3 py-2 text-sm font-medium rounded-md',
                    isActive
                      ? 'text-primary bg-primary-light'
                      : 'text-text-secondary hover:bg-surface-alt',
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-6" role="main">
        <Outlet />
      </main>
    </div>
  );
}
