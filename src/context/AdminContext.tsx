'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkPinStatus, loginAction, logoutAction, setupPinAction } from '@/lib/actions/auth';

interface AdminContextValue {
  isAdmin: boolean;
  pinConfigured: boolean;
  loading: boolean;
  login: (pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setupPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  sessionId: string | null; // kept for header injection if needed
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState<string | null>(null);

  useEffect(() => {
    // Check session via cookie (server validates)
    checkPinStatus().then(({ configured }) => {
      setPinConfigured(configured);
    });

    // Ping the auth-check endpoint to see if the session cookie is valid
    fetch('/api/auth/check')
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(data.authenticated ?? false);
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (pin: string) => {
    const result = await loginAction(pin);
    if (result.success) {
      setIsAdmin(true);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await logoutAction();
    setIsAdmin(false);
  }, []);

  const setupPin = useCallback(async (pin: string) => {
    const result = await setupPinAction(pin);
    if (result.success) {
      setPinConfigured(true);
    }
    return result;
  }, []);

  return (
    <AdminContext.Provider
      value={{ isAdmin, pinConfigured, loading, login, logout, setupPin, sessionId }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
