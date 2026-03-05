import { BrowserRouter, Routes, Route } from 'react-router';
import { ToastContainer } from './components/ui/Toast.js';
import { AuthLayout } from './components/layout/AuthLayout.js';
import { AgentLayout } from './components/layout/AgentLayout.js';
import { PortalLayout } from './components/layout/PortalLayout.js';
import { ProtectedRoute } from './components/layout/ProtectedRoute.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.js';
import { ResetPasswordPage } from './pages/ResetPasswordPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { TicketsPage } from './pages/TicketsPage.js';
import { TicketDetailPage } from './pages/TicketDetailPage.js';
import { CreateTicketPage } from './pages/CreateTicketPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PlaceholderPage } from './pages/PlaceholderPage.js';
import { KBBrowsePage } from './pages/KBBrowsePage.js';
import { KBCategoryPage } from './pages/KBCategoryPage.js';
import { KBArticlePage } from './pages/KBArticlePage.js';
import { KBSearchPage } from './pages/KBSearchPage.js';
import { KBManagePage } from './pages/KBManagePage.js';
import { KBArticleEditPage } from './pages/KBArticleEditPage.js';

export function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* Public / Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
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
          <Route path="/admin/reports" element={<PlaceholderPage title="Reports" />} />
        </Route>

        {/* Client Portal routes */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <PortalLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/portal" element={<PlaceholderPage title="My Tickets" />} />
          <Route path="/portal/tickets/new" element={<PlaceholderPage title="New Ticket" />} />
          <Route path="/portal/tickets/:id" element={<PlaceholderPage title="Ticket Detail" />} />
          <Route path="/portal/kb" element={<KBBrowsePage />} />
          <Route path="/portal/profile" element={<PlaceholderPage title="Profile" />} />
        </Route>

        {/* Public Knowledge Base */}
        <Route path="/kb" element={<KBBrowsePage />} />
        <Route path="/kb/search" element={<KBSearchPage />} />
        <Route path="/kb/:category" element={<KBCategoryPage />} />
        <Route path="/kb/:category/:slug" element={<KBArticlePage />} />

        {/* CSAT Survey */}
        <Route path="/survey/:token" element={<PlaceholderPage title="Feedback Survey" />} />

        {/* Root redirect */}
        <Route path="/" element={<HomePage />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
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
            href="/login"
            className="rounded-md border border-border bg-surface px-6 py-3 text-text-primary font-medium hover:bg-surface-alt transition-colors text-sm"
          >
            Client Portal
          </a>
        </div>
      </div>
    </div>
  );
}
