import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, Filter, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  RotateCw, Package, Check, X, FileText, ChevronRight, History
} from 'lucide-react';
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
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(itemSchema)
  });

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

      const catsRes = await api.get('/settings/inventory-categories');
      if (catsRes.data.success) {
        setCategories(catsRes.data.data);
      }
    } catch (err) {
      showToast('Error', 'Failed to retrieve inventory records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, page, search, catFilter, lowStockFilter]);

  // Create Inventory Profile
  const handleCreateItem = async (data) => {
    try {
      const res = await api.post('/inventory', data);
      if (res.data.success) {
        showToast('Created', 'Inventory item profile created.', 'success');
        setItemModalOpen(false);
        reset();
        loadData();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to create item.', 'error');
    }
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
                onClick={() => setItemModalOpen(true)}
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {items.map(item => {
                      const isLowStock = item.current_quantity <= item.reorder_level;
                      return (
                        <tr key={item.id} className="hover:bg-slate-55/50">
                          <td className="py-3.5 px-4 font-bold text-slate-950">{item.item_code}</td>
                          <td className="py-3.5 px-4 text-slate-800">{item.name}</td>
                          <td className="py-3.5 px-4">{item.category_name}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                            {item.current_quantity} {item.unit_of_measure}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-500">
                            {item.reorder_level} {item.unit_of_measure}
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
          MODAL 1: ADD NEW ITEM
          ========================================== */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setItemModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Add Spare Part Profile</h3>
              <button onClick={() => setItemModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleCreateItem)} className="p-6 space-y-4 text-xs font-semibold">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Part Name *</label>
                  <input type="text" {...register('name')} placeholder="e.g. DDR4 16GB RAM" className="w-full p-2 border border-slate-350 rounded" />
                  {errors.name && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Item Code / SKU *</label>
                  <input type="text" {...register('item_code')} placeholder="e.g. RAM-DDR4-16G" className="w-full p-2 border border-slate-350 rounded" />
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
                  <input type="text" {...register('unit_of_measure')} placeholder="pcs, units, pack" className="w-full p-2 border border-slate-350 rounded" />
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
                <button type="button" onClick={() => setItemModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Save Product</button>
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

    </div>
  );
}
