import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, ShieldAlert, Cpu, Plus, Search, Filter, 
  Edit, Trash2, X, CheckCircle2, AlertTriangle, Monitor, Key
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function Endpoints() {
  const { hasPermission, showToast } = useAuth();

  const [activeTab, setActiveTab] = useState('antivirus'); // 'antivirus' | 'os'

  const [antivirusList, setAntivirusList] = useState([]);
  const [osList, setOsList] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Modal controls
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'antivirus') {
        const res = await api.get('/endpoints/antivirus', { params: { page, search } });
        if (res.data.antivirus) {
          setAntivirusList(res.data.antivirus);
          setPagination(res.data.pagination || { total: res.data.antivirus.length, pages: 1, limit: 10 });
        }
      } else {
        const res = await api.get('/endpoints/os', { params: { page, search } });
        if (res.data.operatingSystems) {
          setOsList(res.data.operatingSystems);
          setPagination(res.data.pagination || { total: res.data.operatingSystems.length, pages: 1, limit: 10 });
        }
      }

      const astRes = await api.get('/assets', { params: { limit: 100 } });
      if (astRes.data.success) setAssets(astRes.data.data.assets);
    } catch (err) {
      showToast('Error', 'Failed to retrieve endpoint security data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, page, search]);

  const openAddModal = () => {
    setEditingItem(null);
    reset({
      asset_id: '',
      antivirus_name: 'Windows Defender Enterprise',
      version: '4.18.2305.1',
      expiration_date: '',
      last_scan_date: new Date().toISOString().split('T')[0],
      scan_result: 'Clean',
      edition: 'Windows 11 Pro 22H2',
      build_version: '22621.1778',
      license_type: 'OEM',
      activation_status: 'Activated'
    });
    setModalOpen(true);
  };

  const openEditModal = (item, e) => {
    if (e) e.stopPropagation();
    setEditingItem(item);
    reset({
      ...item,
      asset_id: String(item.asset_id),
      expiration_date: item.expiration_date ? item.expiration_date.split('T')[0] : '',
      last_scan_date: item.last_scan_date ? item.last_scan_date.split('T')[0] : ''
    });
    setModalOpen(true);
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (activeTab === 'antivirus') {
        const payload = {
          asset_id: parseInt(data.asset_id),
          antivirus_name: data.antivirus_name,
          version: data.version,
          license_key: data.license_key || null,
          expiration_date: data.expiration_date || null,
          last_scan_date: data.last_scan_date || null,
          scan_result: data.scan_result
        };
        if (editingItem) {
          await api.put(`/endpoints/antivirus/${editingItem.id}`, payload);
          showToast('Updated', 'Endpoint antivirus record updated.', 'success');
        } else {
          await api.post('/endpoints/antivirus', payload);
          showToast('Registered', 'New antivirus endpoint added.', 'success');
        }
      } else {
        const payload = {
          asset_id: parseInt(data.asset_id),
          edition: data.edition,
          build_version: data.build_version,
          license_type: data.license_type,
          activation_status: data.activation_status,
          product_key: data.product_key || null
        };
        if (editingItem) {
          await api.put(`/endpoints/os/${editingItem.id}`, payload);
          showToast('Updated', 'Operating System record updated.', 'success');
        } else {
          await api.post('/endpoints/os', payload);
          showToast('Registered', 'New OS record added.', 'success');
        }
      }

      setModalOpen(false);
      reset();
      loadData();
    } catch (err) {
      showToast('Error', 'Failed to save endpoint security profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this endpoint record?')) return;
    try {
      if (activeTab === 'antivirus') await api.delete(`/endpoints/antivirus/${id}`);
      else await api.delete(`/endpoints/os/${id}`);
      showToast('Removed', 'Endpoint record removed.', 'success');
      loadData();
    } catch (err) {
      showToast('Error', 'Failed to delete record.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-gold-600" />
            <span>Endpoint Security & OS Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Track antivirus scan compliance, endpoint health, Windows OS editions, and OEM/Volume activation keys.</p>
        </div>

        {hasPermission('endpoint_security.manage') && (
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>{activeTab === 'antivirus' ? 'Register Antivirus' : 'Register Operating System'}</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 select-none">
        <button
          onClick={() => { setActiveTab('antivirus'); setPage(1); }}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'antivirus' ? 'border-gold-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-gold-600" />
          <span>Antivirus Protection Status</span>
        </button>

        <button
          onClick={() => { setActiveTab('os'); setPage(1); }}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'os' ? 'border-gold-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Monitor className="h-4 w-4 text-gold-600" />
          <span>Operating System Tracking</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search by workstation asset, serial number, edition, software name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-xs text-slate-900"
          />
        </div>
      </div>

      {/* Content View */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
        </div>
      ) : activeTab === 'antivirus' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden select-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 font-extrabold">Workstation Asset</th>
                  <th className="p-3.5 font-extrabold">Antivirus Software</th>
                  <th className="p-3.5 font-extrabold">Version</th>
                  <th className="p-3.5 font-extrabold">Last Scan Date</th>
                  <th className="p-3.5 font-extrabold">Scan Result</th>
                  <th className="p-3.5 font-extrabold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {antivirusList && antivirusList.length > 0 ? (
                  antivirusList.map(av => (
                    <tr key={av.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-extrabold text-slate-900">
                        {av.asset_name} ({av.asset_code})
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">
                        {av.antivirus_name}
                      </td>
                      <td className="p-3.5 font-mono text-slate-700">
                        {av.version}
                      </td>
                      <td className="p-3.5 text-slate-700">
                        {av.last_scan_date ? av.last_scan_date.split('T')[0] : 'Never'}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          av.scan_result === 'Clean' ? 'bg-emerald-100 text-emerald-700' :
                          av.scan_result === 'Threat Found' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {av.scan_result}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        {hasPermission('endpoint_security.manage') && (
                          <button onClick={(e) => openEditModal(av, e)} className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer">
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {hasPermission('endpoint_security.manage') && (
                          <button onClick={(e) => handleDelete(av.id, e)} className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      No antivirus endpoint records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden select-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 font-extrabold">Workstation Asset</th>
                  <th className="p-3.5 font-extrabold">OS Edition</th>
                  <th className="p-3.5 font-extrabold">Build Version</th>
                  <th className="p-3.5 font-extrabold">License Type</th>
                  <th className="p-3.5 font-extrabold">Activation Status</th>
                  <th className="p-3.5 font-extrabold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {osList && osList.length > 0 ? (
                  osList.map(os => (
                    <tr key={os.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-extrabold text-slate-900">
                        {os.asset_name} ({os.asset_code})
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">
                        {os.edition}
                      </td>
                      <td className="p-3.5 font-mono text-slate-700">
                        {os.build_version}
                      </td>
                      <td className="p-3.5 text-slate-700">
                        <span className="font-bold">{os.license_type}</span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          os.activation_status === 'Activated' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {os.activation_status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        {hasPermission('endpoint_security.manage') && (
                          <button onClick={(e) => openEditModal(os, e)} className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer">
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {hasPermission('endpoint_security.manage') && (
                          <button onClick={(e) => handleDelete(os.id, e)} className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      No operating system records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl select-none">
          <span className="text-xs text-slate-500 font-medium">
            Page {pagination.page} of {pagination.pages} ({pagination.total} records)
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

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">
                {editingItem ? 'Edit Profile' : 'Register Entry'} ({activeTab.toUpperCase()})
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleSave)} className="p-6 space-y-4 text-xs font-semibold">
              
              <div>
                <label className="block text-slate-500 mb-1">Workstation Asset *</label>
                <select {...register('asset_id', { required: true })} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">-- Choose Asset --</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.asset_code})</option>
                  ))}
                </select>
              </div>

              {activeTab === 'antivirus' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-1">Antivirus Name *</label>
                      <input type="text" {...register('antivirus_name', { required: true })} placeholder="Windows Defender" className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Version *</label>
                      <input type="text" {...register('version', { required: true })} placeholder="4.18.2305.1" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">License Key (Stored Encrypted)</label>
                    <input type="text" {...register('license_key')} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" className="w-full p-2 border border-slate-350 rounded font-mono" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-1">Last Scan Date</label>
                      <input type="date" {...register('last_scan_date')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Scan Result *</label>
                      <select {...register('scan_result')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                        <option value="Clean">Clean (No Threats)</option>
                        <option value="Threat Found">Threat Found</option>
                        <option value="Warning">Warning</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-1">OS Edition *</label>
                      <input type="text" {...register('edition', { required: true })} placeholder="Windows 11 Pro 22H2" className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Build Version *</label>
                      <input type="text" {...register('build_version', { required: true })} placeholder="22621.1778" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-1">License Type *</label>
                      <select {...register('license_type')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                        <option value="OEM">OEM (Pre-installed)</option>
                        <option value="Volume">Volume (KMS / MAK)</option>
                        <option value="Retail">Retail</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Activation Status *</label>
                      <select {...register('activation_status')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                        <option value="Activated">Activated</option>
                        <option value="Not Activated">Not Activated</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">Windows Product Key (Encrypted)</label>
                    <input type="text" {...register('product_key')} placeholder="VK7JG-NPHTM-C97JM-9MPGT-3V66T" className="w-full p-2 border border-slate-350 rounded font-mono" />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-350 text-slate-700 bg-white rounded font-bold hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold cursor-pointer">
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Register Endpoint'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
