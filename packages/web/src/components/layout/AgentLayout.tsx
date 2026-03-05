import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar.js';
import { TopBar } from './TopBar.js';
import { useUIStore } from '../../stores/ui.store.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { cn } from '../../lib/cn.js';

export function AgentLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <div className="min-h-screen bg-surface-alt">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* Mobile overlay */}
      {isMobile && !sidebarCollapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/50"
          onClick={toggleSidebar}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              toggleSidebar();
            }
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - on mobile, hide when collapsed */}
      <div
        className={cn(
          isMobile && sidebarCollapsed && '-translate-x-full',
          'transition-transform duration-200',
        )}
      >
        <Sidebar isMobileOpen={isMobile && !sidebarCollapsed} onClose={toggleSidebar} />
      </div>

      {/* Main content */}
      <div
        className={cn(
          'transition-all duration-200',
          isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-16' : 'ml-60',
        )}
      >
        <TopBar />
        <main id="main-content" className="p-4 lg:p-6" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
