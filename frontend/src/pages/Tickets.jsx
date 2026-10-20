import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, Filter, Ticket, AlertCircle, Eye, 
  MessageSquare, User, Calendar, ShieldAlert, X
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const ticketSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  subject: z.string().min(1, 'Subject is required').max(100, 'Subject is too long'),
  description: z.string().min(1, 'Description is required'),
  priority: z.string().default('Medium')
});

export default function Tickets() {
  const { user, hasPermission, showToast } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Create Ticket modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(ticketSchema)
  });

  const isITPersonnel = user?.roles?.some(role => 
    ['Super Admin', 'IT Manager', 'IT Staff', 'Technician'].includes(role)
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tickets', {
        params: {
          page,
          search,
          categoryId: catFilter,
          status: statusFilter,
          priority: priorityFilter
        }
      });
      if (response.data.success) {
        setTickets(response.data.data.tickets);
        setPagination(response.data.data.pagination);
      }

      const catsRes = await api.get('/settings/ticket-categories');
      if (catsRes.data.success) {
        setCategories(catsRes.data.data);
      }
    } catch (err) {
      showToast('Error', 'Failed to load tickets list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, catFilter, statusFilter, priorityFilter]);

  const handleFileChange = (e) => {
    setScreenshot(e.target.files[0]);
  };

  const handleCreateTicket = async (data) => {
    setSubmitting(true);
    const formData = new FormData();
    formData.append('categoryId', data.categoryId);
    formData.append('subject', data.subject);
    formData.append('description', data.description);
    formData.append('priority', data.priority);
    
    if (screenshot) {
      formData.append('screenshot', screenshot);
    }

    try {
      const res = await api.post('/tickets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        showToast('Success', 'Help desk ticket submitted successfully.', 'success');
        setModalOpen(false);
        reset();
        setScreenshot(null);
        loadData();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to submit ticket.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">IT Support Help Desk</h1>
          <p className="text-xs text-slate-500 mt-1">
            {isITPersonnel 
              ? 'Oversee, assign, and resolve user technical issues.' 
              : 'Submit support requests and view ticket resolution histories.'}
          </p>
        </div>

        {/* Standard employees must have permission to create tickets */}
        {(hasPermission('tickets.create') || !isITPersonnel) && (
          <button 
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Ticket</span>
          </button>
        )}
      </div>

      {/* ==========================================
          SEARCH AND FILTERS BAR
          ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search by ticket no, subject..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-xs text-slate-900"
          />
        </div>

        {/* Category */}
        <select
          value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setPage(1); }}
          className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Assigned">Assigned</option>
          <option value="In Progress">In Progress</option>
          <option value="Waiting for Parts">Waiting for Parts</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        {/* Priority */}
        <select
          value={priorityFilter}
          onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
          className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
        >
          <option value="">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>

      </div>

      {/* ==========================================
          TICKETS GRID
          ========================================== */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-650"></div>
        </div>
      ) : tickets && tickets.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Ticket No</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Requester</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tech Assigned</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {tickets.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-slate-55/50">
                    <td className="py-3.5 px-4 font-bold text-slate-950">{ticket.ticket_number}</td>
                    <td className="py-3.5 px-4 text-slate-800 truncate max-w-[180px]">{ticket.subject}</td>
                    <td className="py-3.5 px-4">{ticket.category_name}</td>
                    <td className="py-3.5 px-4 text-slate-700">{ticket.requested_by_name}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        ticket.priority === 'Critical' ? 'bg-rose-100 text-rose-800' :
                        ticket.priority === 'High' ? 'bg-amber-100 text-amber-800' :
                        ticket.priority === 'Medium' ? 'bg-sky-105 text-sky-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        ticket.status === 'Open' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                        ticket.status === 'Assigned' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                        ticket.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        ticket.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        ticket.status === 'Closed' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                        'bg-rose-50 text-rose-700'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {ticket.assigned_technician_name ? (
                        <span className="flex items-center gap-1">🧑 {ticket.assigned_technician_name}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                        className="px-2.5 py-1 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-gold-600 cursor-pointer transition-colors"
                      >
                        Details
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
          <Ticket className="h-10 w-10 mx-auto text-slate-350" />
          <h4 className="font-bold text-sm text-slate-805">No support tickets found</h4>
          <p className="text-xs">Adjust your parameters or open a new request to coordinate with IT support.</p>
        </div>
      )}

      {/* Pagination Footer */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl">
          <span className="text-xs text-slate-500 font-semibold">
            Page {pagination.page} of {pagination.pages} ({pagination.total} tickets total)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-slate-350 text-xs text-slate-700 bg-white hover:bg-slate-50 rounded cursor-pointer disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page === pagination.pages}
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              className="px-3 py-1.5 border border-slate-350 text-xs text-slate-700 bg-white hover:bg-slate-50 rounded cursor-pointer disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          CREATE TICKET MODAL DIALOG
          ========================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Create Support Ticket</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(handleCreateTicket)} className="p-6 space-y-4 text-xs font-semibold">
              
              {/* Category */}
              <div>
                <label className="block text-slate-500 mb-1">Issue Category *</label>
                <select {...register('categoryId')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.categoryId && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.categoryId.message}</p>}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-slate-500 mb-1">Priority Level</label>
                <select {...register('priority')} className="w-full p-2 border border-slate-350 rounded bg-white">
                  <option value="Low">Low (General Query)</option>
                  <option value="Medium">Medium (Standard Issue)</option>
                  <option value="High">High (Disruptive Issue)</option>
                  <option value="Critical">Critical (System Downtime)</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-slate-500 mb-1">Subject / Issue Summary *</label>
                <input type="text" {...register('subject')} placeholder="e.g. Printer in Room 3B jammed" className="w-full p-2 border border-slate-350 rounded" />
                {errors.subject && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.subject.message}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-500 mb-1">Detailed Description *</label>
                <textarea {...register('description')} className="w-full p-2 border border-slate-350 rounded h-28 resize-none text-slate-900" placeholder="Please describe the problem, error messages, and what steps you took..."></textarea>
                {errors.description && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.description.message}</p>}
              </div>

              {/* Attachment */}
              <div>
                <label className="block text-slate-500 mb-1.5">Attach Screenshot (Optional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="w-full p-1.5 border border-slate-350 rounded bg-slate-50"
                />
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
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded font-bold hover:bg-gold-650 cursor-pointer"
                >
                  {submitting ? 'Filing Request...' : 'File Ticket'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
