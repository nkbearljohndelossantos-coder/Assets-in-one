import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Play, Plus, Search, Filter, Edit, Trash2, X, 
  CheckCircle2, AlertTriangle, HardDrive, Cpu
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function BackupJobsPage() {
  const { hasPermission, showToast } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobRes, devRes, repoRes] = await Promise.all([
        api.get('/v1/backups/jobs'),
        api.get('/v1/backups/devices'),
        api.get('/v1/backups/repositories')
      ]);

      if (jobRes.data.success) setJobs(jobRes.data.data);
      if (devRes.data.success) setDevices(devRes.data.data);
      if (repoRes.data.success) setRepositories(repoRes.data.data);
    } catch (err) {
      showToast('Error', 'Failed to retrieve backup jobs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    reset({
      name: 'Daily Accounting Files Backup',
      deviceId: '',
      repositoryId: '',
      backupMode: 'Incremental',
      sourcePaths: 'C:\\NKB_Financial_Reports, C:\\AccountingData'
    });
    setModalOpen(true);
  };

  const handleSaveJob = async (data) => {
    setSaving(true);
    try {
      const pathsArray = data.sourcePaths.split(',').map(p => p.trim()).filter(Boolean);
      const payload = {
        name: data.name,
        deviceId: parseInt(data.deviceId),
        repositoryId: parseInt(data.repositoryId),
        backupMode: data.backupMode,
        sourcePaths: pathsArray
      };

      await api.post('/v1/backups/jobs', payload);
      showToast('Created', 'New backup job configured.', 'success');
      setModalOpen(false);
      reset();
      loadData();
    } catch (err) {
      showToast('Error', 'Failed to configure backup job.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async (jobId) => {
    try {
      const res = await api.post(`/v1/backups/jobs/${jobId}/run`);
      if (res.data.success) {
        showToast('Triggered', `Backup job execution ${res.data.data.executionCode} leased.`, 'success');
        loadData();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.error || 'Failed to trigger job execution.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Play className="h-5 w-5 text-gold-600" />
            <span>Configured Backup Jobs</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">File & Folder backup schedules, AES-256-GCM encryption, and execution triggers.</p>
        </div>

        {hasPermission('backup.jobs.create') && (
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4 text-gold-400" />
            <span>Configure New Job</span>
          </button>
        )}
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {jobs.map(j => (
            <div key={j.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <Play className="h-4 w-4 text-gold-600" />
                    <span>{j.name}</span>
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">{j.job_code}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  j.status === 'Running' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-100 text-slate-700'
                }`}>
                  {j.status}
                </span>
              </div>

              <div className="bg-slate-50 border p-3 rounded-lg text-xs space-y-1 select-none">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] font-bold">Target Device:</span>
                  <span className="font-bold text-slate-800">{j.device_name} ({j.hostname})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] font-bold">Repository:</span>
                  <span className="font-bold text-slate-800">{j.repository_name} ({j.repository_type})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] font-bold">Backup Mode:</span>
                  <span className="font-bold text-emerald-600">{j.backup_mode}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-150">
                <span className="text-[10px] font-mono text-slate-400">Phase 1 File-Level</span>
                {hasPermission('backup.jobs.run') && (
                  <button 
                    onClick={() => handleRunNow(j.id)}
                    className="px-3 py-1 bg-slate-900 hover:bg-gold-650 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Run Now</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center text-slate-400">
          No backup jobs configured yet.
        </div>
      )}

      {/* CONFIGURE JOB MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Configure Backup Job</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleSaveJob)} className="p-6 space-y-4 text-xs font-semibold select-none">
              
              <div>
                <label className="block text-slate-500 mb-1">Job Name *</label>
                <input type="text" {...register('name', { required: true })} className="w-full p-2 border border-slate-350 rounded text-slate-900" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Target Device *</label>
                  <select {...register('deviceId', { required: true })} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                    <option value="">Choose Device</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>{d.device_name} ({d.hostname})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Backup Repository *</label>
                  <select {...register('repositoryId', { required: true })} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                    <option value="">Choose Repository</option>
                    {repositories.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Backup Mode *</label>
                <select {...register('backupMode')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="Incremental">Incremental File Backup</option>
                  <option value="Full">Full File Backup</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Source Paths (Comma Separated) *</label>
                <input type="text" {...register('sourcePaths', { required: true })} placeholder="C:\Financial_Reports, C:\Accounting" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-350 text-slate-700 bg-white rounded font-bold hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold cursor-pointer">
                  {saving ? 'Saving...' : 'Create Backup Job'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
