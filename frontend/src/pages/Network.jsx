import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Network, Wifi, Server, Plus, Search, Filter, Edit, 
  Trash2, X, ShieldCheck, AlertCircle, User, Cpu, 
  Activity, Layers, Hash, Link2, CheckCircle2, XCircle
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function NetworkPage() {
  const { hasPermission, showToast } = useAuth();
  
  // Navigation Tabs: 'allocations' | 'devices' | 'wifi'
  const [activeTab, setActiveTab] = useState('allocations');

  // Datasets
  const [allocations, setAllocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [wifiNodes, setWifiNodes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Modal State Controls
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'allocations') {
        const res = await api.get('/network/assignments', { params: { page, search } });
        if (res.data.assignments) {
          setAllocations(res.data.assignments);
          setPagination(res.data.pagination || { total: res.data.assignments.length, pages: 1, limit: 10 });
        }
      } else if (activeTab === 'devices') {
        const res = await api.get('/network/devices', { params: { page, search } });
        if (res.data.devices) {
          setDevices(res.data.devices);
          setPagination(res.data.pagination || { total: res.data.devices.length, pages: 1, limit: 10 });
        }
      } else if (activeTab === 'wifi') {
        const res = await api.get('/network/wifi', { params: { page, search } });
        if (res.data.wifiNodes) {
          setWifiNodes(res.data.wifiNodes);
          setPagination(res.data.pagination || { total: res.data.wifiNodes.length, pages: 1, limit: 10 });
        }
      }

      // Metadata dropdowns
      const empRes = await api.get('/employees', { params: { limit: 100 } });
      if (empRes.data.success) setEmployees(empRes.data.data.employees);

      const astRes = await api.get('/assets', { params: { limit: 100 } });
      if (astRes.data.success) setAssets(astRes.data.data.assets);
    } catch (err) {
      showToast('Error', 'Failed to retrieve network registry.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabData();
  }, [activeTab, page, search]);

  const openAddModal = () => {
    setEditingItem(null);
    reset({
      ip_address: '192.168.1.',
      mac_address: '',
      vlan: 'VLAN 10',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      device_name: '',
      device_type: 'Switch',
      brand: 'Cisco',
      model: '',
      access_point_name: '',
      ssid: '',
      building: 'Main Plant',
      floor: 'Ground Floor'
    });
    setModalOpen(true);
  };

  const openEditModal = (item, e) => {
    if (e) e.stopPropagation();
    setEditingItem(item);
    reset({
      ...item,
      employee_id: item.employee_id ? String(item.employee_id) : '',
      asset_id: item.asset_id ? String(item.asset_id) : '',
      switch_id: item.switch_id ? String(item.switch_id) : ''
    });
    setModalOpen(true);
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (activeTab === 'allocations') {
        const payload = {
          employee_id: parseInt(data.employee_id),
          asset_id: data.asset_id ? parseInt(data.asset_id) : null,
          ip_address: data.ip_address,
          mac_address: data.mac_address,
          switch_port: data.switch_port || null,
          vlan: data.vlan || null,
          subnet: data.subnet || null,
          gateway: data.gateway || null
        };
        if (editingItem) {
          await api.put(`/network/assignments/${editingItem.id}`, payload);
          showToast('Updated', 'IP & MAC address allocation updated.', 'success');
        } else {
          await api.post('/network/assignments', payload);
          showToast('Allocated', 'New static IP & MAC allocation registered.', 'success');
        }
      } else if (activeTab === 'devices') {
        const payload = {
          device_name: data.device_name,
          device_type: data.device_type,
          brand: data.brand,
          model: data.model,
          status: data.status || 'Online',
          remarks: data.remarks || null,
          ip_address: data.ip_address || null,
          mac_address: data.mac_address || null,
          vlan: data.vlan || null,
          subnet: data.subnet || null,
          gateway: data.gateway || null
        };
        if (editingItem) {
          await api.put(`/network/devices/${editingItem.id}`, payload);
          showToast('Updated', 'Network device profile updated.', 'success');
        } else {
          await api.post('/network/devices', payload);
          showToast('Registered', 'New network device registered.', 'success');
        }
      } else if (activeTab === 'wifi') {
        const payload = {
          access_point_name: data.access_point_name,
          ssid: data.ssid,
          building: data.building || null,
          floor: data.floor || null,
          coverage_area: data.coverage_area || null,
          channel: data.channel || null,
          status: data.status || 'Active',
          ip_address: data.ip_address || null,
          vlan: data.vlan || null,
          subnet: data.subnet || null,
          gateway: data.gateway || null
        };
        if (editingItem) {
          await api.put(`/network/wifi/${editingItem.id}`, payload);
          showToast('Updated', 'Wi-Fi Access Point updated.', 'success');
        } else {
          await api.post('/network/wifi', payload);
          showToast('Registered', 'New Wi-Fi AP registered.', 'success');
        }
      }

      setModalOpen(false);
      reset();
      loadTabData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to save network configuration.';
      showToast('Conflict / Error', msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove '${name}' from network registry?`)) return;
    try {
      if (activeTab === 'allocations') await api.delete(`/network/assignments/${id}`);
      else if (activeTab === 'devices') await api.delete(`/network/devices/${id}`);
      else if (activeTab === 'wifi') await api.delete(`/network/wifi/${id}`);
      
      showToast('Removed', 'Network record removed.', 'success');
      loadTabData();
    } catch (err) {
      showToast('Error', 'Failed to remove record.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Network className="h-6 w-6 text-gold-600" />
            <span>Network & IP Address Registry</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Manage static IP allocations, MAC addresses, switches, routers, and Wi-Fi access points.</p>
        </div>

        {hasPermission('network.manage') && (
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>
              {activeTab === 'allocations' ? 'Assign IP / MAC' : activeTab === 'devices' ? 'Register Switch / Router' : 'Register Wi-Fi AP'}
            </span>
          </button>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 gap-2 select-none">
        <button
          onClick={() => { setActiveTab('allocations'); setPage(1); }}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'allocations' 
              ? 'border-gold-600 text-slate-900' 
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Hash className="h-4 w-4 text-gold-600" />
          <span>IP & MAC Allocations</span>
        </button>

        <button
          onClick={() => { setActiveTab('devices'); setPage(1); }}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'devices' 
              ? 'border-gold-600 text-slate-900' 
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Server className="h-4 w-4 text-gold-600" />
          <span>Hardware Switches & Routers</span>
        </button>

        <button
          onClick={() => { setActiveTab('wifi'); setPage(1); }}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'wifi' 
              ? 'border-gold-600 text-slate-900' 
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Wifi className="h-4 w-4 text-gold-600" />
          <span>Wi-Fi Access Points</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search IP address, MAC address, employee, device model, or SSID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-xs text-slate-900"
          />
        </div>
      </div>

      {/* Content View */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
        </div>
      ) : activeTab === 'allocations' ? (
        /* ==========================================
           TAB 1: USER IP & MAC ALLOCATIONS TABLE
           ========================================== */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider select-none">
                <tr>
                  <th className="p-3.5 font-extrabold">IP Address</th>
                  <th className="p-3.5 font-extrabold">MAC Address</th>
                  <th className="p-3.5 font-extrabold">Assigned Employee</th>
                  <th className="p-3.5 font-extrabold">Workstation Asset</th>
                  <th className="p-3.5 font-extrabold">VLAN & Gateway</th>
                  <th className="p-3.5 font-extrabold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {allocations && allocations.length > 0 ? (
                  allocations.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-mono font-extrabold text-slate-900">
                        {item.ip_address}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-700">
                        {item.mac_address}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {item.employee_name ? `${item.employee_name} (${item.employee_number || ''})` : 'Unassigned'}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-700">
                        {item.asset_name ? `${item.asset_name} (${item.asset_code})` : 'N/A'}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        <span className="font-bold text-slate-800">{item.vlan || 'Default'}</span>
                        {item.gateway && <span className="block text-[10px] text-slate-400 font-mono">GW: {item.gateway}</span>}
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        {hasPermission('network.manage') && (
                          <button onClick={(e) => openEditModal(item, e)} className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer">
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {hasPermission('network.manage') && (
                          <button onClick={(e) => handleDelete(item.id, item.ip_address, e)} className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      No static IP allocations registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'devices' ? (
        /* ==========================================
           TAB 2: HARDWARE SWITCHES & ROUTERS
           ========================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {devices && devices.length > 0 ? (
            devices.map(dev => (
              <div key={dev.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">{dev.device_name}</h3>
                    <p className="text-xs font-semibold text-slate-500">{dev.brand} {dev.model}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    dev.status === 'Online' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {dev.status}
                  </span>
                </div>

                <div className="bg-slate-50 border p-3 rounded-lg text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans text-[10px]">Type:</span>
                    <span className="font-bold text-slate-800 font-sans">{dev.device_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans text-[10px]">IP Address:</span>
                    <span className="font-bold text-slate-900">{dev.ip_address || 'Unset'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans text-[10px]">MAC:</span>
                    <span className="font-bold text-slate-700">{dev.mac_address || 'Unset'}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-150">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">{dev.vlan || 'VLAN 1'}</span>
                  <div className="flex gap-1">
                    {hasPermission('network.manage') && (
                      <button onClick={(e) => openEditModal(dev, e)} className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {hasPermission('network.manage') && (
                      <button onClick={(e) => handleDelete(dev.id, dev.device_name, e)} className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full p-12 bg-white border rounded-xl text-center text-slate-400">
              No hardware switches or routers registered.
            </div>
          )}
        </div>
      ) : (
        /* ==========================================
           TAB 3: WI-FI ACCESS POINTS
           ========================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {wifiNodes && wifiNodes.length > 0 ? (
            wifiNodes.map(ap => (
              <div key={ap.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                      <Wifi className="h-4 w-4 text-gold-600" />
                      <span>{ap.access_point_name}</span>
                    </h3>
                    <p className="text-xs font-semibold text-slate-500">SSID: <b className="text-slate-900">{ap.ssid}</b></p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    ap.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {ap.status}
                  </span>
                </div>

                <div className="bg-slate-50 border p-3 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-[10px] font-bold">Location:</span>
                    <span className="font-bold text-slate-800">{ap.building} - {ap.floor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-[10px] font-bold">AP IP Address:</span>
                    <span className="font-mono font-bold text-slate-900">{ap.ip_address || 'DHCP'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-[10px] font-bold">Coverage:</span>
                    <span className="font-semibold text-slate-700">{ap.coverage_area || 'Plant-wide'}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-1 pt-2 border-t border-slate-150">
                  {hasPermission('network.manage') && (
                    <button onClick={(e) => openEditModal(ap, e)} className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {hasPermission('network.manage') && (
                    <button onClick={(e) => handleDelete(ap.id, ap.access_point_name, e)} className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full p-12 bg-white border rounded-xl text-center text-slate-400">
              No Wi-Fi Access Points registered.
            </div>
          )}
        </div>
      )}

      {/* Pagination control */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl select-none">
          <span className="text-xs text-slate-500 font-medium">
            Page {pagination.page} of {pagination.pages} ({pagination.total} records total)
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

      {/* MODAL: ADD / EDIT ENTRY */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">
                {editingItem ? 'Edit Profile' : 'Register Entry'} ({activeTab.toUpperCase()})
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleSave)} className="p-6 space-y-4 text-xs font-semibold">
              
              {/* TAB 1: ALLOCATIONS FORM */}
              {activeTab === 'allocations' && (
                <>
                  <div>
                    <label className="block text-slate-500 mb-1">Assigned Employee *</label>
                    <select {...register('employee_id', { required: true })} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                      <option value="">-- Choose Employee --</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.full_name || `${e.first_name} ${e.last_name}`} ({e.employee_number})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">Workstation Asset (Optional)</label>
                    <select {...register('asset_id')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                      <option value="">-- Choose Hardware Asset --</option>
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.asset_code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-1">Static IP Address *</label>
                      <input type="text" {...register('ip_address', { required: true })} placeholder="192.168.1.50" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">MAC Address *</label>
                      <input type="text" {...register('mac_address', { required: true })} placeholder="E4:A8:DF:12:34:56" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1">VLAN</label>
                      <input type="text" {...register('vlan')} placeholder="VLAN 10" className="w-full p-2 border border-slate-350 rounded" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Subnet</label>
                      <input type="text" {...register('subnet')} defaultValue="255.255.255.0" className="w-full p-2 border border-slate-350 rounded font-mono" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Gateway</label>
                      <input type="text" {...register('gateway')} placeholder="192.168.1.1" className="w-full p-2 border border-slate-350 rounded font-mono" />
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: HARDWARE DEVICES FORM */}
              {activeTab === 'devices' && (
                <>
                  <div>
                    <label className="block text-slate-500 mb-1">Device Name *</label>
                    <input type="text" {...register('device_name', { required: true })} placeholder="Core Switch Floor 1" className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1">Device Type *</label>
                      <select {...register('device_type')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                        <option value="Switch">Switch</option>
                        <option value="Router">Router</option>
                        <option value="Firewall">Firewall</option>
                        <option value="Server">Server</option>
                        <option value="Access Point">Access Point</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Brand *</label>
                      <input type="text" {...register('brand', { required: true })} placeholder="Cisco, Aruba..." className="w-full p-2 border border-slate-350 rounded" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Model *</label>
                      <input type="text" {...register('model', { required: true })} placeholder="Catalyst 2960" className="w-full p-2 border border-slate-350 rounded" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-1">Management IP</label>
                      <input type="text" {...register('ip_address')} placeholder="192.168.1.2" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">MAC Address</label>
                      <input type="text" {...register('mac_address')} placeholder="XX:XX:XX:XX:XX:XX" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                    </div>
                  </div>
                </>
              )}

              {/* TAB 3: WI-FI AP FORM */}
              {activeTab === 'wifi' && (
                <>
                  <div>
                    <label className="block text-slate-500 mb-1">Access Point Name *</label>
                    <input type="text" {...register('access_point_name', { required: true })} placeholder="AP-ADMIN-01" className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">SSID Name *</label>
                    <input type="text" {...register('ssid', { required: true })} placeholder="NKB_OFFICE_WIFI" className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-1">Building</label>
                      <input type="text" {...register('building')} placeholder="Main Building" className="w-full p-2 border border-slate-350 rounded" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Floor</label>
                      <input type="text" {...register('floor')} placeholder="2nd Floor" className="w-full p-2 border border-slate-350 rounded" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">AP IP Address</label>
                    <input type="text" {...register('ip_address')} placeholder="192.168.1.10" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                  </div>
                </>
              )}

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
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Save Entry'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
