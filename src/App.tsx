/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { AddListingView } from './components/AddListingView';
import { AdminConsole } from './components/AdminConsole';
import { AuthModal } from './components/AuthModal';
import { DiscoveryFeed } from './components/DiscoveryFeed';
import { ListingDetailModal } from './components/ListingDetailModal';
import { MapExplorer } from './components/MapExplorer';
import { NgoDirectoryView } from './components/NgoDirectoryView';
import { ProfileView } from './components/ProfileView';
import { TopBar } from './components/TopBar';
import { apiFetch } from './lib/api';
import { auth } from './lib/firebase';
import { useAppStore } from './store/useAppStore';
import type { UserProfile } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AppShell() {
  const { activeTab, setUser, setAuthReady, setLocation } = useAppStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setAuthReady(true);
        return;
      }

      try {
        const res = await apiFetch<{ user: UserProfile }>('/api/me');
        setUser(res.user);
        setLocation({
          lat: res.user.homeLat,
          lng: res.user.homeLng,
          locality: res.user.homeCity,
          city: res.user.homeCity,
          pincode: res.user.homePincode,
        });
      } catch {
        setUser(null);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, [setUser, setAuthReady, setLocation]);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f6] text-zinc-900">
      <TopBar />

      <main className="flex-1">
        {activeTab === 'discover' && <DiscoveryFeed />}
        {activeTab === 'map' && <MapExplorer />}
        {activeTab === 'add' && <AddListingView />}
        {activeTab === 'donate' && <NgoDirectoryView />}
        {activeTab === 'profile' && <ProfileView />}
        {activeTab === 'admin' && <AdminConsole />}
      </main>

      <footer className="hidden md:block border-t border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-stone-500">
          <span>Diwali CleanUp — Hyperlocal Sharing & Circular Living in India</span>
          <span>INR Pricing · Phone-Verified Neighbors · Shiprocket & NGO Handoff</span>
        </div>
      </footer>

      <ListingDetailModal />
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
