import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, Laptop, CheckSquare, Clock, ArrowLeft, 
  Save, CheckCircle2, ListTodo, ClipboardCheck, X
} from 'lucide-react';

export default function MaintenanceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, showToast } = useAuth();

  const [schedule, setSchedule] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [checkedStates, setCheckedStates] = useState({}); // { [index]: boolean }
  const [loading, setLoading] = useState(true);

  // Modals state
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [actualDate, setActualDate] = useState(new Date().toISOString().split('T')[0]);

  const loadScheduleDetails = async () => {
    try {
      const res = await api.get(`/maintenance/${id}`);
      if (res.data.success) {
        setSchedule(res.data.data.schedule);
        const list = res.data.data.checklist || [];
        setChecklist(list);
        
        // Build checkbox states if already completed
        const states = {};
        if (res.data.data.schedule.status === 'Completed') {
          list.forEach((_, idx) => { states[idx] = true; });
        }
        setCheckedStates(states);
      }
    } catch (err) {
      showToast('Error', 'Failed to retrieve PM details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheduleDetails();
  }, [id]);

  const toggleCheck = (idx) => {
    if (schedule.status === 'Completed') return;
    setCheckedStates(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const allChecked = checklist.length > 0 && checklist.every((_, idx) => checkedStates[idx]);

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!allChecked) {
      alert('Please complete all checklist items before recording completion.');
      return;
    }

    try {
      const res = await api.post(`/maintenance/${id}/complete`, {
        actualDate,
        remarks: completionRemarks
      });

      if (res.data.success) {
        showToast('Completed', 'Preventive Maintenance logged as completed. Next cycle auto-scheduled.', 'success');
        setCompleteModalOpen(false);
        loadScheduleDetails();
      }
    } catch (err) {
      showToast('Error', 'Failed to log completion.', 'error');
    }
  };

  // Helper: auto-calculate next date for preview
  const getNextOccurrencePreview = () => {
    if (!schedule) return '';
    const baseDate = new Date(actualDate);
    const freq = schedule.frequency;
    if (freq === 'Daily') baseDate.setDate(baseDate.getDate() + 1);
    else if (freq === 'Weekly') baseDate.setDate(baseDate.getDate() + 7);
    else if (freq === 'Monthly') baseDate.setMonth(baseDate.getMonth() + 1);
    else if (freq === 'Quarterly') baseDate.setMonth(baseDate.getMonth() + 3);
    else if (freq === 'Semi-Annually') baseDate.setMonth(baseDate.getMonth() + 6);
    else if (freq === 'Annually') baseDate.setFullYear(baseDate.getFullYear() + 1);
    return baseDate.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  if (!schedule) return <div className="p-8 text-center text-slate-500">Schedule not found.</div>;

  return (
    <div className="space-y-6">
      
      {/* Action Header */}
      <div className="flex justify-between items-center select-none">
        <button 
          onClick={() => navigate('/maintenance')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-650 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Plans</span>
        </button>

        {hasPermission('maintenance.update') && schedule.status !== 'Completed' && (
          <button 
            disabled={!allChecked}
            onClick={() => setCompleteModalOpen(true)}
            className="px-4 py-2 bg-slate-950 hover:bg-gold-650 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer transition-colors shadow"
          >
            <ClipboardCheck className="h-4 w-4 text-gold-500" />
            <span>Complete Checklist</span>
          </button>
        )}
      </div>

      {/* Grid view: Details Left, Checklist checklist Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side Details card */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 text-xs font-semibold">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Plan Details</h3>
            
            <div className="space-y-3">
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">PM Code</span>
                <span className="font-bold text-slate-900 block mt-0.5">{schedule.maintenance_number}</span>
              </div>
              
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Title</span>
                <span className="font-bold text-slate-800 block mt-0.5">{schedule.title}</span>
              </div>

              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Target Device</span>
                <span className="font-semibold text-slate-700 block mt-0.5">💻 {schedule.asset_name} ({schedule.asset_code})</span>
              </div>

              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Frequency / Cycle</span>
                <span className="font-semibold text-slate-700 block mt-0.5">🔄 {schedule.frequency}</span>
              </div>

              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Scheduled Date</span>
                <span className="font-semibold text-slate-700 block mt-0.5">📅 {schedule.scheduled_date}</span>
              </div>

              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Execution Status</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold inline-block mt-1 ${
                  schedule.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'bg-amber-50 text-amber-705 border border-amber-250'
                }`}>
                  {schedule.status}
                </span>
              </div>

              {schedule.completion_date && (
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Completion Log Date</span>
                  <span className="font-semibold text-slate-700 block mt-0.5">📅 {schedule.completion_date}</span>
                </div>
              )}

              {schedule.remarks && (
                <div className="pt-2 border-t text-[11px] leading-normal">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Remarks / Diagnostics</span>
                  <p className="text-slate-600 mt-1 italic">"{schedule.remarks}"</p>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Center checklist task checklist card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <ListTodo className="h-4.5 w-4.5 text-slate-400" />
                <span>Instruction Task Checklist</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">
                {Object.values(checkedStates).filter(Boolean).length} of {checklist.length} Completed
              </span>
            </div>

            {/* Checklist Loop */}
            <div className="divide-y divide-slate-100">
              {checklist.map((task, idx) => {
                const isChecked = !!checkedStates[idx];
                return (
                  <div 
                    key={idx}
                    onClick={() => toggleCheck(idx)}
                    className={`flex items-start gap-3 py-3.5 px-2.5 cursor-pointer rounded-lg transition-colors select-none ${
                      isChecked ? 'bg-emerald-50/20' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={schedule.status === 'Completed'}
                      onChange={() => {}} // toggled by outer div click
                      className="h-5 w-5 rounded border-slate-350 text-gold-650 focus:ring-gold-500 mt-0.5 cursor-pointer disabled:opacity-60"
                    />
                    <div className="flex-1 text-xs font-bold">
                      <p className={`text-slate-800 ${isChecked ? 'line-through text-slate-400 font-medium' : ''}`}>
                        {task}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {schedule.status !== 'Completed' && !allChecked && (
              <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 p-3 rounded-lg leading-normal">
                ⚠️ All instructional checklist items must be performed and checked before completion logs can be saved.
              </p>
            )}

          </div>
        </div>

      </div>

      {/* ==========================================
          CHECKLIST COMPLETION LOG MODAL
          ========================================== */}
      {completeModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setCompleteModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Log Completion Results</h3>
              <button onClick={() => setCompleteModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCompleteSubmit} className="p-6 space-y-4 text-xs font-semibold">
              
              <div>
                <label className="block text-slate-500 mb-1">Date Performed *</label>
                <input 
                  type="date" 
                  value={actualDate} 
                  onChange={e => setActualDate(e.target.value)}
                  required 
                  className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" 
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Preview Next Scheduled Occurrence Date</label>
                <input 
                  type="text" 
                  readOnly 
                  value={getNextOccurrencePreview()}
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded text-slate-500 font-bold" 
                />
                <span className="text-[9px] text-slate-400 block mt-1">Spawns automatically based on the cycle frequency ({schedule.frequency}).</span>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Execution Remarks / Diagnostic Results *</label>
                <textarea 
                  required
                  value={completionRemarks}
                  onChange={e => setCompletionRemarks(e.target.value)}
                  className="w-full p-2 border border-slate-350 rounded h-20 resize-none text-slate-900" 
                  placeholder="Describe status passes, updates applied, general conditions..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setCompleteModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Save Logs & Spawn Cycle</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
