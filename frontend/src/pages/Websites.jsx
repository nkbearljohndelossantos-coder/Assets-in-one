import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Globe, Plus, Search, Filter, ShieldCheck, ShieldAlert, 
  ExternalLink, Activity, Clock, Server, Edit, Trash2, 
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, X, History
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function Websites() {
  const { hasPermission, showToast } = useAuth();
  
  const [websites, setWebsites] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Modal Controls
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [saving, setSaving] = useState(false);

  // Expiration "Never" checkbox states
  const [noDomainExpiry, setNoDomainExpiry] = useState(false);
  const [noSslExpiry, setNoSslExpiry] = useState(false);

  // Logs Modal
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedSiteForLogs, setSelectedSiteForLogs] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/websites', {
        params: {
          page,
          search,
          status: statusFilter
        }
      });
      if (res.data.websites) {
        setWebsites(res.data.websites);
        setPagination(res.data.pagination || { total: res.data.websites.length, pages: 1, limit: 10 });
      }

      const empRes = await api.get('/employees', { params: { limit: 100 } });
      if (empRes.data.success) {
        setEmployees(empRes.data.data.employees);
      }
    } catch (err) {
      showToast('Error', 'Failed to retrieve website monitoring registry.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, statusFilter]);

  const isNeverExpiry = (dateStr) => {
    if (!dateStr) return false;
    const s = String(dateStr).trim();
    return (
      s === 'Never' ||
      s.startsWith('1899') ||
      s.startsWith('1970') ||
      s.startsWith('0000') ||
      s.startsWith('9999')
    );
  };

  const openAddModal = () => {
    setEditingSite(null);
    setNoDomainExpiry(false);
    setNoSslExpiry(false);
    reset({
      name: '',
      domain: 'https://',
      hosting_provider: '',
      domain_expiration_date: '',
      ssl_expiration_date: '',
      dns_info: '',
      admin_employee_id: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (site, e) => {
    if (e) e.stopPropagation();
    setEditingSite(site);
    const isNoDomain = isNeverExpiry(site.domain_expiration_date);
    const isNoSsl = isNeverExpiry(site.ssl_expiration_date);

    setNoDomainExpiry(isNoDomain);
    setNoSslExpiry(isNoSsl);

    reset({
      name: site.name || '',
      domain: site.domain || '',
      hosting_provider: site.hosting_provider || '',
      domain_expiration_date: (!isNoDomain && site.domain_expiration_date) ? site.domain_expiration_date.split('T')[0] : '',
      ssl_expiration_date: (!isNoSsl && site.ssl_expiration_date) ? site.ssl_expiration_date.split('T')[0] : '',
      dns_info: site.dns_info || '',
      admin_employee_id: site.admin_employee_id ? String(site.admin_employee_id) : ''
    });
    setModalOpen(true);
  };

  const handleSaveWebsite = async (data) => {
    setSaving(true);
    const payload = {
      name: data.name,
      domain: data.domain,
      hosting_provider: data.hosting_provider || null,
      domain_expiration_date: noDomainExpiry ? 'Never' : (data.domain_expiration_date || null),
      ssl_expiration_date: noSslExpiry ? 'Never' : (data.ssl_expiration_date || null),
      dns_info: data.dns_info || null,
      admin_employee_id: data.admin_employee_id ? parseInt(data.admin_employee_id) : null
    };

    try {
      if (editingSite) {
        await api.put(`/websites/${editingSite.id}`, payload);
        showToast('Updated', 'Website monitoring profile updated.', 'success');
      } else {
        await api.post('/websites', payload);
        showToast('Registered', 'New website registered for health checks.', 'success');
      }
      setModalOpen(false);
      reset();
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to save website monitoring record.';
      showToast('Error', msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckNow = async (siteId, e) => {
    if (e) e.stopPropagation();
    setCheckingId(siteId);
    showToast('Checking', 'Sending HTTP health check ping...', 'info');
    try {
      const res = await api.post(`/websites/${siteId}/check`);
      if (res.data.success) {
        const statusText = res.data.data.status === 'Active' ? 'Online' : 'Down';
        showToast('Ping Result', `Website is ${statusText} (HTTP ${res.data.data.http_status_code || 'Err'} - ${res.data.data.response_time_ms || 0}ms)`, res.data.data.status === 'Active' ? 'success' : 'error');
        loadData();
      }
    } catch (err) {
      showToast('Ping Error', 'Failed to reach domain endpoint.', 'error');
    } finally {
      setCheckingId(null);
    }
  };

  const handleDeleteSite = async (siteId, siteName, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove '${siteName}' from website monitoring?`)) return;
    try {
      await api.delete(`/websites/${siteId}`);
      showToast('Removed', 'Website monitoring record removed.', 'success');
      loadData();
    } catch (err) {
      showToast('Error', 'Failed to remove website profile.', 'error');
    }
  };

  const handleOpenLogs = async (site, e) => {
    if (e) e.stopPropagation();
    setSelectedSiteForLogs(site);
    setLogsModalOpen(true);
    setLoadingLogs(true);
    try {
      const res = await api.get(`/websites/${site.id}/logs`);
      setLogs(res.data.logs || []);
    } catch (err) {
      showToast('Error', 'Failed to load uptime logs history.', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  // Metrics calculation
  const totalSites = websites.length;
  const activeSites = websites.filter(s => s.status === 'Active').length;
  const downSites = websites.filter(s => s.status === 'Down').length;
  const sslWarnings = websites.filter(s => s.ssl_expiration_date && !isNeverExpiry(s.ssl_expiration_date) && new Date(s.ssl_expiration_date) < new Date(Date.now() + 30 * 86400000)).length;

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-gold-600" />
            <span>Website & Portal Monitoring</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Track uptime, HTTP response codes, SSL certificates, and domain registration expiries.</p>
        </div>
        
        {hasPermission('websites.manage') && (
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Register Website</span>
          </button>
        )}
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sites Monitored</p>
            <h3 className="text-xl font-black text-slate-900">{totalSites}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Online / Active</p>
            <h3 className="text-xl font-black text-emerald-600">{activeSites}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Downtime Alerts</p>
            <h3 className="text-xl font-black text-rose-600">{downSites}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SSL Expiry Warnings</p>
            <h3 className="text-xl font-black text-amber-600">{sslWarnings}</h3>
          </div>
        </div>

      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative lg:col-span-3">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search by website name, domain URL..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-xs text-slate-900"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active / Online</option>
          <option value="Down">Down / Offline</option>
          <option value="Maintenance">Maintenance</option>
        </select>
      </div>

      {/* Websites Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
        </div>
      ) : websites && websites.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {websites.map(site => (
            <div key={site.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
              
              {/* Header Info */}
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 leading-tight">{site.name}</h3>
                    <a 
                      href={site.domain} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs font-semibold text-gold-700 hover:text-slate-900 flex items-center gap-1 mt-0.5"
                    >
                      <span>{site.domain}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    site.status === 'Active' ? 'bg-emerald-500 text-white' :
                    site.status === 'Down' ? 'bg-rose-600 text-white' :
                    'bg-amber-500 text-white'
                  }`}>
                    {site.status === 'Active' ? 'Online' : site.status}
                  </span>
                </div>

                {/* HTTP Status & Response Time Metrics */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs font-semibold">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">HTTP Code</span>
                    <span className={`text-xs font-extrabold ${
                      site.http_status_code >= 200 && site.http_status_code < 300 ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {site.http_status_code ? `HTTP ${site.http_status_code}` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Response Time</span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {site.response_time_ms ? `${site.response_time_ms} ms` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">SSL Certificate</span>
                    <span className={`text-xs font-extrabold flex items-center gap-1 ${
                      site.ssl_valid ? 'text-emerald-700' : 'text-amber-600'
                    }`}>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{site.ssl_valid ? 'Valid SSL' : 'Unverified'}</span>
                    </span>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs pt-1 select-none">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Hosting Provider:</span>
                    <p className="font-bold text-slate-800">{site.hosting_provider || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">System Admin:</span>
                    <p className="font-bold text-slate-800">{site.admin_name || 'IT Department'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Domain Expiry:</span>
                    <p className="font-semibold text-slate-700">
                      {isNeverExpiry(site.domain_expiration_date) ? (
                        <span className="text-emerald-700 font-bold">Never</span>
                      ) : site.domain_expiration_date ? (
                        site.domain_expiration_date.split('T')[0]
                      ) : (
                        'N/A'
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">SSL Expiry:</span>
                    <p className="font-semibold text-slate-700">
                      {isNeverExpiry(site.ssl_expiration_date) ? (
                        <span className="text-emerald-700 font-bold">Never</span>
                      ) : site.ssl_expiration_date ? (
                        site.ssl_expiration_date.split('T')[0]
                      ) : (
                        'N/A'
                      )}
                    </p>
                  </div>
                </div>

                {site.dns_info && (
                  <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-150 p-2 rounded">
                    <span className="font-bold text-slate-700">DNS / Server Notes:</span> {site.dns_info}
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-150 flex justify-between items-center text-xs">
                <span className="text-[10px] text-slate-400 font-semibold">
                  Last checked: {site.last_checked_at ? new Date(site.last_checked_at).toLocaleTimeString() : 'Never'}
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleCheckNow(site.id, e)}
                    disabled={checkingId === site.id}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-gold-650 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Ping real-time status"
                  >
                    <RefreshCw className={`h-3 w-3 ${checkingId === site.id ? 'animate-spin' : ''}`} />
                    <span>Ping Now</span>
                  </button>

                  <button
                    onClick={(e) => handleOpenLogs(site, e)}
                    className="px-2.5 py-1 border border-slate-350 text-slate-700 hover:bg-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    title="View Uptime Logs"
                  >
                    <History className="h-3 w-3" />
                    <span>Logs</span>
                  </button>

                  {hasPermission('websites.manage') && (
                    <button
                      onClick={(e) => openEditModal(site, e)}
                      className="p-1 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
                      title="Edit Website"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {hasPermission('websites.manage') && (
                    <button
                      onClick={(e) => handleDeleteSite(site.id, site.name, e)}
                      className="p-1 hover:bg-rose-100 text-rose-600 rounded cursor-pointer"
                      title="Remove Website"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="p-16 bg-white border border-slate-200 rounded-xl text-center text-slate-400 space-y-2">
          <Globe className="h-10 w-10 mx-auto text-slate-350" />
          <h4 className="font-bold text-sm text-slate-850">No websites monitored</h4>
          <p className="text-xs">Register your corporate domains and portal web endpoints to track uptime.</p>
        </div>
      )}

      {/* Pagination control */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl">
          <span className="text-xs text-slate-500 font-medium">
            Page {pagination.page} of {pagination.pages} ({pagination.total} websites total)
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
              className="px-3 py-1.5 border border-slate-355 text-xs text-slate-700 bg-white hover:bg-slate-50 rounded cursor-pointer disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER / EDIT WEBSITE */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingSite ? 'Edit Website Profile' : 'Register Website for Monitoring'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleSaveWebsite)} className="p-6 space-y-4 text-xs font-semibold">
              
              <div>
                <label className="block text-slate-500 mb-1">Website / Portal Name *</label>
                <input type="text" {...register('name', { required: true })} placeholder="e.g. NKB Canteen Portal" className="w-full p-2 border border-slate-350 rounded text-slate-900" />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Domain URL * (Must start with http:// or https://)</label>
                <input type="url" {...register('domain', { required: true })} placeholder="https://canteen.nkbmanufacturing.com" className="w-full p-2 border border-slate-350 rounded text-slate-900 font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Hosting Provider</label>
                  <input type="text" {...register('hosting_provider')} placeholder="e.g. AWS, Hostinger, Local" className="w-full p-2 border border-slate-350 rounded" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Admin / IT In-Charge</label>
                  <select {...register('admin_employee_id')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                    <option value="">Select Employee</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.full_name || `${e.first_name} ${e.last_name}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-slate-500">Domain Expiration Date</label>
                    <label className="flex items-center gap-1 text-[10px] text-slate-600 font-bold cursor-pointer hover:text-slate-900">
                      <input 
                        type="checkbox" 
                        checked={noDomainExpiry} 
                        onChange={e => {
                          setNoDomainExpiry(e.target.checked);
                          if (e.target.checked) setValue('domain_expiration_date', '');
                        }} 
                        className="rounded border-slate-350 cursor-pointer" 
                      />
                      <span>Never</span>
                    </label>
                  </div>
                  <input 
                    type="date" 
                    disabled={noDomainExpiry} 
                    {...register('domain_expiration_date')} 
                    className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" 
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-slate-500">SSL Expiration Date</label>
                    <label className="flex items-center gap-1 text-[10px] text-slate-600 font-bold cursor-pointer hover:text-slate-900">
                      <input 
                        type="checkbox" 
                        checked={noSslExpiry} 
                        onChange={e => {
                          setNoSslExpiry(e.target.checked);
                          if (e.target.checked) setValue('ssl_expiration_date', '');
                        }} 
                        className="rounded border-slate-350 cursor-pointer" 
                      />
                      <span>Never</span>
                    </label>
                  </div>
                  <input 
                    type="date" 
                    disabled={noSslExpiry} 
                    {...register('ssl_expiration_date')} 
                    className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">DNS Info / Server Notes</label>
                <textarea {...register('dns_info')} rows={3} placeholder="A Record IP, Cloudflare DNS configuration, etc." className="w-full p-2 border border-slate-350 rounded resize-none"></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-350 text-slate-700 bg-white rounded font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold transition-colors cursor-pointer"
                >
                  {saving ? 'Saving...' : editingSite ? 'Save Changes' : 'Register Website'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPTIME LOGS HISTORY */}
      {logsModalOpen && selectedSiteForLogs && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 p-4 animate-fade-in" onClick={() => setLogsModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Uptime Check Logs: {selectedSiteForLogs.name}</h3>
              <button onClick={() => setLogsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {loadingLogs ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gold-600"></div>
                </div>
              ) : logs && logs.length > 0 ? (
                <div className="space-y-3 select-none">
                  {logs.map(log => (
                    <div key={log.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex justify-between items-center text-xs">
                      <div>
                        <span className={`font-bold uppercase text-[10px] ${log.status === 'Up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          [{log.status}]
                        </span>
                        <span className="ml-2 font-medium text-slate-700">{new Date(log.checked_at).toLocaleString()}</span>
                        {log.error_message && <p className="text-[10px] text-rose-600 mt-0.5 font-bold">{log.error_message}</p>}
                      </div>
                      <div className="text-right font-mono text-[11px] font-bold text-slate-800">
                        {log.http_status_code ? `HTTP ${log.http_status_code}` : 'N/A'} | {log.response_time_ms}ms
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No historical check logs recorded yet.</p>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">
              <button onClick={() => setLogsModalOpen(false)} className="px-4 py-2 border border-slate-350 text-slate-700 bg-white rounded text-xs font-bold hover:bg-slate-100 cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
