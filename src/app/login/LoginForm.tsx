'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/lib/actions/auth';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { AlertCircle, User } from 'lucide-react';

const PIN_LENGTH = 4;

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pinRefs = useRef<Array<HTMLInputElement | null>>([]);

  const pinValue = pin.join('');

  function setDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setPin((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < PIN_LENGTH - 1) pinRefs.current[index + 1]?.focus();
  }

  function onPinKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    // Backspace on an empty box steps back to the previous one.
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) pinRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < PIN_LENGTH - 1) pinRefs.current[index + 1]?.focus();
  }

  function onPinPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (!digits) return;
    e.preventDefault();
    const next = Array(PIN_LENGTH).fill('');
    digits.split('').forEach((d, i) => (next[i] = d));
    setPin(next);
    pinRefs.current[Math.min(digits.length, PIN_LENGTH - 1)]?.focus();
  }

  const submit = useCallback(async () => {
    setError('');

    if (!username.trim()) {
      setError('Enter your username');
      return;
    }
    if (pinValue.length !== PIN_LENGTH) {
      setError('Enter your 4-digit PIN');
      return;
    }

    setSubmitting(true);
    const result = await loginAction(username, pinValue);

    if (!result.success) {
      setSubmitting(false);
      setError(result.error ?? 'Login failed');
      setPin(Array(PIN_LENGTH).fill(''));
      pinRefs.current[0]?.focus();
      return;
    }

    // Stay in the submitting state through navigation so the form cannot be
    // fired twice while the route transition is in flight.
    router.replace(result.role === 'admin' ? '/analytics' : '/home');
    router.refresh();
  }, [username, pinValue, router]);

  // Sign in as soon as the fourth digit lands — no button press needed.
  // A failed attempt clears the PIN, so this cannot loop.
  useEffect(() => {
    if (pinValue.length === PIN_LENGTH && username.trim() && !submitting) {
      void submit();
    }
  }, [pinValue, username, submitting, submit]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-raasta-bg">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} priority className="mb-4 shadow-lift ring-2 ring-gold-300" />
          <h1 className="text-xl font-bold tracking-tight text-raasta-ink">Team Najeeb</h1>
          <p className="text-sm text-raasta-muted mt-1">Performance Tracker</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-raasta-surface border border-raasta-border rounded-2xl shadow-card p-6 space-y-5"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-xs font-medium text-raasta-muted">
              Username
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-raasta-faint"
                aria-hidden="true"
              />
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                spellCheck={false}
                placeholder="yourname"
                className="w-full bg-raasta-surface border border-raasta-border rounded-xl pl-9 pr-3.5 py-2.5 text-raasta-ink text-sm placeholder-raasta-faint focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/25 transition-shadow"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-raasta-muted">4-digit PIN</label>
            <div className="flex gap-2.5 justify-between">
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    pinRefs.current[i] = el;
                  }}
                  value={digit}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onPinKeyDown(i, e)}
                  onPaste={onPinPaste}
                  inputMode="numeric"
                  maxLength={1}
                  disabled={submitting}
                  autoComplete="one-time-code"
                  aria-label={`PIN digit ${i + 1}`}
                  className="w-full aspect-square text-center text-xl font-semibold bg-raasta-subtle border border-raasta-border rounded-xl text-raasta-ink focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/25 focus:bg-raasta-surface transition-all"
                />
              ))}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-bad-50 border border-bad-500/25 rounded-xl px-3 py-2.5"
            >
              <AlertCircle className="w-4 h-4 text-bad-500 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-bad-600">{error}</p>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-xs text-raasta-faint mt-6">
          Ask your admin if you do not have a username and PIN.
        </p>
      </div>
    </div>
  );
}
