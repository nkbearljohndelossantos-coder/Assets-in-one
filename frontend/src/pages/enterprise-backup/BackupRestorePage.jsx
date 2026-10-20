import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  RotateCcw, Folder, Plus, Search, Filter, Edit, Trash2, X, 
  CheckCircle2, AlertTriangle, ShieldCheck, Cpu
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function BackupRestorePage() {
  const { hasPermission, showToast } = useAuth();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/backups/devices');
      if (res.data.success) setDevices(res.data.data);
    } catch (err) {
      showToast('Error', 'Failed to retrieve devices for restore.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openRestoreModal = () => {
    reset({
      restorePointId: '1',
      targetDeviceId: '',
      targetDirectory: 'C:\\Restored_NKB_Files',
      conflictOption: 'Overwrite'
    });
    setModalOpen(true);
  };

  const handleAuthorizeRestore = async (data) => {
    setSaving(true);
    try {
      const payload = {
        restorePointId: parseInt(data.restorePointId),
        targetDeviceId: parseInt(data.targetDeviceId),
        targetDirectory: data.targetDirectory,
        conflictOption: data.conflictOption
      };

      const res = await api.post('/v1/backups/restore-jobs/authorize', payload);
      if (res.data.success) {
        showToast('Authorized', `File restore job ${res.data.data.restoreCode} authorized for target directory ${data.targetDirectory}.`, 'success');
        setModalOpen(false);
        reset();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.error || 'Failed to authorize file restore.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 select-none">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-gold-600" />
            <span>File-Level Restore Console</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Browse restore points, authorize file extraction, and preserve NTFS ACLs & timestamps.</p>
        </div>

        {hasPermission('backup.restore.files') && (
          <button 
            onClick={openRestoreModal}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <RotateCcw className="h-4 w-4 text-gold-400" />
            <span>Authorize File Restore</span>
          </button>
        )}
      </div>

      {/* Restore Points Information Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900 text-gold-400 rounded-lg">
            <Folder className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Selective File & Folder Recovery</h3>
            <p className="text-xs text-slate-500">
              Restore individual financial reports, databases, and document folders to original or alternate Windows directories.
            </p>
          </div>
        </div>
      </div>

      {/* AUTHORIZE RESTORE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Authorize File Restore Job</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleAuthorizeRestore)} className="p-6 space-y-4 text-xs font-semibold select-none">
              
              <div>
                <label className="block text-slate-500 mb-1">Target Windows Device *</label>
                <select {...register('targetDeviceId', { required: true })} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">Select Device</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.device_name} ({d.hostname})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Restore Target Directory *</label>
                <input type="text" {...register('targetDirectory', { required: true })} placeholder="C:\Restored_NKB_Files" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Conflict Handling Option *</label>
                <select {...register('conflictOption')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="Overwrite">Overwrite Existing Files</option>
                  <option value="Skip">Skip Existing Files</option>
                  <option value="Rename">Rename Restored Files</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-350 text-slate-700 bg-white rounded font-bold hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold cursor-pointer">
                  {saving ? 'Authorizing...' : 'Authorize Restore'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
