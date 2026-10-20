import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, Filter, Calendar, AlertCircle, Eye, 
  Settings, User, Clock, ShieldAlert, X, CheckSquare
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const maintSchema = z.object({
  assetId: z.string().min(1, 'Target asset is required'),
  title: z.string().min(1, 'Schedule title is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  scheduledDate: z.string().min(1, 'Scheduled start date is required'),
  technicianId: z.string().optional(),
  checklistJson: z.string().min(1, 'Checklist tasks are required'),
  remarks: z.string().optional()
});

export default function Maintenance() {
  const { hasPermission, showToast } = useAuth();
  const navigate = useNavigate();

  const [schedules, setSchedules] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
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
    resolver: zodResolver(maintSchema),
    defaultValues: {
      frequency: 'Monthly',
      checklistJson: '["Clean dust filters", "Check storage health", "Verify OS updates", "Scan for malware"]'
    }
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/maintenance', {
        params: {
          page,
          search,
          status: statusFilter
        }
      });
      if (response.data.success) {
        setSchedules(response.data.data.schedules);
        setPagination(response.data.data.pagination);
      }

      // Load assets for target scheduling
      const assetsRes = await api.get('/assets', { params: { limit: 100 } });
      if (assetsRes.data.success) {
        setAssets(assetsRes.data.data.assets);
      }

      // Load technician list
      const usersRes = await api.get('/users');
      if (usersRes.data.success) {
        const techs = usersRes.data.data.filter(u => 
          u.roles.some(r => ['IT Staff', 'Technician', 'IT Manager', 'Super Admin'].includes(r.name))
        );
        setTechnicians(techs);
      }

    } catch (err) {
      showToast('Error', 'Failed to retrieve PM schedules.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, statusFilter]);

  const handleCreateSchedule = async (data) => {
    setSaving(true);
    try {
      // Validate checklist JSON format
      let parsedChecklist;
      try {
        parsedChecklist = JSON.parse(data.checklistJson);
        if (!Array.isArray(parsedChecklist)) throw new Error();
      } catch (e) {
        alert('Checklist must be a valid JSON array of strings: e.g. ["Task 1", "Task 2"]');
        setSaving(false);
        return;
      }

      const payload = {
        ...data,
        checklist: parsedChecklist
      };

      const res = await api.post('/maintenance', payload);
      if (res.data.success) {
        showToast('Created', 'Preventive Maintenance schedule configured successfully.', 'success');
        setModalOpen(false);
        reset();
        loadData();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to save PM schedule.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Preventive Maintenance</h1>
          <p className="text-xs text-slate-500 mt-1">Schedule recurring device tuneups, checklists, and cycles tracking.</p>
        </div>

        {hasPermission('maintenance.create') && (
          <button 
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Plan</span>
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
            placeholder="Search by plan title, asset code..."
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
          <option value="Scheduled">Scheduled</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Missed">Missed</option>
          <option value="Cancelled">Cancelled</option>
        </select>

      </div>

      {/* ==========================================
          PM SCHEDULES LIST
          ========================================== */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-650"></div>
        </div>
      ) : schedules && schedules.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">PM Code</th>
                  <th className="py-3 px-4">Title / Plan Name</th>
                  <th className="py-3 px-4">Asset Code</th>
                  <th className="py-3 px-4">Asset Name</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Checklist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {schedules.map(pm => (
                  <tr key={pm.id} className="hover:bg-slate-55/50">
                    <td className="py-3.5 px-4 font-bold text-slate-950">{pm.maintenance_number}</td>
                    <td className="py-3.5 px-4 text-slate-800">{pm.title}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{pm.asset_code}</td>
                    <td className="py-3.5 px-4 truncate max-w-[130px]">{pm.asset_name}</td>
                    <td className="py-3.5 px-4 text-slate-650">{pm.frequency}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">📅 {pm.scheduled_date}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        pm.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        pm.status === 'Cancelled' ? 'bg-slate-100 text-slate-650' :
                        pm.status === 'Missed' ? 'bg-rose-50 text-rose-700 border border-rose-250' :
                        'bg-amber-50 text-amber-705 border border-amber-250'
                      }`}>
                        {pm.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => navigate(`/maintenance/${pm.id}`)}
                        className="px-2.5 py-1 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-gold-650 cursor-pointer transition-colors"
                      >
                        Open Checklist
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
          <Calendar className="h-10 w-10 mx-auto text-slate-350" />
          <h4 className="font-bold text-sm text-slate-850">No preventive plans scheduled</h4>
          <p className="text-xs">Adjust your parameters or record a new PM log cycle to sync asset calibrations.</p>
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
          CREATE SCHEDULE PLAN MODAL
          ========================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Schedule Preventive Maintenance</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(handleCreateSchedule)} className="p-6 space-y-4 text-xs font-semibold">
              
              {/* Asset Select */}
              <div>
                <label className="block text-slate-500 mb-1">Target Device Asset *</label>
                <select {...register('assetId')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">-- Choose Asset --</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.asset_code})</option>
                  ))}
                </select>
                {errors.assetId && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.assetId.message}</p>}
              </div>

              {/* Title */}
              <div>
                <label className="block text-slate-500 mb-1">Maintenance Title / Program Name *</label>
                <input type="text" {...register('title')} placeholder="e.g. Workstations Quarterly Internal Cleaning" className="w-full p-2 border border-slate-350 rounded" />
                {errors.title && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Frequency */}
                <div>
                  <label className="block text-slate-500 mb-1">Cycle Frequency *</label>
                  <select {...register('frequency')} className="w-full p-2 border border-slate-350 rounded bg-white">
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Semi-Annually">Semi-Annually</option>
                    <option value="Annually">Annually</option>
                  </select>
                </div>

                {/* Scheduled Date */}
                <div>
                  <label className="block text-slate-500 mb-1">Schedule Date *</label>
                  <input type="date" {...register('scheduledDate')} defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  {errors.scheduledDate && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.scheduledDate.message}</p>}
                </div>

                {/* Technician */}
                <div>
                  <label className="block text-slate-500 mb-1">Target Technician</label>
                  <select {...register('technicianId')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                    <option value="">-- Choose Tech --</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.username}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checklist */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-500">Checklist Instruction Array (JSON Format) *</label>
                  <span className="text-[10px] text-slate-400">Must represent a string array</span>
                </div>
                <textarea {...register('checklistJson')} className="w-full p-2 border border-slate-350 rounded h-20 resize-none font-mono text-[11px] text-slate-900"></textarea>
                {errors.checklistJson && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.checklistJson.message}</p>}
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-slate-500 mb-1">Remarks</label>
                <input type="text" {...register('remarks')} className="w-full p-2 border border-slate-350 rounded" placeholder="Calibration logs notes..." />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-350 rounded font-bold hover:bg-slate-55 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-slate-950 text-white rounded font-bold hover:bg-gold-650 transition-colors cursor-pointer"
                >
                  {saving ? 'Scheduling program...' : 'Create PM Plan'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
