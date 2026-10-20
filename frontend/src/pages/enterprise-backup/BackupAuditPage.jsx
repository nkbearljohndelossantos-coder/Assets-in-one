import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  FileText, ShieldCheck, RefreshCw, Lock
} from 'lucide-react';

export default function BackupAuditPage() {
  const { showToast } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/backups/audit-logs');
      if (res.data.success) setLogs(res.data.data);
    } catch (err) {
      showToast('Error', 'Failed to retrieve cryptographic audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-gold-600" />
            <span>Cryptographic Hash-Chained Audit Events</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Immutable sequence, previous record hashes, SHA-256 integrity verification.</p>
        </div>

        <button onClick={loadAuditLogs} className="p-2 bg-slate-900 hover:bg-gold-650 text-white rounded-lg text-xs font-semibold cursor-pointer">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Audit Log Table */}
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
                  <th className="p-3.5 font-extrabold">Seq #</th>
                  <th className="p-3.5 font-extrabold">Action / Actor</th>
                  <th className="p-3.5 font-extrabold">Result</th>
                  <th className="p-3.5 font-extrabold">Record Hash (SHA-256)</th>
                  <th className="p-3.5 font-extrabold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {logs && logs.length > 0 ? (
                  logs.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono font-extrabold text-gold-600">
                        #{l.sequence_number}
                      </td>
                      <td className="p-3.5">
                        <span className="font-extrabold text-slate-900 block">{l.action}</span>
                        <span className="text-[10px] text-slate-500">{l.actor_type}: {l.actor_id}</span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          l.result === 'Success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {l.result}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-slate-600">
                        {l.record_hash.substring(0, 16)}...
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {new Date(l.event_timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400">
                      No audit events logged yet.
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
