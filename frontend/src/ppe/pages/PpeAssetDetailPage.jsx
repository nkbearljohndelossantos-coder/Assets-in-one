import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Building2, ArrowLeft, Calendar, DollarSign, Wrench, QrCode, 
  Printer, Download, Plus, Edit2, Trash2, CheckCircle, AlertTriangle, Shield
} from 'lucide-react';

function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PpeAssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintForm, setMaintForm] = useState({
    maintenanceDate: new Date().toISOString().slice(0, 10),
    description: '',
    cost: '',
    performedBy: '',
    assetStatus: 'ACTIVE'
  });
  const [savingMaint, setSavingMaint] = useState(false);

  const fetchAsset = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/ppe/assets/${id}`);
      setAsset(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load asset details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsset();
  }, [id]);

  const handleMaintenanceSubmit = async (e) => {
    e.preventDefault();
    setSavingMaint(true);
    try {
      await api.post(`/ppe/maintenance/${asset.id}`, maintForm);
      setShowMaintModal(false);
      setMaintForm({
        maintenanceDate: new Date().toISOString().slice(0, 10),
        description: '',
        cost: '',
        performedBy: '',
        assetStatus: asset.status
      });
      fetchAsset();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to log maintenance');
    } finally {
      setSavingMaint(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <span>Loading capital asset details...</span>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="rounded-2xl bg-white p-8 border border-slate-200 text-center shadow-sm">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 mb-1">Asset Not Found</h3>
        <p className="text-xs text-slate-500 mb-4">{error || 'The requested capital asset does not exist or has been retired.'}</p>
        <Link to="/ppe/assets" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold">
          Return to PPE Assets
        </Link>
      </div>
    );
  }

  const dep = asset.depreciation || {};

  return (
    <div className="space-y-6">
      {/* Back button and title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/ppe/assets"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{asset.asset_name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {asset.asset_code}
              </span>
            </div>
            <p className="text-xs text-slate-500">{asset.category_name} • Location: {asset.location || 'Unspecified'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMaintModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Wrench className="h-4 w-4 text-slate-600" />
            <span>Log Maintenance</span>
          </button>
        </div>
      </div>

      {/* Valuation & Depreciation Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Acquisition Cost</div>
          <div className="text-xl font-bold text-slate-900">PHP {fmtMoney(asset.acquisition_cost)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Purchased: {asset.purchase_date}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Monthly Depreciation</div>
          <div className="text-xl font-bold text-amber-600">PHP {fmtMoney(dep.monthlyDepreciation)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Annual: PHP {fmtMoney(dep.annualDepreciation)}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Accumulated Depreciation</div>
          <div className="text-xl font-bold text-rose-600">PHP {fmtMoney(dep.accumulatedDepreciation)}</div>
          <div className="text-[11px] text-slate-400 mt-1">{dep.monthsDepreciated} Months in Service</div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/40 p-5 shadow-sm">
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Net Book Value (NBV)</div>
          <div className="text-2xl font-black text-blue-900">PHP {fmtMoney(dep.netBookValue)}</div>
          <div className="text-[11px] text-blue-600 mt-1">Residual Floor: PHP {fmtMoney(asset.salvage_value)}</div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Asset Specs & General Ledger Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Capital Asset Specifications</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">GL Account Code</span>
                <span className="font-semibold text-slate-800">{asset.gl_account || '1500 (Property, Plant & Equipment)'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Serial Number</span>
                <span className="font-semibold text-slate-800">{asset.serial_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Useful Life</span>
                <span className="font-semibold text-slate-800">{asset.useful_life_years} Years ({asset.useful_life_years * 12} Months)</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Current Status</span>
                <span className="font-semibold text-slate-800">{asset.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Assigned Custodian / Department</span>
                <span className="font-semibold text-slate-800">{asset.assigned_to || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Room ID & Name</span>
                <span className="font-semibold text-slate-800">{asset.room_id ? `${asset.room_id} - ${asset.room_name || ''}` : (asset.location || 'N/A')}</span>
              </div>
            </div>

            {asset.notes && (
              <div className="border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400 block mb-1">Technical Remarks & Notes</span>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">{asset.notes}</p>
              </div>
            )}
          </div>

          {/* Maintenance Records Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-600" />
                <span>Maintenance & Servicing History</span>
              </h3>
              <button
                onClick={() => setShowMaintModal(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Record</span>
              </button>
            </div>

            {(!asset.maintenanceRecords || asset.maintenanceRecords.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No maintenance logs recorded for this equipment yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Performed By</th>
                      <th className="pb-2 text-right">Cost (PHP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {asset.maintenanceRecords.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-2.5 whitespace-nowrap text-slate-600">{m.maintenance_date}</td>
                        <td className="py-2.5 text-slate-900 font-medium">{m.description}</td>
                        <td className="py-2.5 text-slate-600">{m.performed_by || 'Staff'}</td>
                        <td className="py-2.5 text-right font-semibold text-slate-900">PHP {fmtMoney(m.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Physical QR Code & Photo */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Asset Label & QR Code</h3>
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block mx-auto">
              <img
                src={`/api/ppe/assets/${asset.id}/qrcode`}
                alt="Asset QR Code"
                className="h-44 w-44 object-contain mx-auto"
              />
            </div>

            <div className="text-xs text-slate-500">
              <p className="font-semibold text-slate-800">{asset.asset_code}</p>
              <p>{asset.asset_name}</p>
            </div>

            <div className="pt-2 flex justify-center gap-2">
              <a
                href={`/api/ppe/assets/${asset.id}/qrcode`}
                download={`${asset.asset_code}-qrcode.png`}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Save PNG</span>
              </a>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Label</span>
              </button>
            </div>
          </div>

          {asset.image_path && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Asset Photo</h3>
              <img
                src={asset.image_path}
                alt={asset.asset_name}
                className="w-full h-48 object-cover rounded-xl border border-slate-200"
              />
            </div>
          )}
        </div>
      </div>

      {/* Log Maintenance Modal */}
      {showMaintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Log Equipment Maintenance</h3>
            <form onSubmit={handleMaintenanceSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Maintenance Date *</label>
                <input
                  type="date"
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={maintForm.maintenanceDate}
                  onChange={(e) => setMaintForm({ ...maintForm, maintenanceDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Description *</label>
                <textarea
                  rows="3"
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Details of repair, inspection, parts replaced, or calibration..."
                  value={maintForm.description}
                  onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cost (PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="0.00"
                    value={maintForm.cost}
                    onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Performed By</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. In-house Technician"
                    value={maintForm.performedBy}
                    onChange={(e) => setMaintForm({ ...maintForm, performedBy: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Asset Operational Status</label>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  value={maintForm.assetStatus}
                  onChange={(e) => setMaintForm({ ...maintForm, assetStatus: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE (Operational)</option>
                  <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE (Offline for servicing)</option>
                  <option value="RETIRED">RETIRED (Decommissioned)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMaintModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMaint}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingMaint ? 'Saving...' : 'Save Maintenance Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
