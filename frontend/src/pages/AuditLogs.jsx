import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { History, Search, AlertOctagon, User, ShieldAlert } from 'lucide-react';

export default function AuditLogs() {
  const { hasPermission, showToast } = useAuth();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 15 });

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs', {
        params: {
          page,
          search
        }
      });
      if (res.data.success) {
        setLogs(res.data.data.logs);
        setPagination(res.data.data.pagination);
      }
    } catch (e) {
      showToast('Error', 'Failed to retrieve security audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, search]);

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Security Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-1">Read-only system activity trail logging changes, logins, and key reveals.</p>
        </div>
      </div>

      {/* Search Filter bar */}
      <div className="flex bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
        <div className="relative flex-grow">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search logs by operator username, action details, target module..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-slate-900"
          />
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-650"></div>
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Operator</th>
                  <th className="py-2.5 px-4">Action Event</th>
                  <th className="py-2.5 px-4">Target Module</th>
                  <th className="py-2.5 px-4">IP Address</th>
                  <th className="py-2.5 px-4">Details / Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {logs.map(log => {
                  const isCritical = log.action.includes('Delete') || log.action.includes('Deactivate') || log.action.includes('Reveal');
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-950 flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{log.username}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isCritical ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{log.module}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">{log.ip_address}</td>
                      <td className="py-3 px-4 text-slate-650 max-w-sm truncate leading-normal" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {pagination.pages > 1 && (
            <div className="flex justify-between items-center p-4 bg-slate-50 border-t select-none">
              <span className="text-slate-500 text-[11px]">
                Showing Page {pagination.page} of {pagination.pages} ({pagination.total} activities total)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 text-slate-750 border border-slate-350 bg-white hover:bg-slate-100 rounded cursor-pointer disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page === pagination.pages}
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  className="px-3 py-1 text-slate-750 border border-slate-355 bg-white hover:bg-slate-100 rounded cursor-pointer disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="p-16 text-center text-slate-400 bg-white border rounded-xl">
          <AlertOctagon className="h-10 w-10 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-805 mt-2">No security audit logs recorded</h4>
          <p className="text-xs">Adjust your parameters or record a system changes event.</p>
        </div>
      )}

    </div>
  );
}
