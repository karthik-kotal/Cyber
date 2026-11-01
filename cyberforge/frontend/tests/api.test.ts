import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  apiBaseUrl,
  buildUrl,
  setCustomApiBaseUrl,
  getCustomApiBaseUrl,
  DEFAULT_DEVICE_API_BASE_URL,
} from '../src/services/api';

describe('API URL Resolution and Mobile Configuration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('uses DEFAULT_DEVICE_API_BASE_URL when running in localhost mobile context without override', () => {
    const base = apiBaseUrl();
    // In jsdom test environment, window.location.hostname is localhost
    expect(base).toBe(DEFAULT_DEVICE_API_BASE_URL);
  });

  it('stores and retrieves custom API base URL in localStorage', () => {
    expect(getCustomApiBaseUrl()).toBe('');

    setCustomApiBaseUrl('http://192.168.1.50:8000/');
    expect(getCustomApiBaseUrl()).toBe('http://192.168.1.50:8000');
    expect(apiBaseUrl()).toBe('http://192.168.1.50:8000');

    setCustomApiBaseUrl(null);
    expect(getCustomApiBaseUrl()).toBe('');
    expect(apiBaseUrl()).toBe(DEFAULT_DEVICE_API_BASE_URL);
  });

  it('buildUrl constructs valid absolute URLs with base and paths', () => {
    setCustomApiBaseUrl('http://192.168.60.239:8000');

    const mapUrl = buildUrl('/api/map');
    expect(mapUrl).toBe('http://192.168.60.239:8000/api/map');

    const reportUrl = buildUrl('/api/report');
    expect(reportUrl).toBe('http://192.168.60.239:8000/api/report');
  });

  it('buildUrl correctly encodes query parameters', () => {
    setCustomApiBaseUrl('http://192.168.60.239:8000');

    const filteredUrl = buildUrl('/api/map', { pincode: '560001', days: 7 });
    expect(filteredUrl).toContain('pincode=560001');
    expect(filteredUrl).toContain('days=7');
  });

  it('buildUrl handles URL without protocol safely by prefixing http://', () => {
    setCustomApiBaseUrl('192.168.60.239:8000');
    const url = buildUrl('/api/health');
    expect(url).toBe('http://192.168.60.239:8000/api/health');
  });
});


import { isVerifiedEntity, getVerifiedBusinessDetails } from '../src/constants/verifiedBusinesses';

describe('Official Appendix C Verified Businesses & Sybil Protections', () => {
  it('identifies official helplines as verified entities', () => {
    expect(isVerifiedEntity('1930')).toBe(true);
    expect(getVerifiedBusinessDetails('1930')?.belongs_to).toBe('National Cybercrime Helpline');

    expect(isVerifiedEntity('1909')).toBe(true);
    expect(getVerifiedBusinessDetails('1909')?.category).toBe('GOVERNMENT');
  });

  it('identifies banking toll-free numbers regardless of spaces or prefixes', () => {
    expect(isVerifiedEntity('18001600')).toBe(true);
    expect(isVerifiedEntity('1800 1600')).toBe(true);
    expect(isVerifiedEntity('18001234')).toBe(true);
    expect(getVerifiedBusinessDetails('18001234')?.belongs_to).toContain('State Bank of India');
  });

  it('identifies official SMS sender IDs in any case', () => {
    expect(isVerifiedEntity('AXISBK')).toBe(true);
    expect(isVerifiedEntity('axisbk')).toBe(true);
    expect(isVerifiedEntity('HDFCBK')).toBe(true);
    expect(isVerifiedEntity('SBIINB')).toBe(true);
  });

  it('identifies certified local businesses with and without country code', () => {
    expect(isVerifiedEntity('+91 80 4100 2233')).toBe(true);
    expect(isVerifiedEntity('+918041002233')).toBe(true);
    expect(isVerifiedEntity('08041002233')).toBe(true);
    expect(getVerifiedBusinessDetails('+918041002233')?.belongs_to).toContain('Fresh Bakes');

    expect(isVerifiedEntity('+91 80 2553 0190')).toBe(true);
    expect(getVerifiedBusinessDetails('+918025530190')?.belongs_to).toContain('Koramangala Pharmacy');
  });

  it('rejects regular scam numbers from verified status', () => {
    expect(isVerifiedEntity('+919108128632')).toBe(false);
    expect(isVerifiedEntity('+919123456789')).toBe(false);
    expect(isVerifiedEntity('scammer@upi')).toBe(false);
    expect(getVerifiedBusinessDetails('+919108128632')).toBeNull();
  });
});
