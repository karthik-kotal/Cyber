import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';
import { LicenseProvider } from '../src/context/LicenseContext';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the Three POV Entry Screen when no POV is selected', () => {
    render(
      <LicenseProvider>
        <App />
      </LicenseProvider>,
    );
    expect(screen.getByText(/Choose Your Experience/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Administrator$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Normal User$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Demo User$/i })).toBeInTheDocument();
  });

  it('renders the mobile navigation with Report, Lookup and Map for Normal User POV', () => {
    localStorage.setItem('cyberforge_pov', 'normal');
    render(
      <LicenseProvider>
        <App />
      </LicenseProvider>,
    );
    expect(screen.getByRole('link', { name: /Report/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Check/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Map/i })).toBeInTheDocument();
  });
});
