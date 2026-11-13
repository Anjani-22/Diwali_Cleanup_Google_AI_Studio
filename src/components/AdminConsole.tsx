import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { ListingItem, NgoRecord } from '../types';

interface AdminOverview {
  metrics: {
    totalUsers: number;
    activeListings: number;
    flaggedListings: number;
    completedTransactions: number;
    ngoRequests: number;
  };
  flaggedListings: ListingItem[];
  ngos: NgoRecord[];
}

export function AdminConsole() {
  const { setActiveTab } = useAppStore();
  const queryClient = useQueryClient();

  const [ngoName, setNgoName] = useState('');
  const [ngoCity, setNgoCity] = useState('Hyderabad');
  const [ngoEmail, setNgoEmail] = useState('');
  const [ngoWhatsapp, setNgoWhatsapp] = useState('');
  const [ngoAddress, setNgoAddress] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiFetch<AdminOverview>('/api/admin/overview'),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'removed' }) =>
      apiFetch(`/api/admin/listings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  const addNgoMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/admin/ngos', {
        method: 'POST',
        body: JSON.stringify({
          name: ngoName,
          city: ngoCity,
          email: ngoEmail,
          phoneWhatsapp: ngoWhatsapp,
          address: ngoAddress,
        }),
      }),
    onSuccess: () => {
      setNgoName('');
      setNgoEmail('');
      setNgoWhatsapp('');
      setNgoAddress('');
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['ngos'] });
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="text-xs font-medium text-stone-600 hover:text-zinc-900 flex items-center gap-1 mb-2 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Profile</span>
          </button>
          <h1 className="font-display text-2xl font-semibold text-zinc-900">
            Admin Moderation & Directory
          </h1>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-stone-500">Loading analytics...</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-700">
          Admin access required or failed to load console.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Users', value: data.metrics.totalUsers },
              { label: 'Active Listings', value: data.metrics.activeListings },
              { label: 'Flagged', value: data.metrics.flaggedListings },
              {
                label: 'Transactions',
                value: data.metrics.completedTransactions,
              },
              { label: 'NGO Requests', value: data.metrics.ngoRequests },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-white border border-stone-200 rounded-2xl p-4"
              >
                <p className="text-xs text-stone-500">{m.label}</p>
                <p className="text-2xl font-mono font-semibold tabular-nums text-zinc-900 mt-1">
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Flagged Listings ({data.flaggedListings.length})
            </h2>
            {data.flaggedListings.length === 0 ? (
              <p className="text-xs text-stone-500">
                No flagged listings waiting for review.
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {data.flaggedListings.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-red-700 mt-0.5">
                        Reason: {item.flagReason || 'Reported by neighbor'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          moderateMutation.mutate({
                            id: item.id,
                            status: 'active',
                          })
                        }
                        className="px-3 py-1.5 border border-stone-300 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          moderateMutation.mutate({
                            id: item.id,
                            status: 'removed',
                          })
                        }
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Add Verified NGO to Directory
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={ngoName}
                onChange={(e) => setNgoName(e.target.value)}
                placeholder="NGO Name"
                className="px-3 py-2 border border-stone-300 rounded-xl text-sm"
              />
              <input
                type="text"
                value={ngoCity}
                onChange={(e) => setNgoCity(e.target.value)}
                placeholder="City (e.g. Hyderabad)"
                className="px-3 py-2 border border-stone-300 rounded-xl text-sm"
              />
              <input
                type="email"
                value={ngoEmail}
                onChange={(e) => setNgoEmail(e.target.value)}
                placeholder="Email"
                className="px-3 py-2 border border-stone-300 rounded-xl text-sm"
              />
              <input
                type="text"
                value={ngoWhatsapp}
                onChange={(e) => setNgoWhatsapp(e.target.value)}
                placeholder="WhatsApp (e.g. 919849012345)"
                className="px-3 py-2 border border-stone-300 rounded-xl text-sm font-mono"
              />
              <input
                type="text"
                value={ngoAddress}
                onChange={(e) => setNgoAddress(e.target.value)}
                placeholder="Street Address"
                className="sm:col-span-2 px-3 py-2 border border-stone-300 rounded-xl text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => addNgoMutation.mutate()}
              disabled={addNgoMutation.isPending}
              className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add NGO</span>
            </button>
          </section>
        </>
      )}
    </div>
  );
}
