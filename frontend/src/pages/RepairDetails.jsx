import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Wrench, Laptop, Calendar, DollarSign, ArrowLeft, 
  Upload, CheckCircle, Save, Plus, Hammer, Trash2, Camera
} from 'lucide-react';
import { ZoomableImage } from '../components/ImageZoomModal';

export default function RepairDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, showToast } = useAuth();

  const [repair, setRepair] = useState(null);
  const [partsUsed, setPartsUsed] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [partsModalOpen, setPartsModalOpen] = useState(false);
  const [photosModalOpen, setPhotosModalOpen] = useState(false);

  // File Upload
  const [beforeFile, setBeforeFile] = useState(null);
  const [afterFile, setAfterFile] = useState(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const loadRepairDetails = async () => {
    try {
      const res = await api.get(`/repairs/${id}`);
      if (res.data.success) {
        setRepair(res.data.data.repair);
        setPartsUsed(res.data.data.partsUsed);
      }

      // Load inventory items for parts selection
      const invRes = await api.get('/inventory', { params: { limit: 100 } });
      if (invRes.data.success) {
        setInventoryItems(invRes.data.data.items);
      }
    } catch (err) {
      showToast('Error', 'Failed to retrieve repair details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepairDetails();
  }, [id]);

  // Handle Status & Cost updates
  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const status = data.get('status');
    const payload = {
      status: status,
      diagnosis: data.get('diagnosis'),
      rootCause: data.get('rootCause'),
      repairAction: data.get('repairAction'),
      laborCost: parseFloat(data.get('laborCost') || '0'),
      externalServiceCost: parseFloat(data.get('externalServiceCost') || '0'),
      testingResult: data.get('testingResult'),
      finalCondition: data.get('finalCondition'),
      remarks: data.get('remarks')
    };

    // Validation
    if ((status === 'Completed' || status === 'Unrepairable') && (!payload.diagnosis || !payload.rootCause || !payload.repairAction)) {
      alert('Completion requires Diagnosis, Root Cause, and Actions Performed.');
      return;
    }

    try {
      const res = await api.put(`/repairs/${id}`, payload);
      if (res.data.success) {
        showToast('Updated', 'Repair log updated successfully.', 'success');
        setStatusModalOpen(false);
        loadRepairDetails();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to update progress.', 'error');
    }
  };

  // Add Spare Parts to Repair
  const handleAddParts = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      inventoryItemId: data.get('inventoryItemId'),
      quantity: parseInt(data.get('quantity'))
    };

    if (!payload.inventoryItemId || !payload.quantity || payload.quantity <= 0) {
      alert('Please select a spare part and specify a positive quantity.');
      return;
    }

    try {
      const res = await api.post(`/repairs/${id}/parts`, payload);
      if (res.data.success) {
        showToast('Parts Issued', 'Spare parts deducted from inventory and added to repair costs.', 'success');
        setPartsModalOpen(false);
        loadRepairDetails();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to issue parts.', 'error');
    }
  };

  // Upload Photos
  const handleUploadPhotos = async (e) => {
    e.preventDefault();
    if (!beforeFile && !afterFile) return;

    setUploadingPhotos(true);
    const formData = new FormData();
    if (beforeFile) formData.append('beforePhoto', beforeFile);
    if (afterFile) formData.append('afterPhoto', afterFile);

    try {
      const res = await api.post(`/repairs/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        showToast('Success', 'Repair photos uploaded.', 'success');
        setPhotosModalOpen(false);
        setBeforeFile(null);
        setAfterFile(null);
        loadRepairDetails();
      }
    } catch (err) {
      showToast('Error', 'Failed to upload photos.', 'error');
    } finally {
      setUploadingPhotos(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  if (!repair) return <div className="p-8 text-center text-slate-500">Repair record not found.</div>;

  return (
    <div className="space-y-6">
      
      {/* Top Banner Control */}
      <div className="flex justify-between items-center select-none">
        <button 
          onClick={() => navigate('/repairs')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-650 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Repairs</span>
        </button>

        {hasPermission('repairs.update') && repair.status !== 'Completed' && repair.status !== 'Unrepairable' && (
          <div className="flex gap-2">
            <button 
              onClick={() => setPhotosModalOpen(true)}
              className="px-3 py-1.5 border border-slate-350 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5 text-slate-500" />
              <span>Upload Photos</span>
            </button>
            <button 
              onClick={() => setPartsModalOpen(true)}
              className="px-3 py-1.5 border border-slate-350 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-slate-500" />
              <span>Issue Parts</span>
            </button>
            <button 
              onClick={() => setStatusModalOpen(true)}
              className="px-3 py-1.5 bg-slate-950 hover:bg-gold-650 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Hammer className="h-3.5 w-3.5 text-gold-500" />
              <span>Update Progress</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Details Left, Parts/Photo Sidebar Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left main diagnostics details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 text-xs font-semibold">
            <div className="flex justify-between items-start border-b pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gold-600 uppercase">IT Hardware Repair</span>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">Repair Code: {repair.repair_number}</h2>
                <p className="text-xs text-slate-500">
                  Target Asset: <Link to={`/assets/${repair.asset_id}`} className="font-semibold text-gold-700 hover:underline">{repair.asset_name} ({repair.asset_code})</Link>
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                repair.status === 'Completed' ? 'bg-emerald-500 text-white shadow-sm' :
                repair.status === 'Unrepairable' ? 'bg-rose-600 text-white shadow-sm' :
                'bg-slate-900 text-gold-500 border border-slate-700'
              }`}>
                {repair.status}
              </span>
            </div>

            {/* Diagnostic Logs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 bg-slate-50 border p-3 rounded-lg text-[11px] leading-relaxed">
                <p className="text-[9px] font-bold uppercase text-slate-400">Reported Issue Summary</p>
                <p className="text-slate-800 font-bold mt-0.5">{repair.reported_issue}</p>
              </div>

              {repair.diagnosis && (
                <div className="bg-slate-50 border p-3 rounded-lg text-[11px] leading-relaxed">
                  <p className="text-[9px] font-bold uppercase text-slate-400">Technician Diagnosis</p>
                  <p className="text-slate-700 mt-0.5">{repair.diagnosis}</p>
                </div>
              )}

              {repair.root_cause && (
                <div className="bg-slate-50 border p-3 rounded-lg text-[11px] leading-relaxed">
                  <p className="text-[9px] font-bold uppercase text-slate-400">Verified Root Cause</p>
                  <p className="text-slate-700 mt-0.5">{repair.root_cause}</p>
                </div>
              )}

              {repair.repair_action && (
                <div className="md:col-span-2 bg-slate-50 border p-3 rounded-lg text-[11px] leading-relaxed">
                  <p className="text-[9px] font-bold uppercase text-slate-400">Actions Performed</p>
                  <p className="text-slate-700 mt-0.5">{repair.repair_action}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t text-[11px]">
              <div>
                <span className="block text-slate-400 font-bold uppercase text-[9px]">Technician Assigned</span>
                <span className="font-semibold text-slate-800 mt-0.5">🧑 {repair.technician_username || 'System'}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-bold uppercase text-[9px]">Date Received</span>
                <span className="font-semibold text-slate-800 mt-0.5">📅 {repair.date_received}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-bold uppercase text-[9px]">Start Date</span>
                <span className="font-semibold text-slate-800 mt-0.5">📅 {repair.repair_start_date || 'Not started'}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-bold uppercase text-[9px]">Completion Date</span>
                <span className="font-semibold text-slate-800 mt-0.5">📅 {repair.repair_completion_date || 'Pending'}</span>
              </div>
            </div>

            {repair.remarks && (
              <div className="pt-2 border-t border-slate-100 text-xs">
                <span className="block text-[9px] font-bold uppercase text-slate-400">Remarks / Custody Notes</span>
                <p className="text-slate-650 mt-0.5 leading-normal">{repair.remarks}</p>
              </div>
            )}
          </div>

          {/* Used Parts List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Issued Spare Parts</h3>
            
            {partsUsed && partsUsed.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-2 pb-2">Item Code</th>
                      <th className="py-2 pb-2">Part Name</th>
                      <th className="py-2 pb-2 text-center">Qty Used</th>
                      <th className="py-2 pb-2">Unit Cost</th>
                      <th className="py-2 pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {partsUsed.map(part => (
                      <tr key={part.id}>
                        <td className="py-2.5 font-bold text-slate-900">{part.item_code}</td>
                        <td className="py-2.5 text-slate-700">{part.part_name}</td>
                        <td className="py-2.5 text-center font-bold text-slate-800">{part.quantity}</td>
                        <td className="py-2.5">₱ {Number(part.unit_cost).toLocaleString()}</td>
                        <td className="py-2.5 text-right font-bold text-slate-950">
                          ₱ {(part.quantity * part.unit_cost).toLocaleString([], { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No spare parts issued to this repair log.</p>
            )}
          </div>

        </div>

        {/* Right side cost panel and photo upload review */}
        <div className="space-y-6">
          
          {/* Costs breakdown panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 text-xs font-semibold">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Expenses Sheet</h3>
            
            <div className="space-y-2 border-b pb-4">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px]">Spare Parts Expense</span>
                <span className="font-semibold text-slate-800">₱ {repair.parts_cost.toLocaleString([], { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px]">Internal Labor Cost</span>
                <span className="font-semibold text-slate-800">₱ {repair.labor_cost.toLocaleString([], { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px]">External Service Cost</span>
                <span className="font-semibold text-slate-800">₱ {repair.external_service_cost.toLocaleString([], { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-900 font-extrabold uppercase text-[10px]">Grand Total Expense</span>
              <span className="text-lg font-black text-gold-700">₱ {repair.total_repair_cost.toLocaleString([], { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Photo Display Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 select-none">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Repair Photos</h3>
            <div className="space-y-4">
              {/* Before Photo */}
              <div className="space-y-1">
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Before Repair Status</span>
                <div className="h-32 rounded-lg bg-slate-50 border flex items-center justify-center overflow-hidden">
                  {repair.before_photo_path ? (
                    <ZoomableImage 
                      src={repair.before_photo_path} 
                      alt="Before repair status" 
                      className="w-full h-full object-cover rounded-lg" 
                      containerClassName="w-full h-full rounded-lg"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400">No photo uploaded</span>
                  )}
                </div>
              </div>
              
              {/* After Photo */}
              <div className="space-y-1">
                <span className="block text-[9px] font-bold text-slate-400 uppercase">After Repair Status</span>
                <div className="h-32 rounded-lg bg-slate-50 border flex items-center justify-center overflow-hidden">
                  {repair.after_photo_path ? (
                    <ZoomableImage 
                      src={repair.after_photo_path} 
                      alt="After repair status" 
                      className="w-full h-full object-cover rounded-lg" 
                      containerClassName="w-full h-full rounded-lg"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400">No photo uploaded</span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ==========================================
          MODAL 1: UPDATE PROGRESS
          ========================================== */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setStatusModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Update Repair Progress</h3>
              <button onClick={() => setStatusModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateStatus} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs font-semibold">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Status Code *</label>
                  <select name="status" required defaultValue={repair.status} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                    <option value="Received">Received</option>
                    <option value="Diagnosing">Diagnosing</option>
                    <option value="Waiting for Parts">Waiting for Parts</option>
                    <option value="Repairing">Repairing</option>
                    <option value="Testing">Testing</option>
                    <option value="Completed">Completed</option>
                    <option value="Unrepairable">Unrepairable</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Labor Cost (PHP)</label>
                  <input type="number" step="0.01" name="laborCost" defaultValue={repair.labor_cost} className="w-full p-2 border border-slate-350 rounded" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">External Service Cost</label>
                  <input type="number" step="0.01" name="externalServiceCost" defaultValue={repair.external_service_cost} className="w-full p-2 border border-slate-350 rounded" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Diagnosis Details</label>
                  <textarea name="diagnosis" defaultValue={repair.diagnosis || ''} className="w-full p-2 border border-slate-350 rounded h-16 resize-none" placeholder="Detail hardware findings..."></textarea>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Root Cause Explanation</label>
                  <textarea name="rootCause" defaultValue={repair.root_cause || ''} className="w-full p-2 border border-slate-350 rounded h-16 resize-none" placeholder="Describe verified root failure..."></textarea>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Repair Actions Performed</label>
                <textarea name="repairAction" defaultValue={repair.repair_action || ''} className="w-full p-2 border border-slate-350 rounded h-16 resize-none" placeholder="What replacement or fixes were completed..."></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Testing Results</label>
                  <input type="text" name="testingResult" defaultValue={repair.testing_result || ''} placeholder="Disk benchmarks, memory passes..." className="w-full p-2 border border-slate-350 rounded" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Final Asset Condition</label>
                  <select name="finalCondition" defaultValue={repair.final_condition || 'Good'} className="w-full p-2 border border-slate-350 rounded bg-white">
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                    <option value="Damaged">Damaged (Unrepairable)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Remarks</label>
                <input type="text" name="remarks" defaultValue={repair.remarks || ''} className="w-full p-2 border border-slate-350 rounded" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setStatusModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: ISSUE SPARE PARTS
          ========================================== */}
      {partsModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setPartsModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Issue Spare Parts</h3>
              <button onClick={() => setPartsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddParts} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">Select Spare Part Item *</label>
                <select name="inventoryItemId" required className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                  <option value="">-- Choose Item --</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.item_code} - Stock: {item.current_quantity} {item.unit_of_measure})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-bold">Quantity to Use *</label>
                <input type="number" name="quantity" defaultValue={1} min={1} required className="w-full p-2 border border-slate-350 rounded text-slate-900" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setPartsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Issue and Deduct</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: UPLOAD REPAIR PHOTOS
          ========================================== */}
      {photosModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setPhotosModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Upload Status Photos</h3>
              <button onClick={() => setPhotosModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleUploadPhotos} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1.5">"Before" Repair Photo</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setBeforeFile(e.target.files[0])} 
                  className="w-full p-2 border border-slate-350 rounded bg-slate-55"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5">"After" Repair Photo</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setAfterFile(e.target.files[0])} 
                  className="w-full p-2 border border-slate-350 rounded bg-slate-55"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setPhotosModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-55 cursor-pointer">Cancel</button>
                <button 
                  type="submit" 
                  disabled={uploadingPhotos || (!beforeFile && !afterFile)}
                  className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 disabled:opacity-50 cursor-pointer"
                >
                  {uploadingPhotos ? 'Uploading...' : 'Save Photos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
