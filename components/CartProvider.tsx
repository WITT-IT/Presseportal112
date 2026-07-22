'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type CartContextType = {
  ids: string[];
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
};

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = 'pp112_pressemappe';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Erst nach dem ersten Rendern aus localStorage lesen -- verhindert einen
  // Server/Client-Mismatch, da der Server ja keinen Zugriff auf localStorage hat.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setIds(JSON.parse(raw));
    } catch {
      // Ungültiger/kein gespeicherter Zustand -- einfach leer starten.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, [ids, hydrated]);

  const add = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const remove = useCallback((id: string) => {
    setIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clear = useCallback(() => setIds([]), []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return (
    <CartContext.Provider value={{ ids, add, remove, clear, has }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart muss innerhalb von <CartProvider> verwendet werden.');
  }
  return ctx;
}
