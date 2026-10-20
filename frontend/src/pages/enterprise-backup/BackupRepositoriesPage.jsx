import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  HardDrive, Plus, Search, Filter, Edit, Trash2, X, 
  CheckCircle2, AlertTriangle, ShieldCheck, Lock, RefreshCw
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function BackupRepositoriesPage() {
  const { hasPermission, showToast } = useAuth();

  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, watch } = useForm();
  const repoType = watch('type', 'LocalFolder');

  const loadRepositories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/backups/repositories');
      if (res.data.success) setRepositories(res.data.data);
    } catch (err) {
      showToast('Error', 'Failed to retrieve backup repositories.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepositories();
  }, []);

  const openAddModal = () => {
    reset({
      name: 'NAS SMB Backup Share 01',
      type: 'SMB',
      targetPath: '\\192.168.1.200\\NKB_Backups',
      concurrentJobLimit: 3,
      smbDomain: 'WORKGROUP',
      smbUsername: 'backup_user',
      smbPassword: ''
    });
    setModalOpen(true);
  };

  const handleSaveRepo = async (data) => {
    setSaving(true);
    try {
      const payload = {
        name: data.name,
        type: data.type,
        targetPath: data.targetPath,
        concurrentJobLimit: parseInt(data.concurrentJobLimit) || 3,
        smbDomain: data.smbDomain || null,
        smbUsername: data.smbUsername || null,
        smbPassword: data.smbPassword || null
      };

      await api.post('/v1/backups/repositories', payload);
      showToast('Created', 'New backup repository registered.', 'success');
      setModalOpen(false);
      reset();
      loadRepositories();
    } catch (err) {
      showToast('Error', 'Failed to register backup repository.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (id, name) => {
    try {
      const res = await api.post(`/v1/backups/repositories/${id}/test`);
      if (res.data.success) {
        showToast('Connectivity Verified', `Repository '${name}' is reachable and healthy.`, 'success');
        loadRepositories();
      }
    } catch (err) {
      showToast('Error', `Connectivity test failed for repository '${name}'.`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-gold-600" />
            <span>Backup Storage Repositories</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage SMB network shares, local folders, external USB repositories, and encrypted credentials.</p>
        </div>

        {hasPermission('backup.repositories.manage') && (
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4 text-gold-400" />
            <span>Register Repository</span>
          </button>
        )}
      </div>

      {/* Repositories Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
        </div>
      ) : repositories && repositories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 select-none">
          {repositories.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4 text-gold-600" />
                    <span>{r.name}</span>
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">{r.target_path}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  r.status === 'Healthy' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {r.status}
                </span>
              </div>

              <div className="bg-slate-50 border p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] font-bold">Storage Type:</span>
                  <span className="font-bold text-slate-800">{r.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] font-bold">Encryption:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    <span>AES-256-GCM</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] font-bold">Max Concurrent Jobs:</span>
                  <span className="font-bold text-slate-800">{r.concurrent_job_limit}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-150">
                <span className="text-[10px] text-slate-400 font-mono">
                  Checked: {r.last_connectivity_check ? new Date(r.last_connectivity_check).toLocaleTimeString() : 'Never'}
                </span>
                {hasPermission('backup.repositories.manage') && (
                  <button 
                    onClick={() => handleTestConnection(r.id, r.name)}
                    className="px-3 py-1 bg-slate-900 hover:bg-gold-650 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Test Connection</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center text-slate-400">
          No backup repositories registered yet.
        </div>
      )}

      {/* REGISTER REPOSITORY MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Register Backup Repository</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleSaveRepo)} className="p-6 space-y-4 text-xs font-semibold select-none">
              
              <div>
                <label className="block text-slate-500 mb-1">Repository Name *</label>
                <input type="text" {...register('name', { required: true })} className="w-full p-2 border border-slate-350 rounded text-slate-900" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Repository Type *</label>
                  <select {...register('type')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                    <option value="SMB">SMB / NAS Network Share</option>
                    <option value="LocalFolder">Local Folder</option>
                    <option value="ExternalDisk">External USB Disk</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Max Concurrent Jobs *</label>
                  <input type="number" min="1" max="20" {...register('concurrentJobLimit')} className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Target Directory / SMB Path *</label>
                <input type="text" {...register('targetPath', { required: true })} placeholder="\\192.168.1.200\NKB_Backups or E:\Backups" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
              </div>

              {repoType === 'SMB' && (
                <div className="bg-slate-50 border p-4 rounded-lg space-y-3">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-gold-600" />
                    <span>Encrypted SMB Network Credentials (Stored Server-Side via AES-256-GCM)</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1">Domain</label>
                      <input type="text" {...register('smbDomain')} placeholder="WORKGROUP" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Username</label>
                      <input type="text" {...register('smbUsername')} placeholder="backup_user" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Password</label>
                    <input type="password" {...register('smbPassword')} className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-350 text-slate-700 bg-white rounded font-bold hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold cursor-pointer">
                  {saving ? 'Saving...' : 'Register Repository'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
