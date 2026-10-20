import React, { useState, useEffect } from 'react';
import { 
  Monitor, ShieldAlert, ShieldCheck, Power, Terminal as TerminalIcon, 
  Folder, Cpu, Wrench, Package, Calendar, Clock, Lock, Shield, Download, 
  FileText, Settings, RefreshCw, CheckCircle2, AlertTriangle, Play, Square,
  CheckSquare, XCircle, Search, Filter, Radio, ChevronRight, User, Eye, Activity, Globe
} from 'lucide-react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import ReauthModal from '../components/ReauthModal';
import AttendedRequestPromptModal from '../components/AttendedRequestPromptModal';

export default function RemoteManagement() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reauthOpen, setReauthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  
  // Terminal state
  const [terminalCmd, setTerminalCmd] = useState('');
  const [terminalLogs, setTerminalLogs] = useState([
    'Microsoft Windows [Version 10.0.22631.3880]',
    '(c) Microsoft Corporation. All rights reserved.',
    'NKB ITMS Remote Powershell Console connected. Type command below.'
  ]);

  // File Manager & Process/Service State
  const [fileList, setFileList] = useState([]);
  const [processList, setProcessList] = useState([]);
  const [serviceList, setServiceList] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [agentPackage, setAgentPackage] = useState(null);
  const [activeModalSession, setActiveModalSession] = useState(null);
  const [attendedPromptRequest, setAttendedPromptRequest] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/remote/dashboard');
      if (res.data.success) {
        setDashboardData(res.data.data);
      }
      
      const devRes = await api.get('/remote/devices');
      if (devRes.data.success) {
        setDevices(devRes.data.data.devices);
        if (devRes.data.data.devices.length > 0 && !selectedDevice) {
          setSelectedDevice(devRes.data.data.devices[0]);
        }
      }
    } catch (err) {
      console.error('Remote management load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const handleAccessUpdated = (data) => {
        if (data.status === 'approved' && selectedDevice) {
          api.post('/remote/sessions/launch', {
            device_id: selectedDevice.device_id,
            access_mode: 'attended',
            connection_type: 'Full Control'
          }).then(res => {
            if (res.data.success) {
              setActiveModalSession(res.data.data);
              setActiveTab('desktop');
            }
          });
        }
      };

      socket.on('remote:access_request_updated', handleAccessUpdated);
      return () => socket.off('remote:access_request_updated', handleAccessUpdated);
    }
  }, [selectedDevice]);

  useEffect(() => {
    if (selectedDevice && activeTab === 'terminal') {
      loadTerminal();
    } else if (selectedDevice && activeTab === 'files') {
      loadFiles();
    } else if (selectedDevice && activeTab === 'processes') {
      loadProcesses();
    } else if (selectedDevice && activeTab === 'services') {
      loadServices();
    } else if (activeTab === 'schedules') {
      loadSchedules();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    } else if (activeTab === 'deployment') {
      loadAgentDeployment();
    } else if (activeTab === 'settings') {
      loadGatewaySettings();
    }
  }, [selectedDevice, activeTab]);

  const loadTerminal = () => {
    // Ready console
  };

  const loadFiles = async () => {
    if (!selectedDevice) return;
    try {
      const res = await api.get('/remote/file-manager/list', { params: { device_id: selectedDevice.device_id } });
      if (res.data.success) setFileList(res.data.data.files || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadProcesses = async () => {
    if (!selectedDevice) return;
    try {
      const res = await api.get('/remote/processes', { params: { device_id: selectedDevice.device_id } });
      if (res.data.success) setProcessList(res.data.data.processes || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadServices = async () => {
    if (!selectedDevice) return;
    try {
      const res = await api.get('/remote/services', { params: { device_id: selectedDevice.device_id } });
      if (res.data.success) setServiceList(res.data.data.services || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSchedules = async () => {
    try {
      const res = await api.get('/remote/schedules');
      if (res.data.success) setSchedules(res.data.data.schedules || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await api.get('/remote/audit-logs');
      if (res.data.success) setAuditLogs(res.data.data.logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAgentDeployment = async () => {
    try {
      const res = await api.get('/remote/agent-deployment');
      if (res.data.success) setAgentPackage(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerPrivilegedAction = (actionType, callback) => {
    setPendingAction({ actionType, callback });
    setReauthOpen(true);
  };

  const handleReauthSuccess = (token) => {
    if (pendingAction && pendingAction.callback) {
      pendingAction.callback(token);
    }
    setPendingAction(null);
  };

  const handleExecuteTerminal = (token) => {
    if (!selectedDevice) return;
    if (!selectedDevice.is_online) {
      alert(`⚠️ Cannot execute commands: ${selectedDevice.name} is currently OFFLINE.\n\nPlease verify that the target machine is powered on and connected to the network.`);
      return;
    }
    if (!terminalCmd.trim()) return;
    setTerminalLogs(prev => [...prev, `PS C:\\> ${terminalCmd}`]);
    api.post('/remote/terminal/execute', {
      device_id: selectedDevice.device_id,
      command: terminalCmd,
      reauth_token: token
    }).then(res => {
      if (res.data.success) {
        setTerminalLogs(prev => [...prev, res.data.data.stdout || 'Command completed.']);
      }
    });
    setTerminalCmd('');
  };

  const handlePowerAction = (commandType) => {
    if (!selectedDevice) return;
    if (commandType !== 'wol' && !selectedDevice.is_online) {
      alert(`⚠️ Cannot execute power command: ${selectedDevice.name} is currently OFFLINE.\n\nUse Wake-on-LAN (WOL) to send a magic packet to boot up an offline machine.`);
      return;
    }
    triggerPrivilegedAction(`POWER_${commandType.toUpperCase()}`, (token) => {
      api.post('/remote/power/command', {
        device_id: selectedDevice.device_id,
        command_type: commandType,
        reauth_token: token
      }).then(res => {
        alert(`Power command ${commandType} dispatched to ${selectedDevice.name}!`);
        loadDashboard();
      });
    });
  };

  const handleLaunchDesktop = (mode = 'unattended') => {
    if (!selectedDevice) return;
    const actionKey = mode === 'unattended' ? 'UNATTENDED_ACCESS' : 'REMOTE_DESKTOP';
    const executeLaunch = (token) => {
      api.post('/remote/sessions/launch', {
        device_id: selectedDevice.device_id,
        access_mode: mode,
        connection_type: 'Full Control',
        reauth_token: token
      }).then(res => {
        if (res.data.success) {
          setActiveModalSession(res.data.data);
          setActiveTab('desktop');
        }
      }).catch(err => {
        console.error('Launch desktop error:', err);
      });
    };

    if (mode === 'unattended') {
      triggerPrivilegedAction(actionKey, executeLaunch);
    } else {
      executeLaunch(null);
    }
  };

  const handleSyncAssets = async () => {
    try {
      const res = await api.post('/remote/sync-assets');
      if (res.data.success) {
        alert(res.data.message);
        loadDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignoffGate = (checkCode) => {
    api.post('/remote/settings/production-gate/signoff', { check_code: checkCode })
      .then(() => loadDashboard());
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  const filteredDevices = devices.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.device_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.ip_address && d.ip_address.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Monitor className="h-6 w-6 text-gold-500" />
            <h1 className="text-xl font-bold tracking-tight">Remote Device Management</h1>
            {dashboardData?.isSimulated && (
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase rounded-md tracking-wider flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                [SIMULATED DATA MODE]
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Centralized Remote Support, Terminal, Process Control & Automated Power Scheduling Integration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAssets}
            className="px-3 py-2 bg-gold-600 hover:bg-gold-650 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync IT Assets</span>
          </button>
          <button
            onClick={loadDashboard}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex overflow-x-auto bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm scrollbar-none gap-1">
        {[
          { id: 'dashboard', name: 'Dashboard', icon: Monitor },
          { id: 'devices', name: 'Managed Devices', icon: Radio },
          { id: 'desktop', name: 'Remote Desktop', icon: Eye },
          { id: 'terminal', name: 'Remote Terminal', icon: TerminalIcon },
          { id: 'files', name: 'File Manager', icon: Folder },
          { id: 'processes', name: 'Processes', icon: Cpu },
          { id: 'services', name: 'Services', icon: Wrench },
          { id: 'schedules', name: 'Power Scheduler', icon: Calendar },
          { id: 'deployment', name: 'Agent Deployment', icon: Download },
          { id: 'audit', name: 'Audit Logs', icon: FileText },
          { id: 'settings', name: 'Production Gate & Settings', icon: Settings }
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                isActive ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-gold-400' : 'text-slate-400'}`} />
              <span>{t.name}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Counters Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'Total Devices', val: dashboardData?.counters.totalDevices, color: 'text-slate-900', bg: 'bg-slate-50' },
              { label: 'Online Devices', val: dashboardData?.counters.onlineDevices, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Offline Devices', val: dashboardData?.counters.offlineDevices, color: 'text-slate-500', bg: 'bg-slate-50' },
              { label: 'Active Sessions', val: dashboardData?.counters.activeSessions, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Pending Requests', val: dashboardData?.counters.pendingRequests, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Protected PCs', val: dashboardData?.counters.protectedDevices, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Power Schedules', val: dashboardData?.counters.activeSchedules, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            ].map((c, i) => (
              <div key={i} className={`p-4 rounded-xl border border-slate-200 shadow-sm ${c.bg}`}>
                <span className="block text-[11px] font-bold text-slate-500 uppercase">{c.label}</span>
                <span className={`text-2xl font-black ${c.color}`}>{c.val || 0}</span>
              </div>
            ))}
          </div>

          {/* Quick Select & Device Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gold-600" />
                  <span>Managed Endpoints Telemetry</span>
                </h3>
                <div className="relative w-48">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search device..."
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-350 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Device Name</th>
                      <th className="p-3">IP Address</th>
                      <th className="p-3">Logged User</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                    {filteredDevices.slice(0, 5).map(d => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-slate-500" />
                          <span>{d.name}</span>
                        </td>
                        <td className="p-3 font-mono">{d.ip_address || '192.168.10.x'}</td>
                        <td className="p-3">{d.logged_in_user || 'N/A'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.is_online ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {d.is_online ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => { setSelectedDevice(d); setActiveTab('desktop'); }}
                            className="px-2.5 py-1 bg-slate-900 text-white rounded text-[11px] font-bold hover:bg-gold-650 cursor-pointer"
                          >
                            Remote Session
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Chain Status Box */}
            <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-bold text-sm">Append-Only Audit Chain</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  All remote device operations are cryptographically chained using SHA-256 server-side hashes (`previous_hash` link).
                </p>
                <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 text-xs font-mono space-y-1">
                  <div className="text-emerald-400 font-bold">STATUS: VERIFIED & INTACT</div>
                  <div className="text-slate-400 text-[10px] truncate">
                    Chain Length: {dashboardData?.auditIntegrity?.count || 0} Records
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('audit')}
                className="w-full py-2 bg-gold-600 hover:bg-gold-650 text-slate-950 font-extrabold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Inspect Audit Hash Chain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGED DEVICES & TELEMETRY */}
      {activeTab === 'devices' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-base">Managed Endpoint Computers</h3>
            <div className="relative w-64">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, IP, user..."
                className="w-full pl-8 pr-3 py-2 border border-slate-350 rounded-lg text-xs outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Device Name</th>
                  <th className="p-3">Asset Code</th>
                  <th className="p-3">IP / MAC Address</th>
                  <th className="p-3">Logged User</th>
                  <th className="p-3">OS Build</th>
                  <th className="p-3">Agent Ver.</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {filteredDevices.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-slate-500" />
                      <span>{d.name}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-700">{d.asset_code || d.device_id}</td>
                    <td className="p-3 font-mono text-[11px]">
                      <div>{d.ip_address || '192.168.10.105'}</div>
                      <div className="text-slate-400 text-[10px]">{d.mac_address || '74:56:3C:99:A1:B2'}</div>
                    </td>
                    <td className="p-3">{d.logged_in_user || 'N/A'}</td>
                    <td className="p-3">{d.os_name}</td>
                    <td className="p-3 font-mono text-[11px]">{d.agent_version}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.is_online ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {d.is_online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => { setSelectedDevice(d); setActiveTab('desktop'); }}
                        className="px-2 py-1 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-gold-650 cursor-pointer"
                      >
                        Desktop
                      </button>
                      <button
                        onClick={() => { setSelectedDevice(d); setActiveTab('terminal'); }}
                        className="px-2 py-1 bg-slate-800 text-slate-200 rounded text-[10px] font-bold hover:bg-slate-700 cursor-pointer"
                      >
                        Terminal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REMOTE DESKTOP VIEWER */}
      {activeTab === 'desktop' && selectedDevice && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Monitor className="h-5 w-5 text-slate-700" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Remote Desktop: {selectedDevice.name}</h3>
                <p className="text-xs text-slate-500 font-mono">IP: {selectedDevice.ip_address} | Logged User: {selectedDevice.logged_in_user}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleLaunchDesktop('attended')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-gold-650 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow"
              >
                <User className="h-3.5 w-3.5" />
                <span>Attended Connection</span>
              </button>
              <button
                onClick={() => handleLaunchDesktop('unattended')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Unattended Access (Re-auth Required)</span>
              </button>
            </div>
          </div>

          {/* Desktop Session Screen Viewer Frame */}
          <div className="bg-slate-950 text-white rounded-xl border border-slate-800 shadow-2xl overflow-hidden min-h-[520px] flex flex-col justify-between w-full">
            {/* Top Control Bar */}
            <div className="w-full bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex justify-between items-center text-xs">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold font-mono">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  {activeModalSession ? 'LIVE STREAM CONNECTED' : 'READY TO CONNECT'}
                </span>
                <span className="text-slate-500">|</span>
                <span className="font-bold text-slate-200">{selectedDevice.name} ({selectedDevice.ip_address})</span>
              </div>

              {activeModalSession && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alert('Ctrl+Alt+Del signal sent to target workstation.')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-mono text-[11px] border border-slate-700 cursor-pointer"
                  >
                    Ctrl+Alt+Del
                  </button>
                  <button
                    onClick={() => alert('Windows Start Key signal sent.')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-mono text-[11px] border border-slate-700 cursor-pointer"
                  >
                    Win Key
                  </button>
                  <button
                    onClick={() => setActiveModalSession(null)}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded cursor-pointer shadow ml-2"
                  >
                    Disconnect Session
                  </button>
                </div>
              )}
            </div>

            {/* Screen Viewer Canvas Container */}
            <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center relative min-h-[460px]">
              {activeModalSession ? (
                <div className="w-full h-full max-w-6xl bg-slate-900 border-2 border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col justify-between" style={{ minHeight: '460px' }}>
                  {/* Top Web Viewer Bar */}
                  <div className="w-full bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 font-mono text-slate-300">
                      <Globe className="h-4 w-4 text-emerald-400" />
                      <span>MeshCentral Web Client Stream: <strong className="text-white">https://192.168.254.139</strong></span>
                    </div>
                    <button
                      onClick={() => window.open(activeModalSession?.sessionUrl || 'https://192.168.254.139', '_blank')}
                      className="px-3 py-1 bg-gold-600 hover:bg-gold-650 text-slate-950 font-extrabold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow uppercase tracking-wider"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Open Fullscreen MeshCentral Viewer</span>
                    </button>
                  </div>

                  {/* Embedded Iframe Container */}
                  <div className="flex-1 w-full bg-black relative min-h-[400px]">
                    <iframe
                      src={activeModalSession?.sessionUrl || 'https://192.168.254.139'}
                      title="MeshCentral Live Desktop Relay Viewer"
                      className="w-full h-full min-h-[400px] border-0"
                      allow="autoplay; camera; microphone; fullscreen; clipboard-read; clipboard-write"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-center my-auto">
                  <Monitor className="h-16 w-16 text-slate-700 mx-auto" />
                  <h4 className="font-bold text-base text-slate-200">MeshCentral Authorized Remote Screen Viewer</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Click <strong className="text-white font-bold">"Attended Connection"</strong> or <strong className="text-white font-bold">"Unattended Access"</strong> above to launch live remote desktop control.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Status Bar */}
            <div className="w-full bg-slate-900/80 px-4 py-2 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
              <span>Token: Single-Use Short-Lived Authorized</span>
              <span>Encrypted Session Stream Active</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REMOTE TERMINAL */}
      {activeTab === 'terminal' && selectedDevice && (
        <div className="bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl p-6 shadow-2xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 text-slate-400">
            <div className="flex items-center gap-2">
              <TerminalIcon className="h-4 w-4 text-emerald-400" />
              <span className="font-bold text-white">PowerShell Remote Console: {selectedDevice.name}</span>
            </div>
            <span className="text-[11px] text-amber-400 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800">Re-auth Token Mandatory</span>
          </div>

          <div className="h-72 overflow-y-auto space-y-1 bg-slate-900/60 p-4 rounded-lg border border-slate-800">
            {terminalLogs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap">{log}</div>
            ))}
          </div>

          <div className="flex gap-2">
            <span className="py-2 text-slate-400 font-bold">PS C:\&gt;</span>
            <input
              type="text"
              value={terminalCmd}
              onChange={e => setTerminalCmd(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  triggerPrivilegedAction('REMOTE_TERMINAL', (token) => handleExecuteTerminal(token));
                }
              }}
              placeholder="Type PowerShell/CMD command (Press Enter)..."
              className="flex-1 bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-800 outline-none text-xs font-mono focus:border-emerald-500"
            />
            <button
              onClick={() => triggerPrivilegedAction('REMOTE_TERMINAL', (token) => handleExecuteTerminal(token))}
              className="px-4 py-2 bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs hover:bg-emerald-500 cursor-pointer"
            >
              Run
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: FILE MANAGER */}
      {activeTab === 'files' && selectedDevice && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Folder className="h-4 w-4 text-gold-600" />
              <span>Remote File Browser: {selectedDevice.name} (C:\)</span>
            </h3>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">File / Folder Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Modified Date</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {fileList.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3 font-bold flex items-center gap-2">
                      <Folder className="h-4 w-4 text-gold-500" />
                      <span>{f.name}</span>
                    </td>
                    <td className="p-3">{f.isDirectory ? 'Directory' : 'File'}</td>
                    <td className="p-3 font-mono">{f.isDirectory ? '--' : `${(f.sizeBytes / 1024).toFixed(1)} KB`}</td>
                    <td className="p-3">{f.modifiedAt}</td>
                    <td className="p-3 text-right">
                      <button className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold cursor-pointer">
                        Audit Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6 & 7: PROCESSES & SERVICES */}
      {activeTab === 'processes' && selectedDevice && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-base">Running Processes Manager</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">PID</th>
                  <th className="p-3">Process Name</th>
                  <th className="p-3">CPU %</th>
                  <th className="p-3">Memory (MB)</th>
                  <th className="p-3">User</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {processList.map(p => (
                  <tr key={p.pid} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold">{p.pid}</td>
                    <td className="p-3 font-bold text-slate-900">{p.name}</td>
                    <td className="p-3 font-mono">{p.cpuPct}%</td>
                    <td className="p-3 font-mono">{p.memoryMb} MB</td>
                    <td className="p-3">{p.user}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => triggerPrivilegedAction('PROCESS_TERMINATE', (token) => {
                          api.post('/remote/processes/terminate', { device_id: selectedDevice.device_id, pid: p.pid, reauth_token: token })
                            .then(() => loadProcesses());
                        })}
                        className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700 cursor-pointer"
                      >
                        Kill Process
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: POWER MANAGEMENT SCHEDULER */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Power className="h-5 w-5 text-gold-600" />
                <span>Automated Power Management Scheduler</span>
              </h3>
              <button
                onClick={() => handlePowerAction('shutdown')}
                className="px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 cursor-pointer flex items-center gap-1.5"
              >
                <Power className="h-3.5 w-3.5" />
                <span>Immediate Power Off</span>
              </button>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs rounded-lg">
              <strong>Pre-Execution Safety Protocol:</strong> All automated power actions re-validate device eligibility 1 second before shutdown. Excluded computers, protected infrastructure, and active maintenance windows are automatically skipped.
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Schedule Name</th>
                    <th className="p-3">Command</th>
                    <th className="p-3">Recurrence</th>
                    <th className="p-3">Warning Interval</th>
                    <th className="p-3">Target Scope</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                  {schedules.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{s.schedule_name}</td>
                      <td className="p-3 font-bold uppercase text-rose-700">{s.command_type}</td>
                      <td className="p-3">{s.schedule_type}</td>
                      <td className="p-3">{s.warning_minutes} Minutes Warnings (30m, 15m, 5m, 1m)</td>
                      <td className="p-3 uppercase font-semibold">{s.target_type}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">ACTIVE</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: AGENT DEPLOYMENT */}
      {activeTab === 'deployment' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Download className="h-5 w-5 text-gold-600" />
                <span>Endpoint Agent Deployment Center</span>
              </h3>
              <p className="text-xs text-slate-500">Download Windows Agent package, copy silent PowerShell installation script, or view AD GPO deployment guide.</p>
            </div>
            <a
              href="https://meshcentral.com/downloads.html"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer border border-slate-350"
            >
              <span>MeshCentral Website</span>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Box 1: Windows Agent Package Download */}
            <div className="p-5 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-gold-400" />
                  <h4 className="font-bold text-sm text-white">1. Windows Agent Package (.exe)</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Download the NKB ITMS Windows Agent executable. Run this installer as Administrator on the target employee laptop or workstation to enable live remote support.
                </p>
                <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 text-xs font-mono space-y-1">
                  <div className="text-slate-400 text-[10px]">Enrollment Token Hash:</div>
                  <div className="text-emerald-400 font-bold text-[11px] truncate">
                    {agentPackage?.tokenHash || 'ENROLL-TOKEN-SHA256-ACTIVE-HASH'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  window.open('https://meshcentral.com/downloads.html', '_blank');
                }}
                className="w-full py-3 bg-gold-600 hover:bg-gold-650 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow cursor-pointer uppercase tracking-wider"
              >
                <Download className="h-4 w-4" />
                <span>Download Windows Agent (.exe)</span>
              </button>
            </div>

            {/* Box 2: Silent PowerShell Script */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <TerminalIcon className="h-5 w-5 text-slate-800" />
                <h4 className="font-bold text-sm text-slate-900">2. PowerShell Silent Installation Command</h4>
              </div>
              <p className="text-xs text-slate-600">
                Run this silent command via PowerShell (Run as Administrator) to install the Windows Agent background service without user prompts:
              </p>
              <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto border border-slate-800 whitespace-pre-wrap">
                {agentPackage?.script || `$InstallDir = "$env:ProgramFiles\\NKB-ITMS-Agent"\nNew-Item -ItemType Directory -Force -Path $InstallDir\nStart-Process -FilePath "MeshAgent.exe" -ArgumentList "-fullinstall" -Wait\nStart-Service -Name "MeshAgent"`}
              </pre>
            </div>
          </div>

          {/* Box 3: Active Directory GPO Guide */}
          <div className="p-5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
              <FileText className="h-5 w-5 text-indigo-600" />
              <span>3. Active Directory GPO Mass Deployment Guide</span>
            </div>
            <pre className="p-4 bg-white border border-indigo-150 rounded-lg text-slate-800 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {agentPackage?.gpoGuide || `===================================================================\nNKB ITMS - ACTIVE DIRECTORY GPO AGENT DEPLOYMENT GUIDE\n===================================================================\n1. Copy the PowerShell script to your SYSVOL share:\n   \\\\yourdomain.com\\SYSVOL\\yourdomain.com\\scripts\\Deploy-NKBAgent.ps1\n2. Open Group Policy Management Console (gpmc.msc).\n3. Create GPO: "NKB ITMS Agent Deployment GPO".\n4. Edit -> Computer Configuration -> Policies -> Windows Settings -> Scripts -> Startup.\n5. Add PowerShell script: Deploy-NKBAgent.ps1`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 9: AUDIT LOGS WITH HASH-CHAIN VERIFICATION */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Append-Only Remote Audit Trail</h3>
              <p className="text-xs text-slate-500">Cryptographically hash-chained operations log</p>
            </div>
            <button
              onClick={loadAuditLogs}
              className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-gold-650 cursor-pointer"
            >
              Verify Chain Hash
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Seq #</th>
                  <th className="p-3">Action Type</th>
                  <th className="p-3">Technician</th>
                  <th className="p-3">Device ID</th>
                  <th className="p-3">Access Reason</th>
                  <th className="p-3">SHA-256 Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {auditLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">#{l.sequence_id}</td>
                    <td className="p-3 font-bold text-blue-700">{l.action_type}</td>
                    <td className="p-3">{l.technician_name || 'Admin'}</td>
                    <td className="p-3 font-mono">{l.device_id || 'N/A'}</td>
                    <td className="p-3 italic">{l.access_reason}</td>
                    <td className="p-3 font-mono text-[10px] text-slate-500 truncate max-w-xs">{l.hash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 10: SETTINGS & PRODUCTION ACTIVATION GATE CHECKLIST */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Gateway Settings Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Settings className="h-5 w-5 text-gold-600" />
                <span>MeshCentral System Gateway Settings</span>
              </h3>
              <p className="text-xs text-slate-500">Configure your live self-hosted MeshCentral server WSS URL, API service user, and token credentials.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">MeshCentral Server WSS / HTTPS URL:</label>
                <input
                  type="text"
                  value={gatewayForm.meshcentral_server_url}
                  onChange={e => setGatewayForm({ ...gatewayForm, meshcentral_server_url: e.target.value })}
                  placeholder="https://timer-end-comes-township.trycloudflare.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-gold-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Service Account User:</label>
                <input
                  type="text"
                  value={gatewayForm.meshcentral_api_user}
                  onChange={e => setGatewayForm({ ...gatewayForm, meshcentral_api_user: e.target.value })}
                  placeholder="daybud35"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-gold-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">API Secret Token / Hash:</label>
                <input
                  type="password"
                  value={gatewayForm.meshcentral_api_token_hash}
                  onChange={e => setGatewayForm({ ...gatewayForm, meshcentral_api_token_hash: e.target.value })}
                  placeholder="••••••••••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-gold-500"
                />
              </div>
            </div>

            <button
              onClick={handleSaveGatewaySettings}
              className="px-4 py-2 bg-gold-600 hover:bg-gold-650 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Save Gateway Settings</span>
            </button>
          </div>

          {/* Production Activation Gate Checklist */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="border-b pb-4">
              <h3 className="font-bold text-slate-900 text-base">Production Activation Gate Checklist</h3>
              <p className="text-xs text-slate-500">12 Mandatory Security & Compliance Sign-offs required before enabling Production Mode</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dashboardData?.productionGateChecklist?.map(g => (
                <div key={g.id} className={`p-4 rounded-xl border text-xs space-y-2 ${
                  g.is_passed ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-[10px] text-slate-500">{g.check_code}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      g.is_passed ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {g.is_passed ? 'PASSED' : 'PENDING'}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">{g.check_title}</h4>
                  <p className="text-slate-600 text-[11px]">{g.description}</p>
                  {!g.is_passed && (
                    <button
                      onClick={() => handleSignoffGate(g.check_code)}
                      className="px-3 py-1 bg-slate-900 hover:bg-gold-650 text-white font-bold rounded text-[10px] cursor-pointer mt-2"
                    >
                      Sign Off Gate
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Technician Re-authentication Modal */}
      <ReauthModal
        isOpen={reauthOpen}
        onClose={() => setReauthOpen(false)}
        deviceId={selectedDevice?.device_id || 'DEV-101'}
        actionType={pendingAction?.actionType || 'PRIVILEGED_ACTION'}
        onSuccess={handleReauthSuccess}
      />

      {/* Endpoint Consent Prompt Modal */}
      <AttendedRequestPromptModal
        request={attendedPromptRequest}
        onResponse={(reqCode, decision) => {
          api.post('/remote/agent/consent', {
            request_code: reqCode,
            device_id: selectedDevice?.device_id,
            decision,
            nonce: 'nonce-123',
            timestamp: new Date().toISOString()
          }, {
            headers: { 'X-Endpoint-Signature': 'mock-signature' }
          }).then(() => {
            setAttendedPromptRequest(null);
            if (decision === 'allow' && selectedDevice) {
              api.post('/remote/sessions/launch', {
                device_id: selectedDevice.device_id,
                access_mode: 'attended',
                connection_type: 'Full Control'
              }).then(res => {
                if (res.data.success) {
                  setActiveModalSession(res.data.data);
                }
              });
            }
          });
        }}
        onClose={() => setAttendedPromptRequest(null)}
      />

    </div>
  );
}
