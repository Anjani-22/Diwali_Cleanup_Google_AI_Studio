import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { NgoRecord } from '../types';

export function NgoDirectoryView() {
  const {
    user,
    setAuthModalOpen,
    city,
    donationBasket,
    addToDonationBasket,
    removeFromDonationBasket,
    clearDonationBasket,
  } = useAppStore();
  const queryClient = useQueryClient();

  const [cityFilter, setCityFilter] = useState(city || 'all');
  const [selectedNgo, setSelectedNgo] = useState<NgoRecord | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Clothing & Textiles');
  const [newItemCondition, setNewItemCondition] = useState('used');
  const [pickupAddress, setPickupAddress] = useState('');
  const [handoffResult, setHandoffResult] = useState<{
    ngo: NgoRecord;
    whatsappUrl: string;
    mailtoUrl: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ngos', cityFilter],
    queryFn: () =>
      apiFetch<{ ngos: NgoRecord[] }>(
        `/api/ngos?city=${encodeURIComponent(cityFilter)}`
      ),
  });

  const requestMutation = useMutation({
    mutationFn: () => {
      if (!selectedNgo) throw new Error('Select an NGO first.');
      const itemsToSend =
        donationBasket.length > 0
          ? donationBasket
          : [
              {
                title: newItemTitle.trim() || 'Household donation bundle',
                category: newItemCategory,
                condition: newItemCondition,
              },
            ];
      const photos = donationBasket
        .map((d) => d.photo)
        .filter((p): p is string => Boolean(p));

      return apiFetch<{
        ngo: NgoRecord;
        whatsappUrl: string;
        mailtoUrl: string;
      }>('/api/ngo-requests', {
        method: 'POST',
        body: JSON.stringify({
          ngoId: selectedNgo.id,
          items: itemsToSend.map((it) => ({
            listingId: it.listingId,
            title: it.title,
            category: it.category,
            condition: it.condition,
          })),
          photos,
          pickupAddress,
        }),
      });
    },
    onSuccess: (res) => {
      setHandoffResult(res);
      clearDonationBasket();
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-ngo-requests'] });
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === 'PHONE_VERIFICATION_REQUIRED') {
        setAuthModalOpen(true);
      }
    },
  });

  const ngos = data?.ngos ?? [];

  const handleAddBasketItem = () => {
    if (!newItemTitle.trim()) return;
    addToDonationBasket({
      title: newItemTitle.trim(),
      category: newItemCategory,
      condition: newItemCondition,
    });
    setNewItemTitle('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Donate to Local NGOs
          </h1>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            Bundle clothes, books, decor, or kitchenware and send an instant
            WhatsApp + email pickup request directly to verified city chapters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="ngo-city" className="text-xs font-medium text-stone-600">
            City:
          </label>
          <select
            id="ngo-city"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm font-medium text-zinc-900"
          >
            <option value="all">All Cities</option>
            <option value="Hyderabad">Hyderabad</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Mumbai">Mumbai</option>
          </select>
        </div>
      </div>

      {/* Donation Basket + Handoff Confirmation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Verified NGO Directory ({ngos.length})
          </h2>

          {isLoading ? (
            <div className="p-6 bg-white border border-stone-200 rounded-2xl text-sm text-stone-500">
              Loading NGO directory...
            </div>
          ) : ngos.length === 0 ? (
            <div className="p-6 bg-white border border-stone-200 rounded-2xl text-sm text-stone-600">
              No NGOs listed for {cityFilter} yet. Switch to All Cities to view
              other chapters.
            </div>
          ) : (
            <div className="space-y-4">
              {ngos.map((ngo) => {
                const isSelected = selectedNgo?.id === ngo.id;
                return (
                  <div
                    key={ngo.id}
                    className={`bg-white border rounded-2xl p-5 transition-colors ${
                      isSelected
                        ? 'border-amber-600 ring-1 ring-amber-600'
                        : 'border-stone-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-amber-700">
                          {ngo.city}
                        </p>
                        <h3 className="text-base font-semibold text-zinc-900 mt-0.5">
                          {ngo.name}
                        </h3>
                        <p className="text-xs text-stone-600 flex items-start gap-1.5 mt-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-stone-400" />
                          <span>{ngo.address}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNgo(ngo);
                          setHandoffResult(null);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900 text-white'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Request pickup'}
                      </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500">
                      Accepts: {ngo.categoriesAccepted.join(' · ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Donation Bundle & Outbound Request */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-5 sticky top-20">
            <h2 className="text-base font-semibold text-zinc-900">
              Your Donation Bundle
            </h2>

            {donationBasket.length > 0 && (
              <ul className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                {donationBasket.map((item, idx) => (
                  <li
                    key={idx}
                    className="p-3 flex items-center justify-between gap-3 bg-stone-50/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-stone-500">
                        {item.category} · {item.condition}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromDonationBasket(idx)}
                      className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2.5 p-3.5 bg-stone-50 border border-stone-200 rounded-xl">
              <p className="text-xs font-semibold text-zinc-900">
                Add items to bundle
              </p>
              <input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="e.g. 6 cotton kurtas, 10 storybooks"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="px-2.5 py-2 bg-white border border-stone-300 rounded-lg text-xs"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={newItemCondition}
                  onChange={(e) => setNewItemCondition(e.target.value)}
                  className="px-2.5 py-2 bg-white border border-stone-300 rounded-lg text-xs"
                >
                  <option value="new">New</option>
                  <option value="almost">Almost New</option>
                  <option value="used">Partially Used</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddBasketItem}
                disabled={!newItemTitle.trim()}
                className="w-full py-2 border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-50 rounded-lg text-xs font-semibold text-zinc-900 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to donation bundle</span>
              </button>
            </div>

            {selectedNgo ? (
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <p className="text-xs text-stone-600">
                  Sending to:{' '}
                  <strong className="text-zinc-900">{selectedNgo.name}</strong>
                </p>
                <div>
                  <label
                    htmlFor="ngo-pickup-address"
                    className="block text-xs font-medium text-stone-600 mb-1.5"
                  >
                    Pickup Address & Preferred Time
                  </label>
                  <textarea
                    id="ngo-pickup-address"
                    rows={2}
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Flat 301, Sri Sai Enclave, Madhapur 500081 (Weekend 10 AM–1 PM)"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm"
                  />
                </div>

                {requestMutation.isError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    {requestMutation.error instanceof Error
                      ? requestMutation.error.message
                      : 'Failed to create NGO request.'}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      setAuthModalOpen(true);
                      return;
                    }
                    if (!user.phoneVerified) {
                      setAuthModalOpen(true);
                      return;
                    }
                    requestMutation.mutate();
                  }}
                  disabled={
                    requestMutation.isPending ||
                    pickupAddress.trim().length < 6 ||
                    (donationBasket.length === 0 && !newItemTitle.trim())
                  }
                  className="w-full min-h-[46px] px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer"
                >
                  {requestMutation.isPending
                    ? 'Preparing request...'
                    : 'Generate NGO Pickup Request'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-stone-500">
                Select any NGO on the left to send your pickup request.
              </p>
            )}

            {handoffResult && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Pickup request logged</span>
                </div>
                <p className="text-xs text-emerald-800">
                  Tap below to send the pre-filled item list and your phone
                  number directly to {handoffResult.ngo.name}:
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    href={handoffResult.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Open WhatsApp with pre-filled message</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={handoffResult.mailtoUrl}
                    className="w-full py-2 px-3 bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Send email copy</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
