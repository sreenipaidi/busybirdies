import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../../App.js';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('App', () => {
  it('should render the home page with BusyBirdies title', () => {
    renderWithProviders(<App />);
    expect(screen.getByText('BusyBirdies')).toBeInTheDocument();
    expect(screen.getByText('Customer Support Platform')).toBeInTheDocument();
  });

  it('should render Agent Login and Client Portal links', () => {
    renderWithProviders(<App />);
    expect(screen.getByText('Agent Login')).toBeInTheDocument();
    expect(screen.getByText('Client Portal')).toBeInTheDocument();
  });
});
