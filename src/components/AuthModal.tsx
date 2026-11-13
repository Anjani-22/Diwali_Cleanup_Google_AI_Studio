import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { CheckCircle2, Phone, ShieldCheck, X } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { UserProfile } from '../types';

export function AuthModal() {
  const { authModalOpen, setAuthModalOpen, user, setUser } = useAppStore();
  const [phoneInput, setPhoneInput] = useState(
    user?.phone ? user.phone.replace(/^\+91/, '') : ''
  );
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [hintCode, setHintCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      const data = await apiFetch<{ user: UserProfile }>('/api/me');
      setUser(data.user);
      if (data.user.phoneVerified) {
        setAuthModalOpen(false);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google sign-in could not be completed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{
        sent: boolean;
        phone: string;
        verificationHint?: string;
      }>('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneInput }),
      });
      setOtpSent(true);
      setHintCode(res.verificationHint ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ verified: boolean; user: UserProfile }>(
        '/api/auth/verify-otp',
        {
          method: 'POST',
          body: JSON.stringify({ phone: phoneInput, code: otpCode }),
        }
      );
      setUser(res.user);
      setOtpSent(false);
      setOtpCode('');
      setAuthModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2
              id="auth-modal-title"
              className="font-display text-2xl font-semibold text-zinc-900"
            >
              {user ? 'Verify your mobile number' : 'Join your neighborhood'}
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              {user
                ? 'A verified +91 mobile number is required for pickup handoffs and Shiprocket delivery.'
                : 'Sign in with Google, then verify your Indian mobile number via OTP.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
            aria-label="Close sign in dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {!user ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full min-h-[46px] px-4 py-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {loading ? 'Connecting...' : 'Continue with Google'}
            </button>
            <div className="flex items-start gap-2.5 text-xs text-stone-500 pt-2 border-t border-stone-100">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                Your phone number stays hidden from browsers and is shared only
                after a purchase or pickup is confirmed.
              </span>
            </div>
          </div>
        ) : user.phoneVerified ? (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Mobile verified ({user.phone})
              </p>
              <p className="text-xs text-emerald-800 mt-0.5">
                You are ready to list, buy, share, and donate items.
              </p>
            </div>
          </div>
        ) : !otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label
                htmlFor="india-phone"
                className="block text-sm font-medium text-zinc-900 mb-1.5"
              >
                Indian Mobile Number
              </label>
              <div className="flex items-center border border-stone-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-amber-600">
                <span className="px-3.5 py-2.5 bg-stone-100 text-sm font-mono text-stone-700 border-r border-stone-300">
                  +91
                </span>
                <input
                  id="india-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phoneInput}
                  onChange={(e) =>
                    setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  placeholder="9849012345"
                  className="w-full px-3.5 py-2.5 text-sm font-mono focus:outline-none"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || phoneInput.length !== 10}
              className="w-full min-h-[46px] px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              <span>{loading ? 'Sending OTP...' : 'Send 6-digit OTP'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label
                htmlFor="otp-input"
                className="block text-sm font-medium text-zinc-900 mb-1.5"
              >
                Enter OTP sent to +91 {phoneInput}
              </label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="6-digit code"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-600"
                required
              />
              {hintCode && (
                <p className="text-xs text-stone-600 mt-1.5">
                  Preview verification code:{' '}
                  <span className="font-mono font-semibold text-zinc-900">
                    {hintCode}
                  </span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="px-4 py-2.5 border border-stone-300 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                Change number
              </button>
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
