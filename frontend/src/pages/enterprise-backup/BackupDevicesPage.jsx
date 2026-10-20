import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Cpu, Plus, Key, Copy, Check, RefreshCw, X, ShieldCheck
} from 'lucide-react';

export default function BackupDevicesPage() {
  const { hasPermission, showToast } = useAuth();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/backups/devices');
      if (res.data.success) setDevices(res.data.data);
    } catch (err) {
      showToast('Error', 'Failed to retrieve backup devices.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleGenerateToken = async () => {
    try {
      const res = await api.post('/v1/backups/enrollment-tokens', {
        expiresInHours: 24,
        maxUses: 1
      });
      if (res.data.success) {
        setGeneratedToken(res.data.data);
        setCopied(false);
      }
    } catch (err) {
      showToast('Error', 'Failed to create enrollment token.', 'error');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="h-5 w-5 text-gold-600" />
            <span>Enrolled Windows Backup Devices</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Enrolled .NET 8 Windows Service Agents, certificates, and SMART status.</p>
        </div>

        {hasPermission('backup.devices.enroll') && (
          <button 
            onClick={() => { handleGenerateToken(); setTokenModalOpen(true); }}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Key className="h-4 w-4 text-gold-400" />
            <span>Generate Enrollment Token</span>
          </button>
        )}
      </div>

      {/* Devices List Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden select-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 font-extrabold">Device Name</th>
                  <th className="p-3.5 font-extrabold">Device ID</th>
                  <th className="p-3.5 font-extrabold">Hostname / IP</th>
                  <th className="p-3.5 font-extrabold">OS / Agent</th>
                  <th className="p-3.5 font-extrabold">Status</th>
                  <th className="p-3.5 font-extrabold">Enrolled At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {devices && devices.length > 0 ? (
                  devices.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-extrabold text-slate-900">
                        {d.device_name}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">{d.device_id}</td>
                      <td className="p-3.5 text-slate-700">{d.hostname} ({d.ip_address || 'N/A'})</td>
                      <td className="p-3.5 text-slate-700">
                        <span className="font-semibold">{d.os_version || 'Windows OS'}</span> | <span className="font-mono text-slate-500">v{d.agent_version || '1.0.0'}</span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          d.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {new Date(d.enrolled_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      No Windows Backup Agents currently enrolled.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ENROLLMENT TOKEN MODAL */}
      {tokenModalOpen && generatedToken && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setTokenModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Key className="h-4 w-4 text-gold-400" />
                <span>Agent Enrollment Token</span>
              </h3>
              <button onClick={() => setTokenModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-semibold select-none">
              <p className="text-slate-600">
                Use this short-lived one-time token during Windows Agent installation. The token expires in 24 hours and will be consumed atomically upon agent certificate enrollment.
              </p>

              <div className="bg-slate-900 text-gold-400 p-3.5 rounded-lg flex items-center justify-between font-mono text-sm border border-slate-800">
                <span className="truncate pr-2">{generatedToken.token}</span>
                <button 
                  onClick={() => copyToClipboard(generatedToken.token)}
                  className="p-1.5 bg-slate-800 hover:bg-gold-650 text-white rounded cursor-pointer transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="bg-slate-50 border p-3 rounded-lg text-[11px] text-slate-500 space-y-1 font-mono">
                <p># PowerShell Installer Example Command:</p>
                <p className="text-slate-800 font-bold select-all">
                  .\install_nkb_backup_agent.ps1 -ServerUrl "https://itms.nkbmanufacturing.com" -EnrollmentToken "{generatedToken.token}"
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={() => setTokenModalOpen(false)} className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold cursor-pointer">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
