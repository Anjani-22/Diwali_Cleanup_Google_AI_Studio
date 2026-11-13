export type ListingMode = 'sell' | 'free' | 'ngo';
export type ListingCondition = 'new' | 'almost' | 'used';
export type ListingStatus = 'active' | 'sold' | 'donated' | 'expired' | 'removed' | 'flagged';

export interface UserProfile {
  id: number;
  uid: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  name: string;
  photoUrl: string | null;
  homeLat: number;
  homeLng: number;
  homePincode: string;
  homeCity: string;
  role: string;
  isAdmin?: boolean;
  aiQuotaRemaining?: number;
  aiQuotaLimit?: number;
  freeRequestsRemaining?: number;
}

export interface DeliveryInfo {
  distanceKm: number;
  tier: 'pickup' | 'mid_range' | 'ship';
  pickupAllowed: boolean;
  codAllowed: boolean;
  shiprocketAllowed: boolean;
  shippingFee: number;
  note: string;
}

export interface ListingItem {
  id: number;
  sellerId: number;
  title: string;
  description: string;
  brand: string | null;
  images: string[];
  mode: ListingMode;
  condition: ListingCondition;
  category: string;
  price: number;
  currency: string;
  expiryDate: string | null;
  lat: number;
  lng: number;
  pincode: string;
  locality: string;
  status: ListingStatus;
  flagReason?: string | null;
  createdAt: string;
  distanceKm: number;
  delivery: DeliveryInfo;
  isOwner?: boolean;
  seller: {
    name: string;
    photoUrl: string | null;
    phoneVerified: boolean;
    phone?: string | null;
  };
  transaction?: TransactionRecord | null;
}

export interface TransactionRecord {
  id: number;
  listingId: number;
  buyerId: number;
  sellerId: number;
  amount: number;
  shippingFee: number;
  paymentMethod: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  deliveryMode: 'pickup' | 'ship';
  shippingAddress: string | null;
  shiprocketAwb: string | null;
  trackingUrl: string | null;
  status: string;
  createdAt: string;
  role?: 'buyer' | 'seller';
  listingTitle?: string;
  listingImage?: string;
  listingLocality?: string;
  sellerName?: string;
  sellerPhone?: string | null;
}

export interface NgoRecord {
  id: number;
  name: string;
  city: string;
  email: string;
  phoneWhatsapp: string;
  address: string;
  categoriesAccepted: string[];
  active: boolean;
}

export interface NgoRequestRecord {
  id: number;
  userId: number;
  ngoId: number;
  ngoName?: string;
  ngoCity?: string;
  ngoWhatsapp?: string;
  items: Array<{
    listingId?: number;
    title: string;
    category: string;
    condition: string;
  }>;
  photos: string[];
  pickupAddress: string;
  contactPhone: string;
  status: string;
  createdAt: string;
}

export interface AiAnalysisResponse {
  cached?: boolean;
  fallback?: boolean;
  error?: string;
  quotaRemaining?: number;
  analysis?: {
    title: string;
    category: string;
    brand: string;
    condition: ListingCondition;
    suggestedPriceMin: number;
    suggestedPriceMax: number;
    expiryDate: string;
    description: string;
    usageNotes: string;
  };
}
