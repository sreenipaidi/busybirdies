import { BrowserRouter, Routes, Route } from 'react-router';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<PlaceholderPage title="Login" />} />
        <Route path="/dashboard" element={<PlaceholderPage title="Dashboard" />} />
        <Route path="/tickets" element={<PlaceholderPage title="Tickets" />} />
        <Route path="/tickets/:id" element={<PlaceholderPage title="Ticket Detail" />} />
        <Route path="*" element={<PlaceholderPage title="Not Found" />} />
      </Routes>
    </BrowserRouter>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">SupportDesk</h1>
        <p className="text-lg text-gray-600 mb-8">Customer Support Platform</p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Agent Login
          </a>
          <a
            href="/portal"
            className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Client Portal
          </a>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-500">This page is under construction.</p>
      </div>
    </div>
  );
}
