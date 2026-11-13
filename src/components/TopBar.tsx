import { Compass, HeartHandshake, MapPin, Plus, User } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { AppTab } from '../store/useAppStore';

export function TopBar() {
  const { activeTab, setActiveTab, setSelectedListingId, user, setAuthModalOpen } =
    useAppStore();

  const navigate = (tab: AppTab) => {
    setSelectedListingId(null);
    if (tab === 'add' && !user) {
      setAuthModalOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  const navItems: Array<{ id: AppTab; label: string }> = [
    { id: 'discover', label: 'Discover' },
    { id: 'map', label: 'Map' },
    { id: 'donate', label: 'Donate' },
    { id: 'profile', label: user ? 'Profile' : 'Sign In' },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 h-14 bg-[#faf9f6]/95 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => navigate('discover')}
            className="font-display text-xl font-semibold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 cursor-pointer text-left"
          >
            Diwali CleanUp
          </button>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'profile' && !user) {
                      setAuthModalOpen(true);
                    } else {
                      navigate(item.id);
                    }
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
                    isActive
                      ? 'text-zinc-900 border-amber-600'
                      : 'border-transparent hover:text-zinc-900 hover:border-stone-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => navigate('add')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Add item
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-stone-200 grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => navigate('discover')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'discover' ? 'text-amber-700' : 'text-stone-500'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span>Discover</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('map')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'map' ? 'text-amber-700' : 'text-stone-500'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span>Map</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('add')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'add' ? 'text-amber-700' : 'text-zinc-900'
          }`}
        >
          <Plus className="w-5 h-5" />
          <span>Add</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('donate')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'donate' ? 'text-amber-700' : 'text-stone-500'
          }`}
        >
          <HeartHandshake className="w-5 h-5" />
          <span>Donate</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!user) {
              setAuthModalOpen(true);
            } else {
              navigate('profile');
            }
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'profile' ? 'text-amber-700' : 'text-stone-500'
          }`}
        >
          <User className="w-5 h-5" />
          <span>{user ? 'Profile' : 'Sign In'}</span>
        </button>
      </nav>
    </>
  );
}
