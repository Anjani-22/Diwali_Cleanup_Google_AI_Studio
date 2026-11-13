import { create } from 'zustand';
import type { UserProfile } from '../types';

export type AppTab = 'discover' | 'map' | 'add' | 'donate' | 'profile' | 'admin';

export interface DonationDraftItem {
  listingId?: number;
  title: string;
  category: string;
  condition: string;
  photo?: string;
}

interface AppState {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  selectedListingId: number | null;
  setSelectedListingId: (id: number | null) => void;

  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;

  authReady: boolean;
  setAuthReady: (ready: boolean) => void;

  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;

  // Discovery location (defaults to Madhapur, Hyderabad)
  lat: number;
  lng: number;
  locality: string;
  city: string;
  pincode: string;
  setLocation: (loc: {
    lat: number;
    lng: number;
    locality: string;
    city: string;
    pincode: string;
  }) => void;

  // Discovery filters
  radiusKm: number;
  setRadiusKm: (r: number) => void;
  panIndia: boolean;
  setPanIndia: (panIndia: boolean) => void;
  category: string;
  setCategory: (category: string) => void;
  condition: string;
  setCondition: (condition: string) => void;
  mode: string;
  setMode: (mode: string) => void;
  maxPrice: string;
  setMaxPrice: (maxPrice: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Pre-filled NGO donation items (from Add Item or expired profile item)
  donationBasket: DonationDraftItem[];
  addToDonationBasket: (item: DonationDraftItem) => void;
  removeFromDonationBasket: (index: number) => void;
  clearDonationBasket: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'discover',
  setActiveTab: (activeTab) => set({ activeTab }),

  selectedListingId: null,
  setSelectedListingId: (selectedListingId) => set({ selectedListingId }),

  authModalOpen: false,
  setAuthModalOpen: (authModalOpen) => set({ authModalOpen }),

  authReady: false,
  setAuthReady: (authReady) => set({ authReady }),

  user: null,
  setUser: (user) => set({ user }),

  lat: 17.4401,
  lng: 78.3489,
  locality: 'Madhapur',
  city: 'Hyderabad',
  pincode: '500081',
  setLocation: (loc) => set(loc),

  radiusKm: 25,
  setRadiusKm: (radiusKm) => set({ radiusKm }),
  panIndia: false,
  setPanIndia: (panIndia) => set({ panIndia }),
  category: 'all',
  setCategory: (category) => set({ category }),
  condition: 'all',
  setCondition: (condition) => set({ condition }),
  mode: 'all',
  setMode: (mode) => set({ mode }),
  maxPrice: '',
  setMaxPrice: (maxPrice) => set({ maxPrice }),
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  donationBasket: [],
  addToDonationBasket: (item) =>
    set((state) => ({
      donationBasket: [...state.donationBasket, item],
    })),
  removeFromDonationBasket: (index) =>
    set((state) => ({
      donationBasket: state.donationBasket.filter((_, i) => i !== index),
    })),
  clearDonationBasket: () => set({ donationBasket: [] }),
}));
