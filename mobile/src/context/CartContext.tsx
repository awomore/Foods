import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  id: string;
  menuItemId: string;
  cookId: string;
  cookName: string;
  dishTitle: string;
  price: number;
  currencyCode: string;
  qty: number;
  slotsLeft?: number;           // used for qty cap in checkout
  selectedSides: string[];
  removedSides: string[];
  allergenAcknowledged: boolean;
  matchedAllergens: string[];   // allergen groups that match customer profile
  matchedIngredients: string[]; // specific ingredients causing each match
  deliveryWindow?: string;
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
}

interface CartContextType {
  items: CartItem[];
  total: number;
  count: number;
  currencyCode: string;
  isRestored: boolean;          // true once AsyncStorage has been read
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  updateDelivery: (id: string, data: Pick<CartItem, 'deliveryAddress' | 'deliveryLat' | 'deliveryLng' | 'deliveryWindow'>) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = '@cart_v2';
const DEBOUNCE_MS = 400;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isRestored, setIsRestored] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore cart from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY)
      .then(raw => {
        if (raw) {
          try {
            const saved = JSON.parse(raw) as CartItem[];
            if (Array.isArray(saved) && saved.length > 0) {
              setItems(saved);
            }
          } catch {
            // corrupted storage — start fresh
          }
        }
      })
      .finally(() => setIsRestored(true));
  }, []);

  // Debounce-persist to AsyncStorage whenever items change (after restoration)
  useEffect(() => {
    if (!isRestored) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (items.length === 0) {
        AsyncStorage.removeItem(CART_STORAGE_KEY);
      } else {
        AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [items, isRestored]);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const currencyCode = items[0]?.currencyCode ?? 'NGN';

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    const id = `${item.cookId}-${item.menuItemId}-${Date.now()}`;
    setItems(prev => {
      // Increment qty if identical item already in cart
      const existing = prev.find(
        i => i.menuItemId === item.menuItemId && i.cookId === item.cookId
      );
      if (existing) {
        const max = item.slotsLeft ?? existing.slotsLeft ?? 99;
        const nextQty = Math.min(existing.qty + item.qty, max);
        return prev.map(i => i.id === existing.id ? { ...i, qty: nextQty } : i);
      }
      return [...prev, { ...item, id }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      setItems(prev => prev.map(i => {
        if (i.id !== id) return i;
        const max = i.slotsLeft ?? 99;
        return { ...i, qty: Math.min(qty, max) };
      }));
    }
  }, []);

  const updateDelivery = useCallback((
    id: string,
    data: Pick<CartItem, 'deliveryAddress' | 'deliveryLat' | 'deliveryLng' | 'deliveryWindow'>
  ) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    AsyncStorage.removeItem(CART_STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <CartContext.Provider value={{ items, total, count, currencyCode, isRestored, addItem, removeItem, updateQty, updateDelivery, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
