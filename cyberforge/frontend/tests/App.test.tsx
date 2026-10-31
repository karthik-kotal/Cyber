import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';
import { LicenseProvider } from '../src/context/LicenseContext';

describe('App', () => {
  it('renders the mobile navigation with Report, Lookup and Map', () => {
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
