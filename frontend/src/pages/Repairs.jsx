import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, Filter, Wrench, AlertCircle, Eye, 
  Settings, User, Calendar, ShieldAlert, X
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const repairSchema = z.object({
  assetId: z.string().min(1, 'Asset is required'),
  ticketId: z.string().optional(),
  dateReceived: z.string().min(1, 'Received date is required'),
  reportedIssue: z.string().min(1, 'Reported issue is required'),
  laborCost: z.coerce.number().nonnegative().optional().default(0),
  externalServiceCost: z.coerce.number().nonnegative().optional().default(0),
  remarks: z.string().optional()
});

export default function Repairs() {
  const { hasPermission, showToast } = useAuth();
  const navigate = useNavigate();

  const [repairs, setRepairs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(repairSchema)
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/repairs', {
        params: {
          page,
          search,
          status: statusFilter
        }
      });
      if (response.data.success) {
        setRepairs(response.data.data.repairs);
        setPagination(response.data.data.pagination);
      }

      // Load assets for selection
      const assetsRes = await api.get('/assets', { params: { limit: 100 } });
      if (assetsRes.data.success) {
        // filter out Retired/Disposed assets
        const activeAssets = assetsRes.data.data.assets.filter(a => a.status !== 'Retired' && a.status !== 'Disposed');
        setAssets(activeAssets);
      }

      // Load tickets for referencing
      const ticketsRes = await api.get('/tickets', { params: { limit: 100 } });
      if (ticketsRes.data.success) {
        setTickets(ticketsRes.data.data.tickets);
      }

    } catch (err) {
      showToast('Error', 'Failed to retrieve repair logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, statusFilter]);

  const handleCreateRepair = async (data) => {
    setSaving(true);
    try {
      const res = await api.post('/repairs', data);
      if (res.data.success) {
        showToast('Created', 'Asset pulled for repairs. Status updated to Under Repair.', 'success');
        setModalOpen(false);
        reset();
        loadData();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to create repair log.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Hardware Repairs</h1>
          <p className="text-xs text-slate-500 mt-1">Track diagnostics, labor/parts cost metrics, and completion checks.</p>
        </div>

        {hasPermission('repairs.create') && (
          <button 
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Repair Log</span>
          </button>
        )}
      </div>

      {/* ==========================================
          SEARCH AND FILTERS BAR
          ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        
        {/* Search */}
        <div className="relative sm:col-span-2">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search by repair number, asset code..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-xs text-slate-900"
          />
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="Received">Received</option>
          <option value="Diagnosing">Diagnosing</option>
          <option value="Waiting for Parts">Waiting for Parts</option>
          <option value="Repairing">Repairing</option>
          <option value="Testing">Testing</option>
          <option value="Completed">Completed</option>
          <option value="Unrepairable">Unrepairable</option>
          <option value="Cancelled">Cancelled</option>
        </select>

      </div>

      {/* ==========================================
          REPAIRS DATA TABLE
          ========================================== */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-650"></div>
        </div>
      ) : repairs && repairs.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Repair Number</th>
                  <th className="py-3 px-4">Asset Code</th>
                  <th className="py-3 px-4">Asset Name</th>
                  <th className="py-3 px-4">Technician</th>
                  <th className="py-3 px-4">Cost (PHP)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date Received</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {repairs.map(rep => (
                  <tr key={rep.id} className="hover:bg-slate-55/50">
                    <td className="py-3.5 px-4 font-bold text-slate-950">{rep.repair_number}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{rep.asset_code}</td>
                    <td className="py-3.5 px-4 text-slate-700 truncate max-w-[150px]">{rep.asset_name}</td>
                    <td className="py-3.5 px-4 text-slate-600">🧑 {rep.technician_username || 'System'}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      ₱ {rep.total_repair_cost.toLocaleString([], { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        rep.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        rep.status === 'Cancelled' ? 'bg-slate-100 text-slate-650' :
                        rep.status === 'Unrepairable' ? 'bg-rose-50 text-rose-700 border border-rose-250' :
                        'bg-amber-50 text-amber-705 border border-amber-250'
                      }`}>
                        {rep.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{rep.date_received}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => navigate(`/repairs/${rep.id}`)}
                        className="px-2.5 py-1 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-gold-600 cursor-pointer transition-colors"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-16 bg-white border border-slate-200 rounded-xl text-center text-slate-400 space-y-2">
          <Wrench className="h-10 w-10 mx-auto text-slate-350" />
          <h4 className="font-bold text-sm text-slate-850">No repair logs created</h4>
          <p className="text-xs">Adjust your parameters or record a new hardware checkup to log costs.</p>
        </div>
      )}

      {/* Pagination Footer */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl">
          <span className="text-xs text-slate-500 font-semibold">
            Page {pagination.page} of {pagination.pages} ({pagination.total} records total)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-slate-300 text-xs text-slate-700 bg-white hover:bg-slate-50 rounded cursor-pointer disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page === pagination.pages}
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              className="px-3 py-1.5 border border-slate-300 text-xs text-slate-700 bg-white hover:bg-slate-50 rounded cursor-pointer disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          CREATE REPAIR LOG DIALOG
          ========================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Initiate Hardware Repair Log</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(handleCreateRepair)} className="p-6 space-y-4 text-xs font-semibold">
              
              {/* Asset Select */}
              <div>
                <label className="block text-slate-500 mb-1">Target Asset *</label>
                <select {...register('assetId')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">-- Choose Asset --</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.asset_code} - S/N: {a.serial_number})</option>
                  ))}
                </select>
                {errors.assetId && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.assetId.message}</p>}
              </div>

              {/* Related Ticket */}
              <div>
                <label className="block text-slate-500 mb-1">Referenced Ticket (Optional)</label>
                <select {...register('ticketId')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">-- Select Helpdesk Ticket --</option>
                  {tickets.map(t => (
                    <option key={t.id} value={t.id}>{t.ticket_number} - {t.subject}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Date Received */}
                <div className="sm:col-span-1">
                  <label className="block text-slate-500 mb-1">Date Received *</label>
                  <input type="date" {...register('dateReceived')} defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  {errors.dateReceived && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.dateReceived.message}</p>}
                </div>
                
                {/* Labor Cost */}
                <div>
                  <label className="block text-slate-500 mb-1">Base Labor Cost (PHP)</label>
                  <input type="number" step="0.01" {...register('laborCost')} className="w-full p-2 border border-slate-350 rounded" />
                </div>

                {/* External Cost */}
                <div>
                  <label className="block text-slate-500 mb-1">External Service Cost (PHP)</label>
                  <input type="number" step="0.01" {...register('externalServiceCost')} className="w-full p-2 border border-slate-350 rounded" />
                </div>
              </div>

              {/* Reported Issue */}
              <div>
                <label className="block text-slate-500 mb-1">Reported Issue Summary *</label>
                <textarea {...register('reportedIssue')} className="w-full p-2 border border-slate-350 rounded h-16 resize-none" placeholder="Describe the physical failure or user complaints..."></textarea>
                {errors.reportedIssue && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.reportedIssue.message}</p>}
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-slate-500 mb-1">General Notes</label>
                <input type="text" {...register('remarks')} className="w-full p-2 border border-slate-350 rounded" placeholder="Storage shelf details or visual status..." />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-350 rounded font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-slate-900 text-white rounded font-bold hover:bg-gold-650 cursor-pointer"
                >
                  {saving ? 'Creating profile...' : 'Pull Under Repair'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
