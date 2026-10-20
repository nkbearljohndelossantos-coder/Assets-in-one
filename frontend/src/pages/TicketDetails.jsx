import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, Send, User, Calendar, Wrench, ShieldAlert, 
  MessageSquare, FileText, CheckCircle2, Clock, Plus, ExternalLink, Star
} from 'lucide-react';

export default function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, showToast } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [internalNotes, setInternalNotes] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [history, setHistory] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  
  // IT Personnel Dropdown lists
  const [technicians, setTechnicians] = useState([]);
  const [assets, setAssets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [commentType, setCommentType] = useState('public'); // public, internal
  const [newComment, setNewComment] = useState('');

  // Modal controls
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [timeLogModalOpen, setTimeLogModalOpen] = useState(false);

  const isITPersonnel = user?.roles?.some(role => 
    ['Super Admin', 'IT Manager', 'IT Staff', 'Technician'].includes(role)
  );

  const loadTicketDetails = async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      if (res.data.success) {
        setTicket(res.data.data.ticket);
        setComments(res.data.data.comments);
        setAttachments(res.data.data.attachments);
        setHistory(res.data.data.history);
        setTimeLogs(res.data.data.timeLogs || []);
        setInternalNotes(res.data.data.internalNotes || []);
      }

      if (isITPersonnel) {
        // Load eligible technicians
        const usersRes = await api.get('/users');
        if (usersRes.data.success) {
          const techUsers = usersRes.data.data.filter(u => 
            u.roles.some(r => ['IT Manager', 'IT Staff', 'Technician', 'Super Admin'].includes(r.name))
          );
          setTechnicians(techUsers);
        }

        // Load assets for linking
        const assetsRes = await api.get('/assets', { params: { limit: 100 } });
        if (assetsRes.data.success) {
          setAssets(assetsRes.data.data.assets);
        }
      }

    } catch (err) {
      showToast('Error', 'Failed to retrieve ticket details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicketDetails();
  }, [id]);

  // Submit Comments or Internal Notes
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const endpoint = commentType === 'public' 
        ? `/tickets/${id}/comments` 
        : `/tickets/${id}/internal-notes`;

      const payload = commentType === 'public'
        ? { comment: newComment }
        : { note: newComment };

      const res = await api.post(endpoint, payload);
      if (res.data.success) {
        setNewComment('');
        showToast('Success', commentType === 'public' ? 'Comment posted.' : 'Internal note saved.', 'success');
        loadTicketDetails();
      }
    } catch (err) {
      showToast('Error', 'Failed to submit comment.', 'error');
    }
  };

  // Assign Technician
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const technicianId = data.get('technicianId');

    try {
      const res = await api.post(`/tickets/${id}/assign`, { technicianId });
      if (res.data.success) {
        showToast('Assigned', 'Technician assigned successfully.', 'success');
        setAssignModalOpen(false);
        loadTicketDetails();
      }
    } catch (err) {
      showToast('Error', 'Failed to assign technician.', 'error');
    }
  };

  // Resolve Ticket
  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      status: 'Resolved',
      resolutionSummary: data.get('resolutionSummary'),
      rootCause: data.get('rootCause')
    };

    try {
      const res = await api.put(`/tickets/${id}`, payload);
      if (res.data.success) {
        showToast('Resolved', 'Ticket status set to Resolved.', 'success');
        setResolveModalOpen(false);
        loadTicketDetails();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to resolve ticket.', 'error');
    }
  };

  // Close Ticket and rate
  const handleCloseSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      rating: parseInt(data.get('rating')),
      feedback: data.get('feedback')
    };

    try {
      const res = await api.post(`/tickets/${id}/close`, payload);
      if (res.data.success) {
        showToast('Closed', 'Thank you! Ticket officially closed.', 'success');
        loadTicketDetails();
      }
    } catch (err) {
      showToast('Error', 'Failed to close ticket.', 'error');
    }
  };

  // Post Time Log
  const handleTimeLogSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      startTime: data.get('startTime'),
      endTime: data.get('endTime'),
      remarks: data.get('remarks')
    };

    try {
      const res = await api.post(`/tickets/${id}/time-logs`, payload);
      if (res.data.success) {
        showToast('Logged', 'Work time log saved.', 'success');
        setTimeLogModalOpen(false);
        loadTicketDetails();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to save time log.', 'error');
    }
  };

  // Link Asset
  const handleLinkAsset = async (assetId) => {
    if (!window.confirm('Do you want to link this asset to the ticket?')) return;
    try {
      const res = await api.put(`/tickets/${id}`, { relatedAssetId: assetId });
      if (res.data.success) {
        showToast('Linked', 'Asset linked successfully.', 'success');
        loadTicketDetails();
      }
    } catch (err) {
      showToast('Error', 'Failed to link asset.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  if (!ticket) return <div className="p-8 text-center text-slate-500">Ticket not found.</div>;

  return (
    <div className="space-y-6">
      
      {/* Top action header */}
      <div className="flex justify-between items-center select-none">
        <Link 
          to="/tickets"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-650 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Help Desk</span>
        </Link>

        {isITPersonnel && ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
          <div className="flex gap-2">
            <button 
              onClick={() => setAssignModalOpen(true)}
              className="px-3 py-1.5 border border-slate-350 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Assign Tech
            </button>
            <button 
              onClick={() => setResolveModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Resolve Ticket
            </button>
            <button 
              onClick={() => setTimeLogModalOpen(true)}
              className="px-3 py-1.5 border border-slate-350 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Log Time
            </button>
          </div>
        )}
      </div>

      {/* Grid Layout: Main Left, Sidebar Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Details and Comments */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Header Panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-start border-b pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gold-600 uppercase">{ticket.category_name}</span>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">{ticket.subject}</h2>
                <p className="text-xs text-slate-500">
                  Ticket No: <span className="font-semibold">{ticket.ticket_number}</span> | Filed by: <span className="font-semibold text-slate-800">{ticket.requested_by_name}</span>
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                ticket.status === 'Resolved' ? 'bg-emerald-500 text-white shadow-sm' :
                ticket.status === 'Closed' ? 'bg-slate-100 text-slate-650' :
                'bg-slate-900 text-gold-500 border border-slate-700'
              }`}>
                {ticket.status}
              </span>
            </div>

            {/* Description */}
            <div className="text-xs text-slate-700 leading-relaxed font-semibold">
              <p className="text-slate-400 font-bold text-[10px] uppercase mb-1">Issue Description</p>
              <p className="whitespace-pre-line bg-slate-50 p-4 rounded-lg border">{ticket.description}</p>
            </div>

            {/* Screenshots */}
            {ticket.screenshot_path && (
              <div className="space-y-1 text-xs">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Attached Screenshot</span>
                <div className="flex items-center gap-2 p-2 border rounded-lg max-w-xs bg-slate-50">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold text-slate-700 truncate flex-1">Screenshot</span>
                  <a href={ticket.screenshot_path} target="_blank" rel="noreferrer" className="text-gold-700 hover:text-slate-950 font-bold flex items-center gap-0.5">
                    <span>View</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Discussion Chat Box */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
            
            {/* Discussion tabs */}
            <div className="bg-slate-900 px-4 text-white flex justify-between items-center border-b">
              <div className="flex gap-4 text-xs font-bold uppercase select-none">
                <button
                  onClick={() => setCommentType('public')}
                  className={`py-3.5 border-b-2 cursor-pointer transition-all ${
                    commentType === 'public' ? 'border-gold-500 text-gold-500' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Client Discussion
                </button>
                
                {isITPersonnel && (
                  <button
                    onClick={() => setCommentType('internal')}
                    className={`py-3.5 border-b-2 cursor-pointer transition-all ${
                      commentType === 'internal' ? 'border-gold-500 text-gold-500' : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Internal Tech Notes
                  </button>
                )}
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                {commentType === 'public' ? 'Public Chat' : 'IT-Only Eyes'}
              </span>
            </div>

            {/* Chat Pane Messages viewport */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
              {commentType === 'public' ? (
                comments && comments.length > 0 ? (
                  comments.map(c => (
                    <div key={c.id} className={`flex flex-col max-w-[80%] ${c.user_id === user.id ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                      <span className="text-[9px] text-slate-400 font-bold mb-0.5">{c.user_full_name || c.username}</span>
                      <div className={`p-3 rounded-lg text-xs leading-normal font-semibold ${
                        c.user_id === user.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-900 border rounded-tl-none'
                      }`}>
                        {c.comment}
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-10">No public comments posted yet.</p>
                )
              ) : (
                internalNotes && internalNotes.length > 0 ? (
                  internalNotes.map(n => (
                    <div key={n.id} className="flex flex-col mr-auto items-start max-w-[80%] border-l-2 border-gold-500 pl-3 py-1">
                      <span className="text-[9px] text-gold-700 font-bold mb-0.5">Technician note by {n.username}</span>
                      <p className="text-xs font-semibold text-slate-800">{n.note}</p>
                      <span className="text-[9px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-10">No internal notes logged on this ticket.</p>
                )
              )}
            </div>

            {/* Chat Input form */}
            {ticket.status !== 'Closed' && (
              <form onSubmit={handlePostComment} className="p-3 border-t bg-white flex gap-2">
                <input
                  type="text"
                  placeholder={commentType === 'public' ? 'Type comment to client...' : 'Log private technician notes...'}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="flex-grow p-2 border border-slate-350 rounded-lg text-xs text-slate-900 focus:outline-none"
                />
                <button type="submit" className="p-2 bg-slate-950 hover:bg-gold-600 text-white rounded-lg cursor-pointer">
                  <Send className="h-4.5 w-4.5" />
                </button>
              </form>
            )}

          </div>

          {/* Resolution Summary View or Close Rating Form */}
          {ticket.status === 'Resolved' && !isITPersonnel && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-emerald-950 font-bold text-sm flex items-center gap-1">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Provide Feedback and Close Ticket</span>
                </h3>
                <p className="text-xs text-emerald-800 leading-normal">
                  IT Support has resolved this issue: <b>"{ticket.resolution_summary}"</b>. Please rate your support experience to close this ticket.
                </p>
              </div>

              <form onSubmit={handleCloseSubmit} className="space-y-4 text-xs font-semibold">
                <div className="space-y-1.5">
                  <label className="block text-slate-700">Support Rating (1 to 5 Stars) *</label>
                  <select name="rating" required className="p-2 border border-slate-300 rounded bg-white font-bold text-slate-900 w-32">
                    <option value="5">⭐⭐⭐⭐⭐ (Excellent)</option>
                    <option value="4">⭐⭐⭐⭐ (Good)</option>
                    <option value="3">⭐⭐⭐ (Average)</option>
                    <option value="2">⭐⭐ (Poor)</option>
                    <option value="1">⭐ (Unsatisfactory)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-700">Comments / User Feedback</label>
                  <textarea name="feedback" className="w-full p-2 border border-slate-300 rounded text-slate-900 h-20 resize-none" placeholder="Provide any additional comments..."></textarea>
                </div>

                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer">
                  Submit Feedback & Close Ticket
                </button>
              </form>
            </div>
          )}

          {/* Display closed feedback if closed */}
          {ticket.status === 'Closed' && (
            <div className="bg-slate-100/80 border rounded-xl p-5 space-y-3 text-xs leading-normal">
              <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4.5 w-4.5 text-slate-500" />
                <span>Ticket Closed</span>
              </h3>
              <p className="font-semibold text-slate-600">
                Support Rating: <span className="text-gold-600 font-bold font-mono">{"⭐".repeat(ticket.user_rating)} ({ticket.user_rating}/5)</span>
              </p>
              {ticket.user_feedback && (
                <p className="italic text-slate-500 font-semibold bg-white p-3 rounded border">
                  "{ticket.user_feedback}"
                </p>
              )}
            </div>
          )}

        </div>

        {/* Sidebar Info Panels */}
        <div className="space-y-6">
          
          {/* Metadata properties panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 text-xs font-semibold">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Ticket Properties</h3>
            
            <div className="space-y-3">
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Assigned Technician</span>
                <span className="font-bold text-slate-800 text-xs block mt-0.5">
                  {ticket.assigned_technician_name ? `🧑 ${ticket.assigned_technician_name}` : 'Unassigned'}
                </span>
              </div>
              
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Ticket Priority</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold inline-block mt-1 ${
                  ticket.priority === 'Critical' ? 'bg-rose-100 text-rose-800' :
                  ticket.priority === 'High' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-850'
                }`}>
                  {ticket.priority}
                </span>
              </div>

              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Linked Asset</span>
                {ticket.related_asset_id ? (
                  <Link to={`/assets/${ticket.related_asset_id}`} className="font-bold text-gold-700 hover:underline block mt-0.5">
                    💻 {ticket.asset_name} ({ticket.asset_code})
                  </Link>
                ) : isITPersonnel ? (
                  <div className="mt-1 space-y-1">
                    <select 
                      onChange={e => { if (e.target.value) handleLinkAsset(e.target.value); }}
                      className="w-full p-1.5 border border-slate-350 rounded bg-white text-[11px]"
                    >
                      <option value="">-- Link Workstation --</option>
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.asset_code})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-slate-400 italic mt-0.5 block">No asset linked</span>
                )}
              </div>

              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Date Opened</span>
                <span className="font-semibold text-slate-650 block mt-0.5">
                  📅 {new Date(ticket.created_at).toLocaleDateString()} {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          {/* Time logged logs panel (IT Personnel only) */}
          {isITPersonnel && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Technician Work Time</h3>
              <div className="space-y-3 max-h-56 overflow-y-auto">
                {timeLogs && timeLogs.length > 0 ? (
                  timeLogs.map(log => (
                    <div key={log.id} className="text-xs bg-slate-50 border p-2.5 rounded-lg space-y-1 font-semibold leading-normal">
                      <p className="text-slate-900 font-bold flex justify-between">
                        <span>🧑 {log.technician_username}</span>
                        <span className="text-gold-700">{log.duration_minutes} Mins</span>
                      </p>
                      <p className="text-[10px] text-slate-400">Logged: {new Date(log.created_at).toLocaleDateString()}</p>
                      {log.remarks && <p className="italic text-[10px] text-slate-500 font-medium">"{log.remarks}"</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-2 text-center">No labor hours recorded yet.</p>
                )}
              </div>
            </div>
          )}

          {/* Chronological ticket history log timeline */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Ticket Timeline</h3>
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {history && history.length > 0 ? (
                history.map(item => (
                  <div key={item.id} className="flex gap-2 text-xs leading-normal font-semibold">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-slate-450 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-slate-800">{item.action}</p>
                      {item.new_status && (
                        <p className="text-[10px] text-slate-400">Status: <span className="font-bold">{item.new_status}</span></p>
                      )}
                      <span className="text-[9px] text-slate-400 block font-medium">
                        by {item.performed_by_username || 'system'} on {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">No updates recorded.</p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ==========================================
          MODAL 1: ASSIGN TECHNICIAN
          ========================================== */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setAssignModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Assign Helpdesk Technician</h3>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-2">Select IT Personnel *</label>
                <select name="technicianId" required className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">-- Select Technician --</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>{t.username} ({t.email})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setAssignModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Assign Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: RESOLVE TICKET
          ========================================== */}
      {resolveModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setResolveModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Resolve Ticket Request</h3>
              <button onClick={() => setResolveModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">Diagnosis & Root Cause *</label>
                <textarea name="rootCause" required className="w-full p-2 border border-slate-350 rounded h-16 resize-none" placeholder="Explain the root problem (e.g. CPU fan failing)"></textarea>
              </div>
              
              <div>
                <label className="block text-slate-500 mb-1">Resolution Actions Performed *</label>
                <textarea name="resolutionSummary" required className="w-full p-2 border border-slate-350 rounded h-20 resize-none" placeholder="Detail how the issue was fixed (e.g. replaced fan)"></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setResolveModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer font-bold">Mark Resolved</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: LOG LABOR TIME
          ========================================== */}
      {timeLogModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setTimeLogModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Log Work Hours</h3>
              <button onClick={() => setTimeLogModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleTimeLogSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Start Time *</label>
                  <input type="datetime-local" name="startTime" required className="w-full p-2 border border-slate-350 rounded text-[11px] bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">End Time *</label>
                  <input type="datetime-local" name="endTime" required className="w-full p-2 border border-slate-350 rounded text-[11px] bg-white text-slate-900" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Labor Remarks</label>
                <input type="text" name="remarks" placeholder="Briefly describe actions..." className="w-full p-2 border border-slate-350 rounded" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setTimeLogModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Save Log</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
