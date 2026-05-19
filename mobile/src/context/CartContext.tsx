import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  id: string;          // unique per line item (generated client-side)
  menuItemId: string;
  cookId: string;
  cookName: string;
  dishTitle: string;
  price: number;
  currencyCode: string;
  qty: number;
  selectedSides: string[];
  removedSides: string[];
  allergenAcknowledged: boolean;
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
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  updateDelivery: (id: string, data: Pick<CartItem, 'deliveryAddress' | 'deliveryLat' | 'deliveryLng' | 'deliveryWindow'>) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const currencyCode = items[0]?.currencyCode ?? 'NGN';

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    const id = `${item.cookId}-${item.menuItemId}-${Date.now()}`;
    setItems(prev => [...prev, { ...item, id }]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
    }
  }, []);

  const updateDelivery = useCallback((
    id: string,
    data: Pick<CartItem, 'deliveryAddress' | 'deliveryLat' | 'deliveryLng' | 'deliveryWindow'>
  ) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return (
    <CartContext.Provider value={{ items, total, count, currencyCode, addItem, removeItem, updateQty, updateDelivery, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
