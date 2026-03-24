import { NavLink, useLocation } from 'react-router';
import { cn } from '../../lib/cn.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { Avatar } from '../ui/Avatar.js';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

export interface SidebarProps {
  /** Whether the sidebar is open on mobile (for focus trapping) */
  isMobileOpen?: boolean;
  /** Callback to close the sidebar (used by focus trap Escape) */
  onClose?: () => void;
}

const mainNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    label: 'Tickets',
    path: '/tickets',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Knowledge Base',
    path: '/kb/manage',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
      </svg>
    ),
  },
];

const adminNavItems: NavItem[] = [
  {
    label: 'Users',
    path: '/admin/users',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    ),
  },
  {
    label: 'Assignment Rules',
    path: '/admin/assignment-rules',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'SLA Policies',
    path: '/admin/sla-policies',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Canned Responses',
    path: '/admin/canned-responses',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Integrations',
    path: '/admin/integrations',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    path: '/admin/reports',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
];

export function Sidebar({ isMobileOpen = false, onClose }: SidebarProps = {}) {
  const user = useAuthStore((s) => s.user);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const isAdmin = user?.role === 'admin';
  const location = useLocation();
  const focusTrapRef = useFocusTrap<HTMLElement>(isMobileOpen, onClose);

  return (
    <aside
      ref={focusTrapRef}
      className={cn(
        'fixed top-0 left-0 z-30 h-full bg-surface border-r border-border',
        'flex flex-col transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-60',
      )}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 border-b border-border flex-shrink-0',
        sidebarCollapsed ? 'justify-center px-2' : 'px-4',
      )}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">SD</span>
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-text-primary text-base">BusyBirdies</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {/* Main section */}
        {!sidebarCollapsed && (
          <p className="px-4 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Main
          </p>
        )}
        <ul className="space-y-1 px-2">
          {mainNavItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-md text-sm font-medium transition-colors',
                  sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2',
                  location.pathname.startsWith(item.path)
                    ? 'bg-primary-light text-primary'
                    : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary',
                )}
                title={sidebarCollapsed ? item.label : undefined}
                aria-current={location.pathname.startsWith(item.path) ? 'page' : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className={cn('mt-6', !sidebarCollapsed && 'px-4 mb-2')}>
              {!sidebarCollapsed && (
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Admin
                </p>
              )}
              {sidebarCollapsed && <div className="border-t border-border mx-2 my-2" />}
            </div>
            <ul className="space-y-1 px-2">
              {adminNavItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 rounded-md text-sm font-medium transition-colors',
                      sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2',
                      location.pathname.startsWith(item.path)
                        ? 'bg-primary-light text-primary'
                        : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary',
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-current={location.pathname.startsWith(item.path) ? 'page' : undefined}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* User section */}
      {user && (
        <div className={cn(
          'border-t border-border p-3 flex-shrink-0',
          sidebarCollapsed ? 'flex justify-center' : '',
        )}>
          <div className={cn('flex items-center gap-3', sidebarCollapsed && 'justify-center')}>
            <Avatar name={user.full_name} size="sm" />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user.full_name}
                </p>
                <p className="text-xs text-text-secondary capitalize">{user.role}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
