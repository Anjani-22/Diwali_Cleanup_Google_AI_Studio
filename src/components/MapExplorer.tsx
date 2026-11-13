import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation } from 'lucide-react';
import { CONDITION_LABELS, SAMPLE_PINCODES, apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { ListingItem } from '../types';
import { ItemImage } from './ItemImage';

export function MapExplorer() {
  const {
    lat,
    lng,
    locality,
    city,
    pincode,
    setLocation,
    radiusKm,
    setRadiusKm,
    setSelectedListingId,
  } = useAppStore();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [previewItem, setPreviewItem] = useState<ListingItem | null>(null);

  const queryParams = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(radiusKm),
    panIndia: 'false',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['map-listings', lat, lng, radiusKm],
    queryFn: () =>
      apiFetch<{ listings: ListingItem[] }>(
        `/api/listings?${queryParams.toString()}`
      ),
  });

  const items = data?.listings ?? [];

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    map.setView([lat, lng], radiusKm <= 10 ? 13 : radiusKm <= 25 ? 12 : 11);

    if (circleRef.current) {
      circleRef.current.remove();
    }
    circleRef.current = L.circle([lat, lng], {
      radius: radiusKm * 1000,
      color: '#d97706',
      fillColor: '#f59e0b',
      fillOpacity: 0.08,
      weight: 1.5,
    }).addTo(map);

    layer.clearLayers();

    // User location marker
    const userIcon = L.divIcon({
      className: 'dc-user-pin',
      html: `<div style="width:14px;height:14px;border-radius:9999px;background:#18181b;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker([lat, lng], { icon: userIcon }).addTo(layer);

    items.forEach((item) => {
      const label =
        item.mode === 'free'
          ? 'Free'
          : `₹${item.price.toLocaleString('en-IN')}`;
      const bg = item.mode === 'free' ? '#047857' : '#18181b';
      const icon = L.divIcon({
        className: 'dc-item-pin',
        html: `<button type="button" style="background:${bg};color:#fff;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;padding:4px 8px;border-radius:8px;border:1.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.22);white-space:nowrap;cursor:pointer;">${label}</button>`,
        iconSize: [64, 28],
        iconAnchor: [32, 14],
      });

      const marker = L.marker([item.lat, item.lng], { icon }).addTo(layer);
      marker.on('click', () => {
        setPreviewItem(item);
      });
    });
  }, [lat, lng, radiusKm, items]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Neighborhood Map
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Tap any price pin within {radiusKm} km of {locality}, {city} to
            preview and inspect the listing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm">
            <MapPin className="w-4 h-4 text-amber-700 mr-2 shrink-0" />
            <select
              aria-label="Center map on neighborhood"
              value={pincode}
              onChange={(e) => {
                const chosen = SAMPLE_PINCODES.find(
                  (p) => p.pincode === e.target.value
                );
                if (chosen) {
                  setPreviewItem(null);
                  setLocation({
                    lat: chosen.lat,
                    lng: chosen.lng,
                    locality: chosen.locality,
                    city: chosen.city,
                    pincode: chosen.pincode,
                  });
                }
              }}
              className="bg-transparent text-zinc-900 font-medium focus:outline-none cursor-pointer"
            >
              {SAMPLE_PINCODES.map((p) => (
                <option key={p.pincode} value={p.pincode}>
                  {p.locality}, {p.city}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 bg-white border border-stone-300 rounded-xl px-3.5 py-2 text-xs">
            <span className="font-mono tabular-nums font-medium text-zinc-900">
              {radiusKm} km radius
            </span>
            <input
              type="range"
              min={1}
              max={50}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              aria-label="Map search radius in kilometers"
              className="w-28 accent-amber-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 h-[520px] sm:h-[600px]">
        <div ref={mapContainerRef} className="w-full h-full" />

        <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-sm border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-900 shadow-sm">
          {isLoading
            ? 'Loading nearby pins...'
            : `${items.length} item${items.length === 1 ? '' : 's'} within ${radiusKm} km`}
        </div>

        {previewItem && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[400] bg-white border border-stone-200 rounded-2xl p-3.5 shadow-xl flex items-center gap-3.5">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 shrink-0">
              <ItemImage
                src={previewItem.images[0]}
                alt={previewItem.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 truncate">
                  {previewItem.title}
                </h2>
                <span className="text-sm font-mono font-semibold text-zinc-900 tabular-nums shrink-0">
                  {previewItem.mode === 'free'
                    ? 'Free'
                    : `₹${previewItem.price.toLocaleString('en-IN')}`}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 truncate">
                {CONDITION_LABELS[previewItem.condition]} ·{' '}
                {previewItem.distanceKm} km · {previewItem.locality}
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedListingId(previewItem.id)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>View listing</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="px-2.5 py-1.5 text-xs text-stone-500 hover:text-zinc-900 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
