import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MapPage } from '../src/pages/MapPage';

// Mock Leaflet because jsdom doesn't support canvas/WebGL
vi.mock('leaflet', () => {
  const layerGroupMock = {
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
  };
  const mapMock = {
    addTo: vi.fn().mockReturnThis(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
  };
  return {
    default: {
      map: vi.fn(() => mapMock),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      layerGroup: vi.fn(() => layerGroupMock),
      circleMarker: vi.fn(() => ({
        bindPopup: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
      })),
      featureGroup: vi.fn(() => ({
        getBounds: vi.fn(() => ({
          pad: vi.fn().mockReturnValue([[0, 0], [1, 1]]),
        })),
      })),
    },
  };
});

vi.mock('../src/services/api', () => ({
  getMap: vi.fn(),
}));

import { getMap } from '../src/services/api';

const mockedGetMap = getMap as unknown as ReturnType<typeof vi.fn>;

describe('MapPage', () => {
  it('renders all eligible returned clusters and unmapped area diagnostic notice', async () => {
    mockedGetMap.mockResolvedValue({
      clusters: [
        {
          pincode: '560102',
          locality: 'HSR Layout',
          city: 'Bengaluru',
          count: 5,
          top_scam_type: 'KYC_FRAUD',
          scam_type: 'KYC_FRAUD',
          severity: 'HIGH',
          lat: 12.9116,
          lng: 77.6473,
        },
        {
          pincode: '560038',
          locality: 'Indiranagar',
          city: 'Bengaluru',
          count: 2,
          top_scam_type: 'job-offer',
          scam_type: 'job-offer',
          severity: 'MED',
          lat: 12.9784,
          lng: 77.6408,
        },
      ],
      points: [
        {
          pincode: '560102',
          locality: 'HSR Layout',
          city: 'Bengaluru',
          count: 5,
          top_scam_type: 'KYC_FRAUD',
          lat: 12.9116,
          lng: 77.6473,
        },
        {
          pincode: '560038',
          locality: 'Indiranagar',
          city: 'Bengaluru',
          count: 2,
          top_scam_type: 'job-offer',
          lat: 12.9784,
          lng: 77.6408,
        },
      ],
      diagnostics: {
        total_reports: 8,
        reports_with_valid_pincodes: 8,
        reports_with_recognized_areas: 8,
        reports_with_coordinates: 7,
        reports_in_clusters: 7,
        unmapped_reports_count: 1,
        unmapped_pincodes: ['570001'],
        exclusion_reasons: { unmapped_pincode: 1 },
      },
      unmapped: [
        {
          pincode: '570001',
          count: 1,
          locality: 'Pincode 570001',
          city: 'Mysuru, Karnataka',
          reason: 'Coordinates not yet registered for this pincode',
        },
      ],
    });

    render(<MapPage lang="en" />);
    await act(async () => {});

    // Legend summary of clusters
    expect(screen.getByText(/7 reports in 2 clusters/i)).toBeInTheDocument();

    // Diagnostic information
    expect(screen.getByText(/Total DB reports: 8/i)).toBeInTheDocument();

    // Unmapped area notice
    expect(screen.getByText(/Unmapped Area Reports/i)).toBeInTheDocument();
    expect(screen.getByText(/570001/i)).toBeInTheDocument();
  });
});
