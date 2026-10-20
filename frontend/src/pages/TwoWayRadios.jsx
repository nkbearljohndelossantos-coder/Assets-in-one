import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Radio, Plus, Search, Filter, Printer, Eye, Edit, 
  CheckCircle, AlertCircle, Wrench, RefreshCw, X, ShieldCheck, Zap
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const radioSchema = z.object({
  name: z.string().min(1, 'Radio name/label is required'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  serial_number: z.string().min(1, 'Serial number is required'),
  call_sign: z.string().optional(),
  radio_frequency_band: z.string().optional(),
  radio_channel_count: z.string().optional(),
  radio_power_output: z.string().optional(),
  license_number: z.string().optional(),
  battery_serial: z.string().optional(),
  condition: z.string().default('Good'),
  status: z.string().default('Available'),
  description: z.string().optional(),
  remarks: z.string().optional()
});

export default function TwoWayRadios() {
  const navigate = useNavigate();
  const { hasPermission, showToast } = useAuth();

  const [radios, setRadios] = useState([]);
  const [radioCategoryId, setRadioCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingRadio, setEditingRadio] = useState(null);
  const [stickerAsset, setStickerAsset] = useState(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(radioSchema),
    defaultValues: {
      condition: 'Good',
      status: 'Available'
    }
  });

  const loadRadioData = async () => {
    try {
      setLoading(true);
      // Fetch asset categories to locate "Two-Way Radio" category ID
      const catRes = await api.get('/assets/categories').catch(() => api.get('/settings/asset-categories'));
      let catId = null;
      if (catRes.data.success) {
        const foundCat = catRes.data.data.find(c => 
          c.name.toLowerCase().includes('radio') || c.name.toLowerCase().includes('walkie')
        );
        if (foundCat) catId = foundCat.id;
      }
      setRadioCategoryId(catId);

      // Fetch assets
      const assetRes = await api.get('/assets', {
        params: {
          limit: 100,
          search,
          categoryId: catId || '',
          status: statusFilter
        }
      });

      if (assetRes.data.success) {
        let list = assetRes.data.data?.assets || assetRes.data.data || [];
        if (catId) {
          list = list.filter(a => Number(a.category_id) === Number(catId));
        } else {
          list = list.filter(a => 
            String(a.category_name || '').toLowerCase().includes('radio') || 
            String(a.category_name || '').toLowerCase().includes('walkie') ||
            a.call_sign || a.radio_frequency_band
          );
        }
        setRadios(list);
      }
    } catch (err) {
      console.error('Failed to load radio assets', err);
      showToast('Error', 'Failed to retrieve two-way radio assets.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRadioData();
  }, [search, statusFilter]);

  const openAddModal = () => {
    setEditingRadio(null);
    reset({
      name: '',
      brand: 'Motorola',
      model: '',
      serial_number: '',
      call_sign: '',
      radio_frequency_band: 'UHF (400-470MHz)',
      radio_channel_count: '16 Channels',
      radio_power_output: '5W',
      license_number: '',
      battery_serial: '',
      condition: 'Good',
      status: 'Available',
      description: '',
      remarks: ''
    });
    setAddModalOpen(true);
  };

  const openEditModal = (radio, e) => {
    if (e) e.stopPropagation();
    setEditingRadio(radio);
    reset({
      name: radio.name || '',
      brand: radio.brand || '',
      model: radio.model || '',
      serial_number: radio.serial_number || '',
      call_sign: radio.call_sign || '',
      radio_frequency_band: radio.radio_frequency_band || '',
      radio_channel_count: radio.radio_channel_count || '',
      radio_power_output: radio.radio_power_output || '',
      license_number: radio.license_number || '',
      battery_serial: radio.battery_serial || '',
      condition: radio.condition || 'Good',
      status: radio.status || 'Available',
      description: radio.description || '',
      remarks: radio.remarks || ''
    });
    setAddModalOpen(true);
  };

  const handleSaveRadio = async (data) => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        category_id: radioCategoryId || 1
      };

      if (editingRadio) {
        const res = await api.put(`/assets/${editingRadio.id}`, payload);
        if (res.data.success) {
          showToast('Updated', 'Two-Way Radio profile updated successfully.', 'success');
          setAddModalOpen(false);
          loadRadioData();
        }
      } else {
        const res = await api.post('/assets', payload);
        if (res.data.success) {
          showToast('Registered', 'New Two-Way Radio asset registered successfully.', 'success');
          setAddModalOpen(false);
          loadRadioData();
        }
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to save radio asset.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Sticker Print Functionality for Two-Way Radios
  const handlePrintSticker = (asset) => {
    const printWindow = window.open('', '_blank', 'width=600,height=500');
    if (!printWindow) {
      showToast('Popup Blocked', 'Please allow popups to print asset sticker.', 'warning');
      return;
    }

    const qrData = encodeURIComponent(`NKB-ITMS:ASSET:${asset.asset_code}`);
    const barcodeData = encodeURIComponent(asset.asset_code);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Radio Sticker - ${asset.asset_code}</title>
          <style>
            @page {
              size: 2in 1in;
              margin: 0;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 4px;
              width: 2in;
              height: 1in;
              box-sizing: border-box;
              background: #fff;
              color: #000;
              font-size: 7pt;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid #000;
              padding-bottom: 1px;
            }
            .title {
              font-weight: 900;
              font-size: 6pt;
              letter-spacing: 0.5px;
            }
            .code {
              font-weight: 900;
              font-size: 7.5pt;
              font-family: monospace;
            }
            .body-grid {
              display: flex;
              gap: 3px;
              align-items: center;
              margin-top: 1px;
            }
            .details {
              flex: 1;
              line-height: 1.1;
            }
            .callsign {
              font-weight: 900;
              font-size: 8pt;
              color: #000;
              background: #eee;
              padding: 1px 3px;
              border-radius: 2px;
              display: inline-block;
            }
            .freq {
              font-size: 5.5pt;
              color: #333;
              font-weight: bold;
            }
            .qr-img {
              width: 0.55in;
              height: 0.55in;
            }
            .footer {
              border-top: 1px dashed #666;
              padding-top: 1px;
              display: flex;
              justify-content: space-between;
              font-size: 5pt;
              font-weight: bold;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header">
            <span class="title">📻 NKB TWO-WAY RADIO</span>
            <span class="code">${asset.asset_code}</span>
          </div>

          <div class="body-grid">
            <div class="details">
              <div class="callsign">${asset.call_sign || asset.name}</div>
              <div class="freq">FREQ: ${asset.radio_frequency_band || 'UHF/VHF'}</div>
              <div class="freq">S/N: <strong>${asset.serial_number}</strong></div>
              ${asset.license_number ? `<div class="freq">NTC: ${asset.license_number}</div>` : ''}
            </div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}" class="qr-img" alt="QR" />
          </div>

          <div class="footer">
            <span>MODEL: ${asset.model}</span>
            <span>NKB ENTERPRISE SECURITY</span>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Title & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
              <Radio className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Two-Way Radio & Walkie-Talkie Assets</h1>
              <p className="text-xs text-slate-500 font-medium">Communication radios, transceivers, frequencies, and physical 2"x1" barcode stickers</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('assets.create') && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Register Two-Way Radio</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Call Sign, Frequency, NTC License, Asset Code, Serial..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-900"
          >
            <option value="">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Assigned">Assigned</option>
            <option value="Under Repair">Under Repair</option>
            <option value="Damaged">Damaged</option>
          </select>
        </div>
      </div>

      {/* Radios Grid */}
      {loading ? (
        <div className="p-12 text-center space-y-3 bg-white border border-slate-200 rounded-xl">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">Loading Two-Way Radio Inventory...</p>
        </div>
      ) : radios && radios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {radios.map(radio => (
            <div
              key={radio.id}
              onClick={() => navigate(`/assets/${radio.id}`)}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-blue-500 transition-all duration-200 cursor-pointer flex flex-col group"
            >
              {/* Radio Top Header Card */}
              <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-2.5">
                  <Radio className="h-5 w-5 text-blue-400" />
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-300 tracking-wider">
                      {radio.call_sign || 'RADIO TRANSCEIVER'}
                    </span>
                    <h4 className="font-bold text-xs text-white leading-tight line-clamp-1">{radio.name}</h4>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                  radio.status === 'Available' ? 'bg-emerald-500 text-white' :
                  radio.status === 'Assigned' ? 'bg-blue-500 text-white' :
                  'bg-amber-500 text-white'
                }`}>
                  {radio.status}
                </span>
              </div>

              {/* Details Body */}
              <div className="p-4 flex-1 space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-semibold">
                  <div>
                    <span className="block text-slate-400 uppercase text-[8.5px]">Asset Code</span>
                    <span className="font-bold text-slate-900">{radio.asset_code}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 uppercase text-[8.5px]">Serial Number</span>
                    <span className="font-bold text-slate-900 truncate block">{radio.serial_number}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 uppercase text-[8.5px]">Frequency Band</span>
                    <span className="font-bold text-blue-700">{radio.radio_frequency_band || 'UHF/VHF'}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 uppercase text-[8.5px]">Channels / Power</span>
                    <span className="font-bold text-slate-800">{radio.radio_channel_count || '16 Ch'} | {radio.radio_power_output || '5W'}</span>
                  </div>
                </div>

                {radio.license_number && (
                  <div className="text-[10px] flex items-center justify-between px-2 py-1 bg-blue-50 border border-blue-150 rounded text-blue-900 font-bold">
                    <span>NTC License: {radio.license_number}</span>
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                )}

                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  {radio.status === 'Assigned' ? (
                    <span className="text-slate-800 font-bold">🧑 Assigned to: {radio.employee_name || radio.department_name || 'Department'}</span>
                  ) : (
                    <span className="text-slate-600">📍 Storage: {radio.current_location || 'Radio Room'}</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrintSticker(radio);
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                  title="Print 2x1 Inch Physical Barcode & QR Label Sticker"
                >
                  <Printer className="h-3 w-3" />
                  <span>Print 2"x1" Sticker</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => openEditModal(radio, e)}
                    className="p-1 text-slate-600 hover:text-blue-700 cursor-pointer"
                    title="Edit Radio Specs"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
                    <span>View</span>
                    <Eye className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center text-slate-400 space-y-2">
          <AlertCircle className="h-8 w-8 mx-auto text-slate-300" />
          <h4 className="font-bold text-sm text-slate-700">No Two-Way Radios Found</h4>
          <p className="text-xs">Click "Register Two-Way Radio" above to add radios or walkie-talkies.</p>
        </div>
      )}

      {/* Modal: Add/Edit Two-Way Radio */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-blue-400" />
                <h3 className="font-extrabold text-sm">
                  {editingRadio ? `Edit Two-Way Radio (${editingRadio.asset_code})` : 'Register New Two-Way Radio / Walkie-Talkie'}
                </h3>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(handleSaveRadio)} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1">1. Call Sign & Base Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Radio Name / Label *</label>
                    <input type="text" {...register('name')} placeholder="e.g. Motorola XiR P6620i Security Radio 1" className="w-full p-2 border border-slate-300 rounded-lg" />
                    {errors.name && <p className="text-rose-600 text-[10px] mt-0.5">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Call Sign / Designation</label>
                    <input type="text" {...register('call_sign')} placeholder="e.g. SECURITY-ALPHA-1, DISPATCH-BASE" className="w-full p-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Brand / Manufacturer *</label>
                    <input type="text" {...register('brand')} placeholder="Motorola, Kenwood, Icom, Baofeng..." className="w-full p-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Model Name / Number *</label>
                    <input type="text" {...register('model')} placeholder="XiR P6620i, NX-3300E, CP200d..." className="w-full p-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Serial Number *</label>
                    <input type="text" {...register('serial_number')} placeholder="Unique Radio Serial Number" className="w-full p-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">NTC License / Permit Number</label>
                    <input type="text" {...register('license_number')} placeholder="e.g. NTC-PR2026-8801" className="w-full p-2 border border-slate-300 rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2 bg-blue-50/50 p-4 border border-blue-200/80 rounded-xl">
                <h4 className="font-bold text-slate-900 border-b border-blue-200 pb-1 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span>2. Radio Frequency & Technical Specifications</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Frequency Band</label>
                    <input type="text" {...register('radio_frequency_band')} placeholder="e.g. UHF (400-470MHz), VHF (136-174MHz)" className="w-full p-2 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Channel Capacity</label>
                    <input type="text" {...register('radio_channel_count')} placeholder="e.g. 16 Channels, 32 Channels, 256 Channels" className="w-full p-2 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Power Output (Watts)</label>
                    <input type="text" {...register('radio_power_output')} placeholder="e.g. 4W High Power, 5W, 10W" className="w-full p-2 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Battery Pack Serial / Model</label>
                    <input type="text" {...register('battery_serial')} placeholder="e.g. PMNN4490A, KNB-57L" className="w-full p-2 border border-slate-300 rounded-lg bg-white" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow transition-colors"
                >
                  {saving ? 'Saving Radio...' : editingRadio ? 'Update Two-Way Radio' : 'Register Two-Way Radio'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
