import { useEffect, useRef, useCallback } from 'react';
import { get, type Lang } from '../i18n/strings';
import { getMap } from '../services/api';
import type { MapResponse } from '../types/api';
import { useApiData } from '../hooks/useApiData';
import { Loading } from '../components/states/Loading';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import L from 'leaflet';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

export function MapPage({ lang }: { lang: Lang }): React.JSX.Element {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);

  const fetcher = useCallback(
    (signal: AbortSignal): Promise<MapResponse> => getMap(undefined, { signal }),
    [],
  );
  const { data, loading, error, refresh } = useApiData<MapResponse>(fetcher, []);

  useEffect(() => {
    if (!data || !mapRef.current) return;
    if (mapInstance.current === null) {
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
      mapInstance.current = map;
    }
    const map = mapInstance.current;
    const markers = L.layerGroup().addTo(map);
    const points = (data.points && data.points.length > 0) ? data.points : (data.clusters || []);
    
    // Add markers for all eligible mapped clusters
    points.forEach((p) => {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || isNaN(p.lat) || isNaN(p.lng)) {
        return;
      }
      const scamType = p.top_scam_type || p.scam_type || 'Reported Incident';
      L.circleMarker([p.lat, p.lng], {
        radius: Math.min(6 + p.count, 22),
        color: '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: 0.75,
        weight: 2,
      })
        .bindPopup(
          `<strong>${scamType}</strong><br/>${p.locality ? `${p.locality}<br/>` : ''}${p.city ? `${p.city}<br/>` : ''}Reports: ${p.count}<br/>Pincode: ${p.pincode}`,
        )
        .addTo(markers);
    });

    if (points.length > 0) {
      const validPoints = points.filter(
        (p) => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng),
      );
      if (validPoints.length > 0) {
        const group = L.featureGroup(
          validPoints.map((p) => L.circleMarker([p.lat, p.lng])),
        );
        map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 14 });
      }
    }
    return () => {
      markers.clearLayers();
    };
  }, [data]);

  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="h-[400px] rounded-xl border border-slate-200 flex items-center justify-center">
        <Loading label={get(lang, 'loading')} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-[400px] rounded-xl border border-slate-200 flex items-center justify-center">
        <ErrorState error={error} onRetry={refresh} retryLabel={get(lang, 'tryAgain')} />
      </div>
    );
  }
  const activePoints = (data?.points && data.points.length > 0) ? data.points : (data?.clusters || []);
  const unmappedReports = data?.unmapped || [];
  const unmappedCount = data?.diagnostics?.unmapped_reports_count ?? unmappedReports.reduce((acc, u) => acc + u.count, 0);

  if (!data || activePoints.length === 0) {
    return (
      <section className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-900">{get(lang, 'mapSubtitle')}</p>
        </div>
        <div className="h-[360px] rounded-xl border border-slate-200 flex items-center justify-center">
          <EmptyState title={get(lang, 'empty')} hint={get(lang, 'mapEmptyHint')} icon="🗺️" />
        </div>
        {unmappedReports.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="font-semibold flex items-center gap-1.5">
              <span>ℹ️</span>
              <span>Reports in Unmapped Areas ({unmappedCount})</span>
            </p>
            <p className="mt-1 text-amber-800">
              {unmappedCount} report(s) from valid Indian pincodes ({unmappedReports.map((u) => u.pincode).join(', ')}) are verified and searchable under Check, but lack registered GPS coordinates for map placement.
            </p>
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span aria-hidden="true">📍</span>
          {get(lang, 'legend')}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-900">{get(lang, 'mapSubtitle')}</p>
      </div>
      <div className="h-[400px] rounded-xl border border-slate-200 bg-white shadow-sm" ref={mapRef} />
      {unmappedReports.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <p className="font-semibold flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>Unmapped Area Reports ({unmappedCount})</span>
          </p>
          <p className="mt-1 text-amber-800">
            {unmappedCount} report(s) from valid pincodes ({unmappedReports.map((u) => `${u.pincode}${u.city ? ` - ${u.city}` : ''}`).join(', ')}) are recorded in the database, but lack GPS coordinates for map placement.
          </p>
        </div>
      ) : null}
      <div className="flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">📍</span>
          <span>{get(lang, 'legend')} ({activePoints.reduce((acc, p) => acc + p.count, 0)} reports in {activePoints.length} clusters)</span>
        </div>
        {data.diagnostics ? (
          <span className="text-[11px] text-slate-400">Total DB reports: {data.diagnostics.total_reports}</span>
        ) : null}
      </div>
    </section>
  );
}
