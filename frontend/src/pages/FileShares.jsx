import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Folder, Plus, Search, Filter, Edit, Trash2, X, 
  Lock, Key, Users, Server, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function FileShares() {
  const { hasPermission, showToast } = useAuth();

  const [shares, setShares] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Modal controls
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShare, setEditingShare] = useState(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  const loadFileShares = async () => {
    setLoading(true);
    try {
      const res = await api.get('/file-shares', {
        params: { page, search }
      });
      if (res.data.fileShares) {
        setShares(res.data.fileShares);
        setPagination(res.data.pagination || { total: res.data.fileShares.length, pages: 1, limit: 10 });
      }

      const empRes = await api.get('/employees', { params: { limit: 100 } });
      if (empRes.data.success) setEmployees(empRes.data.data.employees);
    } catch (err) {
      showToast('Error', 'Failed to retrieve company network file shares.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFileShares();
  }, [page, search]);

  const openAddModal = () => {
    setEditingShare(null);
    reset({
      folder_name: '\\NAS-SERVER-01\\Finance_Share',
      server_location: '192.168.1.200 Volume 1',
      owner_employee_id: '',
      purpose: 'Department financial reports & audits storage'
    });
    setModalOpen(true);
  };

  const openEditModal = (s, e) => {
    if (e) e.stopPropagation();
    setEditingShare(s);
    reset({
      ...s,
      owner_employee_id: s.owner_employee_id ? String(s.owner_employee_id) : ''
    });
    setModalOpen(true);
  };

  const handleSaveShare = async (data) => {
    setSaving(true);
    const payload = {
      folder_name: data.folder_name,
      server_location: data.server_location,
      owner_employee_id: data.owner_employee_id ? parseInt(data.owner_employee_id) : null,
      purpose: data.purpose || null
    };

    try {
      if (editingShare) {
        await api.put(`/file-shares/${editingShare.id}`, payload);
        showToast('Updated', 'File share profile updated.', 'success');
      } else {
        await api.post('/file-shares', payload);
        showToast('Registered', 'New network directory share registered.', 'success');
      }
      setModalOpen(false);
      reset();
      loadFileShares();
    } catch (err) {
      showToast('Error', 'Failed to save file share record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShare = async (id, name, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove directory share '${name}'?`)) return;
    try {
      await api.delete(`/file-shares/${id}`);
      showToast('Removed', 'Network file share removed.', 'success');
      loadFileShares();
    } catch (err) {
      showToast('Error', 'Failed to remove file share.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Folder className="h-6 w-6 text-gold-600" />
            <span>Network File Shares & Folder Security</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Manage company NAS shared folders, network directory paths, folder owners, and access levels.</p>
        </div>

        {hasPermission('file_shares.manage') && (
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Register Shared Folder</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search network path, folder name, server IP, owner..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-xs text-slate-900"
          />
        </div>
      </div>

      {/* File Shares Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
        </div>
      ) : shares && shares.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {shares.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-mono font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <Folder className="h-4 w-4 text-gold-600" />
                    <span>{s.folder_name}</span>
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">{s.server_location}</p>
                </div>
              </div>

              <div className="bg-slate-50 border p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] font-bold">Folder Owner:</span>
                  <span className="font-bold text-slate-800">{s.owner_name || 'IT Department'}</span>
                </div>
                {s.purpose && (
                  <p className="text-[11px] text-slate-600 pt-1 leading-normal">
                    <span className="font-bold text-slate-700">Purpose:</span> {s.purpose}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-1 pt-2 border-t border-slate-150">
                {hasPermission('file_shares.manage') && (
                  <button onClick={(e) => openEditModal(s, e)} className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
                {hasPermission('file_shares.manage') && (
                  <button onClick={(e) => handleDeleteShare(s.id, s.folder_name, e)} className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center text-slate-400">
          No network file shares registered yet.
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl select-none">
          <span className="text-xs text-slate-500 font-medium">
            Page {pagination.page} of {pagination.pages} ({pagination.total} shared directories)
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

      {/* MODAL: ADD / EDIT FILE SHARE */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingShare ? 'Edit Shared Directory' : 'Register Shared Directory'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleSaveShare)} className="p-6 space-y-4 text-xs font-semibold">
              
              <div>
                <label className="block text-slate-500 mb-1">Network Shared Folder Path *</label>
                <input type="text" {...register('folder_name', { required: true })} placeholder="\\NAS-SERVER-01\Finance_Share" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Server / IP Storage Location *</label>
                <input type="text" {...register('server_location', { required: true })} placeholder="192.168.1.200 Volume 1 NAS" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Folder Owner / Manager</label>
                <select {...register('owner_employee_id')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">Select Employee</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name || `${e.first_name} ${e.last_name}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Purpose / Notes</label>
                <textarea {...register('purpose')} rows={3} placeholder="Department financial reports & audits storage" className="w-full p-2 border border-slate-350 rounded resize-none"></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-350 text-slate-700 bg-white rounded font-bold hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold cursor-pointer">
                  {saving ? 'Saving...' : editingShare ? 'Save Changes' : 'Register Directory'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
