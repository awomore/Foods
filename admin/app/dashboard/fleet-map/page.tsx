'use client';

import { useEffect, useState, useCallback } from 'react';
import { fleetMapApi, type ActiveRiderLocation } from '@/lib/api';
import { MapPin, RefreshCw, Bike, Clock, Navigation } from 'lucide-react';

function freshnessLabel(updatedAt: string): string {
  const secs = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

function FreshnessBadge({ updatedAt }: { updatedAt: string }) {
  const secs = (Date.now() - new Date(updatedAt).getTime()) / 1000;
  const isLive = secs < 60;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
      isLive ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
    }`}>
      <Clock size={10} />
      {isLive ? 'Live' : freshnessLabel(updatedAt)}
    </span>
  );
}

export default function FleetMapPage() {
  const [locations, setLocations] = useState<ActiveRiderLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fleetMapApi.getActiveLocations();
      setLocations(res.locations);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  function openInMaps(lat: number, lng: number, name: string) {
    window.open(`https://maps.google.com/maps?q=${lat},${lng}&z=15&label=${encodeURIComponent(name)}`, '_blank');
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MapPin size={20} className="text-brand" />
            Live Fleet Map
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {locations.length} active rider{locations.length !== 1 ? 's' : ''} · refreshes every 15s ·
            Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          title="Refresh now"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && locations.length === 0 ? (
        <div className="py-20 text-center text-sm text-gray-400">Loading active riders…</div>
      ) : locations.length === 0 ? (
        <div className="py-20 text-center space-y-2">
          <MapPin size={32} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">No riders currently broadcasting location.</p>
          <p className="text-xs text-gray-400">Riders share GPS when a delivery is active.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {locations.map(loc => (
            <div
              key={loc.order_id}
              className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-start gap-4"
            >
              <div className="w-10 h-10 bg-brand-light rounded-full flex items-center justify-center flex-shrink-0">
                <Bike size={18} className="text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold text-gray-900">{loc.rider_name}</p>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded capitalize">
                    {loc.vehicle_type}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    loc.order_status === 'out_for_delivery' || loc.order_status === 'in_transit'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {loc.order_status.replace(/_/g, ' ')}
                  </span>
                  <FreshnessBadge updatedAt={loc.updated_at} />
                </div>
                <p className="text-xs text-gray-500">
                  {loc.rider_phone}
                  {loc.delivery_address && ` · → ${loc.delivery_address}`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                  {loc.speed != null ? ` · ${Math.round(loc.speed * 3.6)} km/h` : ''}
                  {loc.heading != null ? ` · ${Math.round(loc.heading)}°` : ''}
                </p>
              </div>
              <button
                onClick={() => openInMaps(loc.latitude, loc.longitude, loc.rider_name)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand border border-brand/30 hover:bg-brand-light rounded-lg flex-shrink-0"
              >
                <Navigation size={12} />
                Map
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pt-2">
        Only riders broadcasting location in the last 10 minutes are shown.
        Click Map to open Google Maps at the rider's last known position.
      </p>
    </div>
  );
}
