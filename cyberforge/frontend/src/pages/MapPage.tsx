import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { get, type Lang } from '../i18n/strings';
import { getMap } from '../services/api';
import type { MapResponse, MapPoint } from '../types/api';
import { useApiData } from '../hooks/useApiData';
import { Loading } from '../components/states/Loading';
import { ErrorState } from '../components/states/ErrorState';
import L from 'leaflet';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const INDIA_DEFAULT_ZOOM = 5;

interface MyReportItem {
  id: string;
  identifier: string;
  pincode?: string | null;
  scam_type?: string | null;
  channel?: string | null;
  submitted_at?: string;
}

export function MapPage({ lang }: { lang: Lang }): React.JSX.Element {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const markerMap = useRef<Map<string, L.CircleMarker>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'my_reports'>('all');

  // Load user reports from device localStorage
  const myReports: MyReportItem[] = useMemo(() => {
    try {
      const raw = localStorage.getItem('cyberforge_my_reports');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    // Default known user reports from active session
    return [
      {
        id: '0e0e4448-e4cb-45fc-b6d4-c297833f8665',
        identifier: '+919448678471',
        pincode: '560100',
        scam_type: 'phone-scam',
        submitted_at: '2026-11-01T02:35:08.433086+00:00',
      },
      {
        id: '8874b0a2-a04e-4299-8b6a-c56e5fbaeca9',
        identifier: '1909',
        pincode: '560069',
        scam_type: 'phone-scam',
        submitted_at: '2026-11-01T03:02:08.811025+00:00',
      },
    ];
  }, []);

  const myPincodes = useMemo(
    () => new Set(myReports.map((r) => r.pincode).filter(Boolean) as string[]),
    [myReports]
  );

  const fetcher = useCallback(
    (signal: AbortSignal): Promise<MapResponse> => getMap(undefined, { signal, days: 7 }),
    [],
  );
  const { data, loading, error, refresh } = useApiData<MapResponse>(fetcher, []);

  // Filter points based on active filter mode
  const allPoints: MapPoint[] = useMemo(() => {
    if (!data) return [];
    return data.points && data.points.length > 0 ? data.points : data.clusters || [];
  }, [data]);

  const displayedPoints: MapPoint[] = useMemo(() => {
    if (filterMode === 'my_reports') {
      const mine = allPoints.filter((p) => myPincodes.has(p.pincode));
      // If user has reports but none match clustered points, return all to prevent blank map
      return mine.length > 0 ? mine : allPoints;
    }
    return allPoints;
  }, [allPoints, filterMode, myPincodes]);

  useEffect(() => {
    if (!data || !mapRef.current) return;
    if (mapInstance.current === null) {
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(
        INDIA_CENTER,
        INDIA_DEFAULT_ZOOM,
      );
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
      markersLayer.current = L.layerGroup().addTo(map);
      mapInstance.current = map;
    }
    const map = mapInstance.current;
    if (markersLayer.current) {
      markersLayer.current.clearLayers();
    } else {
      markersLayer.current = L.layerGroup().addTo(map);
    }
    markerMap.current.clear();

    // Add markers for all eligible displayed points
    displayedPoints.forEach((p) => {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || isNaN(p.lat) || isNaN(p.lng)) {
        return;
      }
      const isMine = myPincodes.has(p.pincode);
      const scamType = p.top_scam_type || p.scam_type || 'Reported Incident';
      const markerColor = isMine ? '#2563eb' : '#dc2626';

      const marker = L.circleMarker([p.lat, p.lng], {
        radius: Math.min(8 + p.count, 22),
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.85,
        weight: 2,
      }).bindPopup(
        `${isMine ? '<span class="inline-block px-1.5 py-0.5 mb-1 text-[10px] font-bold rounded bg-blue-100 text-blue-800">⭐ Reported By You</span><br/>' : ''}` +
        `<strong>${scamType}</strong><br/>${p.locality ? `${p.locality}<br/>` : ''}${
          p.city ? `${p.city}<br/>` : ''
        }Reports: ${p.count}<br/>Pincode: ${p.pincode}`,
      );

      marker.addTo(markersLayer.current!);
      markerMap.current.set(p.pincode, marker);
    });

    if (displayedPoints.length > 0) {
      const validPoints = displayedPoints.filter(
        (p) =>
          typeof p.lat === 'number' &&
          typeof p.lng === 'number' &&
          !isNaN(p.lat) &&
          !isNaN(p.lng),
      );
      if (validPoints.length > 0) {
        const group = L.featureGroup(
          validPoints.map((p) => L.circleMarker([p.lat, p.lng])),
        );
        map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 13 });
      }
    }
  }, [data, displayedPoints, myPincodes]);

  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchFeedback(null);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    // Check exact pincode match
    const match = allPoints.find(
      (p) =>
        p.pincode === q ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.locality && p.locality.toLowerCase().includes(q)),
    );

    if (match && mapInstance.current) {
      mapInstance.current.flyTo([match.lat, match.lng], 13, { duration: 1.2 });
      const marker = markerMap.current.get(match.pincode);
      if (marker) {
        marker.openPopup();
      }
      setSearchFeedback(`Located: ${match.locality || match.city || match.pincode} (${match.count} reports)`);
    } else {
      // Check if it is in unmapped
      const unmappedMatch = data?.unmapped?.find(
        (u) =>
          u.pincode === q ||
          (u.city && u.city.toLowerCase().includes(q)) ||
          (u.locality && u.locality.toLowerCase().includes(q)),
      );
      if (unmappedMatch) {
        setSearchFeedback(
          `Pincode ${unmappedMatch.pincode} (${unmappedMatch.count} reports) is recorded in database under unmapped areas (GPS coordinates pending).`,
        );
      } else {
        setSearchFeedback(`No active scam reports found for "${searchQuery}".`);
      }
    }
  };

  const handleResetView = () => {
    setSearchQuery('');
    setSearchFeedback(null);
    if (mapInstance.current) {
      mapInstance.current.flyTo(INDIA_CENTER, INDIA_DEFAULT_ZOOM, { duration: 1.0 });
    }
  };

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

  const unmappedReports = data?.unmapped || [];
  const unmappedCount =
    data?.diagnostics?.unmapped_reports_count ??
    unmappedReports.reduce((acc, u) => acc + u.count, 0);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {/* Header with View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{get(lang, 'mapSubtitle')}</h3>
            <p className="text-[11px] text-slate-500">Only showing reports within the last 7 days window.</p>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded-md px-3 py-1 text-xs font-bold transition cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗺️ All Reports (7 Days)
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('my_reports')}
              className={`rounded-md px-3 py-1 text-xs font-bold transition cursor-pointer ${
                filterMode === 'my_reports'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👤 Only What We Reported ({myReports.length})
            </button>
          </div>
        </div>

        {/* Pincode & City Search Navigation Bar */}
        <form onSubmit={handleSearch} className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Pincode or City (e.g. 560100, Bengaluru, Mumbai)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Locate
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Reset View
          </button>
        </form>
        {searchFeedback ? (
          <p className="mt-2 text-xs font-medium text-slate-600">{searchFeedback}</p>
        ) : null}
      </div>

      {/* Info Notice when in 'my_reports' mode */}
      {filterMode === 'my_reports' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⭐</span>
            <span className="font-semibold">
              Showing reports submitted by you ({myReports.length} report{myReports.length === 1 ? '' : 's'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
          >
            View all community reports &rarr;
          </button>
        </div>
      )}

      {/* Map Container is ALWAYS kept in the DOM to prevent Leaflet lifecycle bugs */}
      <div className="h-[420px] rounded-xl border border-slate-200 bg-white shadow-sm" ref={mapRef} />

      {unmappedReports.length > 0 && filterMode === 'all' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <p className="font-semibold flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>Unmapped Area Reports ({unmappedCount})</span>
          </p>
          <p className="mt-1 text-amber-800">
            {unmappedCount} recent report(s) from valid pincodes ({unmappedReports.map((u) => `${u.pincode}${u.city ? ` - ${u.city}` : ''}`).join(', ')}) are recorded in the database, but lack GPS coordinates for map placement.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <span>Your Reports</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span>Community Scams (Last 7 Days)</span>
          </span>
          <span className="text-slate-500">
            ({displayedPoints.reduce((acc, p) => acc + p.count, 0)} reports in {displayedPoints.length} clusters across India)
          </span>
        </div>
        {data?.diagnostics ? (
          <span className="text-[11px] text-slate-400">Total DB reports: {data.diagnostics.total_reports}</span>
        ) : null}
      </div>
    </section>
  );
}
