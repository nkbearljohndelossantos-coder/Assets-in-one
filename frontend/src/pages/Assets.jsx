import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, Filter, Laptop, Smartphone, Radio, Mouse, AlertCircle, Eye, Edit,
  Wrench, CheckCircle, HelpCircle, ShieldAlert, X, ZoomIn, Camera, Upload, ShieldCheck, Zap, Printer, Calculator
} from 'lucide-react';
import ImageZoomModal from '../components/ImageZoomModal';
import { optimizeImageQuality } from '../utils/imageOptimizer';
import { printAssetSticker } from '../utils/printSticker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required'),
  category_id: z.string().min(1, 'Category is required'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  serial_number: z.string().min(1, 'Serial number is required'),
  description: z.string().optional(),
  
  // Specs
  specs_cpu: z.string().optional(),
  specs_ram: z.string().optional(),
  specs_storage: z.string().optional(),
  specs_os: z.string().optional(),
  specs_win_edition: z.string().optional(),

  // Phone Specs & MDM
  imei_number: z.string().optional(),
  phone_number: z.string().optional(),
  sim_carrier: z.string().optional(),
  mdm_enrolled: z.boolean().optional().default(false),
  mdm_device_id: z.string().optional(),

  // Two-Way Radio Specs
  call_sign: z.string().optional(),
  radio_frequency_band: z.string().optional(),
  radio_channel_count: z.string().optional(),
  radio_power_output: z.string().optional(),
  license_number: z.string().optional(),
  battery_serial: z.string().optional(),

  // Computer Mouse Specs
  mouse_connectivity: z.string().optional(),
  mouse_sensor_dpi: z.string().optional(),
  mouse_buttons_count: z.string().optional(),
  mouse_hand_orientation: z.string().optional(),
  
  // Net
  hostname: z.string().optional(),
  mac_address: z.string().optional(),
  ip_address: z.string().optional(),
  
  // Acq
  purchase_date: z.string().optional(),
  purchase_price: z.coerce.number().nonnegative().optional().default(0),
  supplier: z.string().optional(),
  invoice_number: z.string().optional(),
  warranty_start_date: z.string().optional(),
  warranty_end_date: z.string().optional(),
  condition: z.string().default('Good'),
  status: z.string().optional().default('Available'),
  remarks: z.string().optional()
});

function AssetCardImage({ src, name, categoryName, onZoom }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const isPhone = String(categoryName || '').toLowerCase().includes('phone') || String(categoryName || '').toLowerCase().includes('mobile');
  const isRadio = String(categoryName || '').toLowerCase().includes('radio') || String(categoryName || '').toLowerCase().includes('walkie');
  const isMouse = String(categoryName || '').toLowerCase().includes('mouse');

  if (!src || src === 'null' || src === 'undefined' || hasError) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 flex flex-col items-center justify-center p-3 text-slate-300 space-y-1">
        {isMouse ? (
          <Mouse className="h-10 w-10 text-purple-400 opacity-90 drop-shadow" />
        ) : isRadio ? (
          <Radio className="h-10 w-10 text-emerald-400 opacity-90 drop-shadow" />
        ) : isPhone ? (
          <Smartphone className="h-10 w-10 text-blue-400 opacity-90 drop-shadow" />
        ) : (
          <Laptop className="h-10 w-10 text-gold-400 opacity-90 drop-shadow" />
        )}
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
          {isMouse ? 'Mouse Asset' : isRadio ? 'Radio Asset' : isPhone ? 'Smartphone Asset' : 'Hardware Asset'}
        </span>
      </div>
    );
  }

  return (
    <>
      <img 
        src={src} 
        alt={name}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      {onZoom && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoom(src, name);
          }}
          className="absolute bottom-2 right-2 p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
          title="Zoom photo"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  );
}

export default function Assets() {
  const navigate = useNavigate();
  const { hasPermission, showToast } = useAuth();
  
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [uploadImage, setUploadImage] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);

  // Filters state
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [warrantyFilter, setWarrantyFilter] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      condition: 'Good',
      status: 'Available',
      purchase_price: 0,
      mdm_enrolled: false
    }
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [assetRes, catRes] = await Promise.all([
        api.get('/assets', {
          params: {
            page,
            limit: 9,
            search,
            categoryId: catFilter,
            status: statusFilter,
            condition: conditionFilter,
            warrantyExpiring: warrantyFilter
          }
        }),
        api.get('/assets/categories').catch(() => api.get('/settings/asset-categories'))
      ]);

      if (assetRes.data.success) {
        const list = assetRes.data.data?.assets || assetRes.data.data || [];
        setAssets(Array.isArray(list) ? list : []);
        if (assetRes.data.data?.pagination) setPagination(assetRes.data.data.pagination);
        else if (assetRes.data.pagination) setPagination(assetRes.data.pagination);
      }
      if (catRes.data.success) {
        setCategories(catRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load assets', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSticker = (asset, e) => {
    if (e) e.stopPropagation();
    printAssetSticker(asset);
  };

  useEffect(() => {
    loadData();
  }, [page, search, catFilter, statusFilter, conditionFilter, warrantyFilter]);

  const openAddModal = () => {
    setEditingAsset(null);
    setUploadImage(null);
    reset({
      name: '',
      category_id: '',
      brand: '',
      model: '',
      serial_number: '',
      description: '',
      specs_cpu: '',
      specs_ram: '',
      specs_storage: '',
      specs_os: '',
      specs_win_edition: '',
      imei_number: '',
      phone_number: '',
      sim_carrier: '',
      mdm_enrolled: false,
      mdm_device_id: '',
      hostname: '',
      mac_address: '',
      ip_address: '',
      purchase_date: '',
      purchase_price: 0,
      supplier: '',
      invoice_number: '',
      warranty_start_date: '',
      warranty_end_date: '',
      condition: 'Good',
      status: 'Available',
      remarks: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (asset, e) => {
    if (e) e.stopPropagation();
    setEditingAsset(asset);
    setUploadImage(null);
    reset({
      name: asset.name || '',
      category_id: String(asset.category_id || ''),
      brand: asset.brand || '',
      model: asset.model || '',
      serial_number: asset.serial_number || '',
      description: asset.description || '',
      specs_cpu: asset.specs_cpu || '',
      specs_ram: asset.specs_ram || '',
      specs_storage: asset.specs_storage || '',
      specs_os: asset.specs_os || '',
      specs_win_edition: asset.specs_win_edition || '',
      imei_number: asset.imei_number || '',
      phone_number: asset.phone_number || '',
      sim_carrier: asset.sim_carrier || '',
      mdm_enrolled: asset.mdm_enrolled === true || asset.mdm_enrolled === 1,
      mdm_device_id: asset.mdm_device_id || '',
      hostname: asset.hostname || '',
      mac_address: asset.mac_address || '',
      ip_address: asset.ip_address || '',
      purchase_date: asset.purchase_date ? asset.purchase_date.split('T')[0] : '',
      purchase_price: asset.purchase_price || 0,
      supplier: asset.supplier || '',
      invoice_number: asset.invoice_number || '',
      warranty_start_date: asset.warranty_start_date ? asset.warranty_start_date.split('T')[0] : '',
      warranty_end_date: asset.warranty_end_date ? asset.warranty_end_date.split('T')[0] : '',
      condition: asset.condition || 'Good',
      status: asset.status || 'Available',
      remarks: asset.remarks || ''
    });
    setModalOpen(true);
  };

  const handleSaveAsset = async (data) => {
    setSaving(true);
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null && key !== 'image' && key !== 'image_path') {
        formData.append(key, val);
      }
    });

    if (uploadImage) {
      try {
        const base64Uri = await convertFileToBase64(uploadImage);
        formData.append('image_path', base64Uri);
      } catch (e) {
        // fallback
      }
      formData.append('image', uploadImage);
    } else if (editingAsset && editingAsset.image_path) {
      formData.append('image_path', editingAsset.image_path);
    }

    try {
      if (editingAsset) {
        const res = await api.put(`/assets/${editingAsset.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.success) {
          showToast('Updated', 'Asset profile updated successfully.', 'success');
          setModalOpen(false);
          reset();
          setUploadImage(null);
          setEditingAsset(null);
          loadData();
        }
      } else {
        const res = await api.post('/assets', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.success) {
          showToast('Created', 'Asset registered successfully.', 'success');
          setModalOpen(false);
          reset();
          setUploadImage(null);
          loadData();
        }
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to save asset.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">IT Assets Register</h1>
          <p className="text-xs text-slate-500 mt-1">Manage company workstations, servers, network hardware, and peripherals.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/calculator')}
            className="px-3.5 py-2 bg-white text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Calculator className="h-4 w-4 text-gold-600" />
            <span>Equipment Calculator</span>
          </button>
          
          {hasPermission('assets.create') && (
            <button 
              onClick={openAddModal}
              className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Asset</span>
            </button>
          )}
        </div>
      </div>

      {/* ==========================================
          SEARCH AND FILTERS BAR
          ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        
        {/* Search Input */}
        <div className="relative lg:col-span-2">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search by code, brand, serial..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-xs text-slate-900"
          />
        </div>

        {/* Category Filter */}
        <select
          value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setPage(1); }}
          className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="Available">Available</option>
          <option value="Assigned">Assigned</option>
          <option value="Under Repair">Under Repair</option>
          <option value="Damaged">Damaged</option>
          <option value="Retired">Retired</option>
        </select>

        {/* Expiring Warranty toggle */}
        <select
          value={warrantyFilter}
          onChange={e => { setWarrantyFilter(e.target.value); setPage(1); }}
          className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
        >
          <option value="false">All Warranties</option>
          <option value="true">Expiring in 30 Days</option>
        </select>

      </div>

      {/* ==========================================
          ASSET CARDS GRID
          ========================================== */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-650"></div>
        </div>
      ) : assets && assets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {assets.map(asset => (
            <div 
              key={asset.id}
              onClick={() => navigate(`/assets/${asset.id}`)}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-gold-500 transition-all duration-200 cursor-pointer flex flex-col group"
            >
              {/* Card top banner with photo/placeholder */}
              <div className="h-32 bg-slate-950/5 relative flex items-center justify-center border-b border-slate-100 group/img">
                <AssetCardImage 
                  src={asset.image_path} 
                  name={asset.name} 
                  categoryName={asset.category_name}
                  onZoom={(s, n) => {
                    setZoomImage({ src: s, title: n });
                  }}
                />
                {/* Status sticker */}
                <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  asset.status === 'Available' ? 'bg-emerald-500 text-white shadow' :
                  asset.status === 'Assigned' ? 'bg-slate-900 text-gold-500 border border-slate-700' :
                  asset.status === 'Under Repair' ? 'bg-amber-500 text-white' :
                  'bg-rose-600 text-white'
                }`}>
                  {asset.status}
                </span>
              </div>

              {/* Card info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-gold-600 uppercase">{asset.category_name}</span>
                    {asset.mdm_enrolled && (
                      <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px]">
                        <ShieldCheck className="h-3 w-3" />
                        <span>MDM Active</span>
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-gold-700 transition-colors leading-tight line-clamp-1">
                    {asset.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-none">
                    Code: <span className="font-bold">{asset.asset_code}</span> | Serial: <span className="font-bold text-slate-800">{asset.serial_number}</span>
                  </p>

                  {/* Phone Badges */}
                  {(asset.phone_number || asset.imei_number || asset.sim_carrier) && (
                    <div className="pt-1 flex flex-wrap items-center gap-1">
                      {asset.phone_number && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 font-bold text-[9.5px] rounded">
                          <Smartphone className="h-3 w-3 text-blue-600" />
                          <span>SIM: {asset.phone_number}</span>
                        </span>
                      )}
                      {asset.imei_number && (
                        <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[9px] rounded">
                          IMEI: {asset.imei_number}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Current location or assignee */}
                  <div className="pt-2 text-[10px] text-slate-650 flex items-center gap-1 leading-normal">
                    {asset.status === 'Assigned' ? (
                      <span className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 font-semibold text-slate-800 truncate block w-full">
                        🧑 {asset.employee_name || asset.department_name || 'Department Assigned'}
                      </span>
                    ) : (
                      <span className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 font-semibold text-slate-500">
                        📍 {asset.current_location || 'IT Storage'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-4 flex justify-between items-center text-[10px]">
                  <span className={`font-bold ${
                    asset.condition === 'New' || asset.condition === 'Good' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    Condition: {asset.condition}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handlePrintSticker(asset, e)}
                      className="text-slate-800 hover:text-black bg-slate-100 hover:bg-slate-200 border border-slate-300 font-bold flex items-center gap-1 cursor-pointer px-2 py-1 rounded text-[9.5px] transition-colors shadow-xs"
                      title="Print 70mm x 40mm Property Asset Tag Sticker"
                    >
                      <Printer className="h-3 w-3 text-slate-700" />
                      <span>Print Sticker</span>
                    </button>
                    {hasPermission('assets.update') && (
                      <button
                        type="button"
                        onClick={(e) => openEditModal(asset, e)}
                        className="text-slate-600 hover:text-gold-700 font-semibold flex items-center gap-0.5 cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
                        title="Edit Asset"
                      >
                        <Edit className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                    )}
                    <span className="text-slate-400 font-semibold group-hover:text-gold-700 flex items-center gap-0.5">
                      <span>View Profile</span>
                      <Eye className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-16 bg-white border border-slate-200 rounded-xl text-center text-slate-400 space-y-2">
          <AlertCircle className="h-10 w-10 mx-auto text-slate-350" />
          <h4 className="font-bold text-sm text-slate-850">No assets registered</h4>
          <p className="text-xs">Adjust your filters or add a new asset to get started.</p>
        </div>
      )}

      {/* Pagination control */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl">
          <span className="text-xs text-slate-500 font-medium">
            Page {pagination.page} of {pagination.pages} ({pagination.total} assets total)
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

      {/* ==========================================
          ADD / EDIT ASSET MODAL DIALOG
          ========================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingAsset ? 'Edit IT Asset Profile' : 'Register IT Asset'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleSaveAsset)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs font-semibold">
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">1. Base Asset Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1">Asset Name *</label>
                    <input type="text" {...register('name')} placeholder="e.g. Finance Desktop Unit 5" className="w-full p-2 border border-slate-350 rounded" />
                    {errors.name && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Category *</label>
                    <select {...register('category_id')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                      <option value="">Choose category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {errors.category_id && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.category_id.message}</p>}
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Brand *</label>
                    <input type="text" {...register('brand')} placeholder="Lenovo, Dell, Cisco..." className="w-full p-2 border border-slate-350 rounded" />
                    {errors.brand && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.brand.message}</p>}
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Model *</label>
                    <input type="text" {...register('model')} placeholder="ThinkCentre M70q, Latitude 5445..." className="w-full p-2 border border-slate-350 rounded" />
                    {errors.model && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.model.message}</p>}
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Serial Number *</label>
                    <input type="text" {...register('serial_number')} placeholder="Hardware unique serial" className="w-full p-2 border border-slate-350 rounded" />
                    {errors.serial_number && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.serial_number.message}</p>}
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Physical Condition</label>
                    <select {...register('condition')} className="w-full p-2 border border-slate-350 rounded bg-white">
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Status</label>
                    <select {...register('status')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                      <option value="Available">Available</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Under Repair">Under Repair</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">2. Hardware Specifications (Optional)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1">CPU Details</label>
                    <input type="text" {...register('specs_cpu')} placeholder="i5-12400, Snapdragon, A17..." className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">RAM Capacity</label>
                    <input type="text" {...register('specs_ram')} placeholder="8GB, 16GB..." className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Storage Size</label>
                    <input type="text" {...register('specs_storage')} placeholder="128GB, 256GB SSD..." className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Operating System</label>
                    <input type="text" {...register('specs_os')} placeholder="Android 14, iOS 17, Windows 11..." className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">OS Edition / UI Version</label>
                    <input type="text" {...register('specs_win_edition')} placeholder="One UI 6, iOS, Pro..." className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                </div>
              </div>

              {/* 3. Mobile Phone & MDM Specifications */}
              <div className="space-y-4 pt-2 bg-blue-50/50 p-4 border border-blue-200/80 rounded-xl">
                <div className="flex items-center gap-2 border-b border-blue-200/80 pb-1.5">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  <h4 className="text-xs font-black text-slate-900">3. Mobile Phone & Enterprise MDM Details</h4>
                  <span className="ml-auto px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-black text-[9px] uppercase tracking-wider">Mobile Asset</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">IMEI Number (IMEI1/IMEI2)</label>
                    <input type="text" {...register('imei_number')} placeholder="e.g. 358940112938475" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Phone Number / SIM</label>
                    <input type="text" {...register('phone_number')} placeholder="e.g. 0917-889-1029" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">SIM Network Carrier / Plan</label>
                    <input type="text" {...register('sim_carrier')} placeholder="Globe Postpaid, Smart Enterprise..." className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">MDM Device Token ID</label>
                    <input type="text" {...register('mdm_device_id')} placeholder="e.g. DEV-MDM-A54-8821" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 border border-slate-300 rounded-lg shadow-sm">
                      <input type="checkbox" {...register('mdm_enrolled')} className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
                      <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span>MDM Work Mode Enrolled</span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 4. Two-Way Radio & Communication Specifications */}
              <div className="space-y-4 pt-2 bg-emerald-50/50 p-4 border border-emerald-200/80 rounded-xl">
                <div className="flex items-center gap-2 border-b border-emerald-200/80 pb-1.5">
                  <Radio className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-black text-slate-900">4. Two-Way Radio & Communication Details</h4>
                  <span className="ml-auto px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px] uppercase tracking-wider">Radio Asset</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Call Sign / Designation</label>
                    <input type="text" {...register('call_sign')} placeholder="e.g. SECURITY-ALPHA-1, DISPATCH" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Frequency Band</label>
                    <input type="text" {...register('radio_frequency_band')} placeholder="UHF (400-470MHz), VHF..." className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Channel Capacity</label>
                    <input type="text" {...register('radio_channel_count')} placeholder="16 Channels, 32 Channels..." className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Power Output (Watts)</label>
                    <input type="text" {...register('radio_power_output')} placeholder="4W, 5W High Power..." className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">NTC License / Permit Number</label>
                    <input type="text" {...register('license_number')} placeholder="e.g. NTC-PR2026-8801" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Battery Serial / Model</label>
                    <input type="text" {...register('battery_serial')} placeholder="e.g. PMNN4490A, KNB-57L" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                </div>
              </div>

              {/* 5. Computer Mouse & Peripheral Specifications */}
              <div className="space-y-4 pt-2 bg-purple-50/50 p-4 border border-purple-200/80 rounded-xl">
                <div className="flex items-center gap-2 border-b border-purple-200/80 pb-1.5">
                  <Mouse className="h-4 w-4 text-purple-600" />
                  <h4 className="text-xs font-black text-slate-900">5. Computer Mouse & Peripheral Details</h4>
                  <span className="ml-auto px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-black text-[9px] uppercase tracking-wider">Mouse Asset</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Connectivity Type</label>
                    <input type="text" {...register('mouse_connectivity')} placeholder="e.g. Logi Bolt 2.4GHz + Bluetooth LE, Wired USB-A" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Sensor Resolution (DPI)</label>
                    <input type="text" {...register('mouse_sensor_dpi')} placeholder="e.g. 8000 DPI Darkfield, 1000 DPI Optical" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Buttons Count & Features</label>
                    <input type="text" {...register('mouse_buttons_count')} placeholder="e.g. 7 Programmable Buttons + Scroll Click" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Hand Orientation / Form Factor</label>
                    <input type="text" {...register('mouse_hand_orientation')} placeholder="e.g. Ergonomic Right-Handed, Ambidextrous" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">6. Network Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1">Hostname</label>
                    <input type="text" {...register('hostname')} placeholder="NKB-DEPT-DESK01" className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">MAC Address</label>
                    <input type="text" {...register('mac_address')} placeholder="00:1A:2B:3C:4D:5E" className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">IP Address</label>
                    <input type="text" {...register('ip_address')} placeholder="192.168.1.100" className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">4. Purchase & Warranty Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1">Purchase Price (PHP)</label>
                    <input type="number" step="0.01" {...register('purchase_price')} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Purchase Date</label>
                    <input type="date" {...register('purchase_date')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Invoice Number</label>
                    <input type="text" {...register('invoice_number')} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Warranty Start Date</label>
                    <input type="date" {...register('warranty_start_date')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Warranty End Date</label>
                    <input type="date" {...register('warranty_end_date')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Supplier / Vendor</label>
                    <input type="text" {...register('supplier')} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">5. Physical Attributes & Uploads</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Asset Photo</label>
                    {uploadImage ? (
                      <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-350 rounded-lg">
                        <img 
                          src={URL.createObjectURL(uploadImage)} 
                          alt="Captured Asset" 
                          className="h-12 w-12 object-cover rounded-lg border border-slate-300 shadow-sm" 
                        />
                        <div className="flex-1 space-y-0.5 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{uploadImage.name || 'Captured_Asset.jpg'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{(uploadImage.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadImage(null)}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-xs font-bold border border-rose-200 cursor-pointer"
                        >
                          Retake
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow">
                          <Camera className="h-4 w-4 text-gold-400" />
                          <span>Take Photo</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            onChange={async (e) => {
                              if (e.target.files[0]) {
                                const opt = await optimizeImageQuality(e.target.files[0]);
                                setUploadImage(opt);
                              }
                            }} 
                          />
                        </label>

                        <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-350 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm">
                          <Upload className="h-4 w-4 text-slate-500" />
                          <span>Browse File</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={async (e) => {
                              if (e.target.files[0]) {
                                const opt = await optimizeImageQuality(e.target.files[0]);
                                setUploadImage(opt);
                              }
                            }} 
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Remarks / Location Details</label>
                    <input type="text" {...register('remarks')} placeholder="Storage locker shelf details" className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
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
                  {saving ? 'Saving...' : editingAsset ? 'Save Changes' : 'Register Asset'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Image Zoom Lightbox Modal */}
      <ImageZoomModal 
        isOpen={!!zoomImage} 
        src={zoomImage?.src} 
        title={zoomImage?.title} 
        onClose={() => setZoomImage(null)} 
      />

    </div>
  );
}
