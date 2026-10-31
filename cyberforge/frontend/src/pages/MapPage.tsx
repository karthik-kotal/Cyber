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
    points.forEach((p) => {
      const scamType = p.top_scam_type || p.scam_type || 'Reported Incident';
      L.circleMarker([p.lat, p.lng], {
        radius: Math.min(6 + p.count, 20),
        color: '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: 0.7,
      })
        .bindPopup(
          `<strong>${scamType}</strong><br/>${p.locality ? `${p.locality}<br/>` : ''}Reports: ${p.count}<br/>Pincode: ${p.pincode}`,
        )
        .addTo(markers);
    });
    if (points.length > 0) {
      const group = L.featureGroup(
        points.map((p) => L.circleMarker([p.lat, p.lng])),
      );
      map.fitBounds(group.getBounds().pad(0.2));
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
  if (!data || activePoints.length === 0) {
    return (
      <section className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-900">{get(lang, 'mapSubtitle')}</p>
        </div>
        <div className="h-[400px] rounded-xl border border-slate-200 flex items-center justify-center">
          <EmptyState title={get(lang, 'empty')} hint={get(lang, 'mapEmptyHint')} icon="🗺️" />
        </div>
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
      <div className="h-[400px] rounded-xl border border-slate-200 bg-white" ref={mapRef} />
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <span aria-hidden="true">📍</span>
        {get(lang, 'legend')}
      </div>
    </section>
  );
}
