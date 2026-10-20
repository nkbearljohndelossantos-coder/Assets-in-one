import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Printer, Plus, Search, Filter, Edit, Trash2, X, 
  Droplet, CheckCircle2, AlertTriangle, UserCheck, Wrench
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function Printers() {
  const { hasPermission, showToast } = useAuth();

  const [printers, setPrinters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Modal controls
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  const loadPrinters = async () => {
    setLoading(true);
    try {
      const res = await api.get('/printers', {
        params: { page, search, status: statusFilter }
      });
      if (res.data.printers) {
        setPrinters(res.data.printers);
        setPagination(res.data.pagination || { total: res.data.printers.length, pages: 1, limit: 10 });
      }

      const deptRes = await api.get('/departments');
      if (deptRes.data.success) setDepartments(deptRes.data.data);
    } catch (err) {
      showToast('Error', 'Failed to retrieve printers list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrinters();
  }, [page, search, statusFilter]);

  const openAddModal = () => {
    setEditingPrinter(null);
    reset({
      printer_name: '',
      brand: 'Canon',
      model: '',
      location: '2nd Floor HR Office',
      department_id: '',
      toner_model: '',
      ink_level: 100,
      status: 'Online',
      remarks: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (p, e) => {
    if (e) e.stopPropagation();
    setEditingPrinter(p);
    reset({
      ...p,
      department_id: p.department_id ? String(p.department_id) : ''
    });
    setModalOpen(true);
  };

  const handleSavePrinter = async (data) => {
    setSaving(true);
    const payload = {
      printer_name: data.printer_name,
      brand: data.brand,
      model: data.model,
      location: data.location || null,
      department_id: data.department_id ? parseInt(data.department_id) : null,
      toner_model: data.toner_model || null,
      ink_level: parseInt(data.ink_level) || 100,
      status: data.status || 'Online',
      remarks: data.remarks || null
    };

    try {
      if (editingPrinter) {
        await api.put(`/printers/${editingPrinter.id}`, payload);
        showToast('Updated', 'Printer profile updated.', 'success');
      } else {
        await api.post('/printers', payload);
        showToast('Registered', 'New printer registered.', 'success');
      }
      setModalOpen(false);
      reset();
      loadPrinters();
    } catch (err) {
      showToast('Error', 'Failed to save printer record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrinter = async (id, name, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove printer '${name}'?`)) return;
    try {
      await api.delete(`/printers/${id}`);
      showToast('Removed', 'Printer profile removed.', 'success');
      loadPrinters();
    } catch (err) {
      showToast('Error', 'Failed to remove printer.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Printer className="h-6 w-6 text-gold-600" />
            <span>Printers & Toner Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Track network printers, toner model replacements, ink levels, and maintenance logs.</p>
        </div>

        {hasPermission('printers.manage') && (
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Register Printer</span>
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative lg:col-span-3">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search printer name, toner model, brand, location..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-355 rounded-lg text-xs text-slate-900"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
          <option value="Maintenance Required">Maintenance Required</option>
        </select>
      </div>

      {/* Printers Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
        </div>
      ) : printers && printers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {printers.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <Printer className="h-4 w-4 text-gold-600" />
                    <span>{p.printer_name}</span>
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">{p.brand} {p.model}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  p.status === 'Online' ? 'bg-emerald-100 text-emerald-700' :
                  p.status === 'Offline' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {p.status}
                </span>
              </div>

              {/* Toner Level Indicator */}
              <div className="space-y-1 bg-slate-50 border p-3 rounded-lg text-xs">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Droplet className="h-3 w-3 text-cyan-600" />
                    <span>Toner Level</span>
                  </span>
                  <span className="text-slate-900 font-mono">{p.ink_level}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      p.ink_level > 50 ? 'bg-emerald-500' : p.ink_level > 20 ? 'bg-amber-500' : 'bg-rose-600'
                    }`}
                    style={{ width: `${p.ink_level}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 pt-1 font-semibold">
                  <span>Toner Model: <b>{p.toner_model || 'N/A'}</b></span>
                  <span>Dept: <b>{p.department_name || 'General'}</b></span>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-0.5">
                <p><span className="text-slate-400 font-bold uppercase text-[10px]">Location:</span> {p.location || 'Unspecified'}</p>
              </div>

              <div className="flex justify-end gap-1 pt-2 border-t border-slate-150">
                {hasPermission('printers.manage') && (
                  <button onClick={(e) => openEditModal(p, e)} className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
                {hasPermission('printers.manage') && (
                  <button onClick={(e) => handleDeletePrinter(p.id, p.printer_name, e)} className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center text-slate-400">
          No printers registered yet.
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl select-none">
          <span className="text-xs text-slate-500 font-medium">
            Page {pagination.page} of {pagination.pages} ({pagination.total} printers)
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

      {/* MODAL: ADD / EDIT PRINTER */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingPrinter ? 'Edit Printer Profile' : 'Register New Printer'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleSavePrinter)} className="p-6 space-y-4 text-xs font-semibold">
              
              <div>
                <label className="block text-slate-500 mb-1">Printer Name *</label>
                <input type="text" {...register('printer_name', { required: true })} placeholder="HR Canon ImageRUNNER 2520" className="w-full p-2 border border-slate-350 rounded text-slate-900" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Brand *</label>
                  <input type="text" {...register('brand', { required: true })} placeholder="Canon, HP, Epson..." className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Model *</label>
                  <input type="text" {...register('model', { required: true })} placeholder="ImageRUNNER 2520" className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Toner Model</label>
                  <input type="text" {...register('toner_model')} placeholder="NPG-51" className="w-full p-2 border border-slate-350 rounded text-slate-900 font-mono" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Current Ink Level (0-100%)</label>
                  <input type="number" min="0" max="100" {...register('ink_level')} className="w-full p-2 border border-slate-350 rounded text-slate-900 font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Department</label>
                  <select {...register('department_id')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Status *</label>
                  <select {...register('status')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                    <option value="Maintenance Required">Maintenance Required</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Location / Office Floor</label>
                <input type="text" {...register('location')} placeholder="2nd Floor HR Office Room 204" className="w-full p-2 border border-slate-350 rounded text-slate-900" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-350 text-slate-700 bg-white rounded font-bold hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold cursor-pointer">
                  {saving ? 'Saving...' : editingPrinter ? 'Save Changes' : 'Register Printer'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
