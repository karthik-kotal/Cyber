import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LookupResultCard } from '../src/components/LookupResultCard';

const result = {
  verdict: 'KNOWN_SCAM' as const,
  report_count: 5,
  distinct_reporters: 3,
  display_value: '+91-****-1234',
  challenged: true,
  first_seen: '2026-01-01T10:00:00Z',
  last_seen: '2026-01-05T12:00:00Z',
  scam_type: 'UPI fraud',
  evidence: ['screenshot', 'message'],
};

describe('LookupResultCard', () => {
  it('displays backend fields verbatim without unmasking', () => {
    render(<LookupResultCard result={result} lang="en" onDispute={() => {}} />);
    expect(screen.getByTestId('lookup-result')).toBeInTheDocument();
    expect(screen.getByTestId('display-value')).toHaveTextContent('+91-****-1234');
    expect(screen.getByTestId('challenge-indicator')).toBeInTheDocument();
    expect(screen.getByText(/Known scam/i)).toBeInTheDocument();
    expect(screen.getByText(/5 reports/i)).toBeInTheDocument();
    expect(screen.getByText(/3 people/i)).toBeInTheDocument();
    expect(screen.getByText(/UPI fraud/i)).toBeInTheDocument();
    expect(screen.getByText(/screenshot/i)).toBeInTheDocument();
    expect(screen.getByText(/message/i)).toBeInTheDocument();
  });
});
