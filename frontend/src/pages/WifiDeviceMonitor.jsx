import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Wifi, Shield, ShieldCheck, ShieldAlert, AlertTriangle, 
  Search, Filter, Plus, RefreshCw, CheckCircle2, XCircle, 
  Clock, Server, Laptop, Activity, ExternalLink, Info, Trash2, 
  Edit3, HelpCircle, FileText, ChevronRight, AlertCircle, Eye
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function WifiDeviceMonitor() {
  const { hasPermission, showToast } = useAuth();

  // Active tab state: 'connected' | 'unknown' | 'trusted' | 'blocked' | 'routers' | 'logs'
  const [activeTab, setActiveTab] = useState('connected');

  // Overview stats & telemetry
  const [overview, setOverview] = useState({
    metrics: {
      totalObserved: 0,
      onlineNow: 0,
      unknownDevices: 0,
      trustedDevices: 0,
      blockedDevices: 0
    },
    lastSync: null,
    routers: []
  });

  // Tab datasets
  const [devices, setDevices] = useState([]);
  const [trustedInventory, setTrustedInventory] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });

  // Modals
  const [trustModalOpen, setTrustModalOpen] = useState(false);
  const [selectedDeviceForTrust, setSelectedDeviceForTrust] = useState(null);
  const [guidanceModalOpen, setGuidanceModalOpen] = useState(false);
  const [guidanceData, setGuidanceData] = useState(null);
  const [savingTrust, setSavingTrust] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  // Load Overview Metrics
  const loadOverview = async () => {
    try {
      const res = await api.get('/wifi-monitor/overview');
      if (res.data.success) {
        setOverview(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load overview telemetry:', err);
    }
  };

  // Load Tab-specific data
  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'connected') {
        const res = await api.get('/wifi-monitor/devices', {
          params: { page, limit: 20, search, status: statusFilter, classification: 'ALL' }
        });
        if (res.data.success) {
          setDevices(res.data.devices);
          setPagination(res.data.pagination);
        }
      } else if (activeTab === 'unknown') {
        const res = await api.get('/wifi-monitor/devices', {
          params: { page, limit: 20, search, classification: 'UNKNOWN' }
        });
        if (res.data.success) {
          setDevices(res.data.devices);
          setPagination(res.data.pagination);
        }
      } else if (activeTab === 'trusted') {
        const res = await api.get('/wifi-monitor/trusted', {
          params: { page, limit: 20, search }
        });
        if (res.data.success) {
          setTrustedInventory(res.data.inventory);
          setPagination(res.data.pagination);
        }
      } else if (activeTab === 'blocked') {
        const res = await api.get('/wifi-monitor/devices', {
          params: { page, limit: 20, search, classification: 'BLOCKED' }
        });
        if (res.data.success) {
          setDevices(res.data.devices);
          setPagination(res.data.pagination);
        }
      } else if (activeTab === 'logs') {
        const res = await api.get('/wifi-monitor/logs', {
          params: { page, limit: 25 }
        });
        if (res.data.success) {
          setAccessLogs(res.data.logs);
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      showToast('Error', 'Failed to retrieve telemetry data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, statusFilter]);

  useEffect(() => {
    loadTabData();
  }, [activeTab, page, search, statusFilter]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadOverview();
    loadTabData();
  };

  // Open Trust Registration Modal
  const openTrustModal = (device = null) => {
    setSelectedDeviceForTrust(device);
    if (device) {
      reset({
        macAddress: device.mac_address || device.macAddress || '',
        deviceName: device.trusted_name || device.hostname || '',
        ownerName: device.owner_name || '',
        department: device.department || '',
        location: device.location || '',
        deviceType: device.trusted_type || 'Laptop',
        notes: '',
        ipAddress: device.ip_address || device.ip || ''
      });
    } else {
      reset({
        macAddress: '',
        deviceName: '',
        ownerName: '',
        department: '',
        location: '',
        deviceType: 'Laptop',
        notes: '',
        ipAddress: ''
      });
    }
    setTrustModalOpen(true);
  };

  // Submit Trust Registration
  const onSubmitTrust = async (formData) => {
    setSavingTrust(true);
    try {
      const res = await api.post('/wifi-monitor/trusted', formData);
      if (res.data.success) {
        showToast('Success', res.data.message || 'Device added to Trusted Inventory', 'success');
        setTrustModalOpen(false);
        loadOverview();
        loadTabData();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save trusted device';
      showToast('Error', msg, 'error');
    } finally {
      setSavingTrust(false);
    }
  };

  // Remove Device from Trusted Inventory
  const handleRemoveTrusted = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from Trusted Inventory? It will revert to UNKNOWN.`)) {
      return;
    }
    try {
      const res = await api.delete(`/wifi-monitor/trusted/${id}`);
      if (res.data.success) {
        showToast('Success', 'Device removed from Trusted Inventory', 'success');
        loadOverview();
        loadTabData();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to remove trusted device', 'error');
    }
  };

  // Trigger Access Control Action (Block / Guidance)
  const handleBlockAction = async (device) => {
    try {
      const payload = {
        macAddress: device.mac_address,
        ipAddress: device.ip_address,
        reason: 'Unauthorized client observed on network'
      };
      
      const res = await api.post('/wifi-monitor/block', payload);
      if (res.data.success) {
        showToast('Success', res.data.message, 'success');
        loadOverview();
        loadTabData();
      }
    } catch (err) {
      // Expected for Globe/ZTE GPON ONT: 422 UNSUPPORTED with manualGuidance
      if (err.response?.status === 422 && err.response?.data?.status === 'UNSUPPORTED') {
        setGuidanceData(err.response.data.manualGuidance);
        setGuidanceModalOpen(true);
      } else {
        showToast('Error', err.response?.data?.message || 'Failed to block device', 'error');
      }
    }
  };

  // Render Freshness Badge
  const renderFreshnessBadge = (freshness) => {
    if (!freshness) return null;
    const isLive = freshness.startsWith('Live');
    const isRecent = freshness.startsWith('Recent');
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isLive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
        isRecent ? 'bg-blue-50 text-blue-700 border border-blue-200' :
        'bg-slate-100 text-slate-600 border border-slate-200'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : isRecent ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
        {freshness}
      </span>
    );
  };

  // Render Classification Badge
  const renderClassificationBadge = (classification) => {
    switch (classification) {
      case 'TRUSTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Trusted
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            Blocked
          </span>
        );
      case 'UNKNOWN':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Unknown
          </span>
        );
    }
  };

  // Render Connection Type Badge
  const renderConnectionTypeBadge = (type) => {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <Server className="w-3 h-3 text-slate-500" />
        {type || 'LAN (ARP Observed)'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 1. HEADER & OVERVIEW BAR                                       */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Wi-Fi Device Monitor</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Live Network Observer
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time broadcast domain discovery, trusted identity inventory, and gateway access governance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {overview.lastSync && (
            <div className="text-right hidden sm:block">
              <div className="text-xs text-slate-400">Last Telemetry Probe</div>
              <div className="text-xs font-medium text-slate-700">
                {new Date(overview.lastSync.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                <span className="text-slate-400 ml-1">({overview.lastSync.source})</span>
              </div>
            </div>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            Refresh
          </button>

          {hasPermission('wifi_monitor.manage') && (
            <button
              onClick={() => openTrustModal(null)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Register Trusted Device
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SUMMARY METRICS CARDS                                       */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Observed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Observed Devices</span>
            <Laptop className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{overview.metrics.totalObserved}</div>
          <div className="text-xs text-slate-400 mt-1">Local ARP & IP cache</div>
        </div>

        {/* Online Now */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Online Now</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
            {overview.metrics.onlineNow}
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-xs text-emerald-600 mt-1 font-medium">Active in last 15 min</div>
        </div>

        {/* Unknown Devices */}
        <div 
          onClick={() => setActiveTab('unknown')}
          className={`p-4 rounded-xl border shadow-sm cursor-pointer transition-all ${
            overview.metrics.unknownDevices > 0 
              ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium text-amber-800">Unknown Devices</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{overview.metrics.unknownDevices}</div>
          <div className="text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
            {overview.metrics.unknownDevices > 0 ? 'Action Needed: Verify' : 'All devices vetted'}
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Trusted Devices */}
        <div 
          onClick={() => setActiveTab('trusted')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Trusted Inventory</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{overview.metrics.trustedDevices}</div>
          <div className="text-xs text-slate-400 mt-1">IT-authorized devices</div>
        </div>

        {/* Blocked Devices */}
        <div 
          onClick={() => setActiveTab('blocked')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Blocked List</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{overview.metrics.blockedDevices}</div>
          <div className="text-xs text-slate-400 mt-1">Blacklisted MACs</div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. TABS NAVIGATION                                             */}
      {/* ============================================================== */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto">
          {[
            { id: 'connected', label: 'Connected Devices', count: overview.metrics.totalObserved },
            { id: 'unknown', label: 'Unknown Devices', count: overview.metrics.unknownDevices, alert: overview.metrics.unknownDevices > 0 },
            { id: 'trusted', label: 'Trusted Devices', count: overview.metrics.trustedDevices },
            { id: 'blocked', label: 'Blocked Devices', count: overview.metrics.blockedDevices },
            { id: 'routers', label: 'Router / AP Status' },
            { id: 'logs', label: 'Access Logs' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 sm:px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  tab.alert 
                    ? 'bg-amber-100 text-amber-800' 
                    : activeTab === tab.id 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ============================================================== */}
      {/* 4. SEARCH & FILTER CONTROLS (for list views)                   */}
      {/* ============================================================== */}
      {['connected', 'unknown', 'trusted', 'blocked'].includes(activeTab) && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by MAC, IP, hostname, vendor, owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {activeTab === 'connected' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="Online">Online Only</option>
                <option value="Offline">Offline Only</option>
              </select>
            )}

            <div className="text-xs text-slate-500 whitespace-nowrap">
              Showing <span className="font-semibold text-slate-700">{pagination.total}</span> record(s)
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. TAB 1: CONNECTED DEVICES & TAB 2: UNKNOWN DEVICES           */}
      {/* ============================================================== */}
      {['connected', 'unknown', 'blocked'].includes(activeTab) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {activeTab === 'unknown' && overview.metrics.unknownDevices > 0 && (
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-amber-900">Unregistered Devices Detected on Local Broadcast Domain.</span>
                <p className="text-amber-800 text-xs mt-0.5">
                  These clients responded to network probes but have not been approved in the Trusted Device Inventory.
                  Review the vendor and IP address, verify with the physical owner, and either register them as Trusted or restrict their access.
                </p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Device & IP</th>
                  <th className="px-4 py-3">MAC & Vendor</th>
                  <th className="px-4 py-3">Connection Medium</th>
                  <th className="px-4 py-3">Telemetry Freshness</th>
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading network device telemetry...</span>
                      </div>
                    </td>
                  </tr>
                ) : devices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      No network devices found matching current filters.
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => {
                    const isOnline = device.status === 'Online';
                    return (
                      <tr key={device.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className={`text-xs font-medium ${isOnline ? 'text-emerald-700' : 'text-slate-400'}`}>
                              {device.status}
                            </span>
                          </div>
                        </td>

                        {/* Device & IP */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {device.trusted_name || device.hostname || 'Unnamed Host'}
                          </div>
                          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{device.ip_address || 'No IP Assigned'}</span>
                            {device.owner_name && (
                              <span className="text-slate-400">({device.owner_name})</span>
                            )}
                          </div>
                        </td>

                        {/* MAC & Vendor */}
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-medium text-slate-800 flex items-center gap-1.5">
                            {device.mac_address}
                            {device.is_randomized_mac ? (
                              <span 
                                title="IEEE 802 Locally Administered Private MAC. Likely an iOS/Android/Windows privacy MAC."
                                className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200 cursor-help"
                              >
                                Private MAC ⚠️
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {device.vendor || 'Unknown Manufacturer'}
                          </div>
                        </td>

                        {/* Connection Medium */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {renderConnectionTypeBadge(device.connection_type)}
                          {device.ssid && (
                            <div className="text-[11px] text-slate-400 mt-0.5">SSID: {device.ssid}</div>
                          )}
                        </td>

                        {/* Telemetry Freshness */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {renderFreshnessBadge(device.freshness)}
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Source: {device.ap_source}
                          </div>
                        </td>

                        {/* Classification */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {renderClassificationBadge(device.classification)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {device.classification !== 'TRUSTED' && hasPermission('wifi_monitor.manage') && (
                              <button
                                onClick={() => openTrustModal(device)}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
                              >
                                Trust
                              </button>
                            )}

                            {hasPermission('wifi_monitor.manage') && (
                              <button
                                onClick={() => handleBlockAction(device)}
                                className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors"
                              >
                                Access Control
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 border border-slate-200 rounded text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  className="px-3 py-1 border border-slate-200 rounded text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. TAB 3: TRUSTED DEVICES INVENTORY                            */}
      {/* ============================================================== */}
      {activeTab === 'trusted' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Vetted Enterprise Hardware Registry</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Authorized company workstations, employee mobile devices, IoT equipment, and printers.
              </p>
            </div>
            {hasPermission('wifi_monitor.manage') && (
              <button
                onClick={() => openTrustModal(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Device
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Device Name</th>
                  <th className="px-4 py-3">MAC Address</th>
                  <th className="px-4 py-3">Owner / Department</th>
                  <th className="px-4 py-3">Device Type</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Approved By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      Loading trusted inventory...
                    </td>
                  </tr>
                ) : trustedInventory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      No devices currently registered in Trusted Inventory.
                    </td>
                  </tr>
                ) : (
                  trustedInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {item.device_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        <div className="flex items-center gap-1.5">
                          {item.mac_address}
                          {item.is_randomized_mac ? (
                            <span 
                              title="Randomized private MAC address" 
                              className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200"
                            >
                              Private MAC ⚠️
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800 font-medium">{item.owner_name || 'N/A'}</div>
                        <div className="text-xs text-slate-400">{item.department || 'Unassigned'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200">
                          {item.device_type || 'Other'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {item.location || 'Plant Floor'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="text-slate-700 font-medium">{item.approved_by_name || 'IT Admin'}</div>
                        <div className="text-slate-400">{new Date(item.updated_at || item.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission('wifi_monitor.manage') && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openTrustModal(item)}
                              title="Edit device registration"
                              className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveTrusted(item.id, item.device_name)}
                              title="Revoke trust status"
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. TAB 5: ROUTER / ACCESS POINT STATUS                          */}
      {/* ============================================================== */}
      {activeTab === 'routers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primary Router: Globe / ZTE GPON ONT */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-lg">Globe / ZTE GPON Gateway (ONT)</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Reachable
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1">
                    IP: 192.168.254.254 • MAC: 84:3C:99:A5:A8:10 (ZTE Corporation)
                  </div>
                </div>
                <Server className="w-8 h-8 text-blue-600" />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hardware Role:</span>
                  <span className="font-semibold text-slate-800">Primary Optical Gateway & DHCP Server</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Subnet Scope:</span>
                  <span className="font-semibold text-slate-800">192.168.254.0/24 (LAN + Wi-Fi)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Management UI:</span>
                  <span className="font-semibold text-blue-600">Globe Modem Control Dashboard</span>
                </div>
              </div>

              {/* Hardware Capability Matrix */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Hardware Capability Matrix
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-rose-50 border border-rose-100 text-rose-800">
                    <span className="flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      Client Telemetry REST API
                    </span>
                    <span className="font-semibold">Unsupported (ISP Locked)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-rose-50 border border-rose-100 text-rose-800">
                    <span className="flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      Programmatic Access Control / MAC Blocking
                    </span>
                    <span className="font-semibold">Disabled (API Unavailable)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-emerald-50 border border-emerald-100 text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Manual Web GUI MAC Filter
                    </span>
                    <span className="font-semibold">Supported (Port 80)</span>
                  </div>
                </div>
              </div>

              {/* Guidance Note */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <Info className="w-4 h-4 text-amber-600" />
                  Engineering Safety Protocol Enforced
                </div>
                <p>
                  Because this ZTE gateway firmware does not expose an authenticated vendor API, ITMS strictly prohibits session scraping or simulated blocks. MAC filtering must be configured directly via the router web portal.
                </p>
              </div>

              <a
                href="http://192.168.254.254"
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Globe Modem Control Dashboard (192.168.254.254)
              </a>
            </div>

            {/* Discovery Engine: On-Premise Network Agent */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-lg">On-Premise Network Agent</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Active Observer
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1">
                    Agent UUID: agent-nkb-plant-01
                  </div>
                </div>
                <Activity className="w-8 h-8 text-emerald-600" />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Observation Method:</span>
                  <span className="font-semibold text-slate-800">Passively harvested local ARP table</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Security / Auth:</span>
                  <span className="font-semibold text-slate-800">SHA-256 HMAC + Nonce Replay Window</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Telemetry Freshness:</span>
                  <span className="font-semibold text-emerald-700">Live (5-min skew window)</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Operational Discovery Protocol
                </h4>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>Harvests real ARP cache entries across the plant physical broadcast domain.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>Labels entries as <strong>LAN (ARP Observed)</strong> to avoid falsely conflating ARP presence with wireless association.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>Evaluates IEEE 802 randomized bits to alert admins of private MAC devices.</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-900 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Agent Execution Command
                </div>
                <code className="block bg-blue-100 p-2 rounded text-[11px] font-mono text-blue-950 select-all">
                  python scripts/on_prem_network_agent.py --interval 60
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. TAB 6: ACCESS LOGS (AUDIT TRAIL)                            */}
      {/* ============================================================== */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Security & Access Control Audit Trail</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Immutable records of all device trustings, access control requests, and telemetry events.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Total Logs: <span className="font-semibold text-slate-700">{pagination.total}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target Device</th>
                  <th className="px-4 py-3">Gateway / System</th>
                  <th className="px-4 py-3">Requested By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : accessLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      No access control actions logged yet.
                    </td>
                  </tr>
                ) : (
                  accessLogs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS';
                    const isUnsupported = log.status === 'UNSUPPORTED';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors text-xs">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {log.action}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          <div>{log.target_mac || 'N/A'}</div>
                          {log.target_name && (
                            <div className="text-[11px] text-slate-400 font-sans">{log.target_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {log.router_name || 'System Registry'}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          {log.requested_by_name || 'System'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${
                            isSuccess ? 'bg-emerald-100 text-emerald-800' :
                            isUnsupported ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 9. MODAL: REGISTER / EDIT TRUSTED DEVICE                       */}
      {/* ============================================================== */}
      {trustModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {selectedDeviceForTrust ? 'Verify & Trust Device' : 'Register Trusted Hardware'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add device identity into the verified inventory to clear unknown alerts.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setTrustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitTrust)} className="p-6 space-y-4">
              {/* MAC Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  MAC Physical Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  {...register('macAddress', { 
                    required: 'MAC address is required',
                    pattern: {
                      value: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
                      message: 'Invalid MAC address format (e.g. 7C:F1:7E:7F:CF:4F)'
                    }
                  })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {errors.macAddress && (
                  <p className="text-xs text-rose-500 mt-1">{errors.macAddress.message}</p>
                )}
              </div>

              {/* Device Friendly Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Device Name / Asset Tag <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. IT-LAPTOP-04, Warehouse-Scanner-12"
                  {...register('deviceName', { required: 'Device name is required' })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {errors.deviceName && (
                  <p className="text-xs text-rose-500 mt-1">{errors.deviceName.message}</p>
                )}
              </div>

              {/* Owner & Department */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assigned Owner
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Juan Dela Cruz"
                    {...register('ownerName')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IT, Production, HR"
                    {...register('department')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Device Type & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Device Type
                  </label>
                  <select
                    {...register('deviceType')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Laptop">Laptop Workstation</option>
                    <option value="Desktop">Desktop PC</option>
                    <option value="Smartphone">Smartphone / Mobile</option>
                    <option value="Tablet">Tablet / Handheld</option>
                    <option value="Printer">Network Printer</option>
                    <option value="Server">Server / Hypervisor</option>
                    <option value="IoT">IoT / Security Camera</option>
                    <option value="Network">Switch / AP / Gateway</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Physical Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Building 2, 2F Office"
                    {...register('location')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Security Notes / Approval Justification
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Approved company-issued Dell Latitude laptop."
                  {...register('notes')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTrustModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTrust}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {savingTrust && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save to Trusted Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 10. MODAL: ACCESS CONTROL / MANUAL GUIDANCE                    */}
      {/* ============================================================== */}
      {guidanceModalOpen && guidanceData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Gateway Access Control Guidance</h3>
                  <p className="text-xs text-amber-800">
                    Hardware API Unsupported: Manual Router Configuration Required
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setGuidanceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Router:</span>
                  <span className="font-semibold text-slate-900">{guidanceData.routerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target MAC:</span>
                  <span className="font-mono font-bold text-rose-600">{guidanceData.targetMac}</span>
                </div>
                {guidanceData.targetIp && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target IP:</span>
                    <span className="font-mono text-slate-700">{guidanceData.targetIp}</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-600 leading-relaxed">
                The current Globe/ZTE GPON gateway firmware does not support programmatic access control via API. To prevent unauthorized devices without risking router session corruption, complete the following manual blacklist configuration:
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Step-by-Step Router Configuration:
                </div>
                <ol className="space-y-2 text-xs text-slate-700 list-decimal pl-4">
                  {guidanceData.steps?.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                <strong>Audit Record:</strong> This access control action and attempt have been registered in the ITMS immutable audit trail.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGuidanceModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <a
                  href={guidanceData.managementUrl || 'http://192.168.254.254'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Launch Router Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
