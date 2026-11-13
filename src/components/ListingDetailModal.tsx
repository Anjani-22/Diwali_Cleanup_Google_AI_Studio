import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flag,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { CONDITION_LABELS, apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { ListingItem, TransactionRecord } from '../types';
import { ItemImage } from './ItemImage';

export function ListingDetailModal() {
  const {
    selectedListingId,
    setSelectedListingId,
    lat,
    lng,
    user,
    setAuthModalOpen,
  } = useAppStore();
  const queryClient = useQueryClient();

  const [photoIdx, setPhotoIdx] = useState(0);
  const [deliveryMode, setDeliveryMode] = useState<'pickup' | 'ship'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<
    'upi' | 'card' | 'netbanking' | 'cod'
  >('upi');
  const [shippingAddress, setShippingAddress] = useState('');
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagDone, setFlagDone] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<{
    transaction: TransactionRecord;
    sellerContact: {
      name: string;
      phone: string | null;
      locality: string;
      pincode: string;
    };
  } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['listing-detail', selectedListingId, lat, lng],
    enabled: Boolean(selectedListingId),
    queryFn: () =>
      apiFetch<{ listing: ListingItem }>(
        `/api/listings/${selectedListingId}?lat=${lat}&lng=${lng}`
      ),
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload: {
      listingId: number;
      paymentMethod: string;
      deliveryMode: 'pickup' | 'ship';
      shippingAddress?: string;
    }) =>
      apiFetch<{
        transaction: TransactionRecord;
        sellerContact: {
          name: string;
          phone: string | null;
          locality: string;
          pincode: string;
        };
      }>('/api/transactions/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      setCheckoutResult(res);
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['listing-detail', selectedListingId] });
      queryClient.invalidateQueries({ queryKey: ['my-transactions'] });
    },
  });

  const flagMutation = useMutation({
    mutationFn: (reason: string) =>
      apiFetch<{ flagged: boolean }>(`/api/listings/${selectedListingId}/flag`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      setFlagDone(true);
      setFlagOpen(false);
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  if (!selectedListingId) return null;

  const listing = data?.listing;
  const images = listing?.images ?? [];
  const activeDelivery =
    listing && !listing.delivery.pickupAllowed ? 'ship' : deliveryMode;

  const totalPayable = listing
    ? (listing.mode === 'sell' ? listing.price : 0) +
      (activeDelivery === 'ship' ? listing.delivery.shippingFee : 0)
    : 0;

  const isExpired =
    listing?.status === 'expired' ||
    Boolean(
      listing?.expiryDate &&
        listing.expiryDate < new Date().toISOString().slice(0, 10)
    );

  const handleClose = () => {
    setSelectedListingId(null);
    setPhotoIdx(0);
    setCheckoutResult(null);
    setFlagOpen(false);
    setFlagDone(false);
  };

  const handleAction = () => {
    if (!listing) return;
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!user.phoneVerified) {
      setAuthModalOpen(true);
      return;
    }
    checkoutMutation.mutate({
      listingId: listing.id,
      paymentMethod: listing.mode === 'free' ? 'free_request' : paymentMethod,
      deliveryMode: activeDelivery,
      shippingAddress: activeDelivery === 'ship' ? shippingAddress : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Listing detail"
    >
      <div className="bg-[#faf9f6] w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl border border-stone-200 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-20 bg-[#faf9f6]/95 backdrop-blur-md border-b border-stone-200 px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm font-medium text-stone-700 hover:text-zinc-900 flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to feed</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200/60 cursor-pointer"
            aria-label="Close listing detail"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-sm text-stone-500">Loading item details...</div>
        ) : isError || !listing ? (
          <div className="p-8 text-sm text-red-700">
            This listing could not be loaded.
          </div>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Gallery */}
            <div className="lg:col-span-7 space-y-3">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                <ItemImage
                  src={images[photoIdx]}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPhotoIdx(
                          (i) => (i - 1 + images.length) % images.length
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow cursor-pointer"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPhotoIdx((i) => (i + 1) % images.length)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow cursor-pointer"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoIdx(i)}
                      className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer ${
                        photoIdx === i
                          ? 'border-amber-600'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <ItemImage
                        src={img}
                        alt={`${listing.title} photo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Item Notes
                </h2>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {listing.description}
                </p>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-stone-100 text-xs">
                  <div>
                    <dt className="text-stone-500">Category</dt>
                    <dd className="font-medium text-zinc-900 mt-0.5">
                      {listing.category}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-500">Brand</dt>
                    <dd className="font-medium text-zinc-900 mt-0.5">
                      {listing.brand || 'Unbranded'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-500">Expiry Date</dt>
                    <dd className="font-mono text-zinc-900 mt-0.5">
                      {listing.expiryDate || 'Not applicable'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Right Contiguous Purchase & Delivery Module */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                    <span>{CONDITION_LABELS[listing.condition]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {listing.distanceKm} km away
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{listing.locality}</span>
                  </div>
                  <h1 className="font-display text-2xl font-semibold text-zinc-900 text-balance">
                    {listing.title}
                  </h1>
                  <p
                    className={`text-2xl font-mono font-semibold tabular-nums mt-2 ${
                      listing.mode === 'free'
                        ? 'text-emerald-700'
                        : 'text-zinc-900'
                    }`}
                  >
                    {listing.mode === 'free'
                      ? 'Free Share'
                      : `₹${listing.price.toLocaleString('en-IN')}`}
                  </p>
                </div>

                {/* Seller privacy summary */}
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {listing.seller.name}
                    </p>
                    <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>
                        {listing.seller.phoneVerified
                          ? 'Phone OTP verified neighbor'
                          : 'Neighbor account'}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs font-mono text-stone-600 tabular-nums">
                    PIN {listing.pincode}
                  </span>
                </div>

                {/* Confirmed Transaction / Seller Contact */}
                {(checkoutResult || listing.transaction) && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
                    <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        {listing.mode === 'free'
                          ? 'Item requested successfully'
                          : 'Order confirmed'}
                      </span>
                    </div>
                    {(checkoutResult?.sellerContact.phone ||
                      listing.seller.phone) && (
                      <p className="text-xs text-emerald-900 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        <span>
                          Seller phone:{' '}
                          <strong className="font-mono">
                            {checkoutResult?.sellerContact.phone ||
                              listing.seller.phone}
                          </strong>
                        </span>
                      </p>
                    )}
                    <p className="text-xs text-emerald-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>
                        Pickup area: {listing.locality}, PIN {listing.pincode}
                      </span>
                    </p>
                    {(checkoutResult?.transaction.shiprocketAwb ||
                      listing.transaction?.shiprocketAwb) && (
                      <div className="pt-2 border-t border-emerald-200 text-xs text-emerald-900 space-y-1">
                        <p>
                          Shiprocket AWB:{' '}
                          <span className="font-mono font-semibold">
                            {checkoutResult?.transaction.shiprocketAwb ||
                              listing.transaction?.shiprocketAwb}
                          </span>
                        </p>
                        <a
                          href={
                            checkoutResult?.transaction.trackingUrl ||
                            listing.transaction?.trackingUrl ||
                            '#'
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold underline"
                        >
                          <span>Track Shiprocket parcel</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Delivery & Checkout Controls (when active & not owner & not completed) */}
                {!checkoutResult &&
                  !listing.transaction &&
                  listing.status === 'active' &&
                  !isExpired &&
                  !listing.isOwner && (
                    <div className="space-y-4 pt-2 border-t border-stone-100">
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 mb-2">
                          Delivery option
                        </p>
                        <p className="text-xs text-stone-600 mb-2.5">
                          {listing.delivery.note}
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {listing.delivery.pickupAllowed && (
                            <button
                              type="button"
                              onClick={() => setDeliveryMode('pickup')}
                              className={`p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                                activeDelivery === 'pickup'
                                  ? 'border-amber-600 bg-amber-50/50 text-zinc-900'
                                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                              }`}
                            >
                              <div className="flex items-center justify-between font-semibold">
                                <span>Self-pickup / Hand-delivery</span>
                                <span className="font-mono">₹0</span>
                              </div>
                            </button>
                          )}

                          {listing.delivery.shiprocketAllowed &&
                            listing.mode === 'sell' && (
                              <button
                                type="button"
                                onClick={() => setDeliveryMode('ship')}
                                className={`p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                                  activeDelivery === 'ship'
                                    ? 'border-amber-600 bg-amber-50/50 text-zinc-900'
                                    : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                                }`}
                              >
                                <div className="flex items-center justify-between font-semibold">
                                  <span className="flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>Shiprocket Courier (Buyer pays)</span>
                                  </span>
                                  <span className="font-mono">
                                    +₹{listing.delivery.shippingFee}
                                  </span>
                                </div>
                              </button>
                            )}
                        </div>
                      </div>

                      {activeDelivery === 'ship' && (
                        <div>
                          <label
                            htmlFor="ship-address"
                            className="block text-xs font-semibold text-zinc-900 mb-1.5"
                          >
                            Shipping address (with PIN code)
                          </label>
                          <textarea
                            id="ship-address"
                            rows={2}
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                            placeholder="Flat 402, Cyber Residency, Madhapur, Hyderabad 500081"
                            className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                          />
                        </div>
                      )}

                      {listing.mode === 'sell' && (
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 mb-2">
                            Razorpay Checkout Method
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'upi', label: 'UPI (GPay / PhonePe)' },
                              { id: 'card', label: 'Debit / Credit Card' },
                              { id: 'netbanking', label: 'Netbanking' },
                              ...(listing.delivery.codAllowed &&
                              activeDelivery === 'pickup'
                                ? [{ id: 'cod', label: 'Cash on Pickup' }]
                                : []),
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setPaymentMethod(
                                    opt.id as
                                      | 'upi'
                                      | 'card'
                                      | 'netbanking'
                                      | 'cod'
                                  )
                                }
                                className={`px-3 py-2 rounded-xl border text-xs font-medium text-left cursor-pointer ${
                                  paymentMethod === opt.id
                                    ? 'border-zinc-900 bg-zinc-900 text-white'
                                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {checkoutMutation.isError && (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                          {checkoutMutation.error instanceof Error
                            ? checkoutMutation.error.message
                            : 'Order could not be completed.'}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={handleAction}
                        disabled={
                          checkoutMutation.isPending ||
                          (activeDelivery === 'ship' &&
                            shippingAddress.trim().length < 8)
                        }
                        className="w-full min-h-[48px] px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        {checkoutMutation.isPending
                          ? 'Processing...'
                          : listing.mode === 'free'
                            ? 'Request this item'
                            : `Buy now · ₹${totalPayable.toLocaleString('en-IN')}`}
                      </button>
                    </div>
                  )}

                {/* Disabled states with explicit reason */}
                {(listing.isOwner ||
                  isExpired ||
                  (listing.status !== 'active' && !checkoutResult && !listing.transaction)) && (
                  <div className="p-3.5 rounded-xl bg-stone-100 border border-stone-200 text-xs text-stone-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      {listing.isOwner
                        ? 'This is your own listing. Manage or remove it from your Profile.'
                        : isExpired
                          ? 'This product has passed its expiry date and is archived.'
                          : `This item is currently ${listing.status}.`}
                    </span>
                  </div>
                )}

                {/* Safety Flag button */}
                {!listing.isOwner && (
                  <div className="pt-2 border-t border-stone-100">
                    {flagDone ? (
                      <p className="text-xs text-stone-600">
                        Listing flagged for moderator review.
                      </p>
                    ) : !flagOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) {
                            setAuthModalOpen(true);
                          } else {
                            setFlagOpen(true);
                          }
                        }}
                        className="text-xs text-stone-500 hover:text-red-700 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>Report or flag listing</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={flagReason}
                          onChange={(e) => setFlagReason(e.target.value)}
                          placeholder="Reason (e.g., prohibited item, misleading price)"
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => flagMutation.mutate(flagReason)}
                            disabled={flagMutation.isPending}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                          >
                            Submit flag
                          </button>
                          <button
                            type="button"
                            onClick={() => setFlagOpen(false)}
                            className="px-3 py-1.5 text-xs text-stone-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
