import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useIsMobile } from '../hooks/useDeviceType';
import { CameraCapture } from '../components/CameraCapture';
import { 
  Building2, Plus, Search, Filter, Download, QrCode, 
  RotateCcw, Eye, Edit2, Trash2, Camera, Layers, CheckCircle, AlertTriangle, Printer
} from 'lucide-react';
import { printAssetSticker } from '../../utils/printSticker';

function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusTone(s) {
  if (s === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'UNDER_MAINTENANCE') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'RETIRED') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function AssetForm({ onClose, onCreated, onUpdated, asset, categories }) {
  const [form, setForm] = useState({
    roomId: asset?.room_id || '',
    roomName: asset?.room_name || '',
    assetName: asset?.asset_name || '',
    glAccount: asset?.gl_account || '1500',
    category: asset?.category_name || (categories[0]?.name || 'Machinery & Equipment'),
    serialNumber: asset?.serial_number || '',
    autoGenerateSerial: asset ? false : true,
    purchaseDate: asset ? dayjs(asset.purchase_date).format('YYYY-MM-DD') : new Date().toISOString().slice(0, 10),
    acquisitionCost: asset?.acquisition_cost || '',
    usefulLifeYears: asset?.useful_life_years || 5,
    salvageValue: asset?.salvage_value || 0,
    assignedTo: asset?.assigned_to || '',
    location: asset?.location || '',
    status: asset?.status || 'ACTIVE',
    remarks: asset?.notes || '',
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(asset?.image_path ? asset.image_path : '');
  const [showCamera, setShowCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      {showCamera && (
        <CameraCapture
          onClose={() => setShowCamera(false)}
          onCapture={(file) => {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
          }}
        />
      )}
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">{asset ? 'Edit Capital Asset' : 'Register Capital Asset'}</h3>
            <p className="text-xs text-slate-500">{asset ? `Asset Code: ${asset.asset_code}` : 'Sequential PPE code will be generated automatically'}</p>
          </div>
          <button className="text-slate-400 hover:text-slate-600 font-medium text-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <form
          className="flex-1 overflow-y-auto p-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setBusy(true);
            try {
              const fd = new FormData();
              Object.entries(form).forEach(([k, v]) => {
                if (v !== null && v !== undefined) fd.append(k, v);
              });
              if (imageFile) {
                fd.append('image', imageFile);
              }

              if (asset) {
                const res = await api.put(`/ppe/assets/${asset.id}`, fd, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                onUpdated(res.data);
              } else {
                const res = await api.post('/ppe/assets', fd, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                onCreated(res.data);
              }
              onClose();
            } catch (err) {
              setError(err.response?.data?.message || err.message || 'Operation failed');
            } finally {
              setBusy(false);
            }
          }}
        >
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Name *</label>
              <input
                type="text"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="e.g. CNC Vertical Milling Machine VMX-42i"
                value={form.assetName}
                onChange={(e) => setForm({ ...form, assetName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Category *</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id || c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GL Account Code</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. 1510 (Machinery)"
                value={form.glAccount}
                onChange={(e) => setForm({ ...form, glAccount: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Acquisition Cost (PHP) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
                placeholder="0.00"
                value={form.acquisitionCost}
                onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Useful Life (Years) *</label>
              <input
                type="number"
                min="1"
                max="50"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.usefulLifeYears}
                onChange={(e) => setForm({ ...form, usefulLifeYears: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Salvage / Residual Value (PHP)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="0.00"
                value={form.salvageValue}
                onChange={(e) => setForm({ ...form, salvageValue: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Acquisition Date *</label>
              <input
                type="date"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Serial Number</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={form.autoGenerateSerial}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  placeholder={form.autoGenerateSerial ? 'Auto-generated upon save' : 'Enter serial no.'}
                  value={form.serialNumber}
                  onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                />
                {!asset && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, autoGenerateSerial: !form.autoGenerateSerial })}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border ${form.autoGenerateSerial ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-slate-100 text-slate-700'}`}
                  >
                    Auto
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
                <option value="RETIRED">RETIRED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned To (Department / Person)</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Production Department"
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Room Name</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Factory Floor Bay 1"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value, roomName: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Photo</label>
              <div className="flex items-center gap-3">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-xl border border-slate-300" />
                ) : (
                  <div className="h-16 w-16 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="cursor-pointer px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition">
                    Upload File
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Take Photo</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Technical Notes</label>
              <textarea
                rows="2"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Additional specifications or warranty terms"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
            >
              {busy ? 'Saving...' : (asset ? 'Update Asset' : 'Register Asset')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PpeAssetsPage() {
  const { hasPermission, user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedYear) params.year = selectedYear;

      const res = await api.get('/ppe/assets', { params });
      setAssets(Array.isArray(res.data) ? res.data : (res.data.data || []));

      const catRes = await api.get('/ppe/assets/categories');
      setCategories(catRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch PPE assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [selectedCategory, selectedStatus, selectedYear]);

  const handleDelete = async (id, assetCode) => {
    if (!window.confirm(`Are you sure you want to retire/delete capital asset ${assetCode}?`)) return;
    try {
      await api.delete(`/ppe/assets/${id}`);
      setAssets(assets.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete asset');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <span>Property, Plant & Equipment (PPE)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Capital asset register, straight-line depreciation tracking, and physical QR codes
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/ppe/reports"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export Register</span>
          </Link>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search code, name, serial, location..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchAssets()}
          />
        </div>

        <div>
          <select
            className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
            <option value="RETIRED">RETIRED</option>
          </select>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Year"
            className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          />
          <button
            onClick={fetchAssets}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Asset Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-4 py-3">Asset Code</th>
                <th className="px-4 py-3">Name & Category</th>
                <th className="px-4 py-3">Acquisition</th>
                <th className="px-4 py-3 text-right">Cost (PHP)</th>
                <th className="px-4 py-3 text-right">Monthly Dep.</th>
                <th className="px-4 py-3 text-right">Accum. Dep.</th>
                <th className="px-4 py-3 text-right">Net Book Value</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <span>Loading capital assets...</span>
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    No PPE capital assets found matching criteria.
                  </td>
                </tr>
              ) : (
                assets.map((a) => {
                  const dep = a.depreciation || {};
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-blue-600 whitespace-nowrap">
                        <Link to={`/ppe/assets/${a.id}`} className="hover:underline flex items-center gap-1.5">
                          <span>{a.asset_code}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{a.asset_name}</div>
                        <div className="text-[11px] text-slate-500">{a.category_name} • {a.location || 'Location unassigned'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        <div>{a.purchase_date}</div>
                        <div className="text-[10px] text-slate-400">{a.useful_life_years} Yrs Useful Life</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 whitespace-nowrap">
                        PHP {fmtMoney(a.acquisition_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                        PHP {fmtMoney(dep.monthlyDepreciation)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                        PHP {fmtMoney(dep.accumulatedDepreciation)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        PHP {fmtMoney(dep.netBookValue)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusTone(a.status)}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => printAssetSticker(a, { systemSubtitle: 'UNIFIED ASSET SYSTEM' })}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            title="Print Property Asset Tag Sticker"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <Link
                            to={`/ppe/assets/${a.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="View Asset Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => setEditingAsset(a)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition"
                            title="Edit Asset"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id, a.asset_code)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete Asset"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(showAddModal || editingAsset) && (
        <AssetForm
          asset={editingAsset}
          categories={categories}
          onClose={() => {
            setShowAddModal(false);
            setEditingAsset(null);
          }}
          onCreated={(newA) => {
            setAssets([newA, ...assets]);
          }}
          onUpdated={(upA) => {
            setAssets(assets.map((a) => (a.id === upA.id ? upA : a)));
          }}
        />
      )}
    </div>
  );
}
