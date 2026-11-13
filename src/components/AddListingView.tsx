import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Loader2, Sparkles, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  CATEGORIES,
  SAMPLE_PINCODES,
  apiFetch,
} from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type {
  AiAnalysisResponse,
  ListingCondition,
  ListingMode,
} from '../types';

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], 'sample.jpg', { type: blob.type || 'image/jpeg' });
  return compressImageFile(file);
}

export function AddListingView() {
  const {
    user,
    setAuthModalOpen,
    setActiveTab,
    addToDonationBasket,
    lat,
    lng,
    locality,
    city,
    pincode,
  } = useAppStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [images, setImages] = useState<string[]>([]);
  const [aiStatus, setAiStatus] = useState<
    'idle' | 'analyzing' | 'ready' | 'fallback'
  >('idle');
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiPriceRange, setAiPriceRange] = useState<string | null>(null);
  const [aiMetadata, setAiMetadata] = useState<Record<string, unknown> | null>(
    null
  );
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(
    user?.aiQuotaRemaining ?? null
  );

  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Home Decor');
  const [condition, setCondition] = useState<ListingCondition>('almost');
  const [mode, setMode] = useState<ListingMode>('sell');
  const [price, setPrice] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPincode, setSelectedPincode] = useState(
    user?.homePincode || pincode
  );
  const [customLocality, setCustomLocality] = useState(
    `${locality}, ${city}`
  );
  const [itemLat, setItemLat] = useState(user?.homeLat || lat);
  const [itemLng, setItemLng] = useState(user?.homeLng || lng);
  const [error, setError] = useState<string | null>(null);

  const runVisionAnalysis = async (firstImageDataUrl: string) => {
    setAiStatus('analyzing');
    setAiNote(null);
    try {
      const res = await apiFetch<AiAnalysisResponse>('/api/ai/analyze-item', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: firstImageDataUrl,
          mimeType: 'image/jpeg',
        }),
      });

      if (typeof res.quotaRemaining === 'number') {
        setQuotaRemaining(res.quotaRemaining);
      }

      if (res.fallback || !res.analysis) {
        setAiStatus('fallback');
        setAiNote(
          res.error || 'AI unavailable — please fill item details manually.'
        );
        return;
      }

      const a = res.analysis;
      setTitle(a.title);
      setBrand(a.brand);
      setCategory(a.category);
      setCondition(a.condition);
      if (a.expiryDate) setExpiryDate(a.expiryDate);
      setDescription(
        a.usageNotes ? `${a.description} ${a.usageNotes}` : a.description
      );
      if (a.suggestedPriceMax > 0) {
        const midpoint = Math.round(
          (a.suggestedPriceMin + a.suggestedPriceMax) / 2
        );
        setPrice(String(midpoint));
        setAiPriceRange(
          `Suggested ₹${a.suggestedPriceMin.toLocaleString('en-IN')}–₹${a.suggestedPriceMax.toLocaleString('en-IN')}`
        );
      }
      setAiMetadata(a as unknown as Record<string, unknown>);
      setAiStatus('ready');
      setAiNote(
        res.cached
          ? 'Pre-filled from cached AI scan.'
          : 'Pre-filled from Gemini Vision — review and adjust any field.'
      );
    } catch (err) {
      setAiStatus('fallback');
      setAiNote(
        err instanceof Error
          ? err.message
          : 'Could not scan photo automatically. Enter details manually.'
      );
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const remainingSlots = 5 - images.length;
    const chosen = Array.from(files).slice(0, remainingSlots);
    const compressed = await Promise.all(chosen.map(compressImageFile));
    const nextImages = [...images, ...compressed];
    setImages(nextImages);

    if (images.length === 0 && compressed[0]) {
      await runVisionAnalysis(compressed[0]);
    }
  };

  const handleUseSamplePhoto = async (sampleUrl: string) => {
    setError(null);
    const dataUrl = await fetchImageAsDataUrl(sampleUrl);
    const nextImages = images.length < 5 ? [...images, dataUrl] : images;
    setImages(nextImages);
    if (images.length === 0) {
      await runVisionAnalysis(dataUrl);
    }
  };

  const publishMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/listings', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          brand,
          images,
          mode,
          condition,
          category,
          price: mode === 'sell' ? Number(price) || 0 : 0,
          expiryDate: expiryDate || undefined,
          lat: itemLat,
          lng: itemLng,
          pincode: selectedPincode,
          locality: customLocality,
          aiMetadata,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      setActiveTab('discover');
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === 'PHONE_VERIFICATION_REQUIRED') {
        setAuthModalOpen(true);
      }
      setError(err.message);
    },
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold text-zinc-900">
          Sign in to list an item
        </h1>
        <p className="text-sm text-stone-600 mt-2">
          Upload up to 5 photos, let AI pre-fill the listing, and share with
          verified neighbors.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl cursor-pointer"
        >
          Sign in with Google & Phone OTP
        </button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user.phoneVerified) {
      setAuthModalOpen(true);
      return;
    }
    if (images.length === 0) {
      setError('Add at least 1 item photo.');
      return;
    }
    if (mode === 'ngo') {
      addToDonationBasket({
        title: title || 'Household donation item',
        category,
        condition,
        photo: images[0],
      });
      setActiveTab('donate');
      return;
    }
    publishMutation.mutate();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Add an item
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Snap 1–5 photos. Vision AI fills the details from the first image.
          </p>
        </div>
        {quotaRemaining !== null && (
          <span className="text-xs font-mono text-stone-600 tabular-nums">
            {quotaRemaining} / 10 AI scans left today
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photo Upload Panel */}
        <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              1. Item Photos ({images.length}/5)
            </h2>
            {aiStatus === 'analyzing' && (
              <span className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Scanning item with Gemini Vision...</span>
              </span>
            )}
            {aiStatus === 'ready' && (
              <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI pre-filled</span>
              </span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
          />

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {images.map((src, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-100"
              >
                <img
                  src={src}
                  alt={`Uploaded item ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setImages((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/65 text-white flex items-center justify-center cursor-pointer"
                  aria-label="Remove photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {images.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-amber-600 flex flex-col items-center justify-center gap-1.5 text-stone-600 hover:text-amber-700 transition-colors cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                <span className="text-xs font-medium">Add photo</span>
              </button>
            )}
          </div>

          {images.length === 0 && (
            <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-2 text-xs text-stone-600">
              <span>Quick test with sample photo:</span>
              <button
                type="button"
                onClick={() =>
                  handleUseSamplePhoto(
                    '/src/assets/images/item_brass_diyas_1794586135529.jpg'
                  )
                }
                className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg font-medium text-zinc-900 cursor-pointer"
              >
                Brass Urli & Diyas
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUseSamplePhoto(
                    '/src/assets/images/item_sunscreen_serum_1794586136107.jpg'
                  )
                }
                className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg font-medium text-zinc-900 cursor-pointer"
              >
                Sunscreen & Serum
              </button>
            </div>
          )}

          {aiNote && (
            <p
              className={`text-xs p-3 rounded-xl border ${
                aiStatus === 'fallback'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-stone-50 border-stone-200 text-stone-700'
              }`}
            >
              {aiNote}
            </p>
          )}
        </section>

        {/* Listing Details */}
        <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            2. Item Details & Sharing Mode
          </h2>

          {/* Mandatory 3-mode choice */}
          <div>
            <span className="block text-xs font-medium text-stone-600 mb-2">
              Choose what you want to do with this item
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'sell',
                  title: 'Sell',
                  desc: 'Set a fair ₹ price with pickup or Shiprocket',
                },
                {
                  id: 'free',
                  title: 'Free Share',
                  desc: 'Gift to a neighbor for local pickup',
                },
                {
                  id: 'ngo',
                  title: 'Donate to NGO',
                  desc: 'Send pickup request to verified NGOs',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id as ListingMode)}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    mode === opt.id
                      ? 'border-amber-600 bg-amber-50/60'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-900">
                      {opt.title}
                    </span>
                    {mode === opt.id && (
                      <Check className="w-4 h-4 text-amber-700" />
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="item-title"
                className="block text-xs font-medium text-stone-600 mb-1.5"
              >
                Title
              </label>
              <input
                id="item-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hammered Brass Urli Bowl"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            <div>
              <label
                htmlFor="item-brand"
                className="block text-xs font-medium text-stone-600 mb-1.5"
              >
                Brand (optional)
              </label>
              <input
                id="item-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Fabindia, Minimalist, Kindle"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="item-category"
                className="block text-xs font-medium text-stone-600 mb-1.5"
              >
                Category
              </label>
              <select
                id="item-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="item-condition"
                className="block text-xs font-medium text-stone-600 mb-1.5"
              >
                Condition
              </label>
              <select
                id="item-condition"
                value={condition}
                onChange={(e) =>
                  setCondition(e.target.value as ListingCondition)
                }
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-sm"
              >
                <option value="new">New (Unopened)</option>
                <option value="almost">Almost New</option>
                <option value="used">Partially Used</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="item-expiry"
                className="block text-xs font-medium text-stone-600 mb-1.5"
              >
                Expiry Date (if applicable)
              </label>
              <input
                id="item-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-mono"
              />
            </div>
          </div>

          {mode === 'sell' && (
            <div>
              <label
                htmlFor="item-price"
                className="block text-xs font-medium text-stone-600 mb-1.5"
              >
                Selling Price (₹){' '}
                {aiPriceRange && (
                  <span className="text-amber-700 font-normal">
                    · {aiPriceRange}
                  </span>
                )}
              </label>
              <input
                id="item-price"
                type="number"
                min={1}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="450"
                className="w-full sm:w-56 px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="item-desc"
              className="block text-xs font-medium text-stone-600 mb-1.5"
            >
              Description & Usage Notes
            </label>
            <textarea
              id="item-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share age, flaws, or why you are passing it on..."
              className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>
        </section>

        {/* Location Confirmation */}
        <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            3. Pickup Location
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="item-pincode-preset"
                className="block text-xs font-medium text-stone-600 mb-1.5"
              >
                Neighborhood PIN Code
              </label>
              <select
                id="item-pincode-preset"
                value={selectedPincode}
                onChange={(e) => {
                  const chosen = SAMPLE_PINCODES.find(
                    (p) => p.pincode === e.target.value
                  );
                  if (chosen) {
                    setSelectedPincode(chosen.pincode);
                    setCustomLocality(`${chosen.locality}, ${chosen.city}`);
                    setItemLat(chosen.lat);
                    setItemLng(chosen.lng);
                  }
                }}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-sm"
              >
                {SAMPLE_PINCODES.map((p) => (
                  <option key={p.pincode} value={p.pincode}>
                    {p.locality}, {p.city} ({p.pincode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="item-locality"
                className="block text-xs font-medium text-stone-600 mb-1.5"
              >
                Area / Locality shown publicly
              </label>
              <input
                id="item-locality"
                type="text"
                value={customLocality}
                onChange={(e) => setCustomLocality(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-stone-500">
            Exact address and phone number are hidden until a neighbor confirms
            purchase or pickup.
          </p>
        </section>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={publishMutation.isPending}
          className="w-full min-h-[48px] px-5 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>
            {publishMutation.isPending
              ? 'Publishing...'
              : mode === 'ngo'
                ? 'Continue to NGO Directory'
                : 'Publish Listing'}
          </span>
        </button>
      </form>
    </div>
  );
}
