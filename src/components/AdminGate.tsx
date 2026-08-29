'use client';

import { useState } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import toast from 'react-hot-toast';

interface AdminGateProps {
  children: React.ReactNode;
}

export function AdminGate({ children }: AdminGateProps) {
  const { isAdmin, pinConfigured, loading, login, setupPin } = useAdmin();
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin) return <>{children}</>;

  // ─── First-time PIN setup ─────────────────────────────────────────────────
  if (!pinConfigured) {
    const handleSetup = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        setError('PIN must be exactly 4 digits');
        return;
      }
      if (newPin !== confirmPin) {
        setError('PINs do not match');
        return;
      }
      setSubmitting(true);
      const result = await setupPin(newPin);
      setSubmitting(false);
      if (!result.success) {
        setError(result.error ?? 'Setup failed');
      } else {
        toast.success('Admin PIN created');
        setNewPin('');
        setConfirmPin('');
      }
    };

    return (
      <div className="max-w-sm mx-auto pt-10">
        <Card>
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-gold-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <CardTitle>Create Admin PIN</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Set a 4-digit PIN to protect admin features</p>
          </div>

          <form onSubmit={handleSetup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-raasta-dark border border-raasta-border rounded-xl px-3 py-2.5 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-gold-500/60"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-raasta-dark border border-raasta-border rounded-xl px-3 py-2.5 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-gold-500/60"
                required
              />
            </div>

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}

            <Button type="submit" loading={submitting} className="w-full mt-2">
              Create PIN
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // ─── PIN login ─────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pin.length !== 4) {
      setError('Enter your 4-digit PIN');
      return;
    }
    setSubmitting(true);
    const result = await login(pin);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Incorrect PIN');
      setPin('');
    }
  };

  return (
    <div className="max-w-sm mx-auto pt-10">
      <Card>
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-gold-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <CardTitle>Admin Access</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Enter your PIN to continue</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="w-full bg-raasta-dark border border-raasta-border rounded-xl px-3 py-3 text-white text-center text-3xl tracking-widest focus:outline-none focus:border-gold-500/60"
            autoFocus
            required
          />

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <Button type="submit" loading={submitting} className="w-full">
            Unlock
          </Button>
        </form>
      </Card>
    </div>
  );
}
