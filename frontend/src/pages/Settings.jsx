import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Save, Plus, Edit, ShieldAlert, Check, X, Shield, Building, ToggleLeft } from 'lucide-react';

export default function Settings() {
  const { user, showToast } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState('company');

  // Company Settings
  const [settings, setSettings] = useState({
    company_name: '', company_address: '', company_contact: '',
    company_email: '', system_timezone: 'Asia/Manila', system_currency: 'PHP'
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Category & Metadata CRUD State
  const [metadataType, setMetadataType] = useState('positions'); // positions, asset-cats, ticket-cats, inv-cats
  const [metaItems, setMetaItems] = useState([]);
  const [metaName, setMetaName] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [editingMetaId, setEditingMetaId] = useState(null);

  // Permission Matrix State
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [matrixState, setMatrixState] = useState({}); // { [roleId-permissionId]: boolean }
  const [savingMatrix, setSavingMatrix] = useState(false);

  const isSuperAdmin = user?.roles?.includes('Super Admin');

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings');
      if (response.data.success) {
        setSettings(prev => ({ ...prev, ...response.data.data }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadMetadata = async () => {
    try {
      let endpoint = '/settings/positions';
      if (metadataType === 'asset-cats') endpoint = '/settings/asset-categories';
      if (metadataType === 'ticket-cats') endpoint = '/settings/ticket-categories';
      if (metadataType === 'inv-cats') endpoint = '/settings/inventory-categories';

      const response = await api.get(endpoint);
      if (response.data.success) {
        setMetaItems(response.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadPermissionMatrix = async () => {
    if (!isSuperAdmin) return;
    try {
      const rolesRes = await api.get('/users/roles');
      const permRes = await api.get('/users/permissions');
      const mappingsRes = await api.get('/users/role-permissions');

      if (rolesRes.data.success && permRes.data.success && mappingsRes.data.success) {
        setRoles(rolesRes.data.data);
        setPermissions(permRes.data.data);

        // Build mapping state dictionary
        const matrix = {};
        mappingsRes.data.data.forEach(item => {
          matrix[`${item.role_id}-${item.permission_id}`] = true;
        });
        setMatrixState(matrix);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'metadata') {
      loadMetadata();
    } else if (activeTab === 'permissions') {
      loadPermissionMatrix();
    }
  }, [activeTab, metadataType]);

  // Company Settings Save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const res = await api.post('/settings', settings);
      if (res.data.success) {
        showToast('Success', 'Company settings saved successfully.', 'success');
        loadSettings();
      }
    } catch (err) {
      showToast('Error', 'Failed to update company profile settings.', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Metadata CRUD Save
  const handleSaveMetadata = async (e) => {
    e.preventDefault();
    if (!metaName) return;

    try {
      let endpoint = '/settings/positions';
      if (metadataType === 'asset-cats') endpoint = '/settings/asset-categories';
      if (metadataType === 'ticket-cats') endpoint = '/settings/ticket-categories';
      if (metadataType === 'inv-cats') endpoint = '/settings/inventory-categories';

      if (editingMetaId) {
        // Edit Mode
        const res = await api.put(`${endpoint}/${editingMetaId}`, { name: metaName, description: metaDesc });
        if (res.data.success) {
          showToast('Updated', 'Record updated successfully.', 'success');
          setMetaName('');
          setMetaDesc('');
          setEditingMetaId(null);
          loadMetadata();
        }
      } else {
        // Create Mode
        const res = await api.post(endpoint, { name: metaName, description: metaDesc });
        if (res.data.success) {
          showToast('Created', 'Record added successfully.', 'success');
          setMetaName('');
          setMetaDesc('');
          loadMetadata();
        }
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to save metadata.', 'error');
    }
  };

  // Permission Matrix handlers
  const handleMatrixToggle = (roleId, permissionId) => {
    const key = `${roleId}-${permissionId}`;
    setMatrixState(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSavePermissions = async () => {
    setSavingMatrix(true);
    try {
      // Package matrix state back to array of items
      const matrixPayload = [];
      roles.forEach(role => {
        permissions.forEach(perm => {
          const key = `${role.id}-${perm.id}`;
          matrixPayload.push({
            roleId: role.id,
            permissionId: perm.id,
            enabled: !!matrixState[key]
          });
        });
      });

      const res = await api.post('/users/role-permissions', { matrix: matrixPayload });
      if (res.data.success) {
        showToast('Success', 'Permissions matrix saved successfully. Re-login or refresh may be required to sync active sessions.', 'success');
        loadPermissionMatrix();
      }
    } catch (err) {
      showToast('Error', 'Failed to save permission matrix.', 'error');
    } finally {
      setSavingMatrix(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
        <p className="text-xs text-slate-500 mt-1">Configure company profiles, metadata groups, and security permissions.</p>
      </div>

      {/* Tab controls */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold uppercase select-none">
        <button
          onClick={() => setActiveTab('company')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
            activeTab === 'company' ? 'border-gold-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Building className="h-4 w-4" />
          <span>Company Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('metadata')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
            activeTab === 'metadata' ? 'border-gold-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <ToggleLeft className="h-4 w-4" />
          <span>Metadata Configuration</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('permissions')}
            className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
              activeTab === 'permissions' ? 'border-gold-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Permissions Matrix</span>
          </button>
        )}
      </div>

      {/* ==========================================
          TAB CONTENT PANEL 1: COMPANY PROFILE
          ========================================== */}
      {activeTab === 'company' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl">
          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-semibold">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Corporate Settings</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-500 mb-1">Company Name</label>
                <input
                  type="text"
                  value={settings.company_name}
                  onChange={e => setSettings(prev => ({ ...prev, company_name: e.target.value }))}
                  className="w-full p-2 border border-slate-350 rounded text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={settings.company_contact}
                  onChange={e => setSettings(prev => ({ ...prev, company_contact: e.target.value }))}
                  className="w-full p-2 border border-slate-350 rounded text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-500 mb-1">Office Address</label>
                <input
                  type="text"
                  value={settings.company_address}
                  onChange={e => setSettings(prev => ({ ...prev, company_address: e.target.value }))}
                  className="w-full p-2 border border-slate-350 rounded text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Support Email</label>
                <input
                  type="email"
                  value={settings.company_email}
                  onChange={e => setSettings(prev => ({ ...prev, company_email: e.target.value }))}
                  className="w-full p-2 border border-slate-350 rounded text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">System Currency</label>
                <input
                  type="text"
                  value={settings.system_currency}
                  onChange={e => setSettings(prev => ({ ...prev, system_currency: e.target.value }))}
                  className="w-full p-2 border border-slate-350 rounded text-slate-900"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={settingsLoading}
                className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="h-4 w-4" />
                <span>{settingsLoading ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================
          TAB CONTENT PANEL 2: METADATA CRUD
          ========================================== */}
      {activeTab === 'metadata' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Metadata select menu */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">Metadata Groups</h4>
            {[
              { code: 'positions', label: 'Employee Positions' },
              { code: 'asset-cats', label: 'Asset Categories' },
              { code: 'ticket-cats', label: 'Ticket Categories' },
              { code: 'inv-cats', label: 'Inventory Categories' }
            ].map(type => (
              <button
                key={type.code}
                onClick={() => { setMetadataType(type.code); setEditingMetaId(null); setMetaName(''); setMetaDesc(''); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  metadataType === type.code ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-55'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* CRUD Form & Table */}
          <div className="md:col-span-2 space-y-4">
            
            {/* Input Form */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <form onSubmit={handleSaveMetadata} className="space-y-4 text-xs font-semibold">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex justify-between items-center">
                  <span>{editingMetaId ? 'Edit Selected Record' : 'Create New Record'}</span>
                  {editingMetaId && (
                    <button 
                      onClick={() => { setEditingMetaId(null); setMetaName(''); setMetaDesc(''); }}
                      className="text-rose-500 hover:underline text-[10px]"
                    >
                      Clear edit selection
                    </button>
                  )}
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1">Name *</label>
                    <input
                      type="text"
                      value={metaName}
                      onChange={e => setMetaName(e.target.value)}
                      className="w-full p-2 border border-slate-350 rounded text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Description</label>
                    <input
                      type="text"
                      value={metaDesc}
                      onChange={e => setMetaDesc(e.target.value)}
                      className="w-full p-2 border border-slate-350 rounded text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {editingMetaId ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    <span>{editingMetaId ? 'Save Changes' : 'Add Item'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-center">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {metaItems && metaItems.length > 0 ? (
                    metaItems.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                        <td className="py-3 px-4 truncate max-w-[200px]">{item.description || 'No description'}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setEditingMetaId(item.id);
                              setMetaName(item.name);
                              setMetaDesc(item.description || '');
                            }}
                            className="p-1 text-slate-500 hover:text-gold-700 rounded"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400">No items available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ==========================================
          TAB CONTENT PANEL 3: PERMISSIONS MATRIX (Super Admin only)
          ========================================== */}
      {activeTab === 'permissions' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="flex gap-2 items-start text-slate-650 bg-slate-100/50 border border-slate-200 p-3.5 rounded-lg max-w-2xl text-xs leading-relaxed font-medium">
              <ShieldAlert className="h-5 w-5 text-gold-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">Security Control Notice:</span> Updates to this permission matrix directly adjust the capabilities of all users holding the respective roles. Use precaution when toggling core access nodes.
              </div>
            </div>

            <button
              onClick={handleSavePermissions}
              disabled={savingMatrix}
              className="px-5 py-2.5 bg-gold-600 hover:bg-gold-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-gold-650/10 self-end sm:self-start"
            >
              <Save className="h-4 w-4" />
              <span>{savingMatrix ? 'Saving Changes...' : 'Save Matrix'}</span>
            </button>
          </div>

          {/* Matrix table representation */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-250 bg-slate-900 text-white font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 font-extrabold sticky left-0 bg-slate-900 border-r border-slate-800">Permission Node</th>
                    <th className="py-3 px-4 border-r border-slate-800">Description</th>
                    {roles.map(role => (
                      <th key={role.id} className="py-3 px-3 text-center border-r border-slate-800 last:border-0 font-extrabold whitespace-nowrap min-w-[90px]">
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-medium">
                  {permissions.map((perm) => (
                    <tr key={perm.id} className="hover:bg-slate-50/50">
                      {/* Permission Node Code */}
                      <td className="py-2.5 px-4 font-bold text-slate-900 sticky left-0 bg-white border-r border-slate-200 whitespace-nowrap hover:bg-slate-50">
                        {perm.code}
                      </td>
                      {/* Description */}
                      <td className="py-2.5 px-4 text-slate-500 border-r border-slate-200">
                        {perm.description}
                      </td>
                      {/* Checkboxes for each role */}
                      {roles.map((role) => {
                        const cellKey = `${role.id}-${perm.id}`;
                        const isChecked = !!matrixState[cellKey];
                        const isSuperAdminRole = role.name === 'Super Admin';

                        return (
                          <td key={role.id} className="py-2.5 px-3 text-center border-r border-slate-200 last:border-0 bg-slate-50/20">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isSuperAdminRole} // Super Admin is hardlocked to true (bypassed on server anyway)
                              onChange={() => handleMatrixToggle(role.id, perm.id)}
                              className="h-4.5 w-4.5 rounded border-slate-350 text-gold-600 focus:ring-gold-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
