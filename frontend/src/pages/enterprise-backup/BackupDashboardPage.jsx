import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, Cpu, HardDrive, Play, CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';

export default function BackupDashboardPage() {
  const { showToast } = useAuth();

  const [devices, setDevices] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [devRes, jobRes, repoRes] = await Promise.all([
        api.get('/v1/backups/devices'),
        api.get('/v1/backups/jobs'),
        api.get('/v1/backups/repositories')
      ]);

      if (devRes.data.success) setDevices(devRes.data.data);
      if (jobRes.data.success) setJobs(jobRes.data.data);
      if (repoRes.data.success) setRepositories(repoRes.data.data);
    } catch (err) {
      showToast('Error', 'Failed to retrieve backup dashboard telemetry.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onlineAgentsCount = devices.filter(d => d.status === 'online').length;
  const activeJobsCount = jobs.filter(j => j.status === 'Running').length;
  const healthyReposCount = repositories.filter(r => r.status === 'Healthy').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-gold-400 rounded-lg">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Registered Agents</p>
            <h3 className="text-xl font-extrabold text-slate-900">{devices.length} Devices</h3>
            <p className="text-[11px] text-emerald-600 font-semibold">{onlineAgentsCount} Online</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-gold-400 rounded-lg">
            <Play className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Configured Jobs</p>
            <h3 className="text-xl font-extrabold text-slate-900">{jobs.length} Jobs</h3>
            <p className="text-[11px] text-slate-500 font-semibold">{activeJobsCount} Active Runs</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-gold-400 rounded-lg">
            <HardDrive className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Repositories</p>
            <h3 className="text-xl font-extrabold text-slate-900">{repositories.length} Shares</h3>
            <p className="text-[11px] text-emerald-600 font-semibold">{healthyReposCount} Healthy</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-gold-400 rounded-lg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Security Mode</p>
            <h3 className="text-sm font-black text-slate-900">AES-256-GCM</h3>
            <p className="text-[11px] text-slate-500 font-semibold">DPAPI Credential Storage</p>
          </div>
        </div>

      </div>

      {/* Real Active Devices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <h3 className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
            <Cpu className="h-4 w-4 text-gold-400" />
            <span>Windows Backup Agent Telemetry (Real-Time)</span>
          </h3>
          <button onClick={loadData} className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b">
              <tr>
                <th className="p-3 font-bold">Device Name / Hostname</th>
                <th className="p-3 font-bold">Device ID</th>
                <th className="p-3 font-bold">Agent Version</th>
                <th className="p-3 font-bold">Status</th>
                <th className="p-3 font-bold">Last Heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {devices && devices.length > 0 ? (
                devices.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-3 font-extrabold text-slate-900">
                      {d.device_name} ({d.hostname})
                    </td>
                    <td className="p-3 font-mono text-slate-600">{d.device_id}</td>
                    <td className="p-3 font-mono text-slate-700">{d.agent_version || '1.0.0'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        d.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">
                      {d.last_heartbeat_at ? new Date(d.last_heartbeat_at).toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No Windows Backup Agents enrolled yet. Generate an enrollment token under "Backup Devices" tab to enroll a Windows endpoint.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
