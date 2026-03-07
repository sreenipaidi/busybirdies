import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { ToastContainer } from './components/ui/Toast.js';
import { AuthLayout } from './components/layout/AuthLayout.js';
import { AgentLayout } from './components/layout/AgentLayout.js';
import { PortalLayout } from './components/layout/PortalLayout.js';
import { ProtectedRoute } from './components/layout/ProtectedRoute.js';
import { Spinner } from './components/ui/Spinner.js';

// Eagerly loaded pages (critical path / small)
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { PortalLoginPage } from './pages/PortalLoginPage.js';
import { ClientRegisterPage } from './pages/ClientRegisterPage.js';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.js';
import { ResetPasswordPage } from './pages/ResetPasswordPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PlaceholderPage } from './pages/PlaceholderPage.js';

// Lazy-loaded pages (larger bundles, code-split)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage.js').then((m) => ({ default: m.DashboardPage })),
);
const TicketsPage = lazy(() =>
  import('./pages/TicketsPage.js').then((m) => ({ default: m.TicketsPage })),
);
const TicketDetailPage = lazy(() =>
  import('./pages/TicketDetailPage.js').then((m) => ({ default: m.TicketDetailPage })),
);
const CreateTicketPage = lazy(() =>
  import('./pages/CreateTicketPage.js').then((m) => ({ default: m.CreateTicketPage })),
);
const KBBrowsePage = lazy(() =>
  import('./pages/KBBrowsePage.js').then((m) => ({ default: m.KBBrowsePage })),
);
const KBCategoryPage = lazy(() =>
  import('./pages/KBCategoryPage.js').then((m) => ({ default: m.KBCategoryPage })),
);
const KBArticlePage = lazy(() =>
  import('./pages/KBArticlePage.js').then((m) => ({ default: m.KBArticlePage })),
);
const KBSearchPage = lazy(() =>
  import('./pages/KBSearchPage.js').then((m) => ({ default: m.KBSearchPage })),
);
const KBManagePage = lazy(() =>
  import('./pages/KBManagePage.js').then((m) => ({ default: m.KBManagePage })),
);
const KBArticleEditPage = lazy(() =>
  import('./pages/KBArticleEditPage.js').then((m) => ({ default: m.KBArticleEditPage })),
);
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage.js').then((m) => ({ default: m.ReportsPage })),
);
const CSATSurveyPage = lazy(() =>
  import('./pages/CSATSurveyPage.js').then((m) => ({ default: m.CSATSurveyPage })),
);
const PortalDashboardPage = lazy(() =>
  import('./pages/portal/PortalDashboardPage.js').then((m) => ({
    default: m.PortalDashboardPage,
  })),
);
const PortalTicketsPage = lazy(() =>
  import('./pages/portal/PortalTicketsPage.js').then((m) => ({
    default: m.PortalTicketsPage,
  })),
);
const PortalCreateTicketPage = lazy(() =>
  import('./pages/portal/PortalCreateTicketPage.js').then((m) => ({
    default: m.PortalCreateTicketPage,
  })),
);
const PortalTicketDetailPage = lazy(() =>
  import('./pages/portal/PortalTicketDetailPage.js').then((m) => ({
    default: m.PortalTicketDetailPage,
  })),
);

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size="lg" label="Loading page" />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public / Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/portal-login" element={<PortalLoginPage />} />
            <Route path="/portal-register" element={<ClientRegisterPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Agent / Admin routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['admin', 'agent']}>
                <AgentLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/new" element={<CreateTicketPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/kb/manage" element={<KBManagePage />} />
            <Route path="/kb/manage/new" element={<KBArticleEditPage />} />
            <Route path="/kb/manage/:id/edit" element={<KBArticleEditPage />} />
            <Route path="/canned-responses" element={<PlaceholderPage title="Canned Responses" />} />
            <Route path="/profile" element={<PlaceholderPage title="Profile" />} />

            {/* Admin-only routes */}
            <Route path="/admin/users" element={<PlaceholderPage title="Users" />} />
            <Route path="/admin/assignment-rules" element={<PlaceholderPage title="Auto-Assignment Rules" />} />
            <Route path="/admin/sla-policies" element={<PlaceholderPage title="SLA Policies" />} />
            <Route path="/admin/canned-responses" element={<PlaceholderPage title="Shared Canned Responses" />} />
            <Route path="/admin/branding" element={<PlaceholderPage title="Branding" />} />
            <Route path="/admin/reports" element={<ReportsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          {/* Client Portal routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['client']}>
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/portal" element={<PortalDashboardPage />} />
            <Route path="/portal/tickets" element={<PortalTicketsPage />} />
            <Route path="/portal/tickets/new" element={<PortalCreateTicketPage />} />
            <Route path="/portal/tickets/:id" element={<PortalTicketDetailPage />} />
            <Route path="/portal/kb" element={<KBBrowsePage />} />
            <Route path="/portal/kb/search" element={<KBSearchPage />} />
            <Route path="/portal/kb/:category" element={<KBCategoryPage />} />
            <Route path="/portal/kb/:category/:slug" element={<KBArticlePage />} />
            <Route path="/portal/profile" element={<PlaceholderPage title="Profile" />} />
          </Route>

          {/* Public Knowledge Base */}
          <Route path="/kb" element={<KBBrowsePage />} />
          <Route path="/kb/search" element={<KBSearchPage />} />
          <Route path="/kb/:category" element={<KBCategoryPage />} />
          <Route path="/kb/:category/:slug" element={<KBArticlePage />} />

          {/* CSAT Survey (public, no auth required) */}
          <Route path="/survey/:token" element={<CSATSurveyPage />} />

          {/* Root redirect */}
          <Route path="/" element={<HomePage />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-alt">
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary mb-6">
          <span className="text-white font-bold text-2xl">SD</span>
        </div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">SupportDesk</h1>
        <p className="text-lg text-text-secondary mb-8">Customer Support Platform</p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="rounded-md bg-primary px-6 py-3 text-white font-medium hover:bg-primary-hover transition-colors text-sm"
          >
            Agent Login
          </a>
          <a
            href="/portal-login"
            className="rounded-md border border-border bg-surface px-6 py-3 text-text-primary font-medium hover:bg-surface-alt transition-colors text-sm"
          >
            Client Portal
          </a>
        </div>
      </div>
    </div>
  );
}
