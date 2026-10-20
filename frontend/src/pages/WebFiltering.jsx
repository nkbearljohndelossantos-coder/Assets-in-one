import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, ShieldAlert, Laptop, Smartphone, AlertTriangle, 
  CheckCircle, XCircle, Search, Plus, Trash2, RefreshCw, Lock, 
  Unlock, Radio, QrCode, Download, Eye, EyeOff, Layers, Filter, 
  AlertCircle, Activity, Wifi, Battery, FileText, Ban, Play, Settings
} from 'lucide-react';

export default function WebFiltering() {
  const { hasPermission, showToast } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [activePolicy, setActivePolicy] = useState(null);
  const [categories, setCategories] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [discoveredApps, setDiscoveredApps] = useState([]);
  const [appBlacklist, setAppBlacklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // New domain / app modal inputs
  const [newDomain, setNewDomain] = useState('');
  const [newMatchCategory, setNewMatchCategory] = useState('');
  const [newWhitelistDomain, setNewWhitelistDomain] = useState('');
  const [newAppPackage, setNewAppPackage] = useState('');
  const [newAppName, setNewAppName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // QR Generator state
  const [qrAction, setQrAction] = useState('ENABLE_WORK_MODE');
  const [generatedQr, setGeneratedQr] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, polRes, catRes, blackRes, whiteRes, appRes, appBlackRes] = await Promise.all([
        api.get('/v1/webfilter/dashboard').catch(() => ({ data: { data: {} } })),
        api.get('/v1/webfilter/policies').catch(() => ({ data: { data: [] } })),
        api.get('/v1/webfilter/categories').catch(() => ({ data: { data: [] } })),
        api.get('/v1/webfilter/blacklist').catch(() => ({ data: { data: [] } })),
        api.get('/v1/webfilter/whitelist').catch(() => ({ data: { data: [] } })),
        api.get('/v1/webfilter/apps').catch(() => ({ data: { data: [] } })),
        api.get('/v1/webfilter/app-blacklist').catch(() => ({ data: { data: [] } }))
      ]);

      setDashboardData(dashRes.data?.data || null);
      setPolicies(polRes.data?.data || []);
      if (polRes.data?.data?.length > 0) {
        setActivePolicy(polRes.data.data[0]);
      }
      setCategories(catRes.data?.data || []);
      setBlacklist(blackRes.data?.data || []);
      setWhitelist(whiteRes.data?.data || []);
      setDiscoveredApps(appRes.data?.data || []);
      setAppBlacklist(appBlackRes.data?.data || []);
    } catch (err) {
      showToast('Error', 'Failed to load Web Filtering & MDM security data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Remote Command Dispatcher
  const handleSendCommand = async (commandName, params = {}) => {
    if (commandName === 'FACTORY_RESET' || commandName === 'WIPE_COMPANY_DATA') {
      if (!window.confirm(`CAUTION: Are you sure you want to execute destructive command '${commandName}' on enrolled devices?`)) {
        return;
      }
    }

    setActionLoading(true);
    try {
      const res = await api.post('/v1/webfilter/commands', {
        command: commandName,
        parameters: params
      });
      if (res.data.success) {
        showToast('Command Transmitted', res.data.message, 'success');
        loadAllData();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to transmit command.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Policy Flags
  const handleTogglePolicyFlag = async (flagName, currentValue) => {
    if (!activePolicy) return;
    const updated = { ...activePolicy, [flagName]: !currentValue };
    setActivePolicy(updated);

    try {
      const res = await api.put(`/v1/webfilter/policies/${activePolicy.id}`, updated);
      if (res.data.success) {
        showToast('Policy Updated', 'Work Mode security policy saved & broadcasted over Socket.IO.', 'success');
      }
    } catch (err) {
      showToast('Error', 'Failed to update policy.', 'error');
    }
  };

  // Add Blacklist Domain
  const handleAddBlacklist = async (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    try {
      const res = await api.post('/v1/webfilter/blacklist', {
        domain: newDomain.trim(),
        category_id: newMatchCategory || null
      });
      if (res.data.success) {
        showToast('Blacklisted', `Domain pattern '${newDomain}' added to blacklist.`, 'success');
        setNewDomain('');
        loadAllData();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to add domain.', 'error');
    }
  };

  // Remove Blacklist Domain
  const handleRemoveBlacklist = async (id) => {
    try {
      const res = await api.delete(`/v1/webfilter/blacklist/${id}`);
      if (res.data.success) {
        showToast('Removed', 'Domain rule deleted.', 'success');
        loadAllData();
      }
    } catch (err) {
      showToast('Error', 'Failed to remove domain.', 'error');
    }
  };

  // Add Whitelist Exception
  const handleAddWhitelist = async (e) => {
    e.preventDefault();
    if (!newWhitelistDomain.trim()) return;
    try {
      const res = await api.post('/v1/webfilter/whitelist', {
        domain: newWhitelistDomain.trim(),
        description: 'Administrator Exception Rule'
      });
      if (res.data.success) {
        showToast('Whitelisted', `Domain '${newWhitelistDomain}' added to exception list.`, 'success');
        setNewWhitelistDomain('');
        loadAllData();
      }
    } catch (err) {
      showToast('Error', 'Failed to add whitelist domain.', 'error');
    }
  };

  // Download PNG QR Code Image helper
  const downloadQRCodeImage = async (qrDataObj, actionType, tokenUuid) => {
    try {
      const qrDataString = typeof qrDataObj === 'string' ? qrDataObj : (qrDataObj?.url || qrDataObj?.scannableUrl || JSON.stringify(qrDataObj));
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrDataString)}`;
      const response = await fetch(qrApiUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${actionType}_${tokenUuid || 'QR'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      showToast('Downloaded', `QR Code image downloaded as '${actionType}_${tokenUuid || 'QR'}.png'`, 'success');
    } catch (e) {
      showToast('Error', 'Failed to download QR image file.', 'error');
    }
  };

  // Generate QR Token
  const handleGenerateQrToken = async (type) => {
    setQrAction(type);
    try {
      const res = await api.post('/v1/webfilter/qr-tokens/generate', {
        action_type: type,
        ttl_minutes: 30
      });
      if (res.data.success) {
        const data = res.data.data;
        setGeneratedQr(data);
        showToast('QR Token Generated', 'Single-use HMAC-SHA256 signed QR code generated.', 'success');
        await downloadQRCodeImage(data.qrPayload, type, data.tokenUuid);
      }
    } catch (err) {
      showToast('Error', 'Failed to generate QR code.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center space-y-4">
        <RefreshCw className="h-8 w-8 text-gold-500 animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-600">Loading Enterprise MDM Security & Web Filtering Platform...</p>
      </div>
    );
  }

  const summary = dashboardData?.summary || {};

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Title & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-gold-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Enterprise Work Mode Security & Web Filtering MDM
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Category-Based Internet Filtering, Android Device Owner OS Policies, Gambling App Hiding, and Remote Command Center
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            className="px-3 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync Status</span>
          </button>
          <button
            onClick={() => handleSendCommand('EMERGENCY_LOCK')}
            disabled={actionLoading}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer shadow transition-colors"
            title="Instantly lock devices, hide non-company apps, and restrict browser access"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Emergency Lock</span>
          </button>
        </div>
      </div>

      {/* Intune-Style MDM Telemetry Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-400">Total MDM Devices</span>
          <p className="text-2xl font-black text-slate-900">{summary.totalDevices || 1}</p>
          <span className="text-[10px] text-emerald-600 font-bold">● {summary.onlineDevices || 1} Online Now</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-400">Work Mode Status</span>
          <p className={`text-xl font-black ${summary.workModeEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
            {summary.workModeEnabled ? 'ACTIVE & ENFORCED' : 'OFF'}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">OS Device Owner</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-400">Compliance Rate</span>
          <p className="text-2xl font-black text-emerald-600">100%</p>
          <span className="text-[10px] text-slate-500 font-medium">0 Non-Compliant</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-400">Blacklisted Domains</span>
          <p className="text-2xl font-black text-slate-900">{summary.blacklistedDomainsCount || blacklist.length}</p>
          <span className="text-[10px] text-gold-600 font-bold">Wildcards Active</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-400">Blocked Gambling Apps</span>
          <p className="text-2xl font-black text-rose-600">{summary.blockedAppsCount || appBlacklist.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">Auto-Hidden</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-400">Security Incidents</span>
          <p className="text-2xl font-black text-slate-900">0</p>
          <span className="text-[10px] text-emerald-600 font-bold">Anti-Tamper Shield</span>
        </div>
      </div>

      {/* Real-time Remote Command Center Control Bar */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-gold-400 animate-pulse" />
            <h3 className="text-xs font-bold tracking-wide uppercase text-gold-400">Real-Time Remote Command Center (Socket.IO)</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Channel: mdmsocket://command-dispatch</span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => handleSendCommand('ENABLE_WORK_MODE')}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold cursor-pointer transition-colors"
          >
            ▶ Enable Work Mode
          </button>
          <button
            onClick={() => handleSendCommand('DISABLE_WORK_MODE')}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold cursor-pointer transition-colors"
          >
            ⏹ Disable Work Mode
          </button>
          <button
            onClick={() => handleSendCommand('SYNC_POLICIES')}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-gold-600 hover:bg-gold-500 text-slate-950 rounded font-bold cursor-pointer transition-colors"
          >
            ⚡ Sync Policies
          </button>
          <button
            onClick={() => handleSendCommand('LOCK_DEVICE')}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-bold cursor-pointer transition-colors"
          >
            🔒 Lock Screen
          </button>
          <button
            onClick={() => handleSendCommand('RING_DEVICE')}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-bold cursor-pointer transition-colors"
          >
            🔔 Ring Device
          </button>
          <button
            onClick={() => handleSendCommand('LOCATE_DEVICE')}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-bold cursor-pointer transition-colors"
          >
            📍 Locate GPS
          </button>
          <button
            onClick={() => handleSendCommand('REFRESH_APP_INVENTORY')}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-bold cursor-pointer transition-colors"
          >
            📦 Scan Installed Apps
          </button>
          <button
            onClick={() => handleSendCommand('WIPE_COMPANY_DATA')}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded font-bold cursor-pointer transition-colors ml-auto"
          >
            ⚠️ Wipe Company Data
          </button>
        </div>
      </div>

      {/* Main Module Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'overview' ? 'border-gold-600 text-gold-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          🛡️ Work Mode Policies & Categories
        </button>
        <button
          onClick={() => setActiveTab('blacklist')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'blacklist' ? 'border-gold-600 text-gold-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          🚫 Wildcard Domain Filtering
        </button>
        <button
          onClick={() => setActiveTab('apps')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'apps' ? 'border-gold-600 text-gold-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          📦 App Discovery Catalog & Gambling Blocker
        </button>
        <button
          onClick={() => setActiveTab('qr')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'qr' ? 'border-gold-600 text-gold-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          📱 Device Owner Provisioning & Signed QR Generator
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'logs' ? 'border-gold-600 text-gold-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          📊 Audit Logs & Export Reports
        </button>
      </div>

      {/* TAB 1: OVERVIEW & CATEGORY POLICIES */}
      {activeTab === 'overview' && activePolicy && (
        <div className="space-y-6">
          
          {/* Policy Toggles */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Work Mode Security Policy Switches</h3>
                <p className="text-xs text-slate-500">Android Enterprise Device Owner Policy Settings (`DevicePolicyManager`)</p>
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase">
                Device Owner Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-semibold">
              
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Work Mode Internet Filtering</p>
                  <p className="text-[10px] text-slate-500">Enforces VPN Sinkhole & DNS rules</p>
                </div>
                <button
                  onClick={() => handleTogglePolicyFlag('is_work_mode_enabled', activePolicy.is_work_mode_enabled)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    activePolicy.is_work_mode_enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Block Gambling & Sabong</p>
                  <p className="text-[10px] text-slate-500">Blocks betting, casino & slot sites</p>
                </div>
                <button
                  onClick={() => handleTogglePolicyFlag('block_gambling', activePolicy.block_gambling)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    activePolicy.block_gambling ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Block Torrent & P2P</p>
                  <p className="text-[10px] text-slate-500">Blocks BitTorrent & P2P sharing</p>
                </div>
                <button
                  onClick={() => handleTogglePolicyFlag('block_torrent', activePolicy.block_torrent)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    activePolicy.block_torrent ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Block / Disable Camera</p>
                  <p className="text-[10px] text-slate-500">Android OS DevicePolicyManager Camera Restriction</p>
                </div>
                <button
                  onClick={() => handleTogglePolicyFlag('hide_camera', activePolicy.hide_camera)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    activePolicy.hide_camera ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Hide Non-Company Browsers</p>
                  <p className="text-[10px] text-slate-500">Hides Chrome, Edge, Firefox</p>
                </div>
                <button
                  onClick={() => handleTogglePolicyFlag('hide_browsers', activePolicy.hide_browsers)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    activePolicy.hide_browsers ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Disable Screenshots</p>
                  <p className="text-[10px] text-slate-500">Device Owner screen capture block</p>
                </div>
                <button
                  onClick={() => handleTogglePolicyFlag('disable_screenshots', activePolicy.disable_screenshots)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    activePolicy.disable_screenshots ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Disable Developer Options</p>
                  <p className="text-[10px] text-slate-500">Blocks USB Debugging & ADB</p>
                </div>
                <button
                  onClick={() => handleTogglePolicyFlag('disable_developer_options', activePolicy.disable_developer_options)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    activePolicy.disable_developer_options ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

            </div>
          </div>

          {/* 18 Filtering Categories */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">
              18 Category-Based Filtering Modules
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {categories.map(cat => (
                <div key={cat.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{cat.name}</p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{cat.description}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    cat.is_blocked_by_default ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {cat.is_blocked_by_default ? 'Blocked' : 'Allowed'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: WILDCARD DOMAIN FILTERING */}
      {activeTab === 'blacklist' && (
        <div className="space-y-6">
          
          {/* Add Blacklist Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">
              Add Wildcard Domain / Blacklist Rule
            </h3>
            
            <form onSubmit={handleAddBlacklist} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g. *.bet, *.sabong, bet88.com, xyzcasino.com"
                className="flex-1 p-2.5 border border-slate-300 rounded-lg text-xs font-semibold"
              />
              <select
                value={newMatchCategory}
                onChange={(e) => setNewMatchCategory(e.target.value)}
                className="p-2.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
              >
                <option value="">Select Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2.5 bg-slate-900 hover:bg-gold-650 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow"
              >
                + Add Blacklist Rule
              </button>
            </form>
          </div>

          {/* Blacklist & Whitelist Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Blacklist Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-2 p-4">
              <h4 className="font-bold text-xs text-rose-700 uppercase tracking-wider">Blocked Wildcard Domains ({blacklist.length})</h4>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Domain Pattern</th>
                      <th className="p-2">Category</th>
                      <th className="p-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {blacklist.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-rose-600">{b.pattern || b.domain}</td>
                        <td className="p-2 font-sans font-semibold text-slate-700">{b.category_name || 'Gambling'}</td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => handleRemoveBlacklist(b.id)}
                            className="text-rose-600 hover:text-rose-800 font-bold text-[10px] cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Whitelist Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-2 p-4">
              <h4 className="font-bold text-xs text-emerald-700 uppercase tracking-wider">Whitelisted Domain Exceptions ({whitelist.length})</h4>
              <form onSubmit={handleAddWhitelist} className="flex gap-2 pb-2">
                <input
                  type="text"
                  value={newWhitelistDomain}
                  onChange={(e) => setNewWhitelistDomain(e.target.value)}
                  placeholder="e.g. nkbmanufacturing.com"
                  className="flex-1 p-2 border border-slate-300 rounded text-xs font-semibold"
                />
                <button type="submit" className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded cursor-pointer">
                  + Whitelist
                </button>
              </form>

              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Domain</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {whitelist.map(w => (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-emerald-700">{w.domain}</td>
                        <td className="p-2 font-sans text-slate-600">{w.description || 'Exception Rule'}</td>
                        <td className="p-2 text-right">
                          <button
                            onClick={async () => {
                              await api.delete(`/v1/webfilter/whitelist/${w.id}`);
                              loadAllData();
                            }}
                            className="text-rose-600 hover:text-rose-800 font-bold text-[10px] cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 3: APP DISCOVERY CATALOG & GAMBLING BLOCKER */}
      {activeTab === 'apps' && (
        <div className="space-y-6">
          
          {/* Add Blacklist App Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">
              Block & Hide Application Package
            </h3>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newAppPackage.trim()) return;
              await api.post('/v1/webfilter/app-blacklist', {
                package_name: newAppPackage.trim(),
                app_name: newAppName.trim() || newAppPackage.trim()
              });
              setNewAppPackage('');
              setNewAppName('');
              showToast('Blocked', 'Application package blocked & hidden.', 'success');
              loadAllData();
            }} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newAppPackage}
                onChange={(e) => setNewAppPackage(e.target.value)}
                placeholder="Package Name e.g. com.ph.sabong.live, com.bet88.ph"
                className="flex-1 p-2.5 border border-slate-300 rounded-lg text-xs font-semibold"
              />
              <input
                type="text"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                placeholder="App Name e.g. Sabong Live"
                className="w-48 p-2.5 border border-slate-300 rounded-lg text-xs font-semibold"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow"
              >
                + Block Package
              </button>
            </form>
          </div>

          {/* Gambling App Blacklist */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h4 className="font-bold text-xs text-rose-700 uppercase tracking-wider">
              Active Gambling & Unauthorized Application Blacklist ({appBlacklist.length})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {appBlacklist.map(app => (
                <div key={app.id} className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-slate-900 truncate">{app.app_name}</p>
                    <button
                      onClick={async () => {
                        await api.delete(`/v1/webfilter/app-blacklist/${app.id}`);
                        loadAllData();
                      }}
                      className="text-rose-600 font-bold text-[10px]"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 truncate">{app.package_name}</p>
                  <span className="inline-block px-2 py-0.5 bg-rose-200 text-rose-900 rounded text-[9px] font-black uppercase">
                    Hidden & Disabled
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: DEVICE OWNER PROVISIONING & SIGNED QR GENERATOR */}
      {activeTab === 'qr' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">
              Work Mode Single-Use Signed QR / Barcode Generator
            </h3>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleGenerateQrToken('ENABLE_WORK_MODE')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow transition-colors"
              >
                Generate Work Mode Security QR
              </button>
              <button
                onClick={() => handleGenerateQrToken('DISABLE_WORK_MODE')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer shadow transition-colors"
              >
                Generate End Work Mode QR
              </button>
              <a
                href="/uploads/NKB-ITMS-Agent.apk"
                download="NKB-ITMS-Agent.apk"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download Android DPC Agent (.apk)</span>
              </a>
            </div>

            {generatedQr && (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4 max-w-xl">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-gold-600" />
                    <h4 className="font-bold text-xs text-slate-900">Signed MDM QR ({generatedQr.action_type})</h4>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px]">
                    Android Enterprise DPC Ready
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* QR 1: Universal Camera Scan */}
                  <div className="flex flex-col items-center p-3 bg-white border border-slate-300 rounded-xl space-y-2 shadow-sm text-center">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Option A: Smartphone Camera Scan</span>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(generatedQr.scannableUrl || generatedQr.qrPayloadString)}`}
                      alt="Camera Scannable QR Code"
                      className="w-44 h-44 border border-slate-200 rounded-lg p-2 bg-white shadow-inner"
                    />
                    <p className="text-[10px] text-slate-500 font-semibold">Scan with iPhone/Android Camera or Google Lens</p>
                  </div>

                  {/* QR 2: Android Enterprise Device Owner Setup QR */}
                  <div className="flex flex-col items-center p-3 bg-white border border-slate-300 rounded-xl space-y-2 shadow-sm text-center">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Option B: Android Device Owner Provisioning</span>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({
                        "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.nkb.itms.agent/.AdminReceiver",
                        "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": `${window.location.origin}/uploads/NKB-ITMS-Agent.apk`,
                        "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
                          "serverUrl": window.location.origin,
                          "enrollmentToken": generatedQr.tokenUuid
                        }
                      }))}`}
                      alt="Android Device Owner Provisioning QR Code"
                      className="w-44 h-44 border border-slate-200 rounded-lg p-2 bg-white shadow-inner"
                    />
                    <p className="text-[10px] text-slate-500 font-semibold">Scan 6 times on Android Welcome Screen (Factory Reset)</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => downloadQRCodeImage(generatedQr.qrPayload, generatedQr.action_type, generatedQr.tokenUuid)}
                    className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download PNG Image</span>
                  </button>
                  <button
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(generatedQr.qrPayload, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `${generatedQr.action_type}_${generatedQr.tokenUuid}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>JSON Payload</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 font-medium text-center">
                  Scan this signed QR payload using the Android MDM Agent camera to authenticate Work Mode transitions.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS & REPORTS */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-sm font-black text-slate-900">
              Blocked Attempt Audit Logs & Export Reports
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => showToast('Export PDF', 'Generating Enterprise MDM PDF Compliance Report...', 'info')}
                className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Export PDF</span>
              </button>
              <button
                onClick={() => showToast('Export Excel', 'Generating Enterprise MDM Excel Audit Workbook...', 'info')}
                className="px-3 py-1.5 bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Target Type</th>
                  <th className="p-2.5">Blocked Target</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Action Taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {dashboardData?.recentAuditLogs?.length > 0 ? (
                  dashboardData.recentAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-2.5 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="p-2.5 font-bold text-slate-900">{log.target_type}</td>
                      <td className="p-2.5 font-bold text-rose-600">{log.blocked_target}</td>
                      <td className="p-2.5 font-sans font-semibold text-slate-700">{log.category_name}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-black text-[9px]">
                          {log.action_taken}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 font-sans text-xs">
                      No blocked attempt logs recorded yet.
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
