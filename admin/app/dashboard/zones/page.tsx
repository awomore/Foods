'use client';

import { useEffect, useState, useCallback } from 'react';
import { zonesApi, type Zone } from '@/lib/api';
import { MapPin, Plus, Pencil, Trash2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

function ZoneModal({
  zone,
  onClose,
  onSave,
}: {
  zone: Zone | null;
  onClose: () => void;
  onSave: (data: Partial<Zone>) => Promise<void>;
}) {
  const [name, setName] = useState(zone?.name ?? '');
  const [description, setDescription] = useState(zone?.description ?? '');
  const [areasInput, setAreasInput] = useState((zone?.service_areas ?? []).join(', '));
  const [isActive, setIsActive] = useState(zone?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Zone name is required');
    setSaving(true);
    setError('');
    try {
      const service_areas = areasInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      await onSave({ name: name.trim(), description: description.trim() || undefined, service_areas, is_active: isActive });
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{zone ? 'Edit Zone' : 'New Zone'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Zone name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Lagos Island"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Service areas (comma-separated)</label>
            <textarea
              value={areasInput}
              onChange={e => setAreasInput(e.target.value)}
              placeholder="Ikeja, Victoria Island, Lekki, Ikorodu"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">These must match the service_areas riders declare during registration.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Active zone</span>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : zone ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalZone, setModalZone] = useState<Zone | null | 'new'>('new');
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await zonesApi.list();
      setZones(res.zones);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load zones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Partial<Zone>) {
    if (modalZone && modalZone !== 'new') {
      const res = await zonesApi.update(modalZone.id, data);
      setZones(prev => prev.map(z => z.id === res.zone.id ? res.zone : z));
    } else {
      const res = await zonesApi.create(data as { name: string; description?: string; service_areas?: string[]; is_active?: boolean });
      setZones(prev => [...prev, res.zone]);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this zone? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await zonesApi.delete(id);
      setZones(prev => prev.filter(z => z.id !== id));
    } catch (e: any) {
      alert(e.message ?? 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MapPin size={20} className="text-brand" />
            Delivery Zones
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Define service territories and link to rider coverage areas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setModalZone('new'); setShowModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:opacity-90"
          >
            <Plus size={15} />
            New Zone
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading zones…</div>
      ) : zones.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center shadow-sm">
          <MapPin size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No delivery zones yet</p>
          <p className="text-xs text-gray-400 mt-1">Create a zone to group service areas for easier rider matching</p>
          <button
            onClick={() => { setModalZone('new'); setShowModal(true); }}
            className="mt-4 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:opacity-90"
          >
            Create first zone
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Zone</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Service areas</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z, i) => (
                <tr key={z.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{z.name}</p>
                    {z.description && <p className="text-xs text-gray-400 mt-0.5">{z.description}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {(z.service_areas ?? []).length === 0 ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (z.service_areas ?? []).map(area => (
                        <span key={area} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {area}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {z.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle size={10} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        <XCircle size={10} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setModalZone(z); setShowModal(true); }}
                        className="p-1.5 text-gray-400 hover:text-brand hover:bg-gray-100 rounded"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(z.id)}
                        disabled={deleting === z.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ZoneModal
          zone={modalZone === 'new' ? null : modalZone}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
