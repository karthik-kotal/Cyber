import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ReportPage } from '../src/pages/ReportPage';

vi.mock('../src/services/api', () => ({
  submitReport: vi.fn(),
  ApiError: class ApiError extends Error {
    readonly code: string;
    readonly status: number | null;
    readonly detail: string | null;
    constructor(code: string, message: string, options?: { status?: number | null; detail?: string | null }) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = options?.status ?? null;
      this.detail = options?.detail ?? null;
    }
  },
}));

import { submitReport } from '../src/services/api';

const mockedSubmitReport = submitReport as unknown as ReturnType<typeof vi.fn>;

describe('ReportPage', () => {
  it('shows a validation error when submitting with no identifier', async () => {
    render(<ReportPage lang="en" />);
    const submit = screen.getByRole('button', { name: /Submit report/i });
    fireEvent.click(submit);
    await act(async () => {});
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mockedSubmitReport).not.toHaveBeenCalled();
  });

  it('shows success state only after the backend confirms', async () => {
    mockedSubmitReport.mockResolvedValue({
      id: 'r_123',
      status: 'received',
      display_value: '+91-****-1234',
      created_at: '2026-01-01T00:00:00Z',
    });
    render(<ReportPage lang="en" />);
    fireEvent.change(screen.getByLabelText(/Phone, UPI ID or link/i), {
      target: { value: '919876543210' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit report/i }));
    await act(async () => {});
    expect(screen.getByText(/Report received/i)).toBeInTheDocument();
    expect(screen.getByText('+91-****-1234')).toBeInTheDocument();
  });

  it('submits report with string pincode without converting to number', async () => {
    mockedSubmitReport.mockResolvedValue({
      report_id: 'r_456',
      case_id: 'case_456',
      display_value: '+91-****-8632',
      merged: false,
    });
    render(<ReportPage lang="en" />);
    fireEvent.change(screen.getByLabelText(/Phone, UPI ID or link/i), {
      target: { value: '9108128632' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Pincode \(optional\)/i), {
      target: { value: '560050' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit report/i }));
    await act(async () => {});
    expect(mockedSubmitReport).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: '9108128632',
        pincode: '560050',
      })
    );
    expect(screen.getByText(/Report received/i)).toBeInTheDocument();
  });
});
