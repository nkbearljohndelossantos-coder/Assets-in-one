import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, Key, ShieldAlert, Check, X, 
  Trash2, UserCheck, Eye, EyeOff, ShieldCheck, Download
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const licenseSchema = z.object({
  software_name: z.string().min(1, 'Software name is required'),
  license_key: z.string().min(1, 'License key is required'),
  total_seats: z.coerce.number().min(1, 'License seats must be at least 1'),
  purchase_date: z.string().optional(),
  expiration_date: z.string().optional(),
  supplier: z.string().optional(),
  remarks: z.string().optional()
});

export default function Licenses() {
  const { hasPermission, showToast } = useAuth();
  
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected License seat view details
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [seats, setSeats] = useState([]);
  const [revealedKey, setRevealedKey] = useState('');
  const [revealingId, setRevealingId] = useState(null);

  // Metadata dropdowns
  const [employees, setEmployees] = useState([]);
  const [assets, setAssets] = useState([]);

  // Auto fill seat states
  const [selectedSeatEmp, setSelectedSeatEmp] = useState('');
  const [selectedSeatAsset, setSelectedSeatAsset] = useState('');

  const handleSeatEmpChange = (e) => {
    const empId = e.target.value;
    setSelectedSeatEmp(empId);
    if (empId) {
      const assignedAsset = assets.find(ast => String(ast.employee_id) === String(empId));
      if (assignedAsset) {
        setSelectedSeatAsset(String(assignedAsset.id));
      }
    }
  };

  // Modals state
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [expiringFilter, setExpiringFilter] = useState('false');

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(licenseSchema)
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/licenses', {
        params: {
          search,
          expiring: expiringFilter
        }
      });
      if (res.data.success) {
        setLicenses(res.data.data);
      }

      // Preload assets and employees
      const empRes = await api.get('/employees', { params: { limit: 100 } });
      if (empRes.data.success) setEmployees(empRes.data.data.employees);

      const astRes = await api.get('/assets', { params: { limit: 100 } });
      if (astRes.data.success) setAssets(astRes.data.data.assets);

    } catch (e) {
      showToast('Error', 'Failed to retrieve software licenses catalog.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, expiringFilter]);

  const loadSeats = async (licenseId) => {
    try {
      const res = await api.get(`/licenses/${licenseId}/seats`);
      if (res.data.success) {
        setSeats(res.data.data);
      }
    } catch (e) {
      showToast('Error', 'Failed to load seat allocations.', 'error');
    }
  };

  const handleSelectLicense = (lic) => {
    setSelectedLicense(lic);
    setRevealedKey('');
    setRevealingId(null);
    loadSeats(lic.id);
  };

  const handleCreateLicense = async (data) => {
    setSaving(true);
    try {
      const res = await api.post('/licenses', data);
      if (res.data.success) {
        showToast('Created', 'Secure software license record registered.', 'success');
        setLicenseModalOpen(false);
        reset();
        loadData();
      }
    } catch (err) {
      showToast('Error', 'Failed to save license record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleIssueSeat = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      employeeId: data.get('employeeId') || null,
      assetId: data.get('assetId') || null
    };

    if (!payload.employeeId && !payload.assetId) {
      alert('Please link either an Employee or an Asset to allocate seat.');
      return;
    }

    try {
      const res = await api.post(`/licenses/${selectedLicense.id}/assign`, payload);
      if (res.data.success) {
        showToast('Seat Allocated', 'Software seat mapped successfully.', 'success');
        setSeatModalOpen(false);
        // Refresh details
        loadSeats(selectedLicense.id);
        loadData(); // reload totals
      }
    } catch (err) {
      showToast('Allocation Error', err.response?.data?.message || 'Failed to issue seat.', 'error');
    }
  };

  const handleRevokeSeat = async (seatId) => {
    if (!window.confirm('Are you sure you want to revoke this seat allocation?')) return;
    try {
      const res = await api.post(`/licenses/${selectedLicense.id}/unassign`, { assignmentId: seatId });
      if (res.data.success) {
        showToast('Revoked', 'Software seat access deactivated.', 'success');
        loadSeats(selectedLicense.id);
        loadData();
      }
    } catch (err) {
      showToast('Error', 'Failed to revoke seat allocation.', 'error');
    }
  };

  const handleRevealKey = async (licId) => {
    if (revealingId === licId) {
      setRevealedKey('');
      setRevealingId(null);
      return;
    }
    try {
      const res = await api.get(`/licenses/${licId}/reveal`);
      if (res.data.success) {
        setRevealedKey(res.data.key);
        setRevealingId(licId);
        showToast('Security Alert', 'Decrypted license key displayed. Action recorded in audit logs.', 'warning');
      }
    } catch (e) {
      showToast('Security Denied', 'Insufficient authorization to reveal cryptography keys.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Software Licenses</h1>
          <p className="text-xs text-slate-500 mt-1">Manage corporate software licenses, keys encryption, and seat limits.</p>
        </div>

        {hasPermission('licenses.create') && (
          <button 
            onClick={() => setLicenseModalOpen(true)}
            className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Software</span>
          </button>
        )}
      </div>

      {/* Grid: catalog Left, seat mapping details Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Catalog */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search software name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-lg text-xs text-slate-900"
              />
            </div>
            <select
              value={expiringFilter}
              onChange={e => setExpiringFilter(e.target.value)}
              className="p-2 border border-slate-350 rounded-lg text-xs text-slate-900 bg-white"
            >
              <option value="false">All Expiration Schedules</option>
              <option value="true">⚠️ Expiring within 30 Days</option>
            </select>
          </div>

          {/* Catalog list */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-650"></div>
            </div>
          ) : licenses && licenses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {licenses.map(lic => {
                const availableSeats = lic.total_seats - lic.used_seats;
                const isFull = availableSeats <= 0;
                const isSelected = selectedLicense?.id === lic.id;

                return (
                  <div 
                    key={lic.id}
                    onClick={() => handleSelectLicense(lic)}
                    className={`p-5 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between bg-white shadow-sm ${
                      isSelected ? 'border-gold-500 ring-1 ring-gold-500' : 'border-slate-200 hover:border-gold-500 hover:shadow'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-sm text-slate-900">{lic.software_name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          isFull ? 'bg-rose-50 text-rose-700 border border-rose-250' : 'bg-emerald-50 text-emerald-700 border border-emerald-250'
                        }`}>
                          {isFull ? 'Seats Full' : `${availableSeats} Seats Available`}
                        </span>
                      </div>
                      
                      {/* Key reveal and masked view */}
                      <div className="bg-slate-50 border p-2.5 rounded-lg flex justify-between items-center text-[10px] font-mono leading-none">
                        <span className="truncate max-w-[150px] font-bold">
                          {revealingId === lic.id ? revealedKey : '••••-••••-••••-••••'}
                        </span>
                        {hasPermission('licenses.reveal') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRevealKey(lic.id); }}
                            className="p-1 hover:bg-slate-200 text-slate-500 rounded cursor-pointer"
                          >
                            {revealingId === lic.id ? <EyeOff className="h-3.5 w-3.5 text-slate-700" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t mt-4 flex justify-between items-center text-[10px] text-slate-450 font-semibold leading-none">
                      <span>Purchased: {lic.purchase_date || 'N/A'}</span>
                      <span className={lic.expiration_date && new Date(lic.expiration_date) < new Date() ? 'text-rose-600 font-bold' : ''}>
                        Expires: {lic.expiration_date || 'Lifetime'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-white border rounded-xl">No software licenses match.</div>
          )}

        </div>

        {/* Right Side: Seat allocations details */}
        <div className="space-y-4 select-none">
          {selectedLicense ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Seat Allocations</h3>
                  <p className="text-[10px] font-bold text-slate-900 mt-0.5">{selectedLicense.software_name}</p>
                </div>
                {hasPermission('licenses.manage') && (
                  <button 
                    onClick={() => setSeatModalOpen(true)}
                    className="px-3 py-1 bg-slate-900 hover:bg-gold-650 text-white rounded text-[10px] font-bold cursor-pointer"
                  >
                    Allocate Seat
                  </button>
                )}
              </div>

              {/* Progress seat limits bar */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between font-bold text-slate-750">
                  <span>Seats Assigned</span>
                  <span>{selectedLicense.used_seats} of {selectedLicense.total_seats} Seats</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className="bg-gold-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (selectedLicense.used_seats / selectedLicense.total_seats) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Seats active list */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {seats && seats.length > 0 ? (
                  seats.map(seat => (
                    <div key={seat.id} className="text-xs bg-slate-50 border p-2.5 rounded-lg space-y-1.5 font-semibold leading-normal">
                      <div className="flex justify-between items-start">
                        <div>
                          {seat.employee_name && <p className="text-slate-805 font-bold">🧑 {seat.employee_name}</p>}
                          {seat.asset_name && <p className="text-slate-805 font-bold">💻 {seat.asset_name} ({seat.asset_code})</p>}
                        </div>
                        {hasPermission('licenses.manage') && (
                          <button 
                            onClick={() => handleRevokeSeat(seat.id)}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400 font-semibold leading-none">Assigned: {seat.date_assigned}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">No seats issued to devices or employees.</p>
                )}
              </div>

            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-xl">
              Choose a software package to view seat utilization and assignments.
            </div>
          )}
        </div>

      </div>

      {/* ==========================================
          MODAL 1: ADD SOFTWARE LICENSE
          ========================================== */}
      {licenseModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setLicenseModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Register Software Package</h3>
              <button onClick={() => setLicenseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleCreateLicense)} className="p-6 space-y-4 text-xs font-semibold">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1">Software Package Name *</label>
                  <input type="text" {...register('software_name')} placeholder="e.g. Office 365 Enterprise" className="w-full p-2 border border-slate-350 rounded" />
                  {errors.software_name && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.software_name.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">License Key (Stored Securely) *</label>
                <input type="text" {...register('license_key')} placeholder="e.g. AAAAA-BBBBB-CCCCC-DDDDD" className="w-full p-2 border border-slate-350 rounded font-mono text-slate-900" />
                {errors.license_key && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.license_key.message}</p>}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Seat Capacity *</label>
                  <input type="number" {...register('total_seats')} defaultValue={1} min={1} className="w-full p-2 border border-slate-350 rounded text-slate-900" />
                  {errors.total_seats && <p className="text-rose-600 text-[10px] mt-0.5 font-bold">{errors.total_seats.message}</p>}
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1">Purchase Date</label>
                  <input type="date" {...register('purchase_date')} defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Expiration Date (Blank Lifetime)</label>
                  <input type="date" {...register('expiration_date')} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Vendor / Supplier</label>
                  <input type="text" {...register('supplier')} placeholder="e.g. Microsoft reseller" className="w-full p-2 border border-slate-350 rounded" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Remarks</label>
                <input type="text" {...register('remarks')} className="w-full p-2 border border-slate-350 rounded" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setLicenseModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Encrypt & Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: ALLOCATE SEAT
          ========================================== */}
      {seatModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setSeatModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Issue Software License Seat</h3>
              <button onClick={() => setSeatModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleIssueSeat} className="p-6 space-y-4 text-xs font-semibold">
              <div className="bg-slate-50 border p-3 rounded text-[11px] leading-relaxed">
                Allocating seat from: <span className="font-bold text-slate-900">{selectedLicense.software_name}</span>
                <br/>
                Available seat slots: <b>{selectedLicense.total_seats - selectedLicense.used_seats}</b>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Assign to Employee</label>
                  <select 
                    name="employeeId" 
                    value={selectedSeatEmp}
                    onChange={handleSeatEmpChange}
                    className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.full_name || `${e.first_name} ${e.last_name}`}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-slate-500 mb-1">Install on Workstation</label>
                  <select 
                    name="assetId" 
                    value={selectedSeatAsset}
                    onChange={e => setSelectedSeatAsset(e.target.value)}
                    className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900"
                  >
                    <option value="">-- Choose Asset --</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.asset_code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setSeatModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded font-bold hover:bg-slate-55 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Map Seat</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
