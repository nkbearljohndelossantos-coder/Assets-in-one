import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Wifi, Plus, Search, Filter, Edit, Trash2, X, 
  Key, Clock, UserCheck, ShieldCheck, CheckCircle2, AlertTriangle, Lock
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function GuestWifi() {
  const { hasPermission, showToast } = useAuth();

  const [guestAccounts, setGuestAccounts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Modal controls
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  const loadGuestWifi = async () => {
    setLoading(true);
    try {
      const res = await api.get('/guest-wifi', {
        params: { page, search, status: statusFilter }
      });
      if (res.data.guestAccounts) {
        setGuestAccounts(res.data.guestAccounts);
        setPagination(res.data.pagination || { total: res.data.guestAccounts.length, pages: 1, limit: 10 });
      }

      const empRes = await api.get('/employees', { params: { limit: 100 } });
      if (empRes.data.success) setEmployees(empRes.data.data.employees);
    } catch (err) {
      showToast('Error', 'Failed to retrieve guest Wi-Fi accounts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuestWifi();
  }, [page, search, statusFilter]);

  const openAddModal = () => {
    setEditingGuest(null);
    const now = new Date();
    const expiry = new Date(Date.now() + 86400000); // 24 hours
    reset({
      guest_name: '',
      wifi_username: 'guest_' + Math.random().toString(36).substring(2, 8),
      wifi_password: Math.random().toString(36).substring(2, 10).toUpperCase(),
      start_date: now.toISOString().slice(0, 16),
      expiration_date: expiry.toISOString().slice(0, 16),
      purpose: 'Auditor / Vendor temporary internet access',
      requested_by_employee_id: '',
      status: 'Active'
    });
    setModalOpen(true);
  };

  const openEditModal = (g, e) => {
    if (e) e.stopPropagation();
    setEditingGuest(g);
    reset({
      ...g,
      start_date: g.start_date ? g.start_date.slice(0, 16) : '',
      expiration_date: g.expiration_date ? g.expiration_date.slice(0, 16) : '',
      requested_by_employee_id: g.requested_by_employee_id ? String(g.requested_by_employee_id) : ''
    });
    setModalOpen(true);
  };

  const handleSaveGuest = async (data) => {
    setSaving(true);
    const payload = {
      guest_name: data.guest_name,
      wifi_username: data.wifi_username,
      wifi_password: data.wifi_password,
      start_date: data.start_date,
      expiration_date: data.expiration_date,
      purpose: data.purpose || null,
      requested_by_employee_id: data.requested_by_employee_id ? parseInt(data.requested_by_employee_id) : null,
      status: data.status || 'Active'
    };

    try {
      if (editingGuest) {
        await api.put(`/guest-wifi/${editingGuest.id}`, payload);
        showToast('Updated', 'Guest Wi-Fi credentials updated.', 'success');
      } else {
        await api.post('/guest-wifi', payload);
        showToast('Created', 'New temporary Guest Wi-Fi account created.', 'success');
      }
      setModalOpen(false);
      reset();
      loadGuestWifi();
    } catch (err) {
      showToast('Error', 'Failed to save guest Wi-Fi account.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGuest = async (id, name, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to disable guest Wi-Fi account for '${name}'?`)) return;
    try {
      await api.delete(`/guest-wifi/${id}`);
      showToast('Disabled', 'Guest Wi-Fi account disabled.', 'success');
      loadGuestWifi();
    } catch (err) {
      showToast('Error', 'Failed to disable guest account.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wifi className="h-6 w-6 text-gold-600" />
            <span>Guest Wi-Fi Access Control</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Issue encrypted temporary Wi-Fi logins for plant visitors, auditors, and external contractors.</p>
        </div>

        {hasPermission('guest_wifi.create') && (
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Issue Guest Pass</span>
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative lg:col-span-3">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search guest name, Wi-Fi username, purpose, sponsor..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-xs text-slate-900"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
          <option value="Disabled">Disabled</option>
        </select>
      </div>

      {/* Guest Pass Cards Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
        </div>
      ) : guestAccounts && guestAccounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {guestAccounts.map(g => (
            <div key={g.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <Wifi className="h-4 w-4 text-gold-600" />
                    <span>{g.guest_name}</span>
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">Sponsor: <b className="text-slate-800">{g.requested_by_name || 'IT Office'}</b></p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  g.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                  g.status === 'Expired' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {g.status}
                </span>
              </div>

              {/* Login Credentials Box */}
              <div className="bg-slate-900 text-white p-3 rounded-lg text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-sans">SSID:</span>
                  <span className="font-bold text-gold-400 font-sans">NKB_GUEST_WIFI</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-sans">Username:</span>
                  <span className="font-bold text-emerald-400">{g.wifi_username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-sans">Password:</span>
                  <span className="font-bold text-white">{g.wifi_password_ciphertext ? '••••••••' : g.wifi_password}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1 select-none">
                <p><span className="text-slate-400 font-bold uppercase text-[9px]">Valid From:</span> {new Date(g.start_date).toLocaleString()}</p>
                <p><span className="text-slate-400 font-bold uppercase text-[9px]">Expires On:</span> {new Date(g.expiration_date).toLocaleString()}</p>
                {g.purpose && <p className="text-slate-500 pt-1 leading-normal"><b className="text-slate-700">Purpose:</b> {g.purpose}</p>}
              </div>

              <div className="flex justify-end gap-1 pt-2 border-t border-slate-150">
                {hasPermission('guest_wifi.create') && (
                  <button onClick={(e) => openEditModal(g, e)} className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
                {hasPermission('guest_wifi.disable') && (
                  <button onClick={(e) => handleDeleteGuest(g.id, g.guest_name, e)} className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center text-slate-400">
          No temporary guest Wi-Fi passes issued.
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl select-none">
          <span className="text-xs text-slate-500 font-medium">
            Page {pagination.page} of {pagination.pages} ({pagination.total} guest passes)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-slate-350 text-xs text-slate-700 bg-white hover:bg-slate-50 rounded cursor-pointer disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page === pagination.pages}
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              className="px-3 py-1.5 border border-slate-355 text-xs text-slate-700 bg-white hover:bg-slate-50 rounded cursor-pointer disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ISSUE / EDIT GUEST PASS */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingGuest ? 'Edit Guest Wi-Fi Pass' : 'Issue Guest Wi-Fi Pass'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleSaveGuest)} className="p-6 space-y-4 text-xs font-semibold">
              
              <div>
                <label className="block text-slate-500 mb-1">Guest Full Name *</label>
                <input type="text" {...register('guest_name', { required: true })} placeholder="e.g. John Smith (External Auditor)" className="w-full p-2 border border-slate-350 rounded text-slate-900" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Wi-Fi Username *</label>
                  <input type="text" {...register('wifi_username', { required: true })} className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Wi-Fi Password *</label>
                  <input type="text" {...register('wifi_password', { required: true })} className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Start Date & Time *</label>
                  <input type="datetime-local" {...register('start_date', { required: true })} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Expiration Date & Time *</label>
                  <input type="datetime-local" {...register('expiration_date', { required: true })} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Employee Sponsor</label>
                  <select {...register('requested_by_employee_id')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                    <option value="">Select Employee</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.full_name || `${e.first_name} ${e.last_name}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Status *</label>
                  <select {...register('status')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Purpose / Visit Reason</label>
                <textarea {...register('purpose')} rows={2} placeholder="Plant audit, equipment demonstration..." className="w-full p-2 border border-slate-350 rounded resize-none"></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-350 text-slate-700 bg-white rounded font-bold hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold cursor-pointer">
                  {saving ? 'Saving...' : editingGuest ? 'Save Changes' : 'Issue Guest Pass'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
