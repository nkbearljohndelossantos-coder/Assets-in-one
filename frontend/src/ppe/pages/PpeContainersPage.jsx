import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { 
  Package, Plus, Search, Filter, ArrowRightLeft, 
  CheckCircle2, Clock, AlertTriangle, Truck, History 
} from 'lucide-react';

function statusBadge(s) {
  if (s === 'AVAILABLE') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'CHECKED_OUT') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (s === 'IN_TRANSIT') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (s === 'DAMAGED') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function PpeContainersPage() {
  const [containers, setContainers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementContainer, setMovementContainer] = useState(null);

  const [addForm, setAddForm] = useState({
    containerCode: '',
    containerType: 'Steel Drum 200L',
    description: '',
    barcode: '',
    status: 'AVAILABLE',
    currentHolder: '',
    location: 'Central Warehouse'
  });

  const [moveForm, setMoveForm] = useState({
    action: 'CHECK_OUT',
    toLocation: '',
    releasedTo: '',
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;

      const [cRes, sRes] = await Promise.all([
        api.get('/ppe/containers', { params }),
        api.get('/ppe/containers/stats')
      ]);
      setContainers(cRes.data.data || []);
      setStats(sRes.data.data || null);
    } catch (err) {
      console.error('Failed to load returnable containers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/ppe/containers', addForm);
      setShowAddModal(false);
      setAddForm({
        containerCode: '',
        containerType: 'Steel Drum 200L',
        description: '',
        barcode: '',
        status: 'AVAILABLE',
        currentHolder: '',
        location: 'Central Warehouse'
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register container');
    }
  };

  const handleMovementSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/ppe/containers/${movementContainer.id}/movements`, moveForm);
      setShowMovementModal(false);
      setMoveForm({ action: 'CHECK_OUT', toLocation: '', releasedTo: '', notes: '' });
      fetchData();
      if (selectedContainer?.id === movementContainer.id) {
        loadContainerDetails(movementContainer.id);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record movement');
    }
  };

  const loadContainerDetails = async (id) => {
    try {
      const res = await api.get(`/ppe/containers/${id}`);
      setSelectedContainer(res.data.data);
    } catch (err) {
      console.error('Failed to load container details:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" />
            <span>Returnable Containers & Vessels</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Industrial asset tracking for returnable IBC totes, chemical drums, gas cylinders, and transport crates
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Register Container</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Total Units</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{stats?.total || 0}</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase">Available</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{stats?.available || 0}</div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-blue-600 uppercase">Checked Out</div>
          <div className="text-xl font-bold text-blue-700 mt-1">{stats?.checkedOut || 0}</div>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-indigo-600 uppercase">In Transit</div>
          <div className="text-xl font-bold text-indigo-700 mt-1">{stats?.inTransit || 0}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-amber-600 uppercase">Damaged / Maint.</div>
          <div className="text-xl font-bold text-amber-700 mt-1">{stats?.damaged || 0}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search code, type, holder, location..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
          />
        </div>
        <select
          className="py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="AVAILABLE">AVAILABLE</option>
          <option value="CHECKED_OUT">CHECKED_OUT</option>
          <option value="IN_TRANSIT">IN_TRANSIT</option>
          <option value="DAMAGED">DAMAGED</option>
        </select>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
        >
          Filter
        </button>
      </div>

      {/* Main Containers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type & Description</th>
                <th className="px-4 py-3">Barcode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Current Holder / Location</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">Loading returnable containers...</td>
                </tr>
              ) : containers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">No returnable containers found.</td>
                </tr>
              ) : (
                containers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-indigo-600 whitespace-nowrap">{c.container_code}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{c.container_type}</div>
                      <div className="text-[11px] text-slate-400">{c.description || 'No description'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.barcode || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{c.current_holder || 'In Storage'}</div>
                      <div className="text-[11px] text-slate-400">{c.location || 'Location unassigned'}</div>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setMovementContainer(c);
                            setMoveForm({
                              action: c.status === 'AVAILABLE' ? 'CHECK_OUT' : 'CHECK_IN',
                              toLocation: c.location || '',
                              releasedTo: c.current_holder || '',
                              notes: ''
                            });
                            setShowMovementModal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          <span>Move</span>
                        </button>
                        <button
                          onClick={() => loadContainerDetails(c.id)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                          title="View History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement Details Drawer / Modal */}
      {selectedContainer && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Movement History for {selectedContainer.container_code} ({selectedContainer.container_type})
              </h3>
              <p className="text-xs text-slate-500">Current Location: {selectedContainer.location} • Status: {selectedContainer.status}</p>
            </div>
            <button
              onClick={() => setSelectedContainer(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Action</th>
                  <th className="pb-2">From</th>
                  <th className="pb-2">To Location</th>
                  <th className="pb-2">Released To</th>
                  <th className="pb-2">Recorded By</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedContainer.movements?.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2.5 whitespace-nowrap text-slate-600">{dayjs(m.created_at).format('YYYY-MM-DD HH:mm')}</td>
                    <td className="py-2.5 font-bold text-indigo-600 whitespace-nowrap">{m.action}</td>
                    <td className="py-2.5 text-slate-600">{m.from_location || '—'}</td>
                    <td className="py-2.5 font-semibold text-slate-900">{m.to_location}</td>
                    <td className="py-2.5 text-slate-700">{m.released_to}</td>
                    <td className="py-2.5 text-slate-500">{m.recorded_by_username || 'Staff'}</td>
                    <td className="py-2.5 text-slate-500">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Movement Modal */}
      {showMovementModal && movementContainer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Record Container Movement</h3>
            <p className="text-xs text-slate-500">{movementContainer.container_code} ({movementContainer.container_type})</p>

            <form onSubmit={handleMovementSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Movement Action *</label>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  value={moveForm.action}
                  onChange={(e) => setMoveForm({ ...moveForm, action: e.target.value })}
                >
                  <option value="CHECK_OUT">CHECK_OUT (Issue to Floor / Department)</option>
                  <option value="CHECK_IN">CHECK_IN (Returned to Warehouse)</option>
                  <option value="TRANSFER">TRANSFER (Inter-plant Transit)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Taken out for cleaning / repair)</option>
                  <option value="STATUS_CHANGE">STATUS_CHANGE (Update status)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Location *</label>
                <input
                  type="text"
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. Factory Floor Bay 4"
                  value={moveForm.toLocation}
                  onChange={(e) => setMoveForm({ ...moveForm, toLocation: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Received By / Custodian *</label>
                <input
                  type="text"
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. Jane Smith (Production Supervisor)"
                  value={moveForm.releasedTo}
                  onChange={(e) => setMoveForm({ ...moveForm, releasedTo: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Movement Notes</label>
                <textarea
                  rows="2"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Batch ticket or transfer reason"
                  value={moveForm.notes}
                  onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Save Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Container Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Register New Returnable Container</h3>
            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Container Code *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. CNT-2026-0005"
                    value={addForm.containerCode}
                    onChange={(e) => setAddForm({ ...addForm, containerCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Container Type *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. Steel Drum 200L"
                    value={addForm.containerType}
                    onChange={(e) => setAddForm({ ...addForm, containerType: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Barcode / Tracking ID</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. BC-CNT-005"
                  value={addForm.barcode}
                  onChange={(e) => setAddForm({ ...addForm, barcode: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Location</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={addForm.location}
                    onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Custodian</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. Warehouse Custodian"
                    value={addForm.currentHolder}
                    onChange={(e) => setAddForm({ ...addForm, currentHolder: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description & Material Specs</label>
                <textarea
                  rows="2"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Material, capacity, and hazardous cargo compatibility"
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Register Container
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
