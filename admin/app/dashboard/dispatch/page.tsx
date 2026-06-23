'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, statusVariant } from '@/components/Badge';
import { Bike, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';

interface DispatchOrder {
  id: string;
  status: string;
  total_amount: number;
  delivery_address: string | null;
  delivery_fee: number;
  created_at: string;
  cook_name: string;
  cook_address: string | null;
  customer_name: string;
  customer_phone: string;
  item_title: string | null;
}

interface AvailableRider {
  id: string;
  vehicle_type: string;
  rider_name: string;
  rider_phone: string;
}

function fmt(n: number) {
  return `₦${Number(n).toLocaleString()}`;
}

export default function DispatchPage() {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [riders, setRiders] = useState<AvailableRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await api.get<{ orders: DispatchOrder[]; riders: AvailableRider[] }>('/admin/dispatch');
      setOrders(res.orders);
      setRiders(res.riders);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function assign() {
    if (!selectedOrder || !selectedRider) return;
    setAssigning(true);
    setErr('');
    try {
      await api.post('/admin/dispatch/assign', {
        order_id: selectedOrder,
        rider_profile_id: selectedRider,
      });
      setSuccessId(selectedOrder);
      setSelectedOrder(null);
      setSelectedRider(null);
      setTimeout(() => { setSuccessId(null); load(); }, 1500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Bike size={20} className="text-brand" />
            Dispatch Console
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {orders.length} awaiting dispatch · {riders.length} riders available
          </p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {err && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{err}</div>}

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Orders waiting */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Unassigned orders</h2>
            {orders.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 bg-white border border-gray-100 rounded-xl">
                No orders awaiting dispatch.
              </div>
            ) : orders.map(o => {
              const isSelected = selectedOrder === o.id;
              const isSuccess = successId === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrder(isSelected ? null : o.id)}
                  className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm transition-all ${
                    isSuccess ? 'border-green-400 bg-green-50' :
                    isSelected ? 'border-brand ring-1 ring-brand/20' :
                    'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-gray-400">{o.id.slice(0, 8)}</span>
                        <Badge label={o.status.replace(/_/g, ' ')} variant={statusVariant(o.status)} />
                        {isSuccess && <CheckCircle2 size={16} className="text-green-500" />}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{o.item_title ?? '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        From: {o.cook_name} · {o.cook_address ?? 'no address'}
                      </p>
                      <p className="text-xs text-gray-500">
                        To: {o.customer_name} · {o.delivery_address ?? 'no address'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Fee: {fmt(o.delivery_fee)} · {new Date(o.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmt(o.total_amount)}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Riders + assign panel */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Available riders</h2>
            {riders.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 bg-white border border-gray-100 rounded-xl">
                No riders currently available.
              </div>
            ) : riders.map(r => {
              const isSelected = selectedRider === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRider(isSelected ? null : r.id)}
                  className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm transition-all ${
                    isSelected ? 'border-brand ring-1 ring-brand/20' : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
                      <Bike size={16} className="text-brand" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{r.rider_name}</p>
                      <p className="text-xs text-gray-400">{r.rider_phone} · <span className="capitalize">{r.vehicle_type}</span></p>
                    </div>
                    {isSelected && <CheckCircle2 size={18} className="text-brand flex-shrink-0" />}
                  </div>
                </button>
              );
            })}

            {/* Assign button */}
            {(selectedOrder || selectedRider) && (
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                <p className="text-sm font-medium text-gray-700">Assign summary</p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Order: {selectedOrder ? selectedOrder.slice(0, 8) + '…' : <span className="text-orange-500">not selected</span>}</p>
                  <p>Rider: {selectedRider ? (riders.find(r => r.id === selectedRider)?.rider_name ?? selectedRider.slice(0,8)) : <span className="text-orange-500">not selected</span>}</p>
                </div>
                <button
                  onClick={assign}
                  disabled={!selectedOrder || !selectedRider || assigning}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
                >
                  {assigning ? <Loader2 size={16} className="animate-spin" /> : <Bike size={16} />}
                  {assigning ? 'Assigning…' : 'Assign rider'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
