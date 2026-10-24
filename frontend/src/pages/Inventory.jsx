import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, Filter, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  RotateCw, Package, Check, X, FileText, ChevronRight, History, Edit, Printer
} from 'lucide-react';
import QRCode from 'qrcode';
import { printInventorySticker } from '../utils/printSticker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const itemSchema = z.object({
  name: z.string().min(1, 'Part name is required'),
  item_code: z.string().min(1, 'Item code is required'),
  category_id: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  unit_of_measure: z.string().default('pcs'),
  reorder_level: z.coerce.number().min(0, 'Reorder level cannot be negative').default(5),
  unit_cost: z.coerce.number().nonnegative('Unit cost cannot be negative').default(0)
});

export default function Inventory() {
  const { hasPermission, showToast } = useAuth();
  
  // Tab Control
  const [activeTab, setActiveTab] = useState('inventory'); // inventory, ledger

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState('false');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Modals state
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [stickerModalOpen, setStickerModalOpen] = useState(false);
  const [selectedStickerItem, setSelectedStickerItem] = useState(null);
  const [stickerQrUrl, setStickerQrUrl] = useState('');
  const [printCount, setPrintCount] = useState(1);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      unit_of_measure: 'pcs',
      reorder_level: 5,
      unit_cost: 0
    }
  });

  // Separate independent category loader
  const loadCategories = async () => {
    try {
      const catsRes = await api.get('/settings/inventory-categories');
      if (catsRes.data && catsRes.data.success && catsRes.data.data?.length > 0) {
        setCategories(catsRes.data.data);
        return;
      }
    } catch {
      // fallback
    }

    try {
      const fallbackRes = await api.get('/inventory/categories');
      if (fallbackRes.data && fallbackRes.data.success && fallbackRes.data.data?.length > 0) {
        setCategories(fallbackRes.data.data);
      }
    } catch {
      // Keep existing
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'inventory') {
        const response = await api.get('/inventory', {
          params: {
            page,
            search,
            categoryId: catFilter,
            lowStock: lowStockFilter
          }
        });
        if (response.data.success) {
          setItems(response.data.data.items);
          setPagination(response.data.data.pagination);
        }
      } else {
        const ledgerRes = await api.get('/inventory/movements', { params: { limit: 100 } });
        if (ledgerRes.data.success) {
          setLedger(ledgerRes.data.data);
        }
      }
    } catch (err) {
      showToast('Error', 'Failed to retrieve inventory records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load categories independently on mount and when modal opens
  useEffect(() => {
    loadCategories();
  }, [itemModalOpen]);

  useEffect(() => {
    loadData();
  }, [activeTab, page, search, catFilter, lowStockFilter]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    reset({
      name: '',
      item_code: '',
      category_id: '',
      unit_of_measure: 'pcs',
      reorder_level: 5,
      unit_cost: 0,
      description: ''
    });
    setItemModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const uom = (!item.unit_of_measure || /^\d+$/.test(String(item.unit_of_measure).trim())) ? 'pcs' : item.unit_of_measure;
    reset({
      name: item.name || '',
      item_code: item.item_code || '',
      category_id: String(item.category_id || ''),
      unit_of_measure: uom,
      reorder_level: item.reorder_level !== undefined ? item.reorder_level : 5,
      unit_cost: item.unit_cost !== undefined ? item.unit_cost : 0,
      description: item.remarks || item.description || ''
    });
    setItemModalOpen(true);
  };

  // Create or Update Inventory Profile
  const handleSaveItem = async (data) => {
    try {
      const cleanUom = (!data.unit_of_measure || /^\d+$/.test(String(data.unit_of_measure).trim())) ? 'pcs' : data.unit_of_measure.trim();
      const payload = {
        ...data,
        unit_of_measure: cleanUom
      };

      if (editingItem) {
        const res = await api.put(`/inventory/${editingItem.id}`, payload);
        if (res.data.success) {
          showToast('Updated', 'Inventory item updated successfully.', 'success');
          setItemModalOpen(false);
          setEditingItem(null);
          loadData();
        }
      } else {
        const res = await api.post('/inventory', payload);
        if (res.data.success) {
          showToast('Created', 'Inventory item profile created.', 'success');
          setItemModalOpen(false);
          reset({
            name: '',
            item_code: '',
            category_id: '',
            unit_of_measure: 'pcs',
            reorder_level: 5,
            unit_cost: 0,
            description: ''
          });
          loadData();
        }
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to save item.', 'error');
    }
  };

  // Open Sticker Modal & Generate QR preview
  const handleOpenSticker = async (item, e) => {
    if (e) e.stopPropagation();
    setSelectedStickerItem(item);
    const initialCopies = (item.current_quantity && Number(item.current_quantity) > 0) ? Number(item.current_quantity) : 1;
    setPrintCount(initialCopies);
    try {
      const url = await QRCode.toDataURL(item.item_code || 'INV-00000', {
        width: 160,
        margin: 1,
        errorCorrectionLevel: 'M'
      });
      setStickerQrUrl(url);
    } catch {
      setStickerQrUrl('');
    }
    setStickerModalOpen(true);
  };

  // Receive Stock In
  const handleReceiveStock = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      inventoryItemId: data.get('inventoryItemId'),
      quantity: parseInt(data.get('quantity')),
      unitCost: parseFloat(data.get('unitCost') || '0'),
      supplier: data.get('supplier'),
      referenceNumber: data.get('referenceNumber'),
      remarks: data.get('remarks')
    };

    if (!payload.inventoryItemId || !payload.quantity || payload.quantity <= 0) {
      alert('Please fill out all required fields with positive counts.');
      return;
    }

    try {
      const res = await api.post(`/inventory/${payload.inventoryItemId}/stock-in`, {
        quantity: payload.quantity,
        unitCost: payload.unitCost,
        remarks: payload.remarks
      });
      if (res.data.success) {
        showToast('Received', 'Stock received successfully and quantities updated.', 'success');
        setReceiveModalOpen(false);
        loadData();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to receive stock.', 'error');
    }
  };

  // Adjust Stock counts
  const handleAdjustStock = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      inventoryItemId: data.get('inventoryItemId'),
      quantity: parseInt(data.get('quantity')),
      action: data.get('action'), // add, subtract
      remarks: data.get('remarks')
    };

    if (!payload.inventoryItemId || !payload.quantity || payload.quantity <= 0) {
      alert('Please fill out required fields with positive counts.');
      return;
    }

    try {
      const res = await api.post(`/inventory/${payload.inventoryItemId}/adjust`, {
        type: payload.action === 'add' ? 'Adjustment Increase' : 'Adjustment Decrease',
        quantity: payload.quantity,
        remarks: payload.remarks
      });
      if (res.data.success) {
        showToast('Adjusted', 'Inventory counts adjusted successfully.', 'success');
        setAdjustModalOpen(false);
        loadData();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to adjust stock.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Spare Parts Inventory</h1>
          <p className="text-xs text-slate-500 mt-1">Oversee replacement hardware stocks, receipt logs, and parts tracking.</p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission('inventory.manage') && (
            <>
              <button 
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
              <button 
                onClick={() => setReceiveModalOpen(true)}
                className="px-4 py-2 border border-slate-350 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                <span>Stock In</span>
              </button>
              <button 
                onClick={() => setAdjustModalOpen(true)}
                className="px-4 py-2 border border-slate-350 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCw className="h-4 w-4 text-amber-600" />
                <span>Adjust Stock</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab controls */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold uppercase select-none">
        <button
          onClick={() => { setActiveTab('inventory'); setPage(1); }}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
            activeTab === 'inventory' ? 'border-gold-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Parts Catalog</span>
        </button>

        <button
          onClick={() => { setActiveTab('ledger'); }}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
            activeTab === 'ledger' ? 'border-gold-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Ledger History</span>
        </button>
      </div>

      {/* ==========================================
          TAB CONTENT PANEL 1: PARTS CATALOG
          ========================================== */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          
          {/* Search bar filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            
            {/* Search */}
            <div className="relative sm:col-span-2">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search by part name, part code..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-xs text-slate-900"
              />
            </div>

            {/* Category */}
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

            {/* Low stock alert flag */}
            <select
              value={lowStockFilter}
              onChange={e => { setLowStockFilter(e.target.value); setPage(1); }}
              className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
            >
              <option value="false">All Stock Levels</option>
              <option value="true">⚠️ Low Stock Alerts</option>
            </select>

          </div>

          {/* Catalog Table */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-650"></div>
            </div>
          ) : items && items.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Part Code</th>
                      <th className="py-3 px-4">Part Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-center">Available Stock</th>
                      <th className="py-3 px-4 text-center">Reorder Threshold</th>
                      <th className="py-3 px-4">Est Unit Cost</th>
                      <th className="py-3 px-4 text-center">Stock Level</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {items.map(item => {
                      const isLowStock = item.current_quantity <= item.reorder_level;
                      const displayUom = (!item.unit_of_measure || /^\d+$/.test(String(item.unit_of_measure).trim())) ? 'pcs' : item.unit_of_measure;
                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => handleOpenSticker(item)}
                          className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-950">
                            <span 
                              className="font-mono text-slate-900 group-hover:text-gold-650 group-hover:underline transition-colors inline-flex items-center gap-1.5"
                              title="Click to preview & print sticker"
                            >
                              {item.item_code}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-800 font-semibold">{item.name}</td>
                          <td className="py-3.5 px-4 text-slate-600">{item.category_name}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                            {item.current_quantity} {displayUom}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-500">
                            {item.reorder_level} {displayUom}
                          </td>
                          <td className="py-3.5 px-4">₱ {Number(item.unit_cost).toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-center">
                            {isLowStock ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center gap-0.5 max-w-[80px] mx-auto">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Low</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center max-w-[80px] mx-auto">
                                <span>Normal</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleOpenSticker(item, e)}
                                className="px-2.5 py-1 text-slate-800 hover:text-black bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-bold flex items-center gap-1 cursor-pointer text-[11px] transition-colors shadow-2xs"
                                title="Preview & Print 70mm x 40mm Sticker"
                              >
                                <Printer className="h-3 w-3 text-slate-700" />
                                <span>Sticker</span>
                              </button>

                              {hasPermission('inventory.manage') && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }}
                                  className="px-2.5 py-1 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded border border-slate-300 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                                  title="Edit Part Profile"
                                >
                                  <Edit className="h-3 w-3 text-slate-500" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              {pagination.pages > 1 && (
                <div className="flex justify-between items-center p-4 bg-slate-50 border-t">
                  <span className="text-xs text-slate-500">
                    Showing Page {pagination.page} of {pagination.pages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded text-xs cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page === pagination.pages}
                      onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                      className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded text-xs cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="p-16 bg-white border border-slate-200 rounded-xl text-center text-slate-400">
              No inventory parts found matching search description.
            </div>
          )}

        </div>
      )}

      {/* ==========================================
          TAB CONTENT PANEL 2: LEDGER MOVEMENTS CARD
          ========================================== */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <div className="p-4 bg-slate-50 border-b font-bold text-slate-800">
            Chronological Stock Card Movement Logs
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-650"></div>
            </div>
          ) : ledger && ledger.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Item Code</th>
                    <th className="py-2.5 px-4">Part Name</th>
                    <th className="py-2.5 px-4 text-center">Movement Qty</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Invoice / Ticket Reference</th>
                    <th className="py-2.5 px-4">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {ledger.map(log => {
                    const isIncrease = log.movement_type === 'Receive' || (log.movement_type === 'Adjustment' && log.quantity > 0);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{log.item_code}</td>
                        <td className="py-3 px-4 text-slate-800">{log.part_name}</td>
                        <td className={`py-3 px-4 text-center font-bold flex items-center justify-center gap-1 ${
                          isIncrease ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {isIncrease ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          <span>{Math.abs(log.quantity)}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-650">{log.movement_type}</td>
                        <td className="py-3 px-4 text-slate-550">{log.reference_number || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-600">🧑 {log.username}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400 py-10 text-center">No ledger logs available.</p>
          )}
        </div>
      )}

      {/* ==========================================
          MODAL 1: ADD / EDIT ITEM
          ========================================== */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => { setItemModalOpen(false); setEditingItem(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingItem ? `Edit Spare Part Profile (${editingItem.item_code})` : 'Add Spare Part Profile'}</h3>
              <button onClick={() => { setItemModalOpen(false); setEditingItem(null); }} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleSaveItem)} className="p-6 space-y-4 text-xs font-semibold">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Part Name *</label>
                  <input type="text" {...register('name')} placeholder="e.g. DDR4 16GB RAM" className="w-full p-2 border border-slate-350 rounded" />
                  {errors.name && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Item Code / SKU *</label>
                  <input 
                    type="text" 
                    {...register('item_code')} 
                    disabled={!!editingItem} 
                    placeholder="e.g. RAM-DDR4-16G" 
                    className={`w-full p-2 border border-slate-350 rounded ${editingItem ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} 
                  />
                  {errors.item_code && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.item_code.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  <label className="block text-slate-500 mb-1">Unit of Measure</label>
                  <input type="text" {...register('unit_of_measure')} defaultValue="pcs" placeholder="pcs, units, pack" className="w-full p-2 border border-slate-350 rounded" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Reorder Alert Level</label>
                  <input type="number" {...register('reorder_level')} className="w-full p-2 border border-slate-350 rounded" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Estimated Unit Cost (PHP)</label>
                  <input type="number" step="0.01" {...register('unit_cost')} className="w-full p-2 border border-slate-350 rounded" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Description / Spec Notes</label>
                <textarea {...register('description')} className="w-full p-2 border border-slate-350 rounded h-16 resize-none" placeholder="Add optional details..."></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => { setItemModalOpen(false); setEditingItem(null); }} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">
                  {editingItem ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: RECEIVE STOCK (Stock In)
          ========================================== */}
      {receiveModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setReceiveModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Stock In (Receive Delivery)</h3>
              <button onClick={() => setReceiveModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleReceiveStock} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">Select Spare Part Item *</label>
                <select name="inventoryItemId" required className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">-- Choose Item --</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.item_code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Quantity Received *</label>
                  <input type="number" name="quantity" defaultValue={1} min={1} required className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Invoice Cost (PHP)</label>
                  <input type="number" step="0.01" name="unitCost" defaultValue={0} className="w-full p-2 border border-slate-350 rounded" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Reference Invoice No</label>
                  <input type="text" name="referenceNumber" placeholder="INV-0001" className="w-full p-2 border border-slate-350 rounded" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Supplier / Vendor</label>
                  <input type="text" name="supplier" placeholder="e.g. Octagon IT" className="w-full p-2 border border-slate-350 rounded" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Remarks</label>
                <input type="text" name="remarks" placeholder="Purchase order reference..." className="w-full p-2 border border-slate-350 rounded" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setReceiveModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Receive Shipment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: STOCK ADJUSTMENT
          ========================================== */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setAdjustModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Inventory Adjustment Card</h3>
              <button onClick={() => setAdjustModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAdjustStock} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">Select Spare Part Item *</label>
                <select name="inventoryItemId" required className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">-- Choose Item --</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.item_code} - Current: {item.current_quantity})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Adjustment Action *</label>
                  <select name="action" required className="w-full p-2 border border-slate-350 rounded bg-white">
                    <option value="add">Add Stock (Count surplus)</option>
                    <option value="subtract">Subtract Stock (Count loss/audit)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Quantity *</label>
                  <input type="number" name="quantity" defaultValue={1} min={1} required className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Reason for Adjustment *</label>
                <input type="text" name="remarks" required placeholder="Describe discrepancy (e.g. physical count mismatch)" className="w-full p-2 border border-slate-350 rounded" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setAdjustModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Execute Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 4: SPARE PART STICKER PREVIEW & PRINT
          ========================================== */}
      {stickerModalOpen && selectedStickerItem && (
        <div 
          className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 p-4 animate-fade-in" 
          onClick={() => { setStickerModalOpen(false); setSelectedStickerItem(null); }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-slide-up" 
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-gold-500" />
                <h3 className="font-bold text-sm">Spare Part Sticker Tag & Barcode</h3>
              </div>
              <button 
                onClick={() => { setStickerModalOpen(false); setSelectedStickerItem(null); }} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-100 flex flex-col items-center select-none">
              
              <div className="text-xs font-medium flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg w-full max-w-md justify-center">
                <span>🏷️ Standard <strong>70mm x 40mm</strong> Thermal Sticker Label (Replacement Hardware)</span>
              </div>

              {/* Exact 70mm x 40mm Scaled Container Preview */}
              <div className="bg-white border-2 border-black p-3.5 rounded-sm shadow-lg w-[420px] h-[240px] text-black font-sans flex flex-col justify-between overflow-hidden">
                
                {/* Header */}
                <div className="flex justify-between items-center border-b border-black pb-1.5 mb-1">
                  <img src="/nkb-logo.png" alt="NKB Logo" className="h-6 object-contain" />
                  <div className="text-right">
                    <span className="block text-[8px] font-extrabold text-slate-700 tracking-wider uppercase leading-none">SPARE PART INVENTORY TAG</span>
                    <span className="block text-sm font-black font-mono leading-tight">{selectedStickerItem.item_code}</span>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex gap-2 overflow-hidden py-1">
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <span className="block text-[8px] font-extrabold text-slate-600 uppercase tracking-tight leading-none mb-0.5">Part Name :</span>
                      <span className="block text-[12px] font-black uppercase text-black leading-tight truncate">{selectedStickerItem.name}</span>
                    </div>

                    <div className="bg-slate-100 border-l-2 border-black px-1.5 py-0.5 my-0.5">
                      <span className="block text-[9px] font-bold text-slate-800 truncate">
                        {[
                          selectedStickerItem.brand && selectedStickerItem.brand !== 'Generic' ? selectedStickerItem.brand : '',
                          selectedStickerItem.model && selectedStickerItem.model !== 'Standard' ? selectedStickerItem.model : '',
                          selectedStickerItem.remarks || selectedStickerItem.description || 'GENUINE REPLACEMENT HARDWARE'
                        ].filter(Boolean).join(' • ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[8.5px]">
                      <div>
                        <span className="block text-[7px] font-bold text-slate-500 uppercase">Category</span>
                        <span className="font-extrabold truncate block">{selectedStickerItem.category_name || 'SPARE PART'}</span>
                      </div>
                      <div>
                        <span className="block text-[7px] font-bold text-slate-500 uppercase">Bin / Location</span>
                        <span className="font-extrabold truncate block">{selectedStickerItem.storage_location || 'IT PARTS ROOM'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[8.5px] border-t border-slate-200 pt-1">
                      <div>
                        <span className="block text-[7px] font-bold text-slate-500 uppercase">Available</span>
                        <span className="font-extrabold text-emerald-700">
                          {selectedStickerItem.current_quantity} {(!selectedStickerItem.unit_of_measure || /^\d+$/.test(String(selectedStickerItem.unit_of_measure).trim())) ? 'pcs' : selectedStickerItem.unit_of_measure}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[7px] font-bold text-slate-500 uppercase">Reorder At</span>
                        <span className="font-extrabold text-amber-700">
                          {selectedStickerItem.reorder_level} {(!selectedStickerItem.unit_of_measure || /^\d+$/.test(String(selectedStickerItem.unit_of_measure).trim())) ? 'pcs' : selectedStickerItem.unit_of_measure}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[7px] font-bold text-slate-500 uppercase">Unit Cost</span>
                        <span className="font-extrabold">₱ {Number(selectedStickerItem.unit_cost || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* QR Box */}
                  <div className="w-24 flex flex-col items-center justify-center border-l border-dashed border-slate-300 pl-2">
                    {stickerQrUrl ? (
                      <img src={stickerQrUrl} alt="QR Code" className="w-20 h-20 object-contain" />
                    ) : (
                      <div className="w-20 h-20 bg-slate-200 flex items-center justify-center text-[9px] text-slate-500 font-bold">QR Loading</div>
                    )}
                    <span className="text-[7.5px] font-mono font-black text-slate-700 tracking-wider mt-0.5">SCAN SKU</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-black pt-1 text-center">
                  <div className="text-[8px] font-black tracking-wider uppercase">PROPERTY OF NKB MANUFACTURING CORP.</div>
                  <div className="text-[6.5px] font-bold text-slate-600 uppercase">DO NOT REMOVE OR DEFACE &bull; SPARE PARTS INVENTORY</div>
                </div>

              </div>

              {/* Quantity / Copies Controller */}
              <div className="w-full max-w-md bg-white border border-slate-300 rounded-xl p-3 flex flex-col gap-2 shadow-xs">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Print Copies / Quantity:</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      (Available Stock: {selectedStickerItem.current_quantity || 0} {(!selectedStickerItem.unit_of_measure || /^\d+$/.test(String(selectedStickerItem.unit_of_measure).trim())) ? 'pcs' : selectedStickerItem.unit_of_measure})
                    </span>
                  </span>
                  <span className="text-xs font-black text-slate-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    {printCount} {printCount > 1 ? 'stickers' : 'sticker'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintCount(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded border border-slate-300 font-black text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer text-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={printCount}
                    onChange={(e) => setPrintCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-16 text-center font-black text-sm p-1.5 border border-slate-300 rounded text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setPrintCount(prev => prev + 1)}
                    className="w-8 h-8 rounded border border-slate-300 font-black text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer text-sm"
                  >
                    +
                  </button>
                  
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => setPrintCount(1)}
                      className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        printCount === 1 ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      1 pc
                    </button>
                    {selectedStickerItem.current_quantity > 0 && (
                      <button
                        type="button"
                        onClick={() => setPrintCount(Number(selectedStickerItem.current_quantity))}
                        className={`px-2.5 py-1.5 rounded text-[10px] font-black border transition-colors cursor-pointer flex items-center gap-1 ${
                          printCount === Number(selectedStickerItem.current_quantity) ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        }`}
                        title="Match available stock count"
                      >
                        <span>Match Stock ({selectedStickerItem.current_quantity} pcs)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full max-w-md pt-1">
                <button
                  type="button"
                  onClick={() => { setStickerModalOpen(false); setSelectedStickerItem(null); }}
                  className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={() => printInventorySticker(selectedStickerItem, { copies: printCount })}
                  className="flex-2 py-2.5 bg-slate-900 hover:bg-gold-650 text-white font-black text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print {printCount} Sticker{printCount > 1 ? 's' : ''} (70mm x 40mm)</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
