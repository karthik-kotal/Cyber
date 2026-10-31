import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerdictBadge } from '../src/components/VerdictBadge';

describe('VerdictBadge', () => {
  it.each([
    ['KNOWN_SCAM', 'Known scam'],
    ['SUSPICIOUS', 'Suspicious'],
    ['NO_REPORTS', 'No scam reports'],
    ['VERIFIED_BUSINESS', 'Verified business'],
  ])('renders %s backend verdict', (verdict, expected) => {
    render(<VerdictBadge verdict={verdict as any} lang="en" />);
    expect(screen.getByTestId('verdict-badge')).toHaveTextContent(expected);
  });
});
