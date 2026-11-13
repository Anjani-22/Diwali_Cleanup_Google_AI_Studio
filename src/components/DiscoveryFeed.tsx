import { useQuery } from '@tanstack/react-query';
import { Crosshair, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import {
  CATEGORIES,
  CONDITION_LABELS,
  SAMPLE_PINCODES,
  apiFetch,
} from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { ListingItem } from '../types';
import { ItemImage } from './ItemImage';

export function DiscoveryFeed() {
  const {
    lat,
    lng,
    locality,
    city,
    pincode,
    setLocation,
    radiusKm,
    setRadiusKm,
    panIndia,
    setPanIndia,
    category,
    setCategory,
    condition,
    setCondition,
    mode,
    setMode,
    maxPrice,
    setMaxPrice,
    searchQuery,
    setSearchQuery,
    setSelectedListingId,
    setActiveTab,
    user,
    setAuthModalOpen,
  } = useAppStore();

  const [showFilters, setShowFilters] = useState(false);
  const [locating, setLocating] = useState(false);

  const queryParams = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(radiusKm),
    panIndia: String(panIndia),
    category,
    condition,
    mode,
    ...(maxPrice ? { maxPrice } : {}),
    ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['listings', queryParams.toString()],
    queryFn: () =>
      apiFetch<{ listings: ListingItem[] }>(
        `/api/listings?${queryParams.toString()}`
      ),
  });

  const items = data?.listings ?? [];

  const handleUseBrowserGps = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
          locality: 'Current Location',
          city: city || 'Nearby',
          pincode,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { timeout: 6000 }
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12">
      {/* Editorial Split Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pb-10 border-b border-stone-200">
        <div className="lg:col-span-6 flex flex-col justify-center py-2">
          <p className="text-xs font-medium text-amber-700 tracking-wide mb-3">
            Hyperlocal India · {locality}, {city}
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-semibold text-zinc-900 tracking-tight leading-[1.12] text-balance">
            Pass on unused home treasures to neighbors nearby.
          </h1>
          <p className="text-base text-stone-600 mt-4 max-w-xl leading-relaxed">
            Snap a photo and let vision AI draft the listing in seconds. Sell
            fairly in ₹, share for free within walking distance, or request a
            verified NGO pickup.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setAuthModalOpen(true);
                } else {
                  setActiveTab('add');
                }
              }}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              List an item with AI
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className="px-5 py-2.5 bg-white hover:bg-stone-50 text-zinc-900 border border-stone-300 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Explore neighborhood map
            </button>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="h-64 sm:h-80 lg:h-full rounded-2xl overflow-hidden border border-stone-200 bg-stone-100">
            <ItemImage
              src="/src/assets/images/hero_cleanup_flatlay_1794586135730.jpg"
              alt="Curated household items ready to share, sell, or donate in an Indian home"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Search & Neighborhood Filter Toolbar */}
      <section className="py-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brass lamps, sunscreen, Kindle, kurtas..."
              aria-label="Search nearby listings"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm">
              <MapPin className="w-4 h-4 text-amber-700 mr-2 shrink-0" />
              <select
                aria-label="Select neighborhood"
                value={pincode}
                onChange={(e) => {
                  const chosen = SAMPLE_PINCODES.find(
                    (p) => p.pincode === e.target.value
                  );
                  if (chosen) {
                    setLocation({
                      lat: chosen.lat,
                      lng: chosen.lng,
                      locality: chosen.locality,
                      city: chosen.city,
                      pincode: chosen.pincode,
                    });
                  }
                }}
                className="bg-transparent text-zinc-900 font-medium focus:outline-none pr-1 cursor-pointer"
              >
                {SAMPLE_PINCODES.map((p) => (
                  <option key={p.pincode} value={p.pincode}>
                    {p.locality}, {p.city} ({p.pincode})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleUseBrowserGps}
              disabled={locating}
              className="px-3 py-2 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium text-stone-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Crosshair className="w-4 h-4" />
              <span>{locating ? 'Locating...' : 'Near me'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className={`px-3.5 py-2 border rounded-xl text-sm font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                showFilters
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-900 border-stone-300 hover:bg-stone-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Interactive Mode Segmented Controls & Radius Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-xl">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'sell', label: 'For Sale' },
              { id: 'free', label: 'Free Share' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  mode === tab.id
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-stone-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs text-stone-600">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={panIndia}
                onChange={(e) => setPanIndia(e.target.checked)}
                className="accent-amber-600 rounded"
              />
              <span>Include pan-India Shiprocket items</span>
            </label>
            {!panIndia && (
              <div className="flex items-center gap-2">
                <span className="font-mono tabular-nums text-zinc-900 font-medium">
                  Within {radiusKm} km
                </span>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  aria-label="Maximum distance in kilometers"
                  className="w-24 accent-amber-600 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="p-4 bg-white border border-stone-200 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm text-zinc-900"
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm text-zinc-900"
              >
                <option value="all">Any condition</option>
                <option value="new">New</option>
                <option value="almost">Almost New</option>
                <option value="used">Partially Used</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Max Price (₹)
              </label>
              <input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="e.g. 2000"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm font-mono tabular-nums text-zinc-900"
              />
            </div>
          </div>
        )}
      </section>

      {/* Feed Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white border border-stone-200 rounded-2xl overflow-hidden animate-pulse"
            >
              <div className="aspect-[4/3] bg-stone-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-stone-200 rounded w-3/4" />
                <div className="h-3 bg-stone-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="p-8 bg-white border border-stone-200 rounded-2xl text-center">
          <p className="text-sm text-stone-600 mb-3">
            Could not load nearby listings right now.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 bg-white border border-stone-200 rounded-2xl text-center">
          <h2 className="font-display text-xl font-semibold text-zinc-900">
            No items match within {panIndia ? 'India' : `${radiusKm} km`}
          </h2>
          <p className="text-sm text-stone-600 mt-1.5">
            Widen your distance slider or enable pan-India Shiprocket items to
            see more listings.
          </p>
          <button
            type="button"
            onClick={() => {
              setPanIndia(true);
              setCategory('all');
              setCondition('all');
              setMode('all');
              setMaxPrice('');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl cursor-pointer"
          >
            Show all items across India
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <article
              key={item.id}
              onClick={() => setSelectedListingId(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedListingId(item.id);
                }
              }}
              tabIndex={0}
              role="button"
              className="group bg-white border border-stone-200 rounded-2xl overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              <div className="aspect-[4/3] w-full bg-stone-100 overflow-hidden">
                <ItemImage
                  src={item.images[0]}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
              </div>

              <div className="p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-semibold text-zinc-900 line-clamp-1">
                    {item.title}
                  </h3>
                  <span
                    className={`text-sm font-mono font-medium tabular-nums shrink-0 ${
                      item.mode === 'free'
                        ? 'text-emerald-700'
                        : 'text-zinc-900'
                    }`}
                  >
                    {item.mode === 'free'
                      ? 'Free Share'
                      : `₹${item.price.toLocaleString('en-IN')}`}
                  </span>
                </div>

                {/* Unboxed metadata with typographic separators */}
                <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1.5 truncate">
                  <span>{item.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{CONDITION_LABELS[item.condition]}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-zinc-700">
                    {item.distanceKm} km
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-500 mt-3 pt-3 border-t border-stone-100">
                  <span className="truncate">
                    {item.seller.name} · {item.locality}
                  </span>
                  {item.delivery.shiprocketAllowed &&
                    !item.delivery.pickupAllowed && (
                      <span className="text-amber-700 font-medium shrink-0">
                        Ships pan-India
                      </span>
                    )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
