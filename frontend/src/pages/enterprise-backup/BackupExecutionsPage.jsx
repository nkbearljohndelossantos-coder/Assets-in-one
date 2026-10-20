import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  RefreshCw, Play, CheckCircle2, AlertTriangle, Clock, ShieldCheck
} from 'lucide-react';

export default function BackupExecutionsPage() {
  const { showToast } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/backups/jobs');
      if (res.data.success) setJobs(res.data.data);
    } catch (err) {
      showToast('Error', 'Failed to retrieve execution state.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutions();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-gold-600" />
            <span>Job Executions & Lease State Machine</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Idempotent leases, execution phases, transfer speed meters, and state machine transitions.</p>
        </div>

        <button onClick={loadExecutions} className="p-2 bg-slate-900 hover:bg-gold-650 text-white rounded-lg text-xs font-semibold cursor-pointer">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Execution State Info Table */}
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
                  <th className="p-3.5 font-extrabold">Job Name / Code</th>
                  <th className="p-3.5 font-extrabold">Target Device</th>
                  <th className="p-3.5 font-extrabold">Repository</th>
                  <th className="p-3.5 font-extrabold">Current Status</th>
                  <th className="p-3.5 font-extrabold">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {jobs && jobs.length > 0 ? (
                  jobs.map(j => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-extrabold text-slate-900">
                        {j.name} ({j.job_code})
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">{j.device_name}</td>
                      <td className="p-3.5 text-slate-700">{j.repository_name}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          j.status === 'Running' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {new Date(j.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400">
                      No job executions recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
