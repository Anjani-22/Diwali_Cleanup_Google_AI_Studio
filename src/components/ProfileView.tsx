import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import {
  AlertTriangle,
  ExternalLink,
  HeartHandshake,
  LogOut,
  Shield,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { CONDITION_LABELS, SAMPLE_PINCODES, apiFetch } from '../lib/api';
import { auth } from '../lib/firebase';
import { useAppStore } from '../store/useAppStore';
import type {
  ListingCondition,
  ListingItem,
  NgoRequestRecord,
  TransactionRecord,
  UserProfile,
} from '../types';
import { ItemImage } from './ItemImage';

export function ProfileView() {
  const {
    user,
    setUser,
    setAuthModalOpen,
    setActiveTab,
    addToDonationBasket,
    setSelectedListingId,
  } = useAppStore();
  const queryClient = useQueryClient();

  const [conditionTab, setConditionTab] = useState<
    ListingCondition | 'orders' | 'donations'
  >('new');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'sold' | 'donated' | 'expired'
  >('all');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPincode, setEditPincode] = useState(
    user?.homePincode || '500081'
  );

  const { data: myListingsData } = useQuery({
    queryKey: ['my-listings'],
    enabled: Boolean(user),
    queryFn: () => apiFetch<{ listings: ListingItem[] }>('/api/my/listings'),
  });

  const { data: myTxData } = useQuery({
    queryKey: ['my-transactions'],
    enabled: Boolean(user),
    queryFn: () =>
      apiFetch<{ transactions: TransactionRecord[] }>('/api/my/transactions'),
  });

  const { data: myNgoData } = useQuery({
    queryKey: ['my-ngo-requests'],
    enabled: Boolean(user),
    queryFn: () =>
      apiFetch<{ requests: NgoRequestRecord[] }>('/api/my/ngo-requests'),
  });

  const updateProfileMutation = useMutation({
    mutationFn: () => {
      const preset = SAMPLE_PINCODES.find((p) => p.pincode === editPincode);
      return apiFetch<{ user: UserProfile }>('/api/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: editName,
          homePincode: editPincode,
          ...(preset
            ? {
                homeLat: preset.lat,
                homeLng: preset.lng,
                homeCity: preset.city,
              }
            : {}),
        }),
      });
    },
    onSuccess: (res) => {
      setUser(res.user);
      setEditingProfile(false);
    },
  });

  const removeListingMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/listings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'removed' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold text-zinc-900">
          Your Profile
        </h1>
        <p className="text-sm text-stone-600 mt-2">
          Sign in to track your shared items, orders, Shiprocket tracking, and
          NGO donations.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl cursor-pointer"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  const allMyListings = (myListingsData?.listings ?? []).filter(
    (l) => l.status !== 'removed'
  );
  const filteredListings = allMyListings.filter((item) => {
    if (conditionTab !== item.condition) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  const handleDonateExpired = (item: ListingItem) => {
    addToDonationBasket({
      listingId: item.id,
      title: item.title,
      category: item.category,
      condition: item.condition,
      photo: item.images[0],
    });
    setActiveTab('donate');
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setActiveTab('discover');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12 space-y-6">
      {/* Header Card */}
      <section className="bg-white border border-stone-200 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-zinc-900">
              {user.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 mt-1">
              <span>{user.homeCity}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">PIN {user.homePincode}</span>
              <span aria-hidden="true">·</span>
              {user.phoneVerified ? (
                <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{user.phone} verified</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="text-amber-700 font-semibold underline cursor-pointer"
                >
                  Verify +91 mobile number
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user.isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="px-3.5 py-2 border border-stone-300 hover:bg-stone-50 rounded-xl text-xs font-semibold text-zinc-900 flex items-center gap-1.5 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Moderation</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditName(user.name);
                setEditPincode(user.homePincode);
                setEditingProfile((s) => !s);
              }}
              className="px-3.5 py-2 border border-stone-300 hover:bg-stone-50 rounded-xl text-xs font-semibold text-zinc-900 cursor-pointer"
            >
              Edit Profile
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3.5 py-2 border border-stone-300 hover:bg-stone-50 rounded-xl text-xs font-semibold text-stone-700 flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {editingProfile && (
          <div className="mt-5 pt-5 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Home PIN Code
              </label>
              <select
                value={editPincode}
                onChange={(e) => setEditPincode(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm"
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
              onClick={() => updateProfileMutation.mutate()}
              disabled={updateProfileMutation.isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl cursor-pointer"
            >
              {updateProfileMutation.isPending ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        )}
      </section>

      {/* Primary Profile Tabs: New / Almost New / Partially Used + Orders + Donations */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-200/70 rounded-xl w-fit">
        {[
          { id: 'new', label: 'New' },
          { id: 'almost', label: 'Almost New' },
          { id: 'used', label: 'Partially Used' },
          { id: 'orders', label: 'Orders & Pickups' },
          { id: 'donations', label: 'NGO Requests' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              setConditionTab(
                t.id as ListingCondition | 'orders' | 'donations'
              )
            }
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              conditionTab === t.id
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-stone-600 hover:text-zinc-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Listings by Condition */}
      {(conditionTab === 'new' ||
        conditionTab === 'almost' ||
        conditionTab === 'used') && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(['all', 'active', 'sold', 'donated', 'expired'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg border font-medium capitalize cursor-pointer ${
                    statusFilter === st
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>

          {filteredListings.length === 0 ? (
            <div className="p-8 bg-white border border-stone-200 rounded-2xl text-center text-sm text-stone-600">
              No {CONDITION_LABELS[conditionTab].toLowerCase()} listings in this
              section yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredListings.map((item) => {
                const isExpired = item.status === 'expired';
                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-2xl overflow-hidden ${
                      isExpired ? 'border-red-300' : 'border-stone-200'
                    }`}
                  >
                    <div
                      onClick={() => setSelectedListingId(item.id)}
                      className="aspect-[4/3] bg-stone-100 cursor-pointer"
                    >
                      <ItemImage
                        src={item.images[0]}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4 space-y-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold text-zinc-900 truncate">
                          {item.title}
                        </h3>
                        <span className="text-xs font-mono font-semibold text-zinc-900 tabular-nums shrink-0">
                          {item.mode === 'free'
                            ? 'Free'
                            : `₹${item.price.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                      <p
                        className={`text-xs font-medium ${
                          isExpired ? 'text-red-700' : 'text-stone-500'
                        }`}
                      >
                        Status: {item.status.toUpperCase()}
                        {item.expiryDate ? ` · Exp ${item.expiryDate}` : ''}
                      </p>

                      {isExpired && (
                        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>
                            Product expired. Remove it or donate usable parts to
                            an NGO instead.
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                        {isExpired && (
                          <button
                            type="button"
                            onClick={() => handleDonateExpired(item)}
                            className="flex-1 py-1.5 px-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <HeartHandshake className="w-3.5 h-3.5" />
                            <span>Donate to NGO</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeListingMutation.mutate(item.id)}
                          className="py-1.5 px-2.5 border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Orders & Pickups */}
      {conditionTab === 'orders' && (
        <div className="space-y-3">
          {(myTxData?.transactions ?? []).length === 0 ? (
            <div className="p-8 bg-white border border-stone-200 rounded-2xl text-center text-sm text-stone-600">
              No purchases or free pickup requests yet.
            </div>
          ) : (
            (myTxData?.transactions ?? []).map((tx) => (
              <div
                key={tx.id}
                className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                    <ItemImage
                      src={tx.listingImage}
                      alt={tx.listingTitle || 'Order item'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-amber-700 uppercase">
                      {tx.role === 'buyer' ? 'Bought / Requested' : 'Sold'}
                    </p>
                    <h3 className="text-sm font-semibold text-zinc-900">
                      {tx.listingTitle}
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {tx.deliveryMode === 'ship'
                        ? `Shiprocket AWB: ${tx.shiprocketAwb}`
                        : `Self-pickup · ${tx.listingLocality}`}
                      {tx.sellerPhone ? ` · Contact ${tx.sellerPhone}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono font-semibold tabular-nums text-zinc-900">
                    {tx.amount === 0
                      ? 'Free'
                      : `₹${(tx.amount + tx.shippingFee).toLocaleString('en-IN')}`}
                  </span>
                  {tx.trackingUrl && (
                    <a
                      href={tx.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-amber-700 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Track</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* NGO Requests */}
      {conditionTab === 'donations' && (
        <div className="space-y-3">
          {(myNgoData?.requests ?? []).length === 0 ? (
            <div className="p-8 bg-white border border-stone-200 rounded-2xl text-center text-sm text-stone-600">
              No NGO pickup requests sent yet.
            </div>
          ) : (
            (myNgoData?.requests ?? []).map((req) => (
              <div
                key={req.id}
                className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {req.ngoName} ({req.ngoCity})
                  </h3>
                  <p className="text-xs text-stone-600 mt-1">
                    Items: {req.items.map((i) => i.title).join(', ')}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Pickup: {req.pickupAddress}
                  </p>
                </div>
                <span className="text-xs font-mono uppercase text-emerald-700 font-semibold">
                  {req.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
