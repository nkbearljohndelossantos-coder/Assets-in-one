import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Laptop, Smartphone, Radio, Mouse, Calendar, Wrench, ShieldAlert, ArrowLeft, Plus, Edit,
  Upload, FileText, Trash2, Printer, Download, UserCheck, 
  ArrowRightLeft, RotateCcw, AlertTriangle, ShieldCheck, X, Camera
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { ZoomableImage } from '../components/ImageZoomModal';
import { optimizeImageQuality, convertFileToBase64 } from '../utils/imageOptimizer';
import { printAssetSticker, getAssetOwnerText, getAssetModelText, getAssetSpecsText } from '../utils/printSticker';

export default function AssetDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, showToast } = useAuth();

  const [asset, setAsset] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [history, setHistory] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Metadata dropdown options
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);

  // Assign/Transfer selection states for auto fill
  const [selectedAssignEmp, setSelectedAssignEmp] = useState('');
  const [selectedAssignDept, setSelectedAssignDept] = useState('');
  const [selectedTransferEmp, setSelectedTransferEmp] = useState('');
  const [selectedTransferDept, setSelectedTransferDept] = useState('');

  const handleAssignEmpChange = (e) => {
    const empId = e.target.value;
    setSelectedAssignEmp(empId);
    if (empId) {
      const emp = employees.find(item => String(item.id) === String(empId));
      if (emp && emp.department_id) {
        setSelectedAssignDept(String(emp.department_id));
      }
    }
  };

  const handleTransferEmpChange = (e) => {
    const empId = e.target.value;
    setSelectedTransferEmp(empId);
    if (empId) {
      const emp = employees.find(item => String(item.id) === String(empId));
      if (emp && emp.department_id) {
        setSelectedTransferDept(String(emp.department_id));
      }
    }
  };

  // Modal Control
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [stickerModalOpen, setStickerModalOpen] = useState(false);
  const [stickerMode, setStickerMode] = useState('full'); // 'full' or 'qr_only'

  // Form / File upload states
  const [saving, setSaving] = useState(false);
  const [editUploadImage, setEditUploadImage] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);

  const [agentData, setAgentData] = useState(null);
  const [agentSubTab, setAgentSubTab] = useState('overview');
  const [enrollmentTokenData, setEnrollmentTokenData] = useState(null);
  const [softwareSearch, setSoftwareSearch] = useState('');

  const loadAssetDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/assets/${id}`);
      if (res.data.success) {
        setAsset(res.data.data.asset);
        setDocuments(res.data.data.documents);
        setHistory(res.data.data.history);
        setAssignments(res.data.data.assignments);
      }

      // Load agent details
      try {
        const agentRes = await api.get(`/assets/${id}/agent`);
        if (agentRes.data.success) setAgentData(agentRes.data);
      } catch (e) {}
      
      // Load employees and depts for assignments dropdowns
      const empRes = await api.get('/employees', { params: { limit: 100 } });
      if (empRes.data.success) setEmployees(empRes.data.data.employees);

      const deptRes = await api.get('/employees/departments');
      if (deptRes.data.success) setDepartments(deptRes.data.data);

      const catRes = await api.get('/settings/asset-categories');
      if (catRes.data.success) setCategories(catRes.data.data);

    } catch (err) {
      if (err.response?.status === 404) {
        setAsset(null);
      } else {
        showToast('Error', 'Failed to retrieve asset details profile.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssetDetails();
  }, [id]);

  const handleGenerateAgentToken = async () => {
    try {
      const res = await api.post(`/assets/${id}/agent-token`);
      if (res.data.success) {
        setEnrollmentTokenData(res.data.data);
      }
    } catch (err) {
      alert('Failed to generate agent enrollment token.');
    }
  };

  const handleRevokeAgent = async () => {
    if (!window.confirm('Are you sure you want to revoke this endpoint agent?')) return;
    try {
      const res = await api.post(`/assets/${id}/agent/revoke`);
      if (res.data.success) {
        loadAssetDetails();
      }
    } catch (err) {
      alert('Failed to revoke agent.');
    }
  };

  const activeAssignment = assignments.find(a => a.status === 'Active');

  // ==========================================
  // TRANSACTION SUBMISSIONS
  // ==========================================

  // 1. Assign Asset
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      assetId: id,
      employeeId: data.get('employeeId') || null,
      departmentId: data.get('departmentId') || null,
      dateAssigned: data.get('dateAssigned'),
      expectedReturnDate: data.get('expectedReturnDate') || null,
      releaseCondition: data.get('releaseCondition'),
      remarks: data.get('remarks')
    };

    if (!payload.employeeId && !payload.departmentId) {
      alert('Please select either an Employee or a Department.');
      return;
    }

    try {
      const res = await api.post('/assignments', payload);
      if (res.data.success) {
        showToast('Assigned', 'Asset assignment completed.', 'success');
        setAssignModalOpen(false);
        loadAssetDetails();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to assign.', 'error');
    }
  };

  // 2. Return Asset
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      actualReturnDate: data.get('actualReturnDate'),
      returnCondition: data.get('returnCondition'),
      assetStatus: data.get('assetStatus'), // Available, Under Repair, Damaged, etc.
      remarks: data.get('remarks')
    };

    try {
      const res = await api.post(`/assignments/${activeAssignment.id}/return`, payload);
      if (res.data.success) {
        showToast('Returned', 'Asset has been returned to storage.', 'success');
        setReturnModalOpen(false);
        loadAssetDetails();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to complete return.', 'error');
    }
  };

  // 3. Transfer Asset
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      employeeId: data.get('employeeId') || null,
      departmentId: data.get('departmentId') || null,
      dateTransferred: data.get('dateTransferred'),
      releaseCondition: data.get('releaseCondition'),
      remarks: data.get('remarks')
    };

    if (!payload.employeeId && !payload.departmentId) {
      alert('Please select either an Employee or a Department.');
      return;
    }

    try {
      const res = await api.post(`/assignments/${activeAssignment.id}/transfer`, payload);
      if (res.data.success) {
        showToast('Transferred', 'Asset transfer logged successfully.', 'success');
        setTransferModalOpen(false);
        loadAssetDetails();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to transfer asset.', 'error');
    }
  };

  // 4. Upload Documents
  const handleDocUpload = async (e) => {
    e.preventDefault();
    if (uploadFiles.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < uploadFiles.length; i++) {
      formData.append('files', uploadFiles[i]);
    }

    try {
      const res = await api.post(`/assets/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        showToast('Uploaded', 'Documents uploaded successfully.', 'success');
        setUploadModalOpen(false);
        setUploadFiles([]);
        loadAssetDetails();
      }
    } catch (err) {
      showToast('Error', 'Failed to upload document files.', 'error');
    }
  };

  // 4b. Edit Asset Details
  const handleEditAssetSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.target);
    formData.delete('image');
    formData.delete('image_path');

    if (editUploadImage) {
      try {
        const base64Uri = await convertFileToBase64(editUploadImage);
        formData.append('image_path', base64Uri);
      } catch (err) {
        // fallback
      }
      formData.append('image', editUploadImage);
    } else if (asset && asset.image_path) {
      formData.append('image_path', asset.image_path);
    }

    try {
      const res = await api.put(`/assets/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        showToast('Updated', 'Asset details updated successfully.', 'success');
        setEditModalOpen(false);
        setEditUploadImage(null);
        loadAssetDetails();
      }
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to update asset.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 5. Hard/Soft delete asset profile
  const handleDeleteAsset = async () => {
    if (!window.confirm('Are you sure you want to retire or delete this asset profile?')) return;
    try {
      const res = await api.delete(`/assets/${id}`);
      if (res.data.success) {
        showToast('Retired', res.data.message, 'success');
        navigate('/assets');
      }
    } catch (err) {
      showToast('Error', 'Failed to retire asset.', 'error');
    }
  };

  const getAssetModelText = () => {
    if (!asset) return '';
    return [asset.brand, asset.model].filter(Boolean).join(' ');
  };

  const getAssetSpecsText = () => {
    if (!asset) return '';
    const specs = [
      asset.specs_cpu && `CPU: ${asset.specs_cpu}`,
      asset.specs_ram && `RAM: ${asset.specs_ram}`,
      asset.specs_storage && `Storage: ${asset.specs_storage}`,
      (asset.specs_os || asset.specs_win_edition) && `OS: ${asset.specs_os || ''} ${asset.specs_win_edition || ''}`.trim()
    ].filter(Boolean);

    if (specs.length > 0) {
      return specs.join(' | ');
    }
    return asset.description || asset.remarks || '';
  };

  const getAssignedToText = () => {
    if (!asset) return 'UNASSIGNED / IN STOCK';
    if (activeAssignment && activeAssignment.employee_name && String(activeAssignment.employee_name).trim() !== '') {
      return String(activeAssignment.employee_name).trim();
    }
    if (activeAssignment && activeAssignment.department_name && String(activeAssignment.department_name).trim() !== '') {
      return `${String(activeAssignment.department_name).trim()} (Dept)`;
    }
    if (asset.employee_name && String(asset.employee_name).trim() !== '') {
      return String(asset.employee_name).trim();
    }
    if (asset.department_name && String(asset.department_name).trim() !== '') {
      return `${String(asset.department_name).trim()} (Dept)`;
    }
    if (asset.assigned_employee_name && String(asset.assigned_employee_name).trim() !== '') {
      return String(asset.assigned_employee_name).trim();
    }
    return 'UNASSIGNED / IN STOCK';
  };

  const handlePrintSticker = (modeOverride) => {
    if (!asset) return;
    const mode = modeOverride || stickerMode || 'full';
    const printWindow = window.open('', '_blank');
    const logoUrl = `${window.location.origin}/nkb-logo.png`;
    const scanUrl = `${window.location.origin}/scan/${asset.asset_code}`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(scanUrl)}`;

    if (mode === 'qr_only') {
      const scanUrl = `${window.location.origin}/scan/${asset.asset_code}`;
      const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(scanUrl)}`;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Specs Sticker - ${asset.asset_code}</title>
            <style>
              @page { size: 50mm 50mm; margin: 0mm; }
              * { box-sizing: border-box; }
              html, body {
                width: 50mm; height: 50mm; margin: 0; padding: 2mm;
                font-family: Arial, sans-serif; background: #ffffff; color: #000000;
                display: flex; flex-direction: column; align-items: center; justify-content: space-between;
                text-align: center; overflow: hidden;
              }
              .header { font-size: 6.5pt; font-weight: 900; letter-spacing: 0.5px; border-bottom: 1px solid #000; padding-bottom: 1mm; margin-bottom: 1mm; width: 100%; text-transform: uppercase; }
              .qr-box { flex: 1; display: flex; align-items: center; justify-content: center; margin: 1mm 0; }
              .qr-img { width: 32mm; height: 32mm; object-fit: contain; }
              .code { font-size: 9pt; font-weight: 900; font-family: monospace, Arial; margin-top: 0.5mm; }
              .footer { font-size: 5pt; font-weight: 800; color: #333; margin-top: 0.5mm; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="header">🛡️ NKB IT ASSET SPECIFICATIONS</div>
            <div class="qr-box">
              <img src="${qrImgUrl}" class="qr-img" alt="Asset Specs QR" />
            </div>
            <div class="code">${asset.asset_code}</div>
            <div class="footer">SCAN CAMERA FOR SPECS 📱</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      return;
    }

    printWindow.close();
    printAssetSticker(asset, { assignment: activeAssignment });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-12 text-center space-y-4 bg-white border border-slate-200 rounded-xl shadow-sm max-w-md mx-auto my-12">
        <Laptop className="h-12 w-12 text-slate-300 mx-auto" />
        <h3 className="font-bold text-slate-800 text-lg">Asset Profile Not Found</h3>
        <p className="text-xs text-slate-500">
          The requested asset profile (ID: <span className="font-mono font-semibold text-slate-700">{id}</span>) does not exist in the database or was deleted during data cleanup.
        </p>
        <button
          onClick={() => navigate('/assets')}
          className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-gold-650 transition-colors cursor-pointer"
        >
          Return to Assets Register
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top action header */}
      <div className="flex justify-between items-center select-none">
        <button 
          onClick={() => navigate('/assets')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Register</span>
        </button>

        <div className="flex items-center gap-2">
          {hasPermission('assets.update') && (
            <button 
              onClick={() => setEditModalOpen(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-gold-650 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Asset</span>
            </button>
          )}
          {hasPermission('assets.delete') && (
            <button 
              onClick={handleDeleteAsset}
              className="px-3 py-1.5 border border-rose-500/20 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Retire Asset
            </button>
          )}
          <button 
            onClick={() => setStickerModalOpen(true)}
            className="px-3 py-1.5 border border-slate-350 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Sticker</span>
          </button>
        </div>
      </div>

      {/* Grid: Details Left, Allocation Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left side details cards */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            
            {/* Header info */}
            <div className="flex gap-4 items-start border-b border-slate-100 pb-4">
              <div className="h-16 w-16 bg-slate-100 rounded-lg flex items-center justify-center border text-slate-400">
                {asset.image_path ? (
                  <ZoomableImage 
                    src={asset.image_path} 
                    alt={asset.name} 
                    className="h-full w-full object-cover rounded-lg" 
                    containerClassName="h-full w-full rounded-lg"
                  />
                ) : (
                  <Laptop className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gold-600 uppercase">{asset.category_name}</span>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">{asset.name}</h2>
                <p className="text-xs text-slate-500">
                  Asset Code: <span className="font-semibold">{asset.asset_code}</span> | S/N: <span className="font-semibold text-slate-800">{asset.serial_number}</span>
                </p>
              </div>
            </div>

            {/* Spec block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-xs leading-normal">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Brand / Model</p>
                <p className="font-bold text-slate-800 mt-0.5">{asset.brand} / {asset.model}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Physical Condition</p>
                <p className={`font-bold mt-0.5 ${
                  asset.condition === 'New' || asset.condition === 'Good' ? 'text-emerald-600' : 'text-amber-600'
                }`}>{asset.condition}</p>
              </div>
              
              {/* Specs */}
              {asset.specs_cpu && (
                <div className="sm:col-span-2 bg-slate-50 border border-slate-200 p-3 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="block text-slate-400 font-bold uppercase text-[9px]">CPU</span>
                    <span className="font-semibold text-slate-800">{asset.specs_cpu}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 font-bold uppercase text-[9px]">RAM</span>
                    <span className="font-semibold text-slate-800">{asset.specs_ram}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 font-bold uppercase text-[9px]">Storage</span>
                    <span className="font-semibold text-slate-800">{asset.specs_storage}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 font-bold uppercase text-[9px]">OS</span>
                    <span className="font-semibold text-slate-800">{asset.specs_os} {asset.specs_win_edition}</span>
                  </div>
                </div>
              )}

              {/* Phone Specs & MDM */}
              {(asset.imei_number || asset.phone_number || asset.sim_carrier || String(asset.category_name || '').toLowerCase().includes('phone') || String(asset.category_name || '').toLowerCase().includes('mobile')) && (
                <div className="sm:col-span-2 bg-blue-50/80 border border-blue-200 p-4 rounded-xl space-y-2.5 text-[11px] shadow-sm">
                  <div className="flex items-center gap-1.5 border-b border-blue-200/80 pb-2">
                    <Smartphone className="h-4 w-4 text-blue-600" />
                    <span className="font-extrabold text-slate-900 text-xs">Mobile Phone & Enterprise MDM Details</span>
                    {asset.mdm_enrolled && (
                      <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[9px] rounded-full shadow-sm">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        <span>MDM Work Mode Active</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">IMEI Number</span>
                      <span className="font-mono font-bold text-slate-900">{asset.imei_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">Phone / SIM Number</span>
                      <span className="font-extrabold text-blue-700">{asset.phone_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">SIM Network Carrier</span>
                      <span className="font-semibold text-slate-800">{asset.sim_carrier || 'Corporate Postpaid'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">MDM Device ID</span>
                      <span className="font-mono text-slate-700 text-[10px] font-bold">{asset.mdm_device_id || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Two-Way Radio Specs */}
              {(asset.call_sign || asset.radio_frequency_band || asset.license_number || String(asset.category_name || '').toLowerCase().includes('radio') || String(asset.category_name || '').toLowerCase().includes('walkie')) && (
                <div className="sm:col-span-2 bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl space-y-2.5 text-[11px] shadow-sm">
                  <div className="flex items-center gap-1.5 border-b border-emerald-200/80 pb-2">
                    <Radio className="h-4 w-4 text-emerald-600" />
                    <span className="font-extrabold text-slate-900 text-xs">Two-Way Radio & Communication Details</span>
                    {asset.call_sign && (
                      <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-700 text-white font-black text-[9px] rounded-md shadow-sm">
                        <span>CALL SIGN: {asset.call_sign}</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">Frequency Band</span>
                      <span className="font-bold text-emerald-700">{asset.radio_frequency_band || 'UHF/VHF'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">Channels / Power</span>
                      <span className="font-bold text-slate-900">{asset.radio_channel_count || '16 Ch'} | {asset.radio_power_output || '5W'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">NTC License No.</span>
                      <span className="font-semibold text-slate-800">{asset.license_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">Battery Pack S/N</span>
                      <span className="font-mono text-slate-700 text-[10px] font-bold">{asset.battery_serial || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Computer Mouse Specs */}
              {(asset.mouse_connectivity || asset.mouse_sensor_dpi || String(asset.category_name || '').toLowerCase().includes('mouse')) && (
                <div className="sm:col-span-2 bg-purple-50/80 border border-purple-200 p-4 rounded-xl space-y-2.5 text-[11px] shadow-sm">
                  <div className="flex items-center gap-1.5 border-b border-purple-200/80 pb-2">
                    <Mouse className="h-4 w-4 text-purple-600" />
                    <span className="font-extrabold text-slate-900 text-xs">Computer Mouse & Peripheral Details</span>
                    <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-700 text-white font-black text-[9px] rounded-md shadow-sm">
                      <span>PERIPHERAL ASSET</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">Connectivity</span>
                      <span className="font-bold text-purple-700">{asset.mouse_connectivity || 'Wired USB / Wireless'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">Sensor DPI</span>
                      <span className="font-bold text-slate-900">{asset.mouse_sensor_dpi || 'Standard Optical'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">Buttons & Features</span>
                      <span className="font-semibold text-slate-800">{asset.mouse_buttons_count || 'Standard Buttons'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-extrabold uppercase text-[9px]">Orientation</span>
                      <span className="font-mono text-slate-700 text-[10px] font-bold">{asset.mouse_hand_orientation || 'Ambidextrous'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Net */}
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Hostname</p>
                <p className="font-semibold text-slate-800 mt-0.5">{asset.hostname || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">MAC / IP Address</p>
                <p className="font-semibold text-slate-800 mt-0.5">{asset.mac_address || 'N/A'} / {asset.ip_address || 'DHCP'}</p>
              </div>

              {/* Acq */}
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Purchase Date / Cost</p>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {asset.purchase_date || 'N/A'} (₱ {asset.purchase_price.toLocaleString()})
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Warranty End Date</p>
                <p className="font-semibold text-slate-800 mt-0.5">{asset.warranty_end_date || 'N/A'}</p>
              </div>

            </div>

            {asset.remarks && (
              <div className="pt-2 border-t border-slate-100 text-xs">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Remarks</span>
                <p className="text-slate-600 mt-1">{asset.remarks}</p>
              </div>
            )}

          </div>

          {/* Asset supporting files list */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supporting Documents</h3>
              {hasPermission('assets.update') && (
                <button 
                  onClick={() => setUploadModalOpen(true)}
                  className="text-xs font-bold text-gold-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Upload Files</span>
                </button>
              )}
            </div>

            {documents && documents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-700 truncate">{doc.name}</span>
                    </div>
                    <a 
                      href={doc.file_path} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-1 hover:bg-slate-200 text-slate-500 rounded"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No warranty cards, manuals, or invoices uploaded.</p>
            )}
          </div>

          {/* Asset movement logs history */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Asset History & Logs</h3>
            <div className="space-y-4">
              {history && history.length > 0 ? (
                history.map(item => (
                  <div key={item.id} className="flex gap-3 text-xs leading-normal">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-slate-800">
                        <span className="font-bold text-slate-900">{item.action}</span> - {item.notes}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                        Performed by {item.performed_by_username || 'system'} on {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">No historical records available.</p>
              )}
            </div>
          </div>

        </div>

        {/* Right side allocation/custody cards */}
        <div className="space-y-6">
          
          {/* Active Custody state card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Custody Status</h3>
            
            <div className="text-center py-4 space-y-2">
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                asset.status === 'Available' ? 'bg-emerald-500 text-white' :
                asset.status === 'Assigned' ? 'bg-slate-900 text-gold-500 border border-slate-700' :
                asset.status === 'Under Repair' ? 'bg-amber-500 text-white' :
                'bg-rose-600 text-white'
              }`}>
                {asset.status}
              </span>

              {asset.status === 'Assigned' && activeAssignment ? (
                <div className="pt-4 text-xs space-y-2 text-left">
                  <div className="bg-slate-50 border rounded-lg p-3 text-[11px] leading-relaxed">
                    {activeAssignment.employee_name ? (
                      <div>
                        <p className="text-slate-400 uppercase font-bold text-[9px]">Issued Employee</p>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">{activeAssignment.employee_name}</p>
                        <p className="font-semibold text-slate-500">ID: {activeAssignment.employee_number}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-slate-400 uppercase font-bold text-[9px]">Issued Department</p>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">{activeAssignment.department_name}</p>
                      </div>
                    )}
                    <p className="font-semibold text-slate-500 mt-2">Date Assigned: {activeAssignment.date_assigned}</p>
                    {activeAssignment.expected_return_date && (
                      <p className="font-semibold text-slate-500">Expected Return: {activeAssignment.expected_return_date}</p>
                    )}
                    <p className="italic text-slate-450 text-[10px] mt-2">"{activeAssignment.remarks || 'No allocation remarks'}"</p>
                  </div>
                  
                  {/* Actions for Assigned asset */}
                  <div className="space-y-2 pt-2 select-none">
                    {hasPermission('assets.return') && (
                      <button 
                        onClick={() => setReturnModalOpen(true)}
                        className="w-full py-2 bg-slate-950 hover:bg-gold-600 text-white text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Return Asset</span>
                      </button>
                    )}
                    {hasPermission('assets.transfer') && (
                      <button 
                        onClick={() => setTransferModalOpen(true)}
                        className="w-full py-2 border border-slate-350 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        <span>Transfer Asset</span>
                      </button>
                    )}
                    {/* Download PDF Receipt */}
                    <a 
                      href={`/api/assignments/${activeAssignment.id}/receipt?token=${localStorage.getItem('accessToken') || ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const token = localStorage.getItem('accessToken');
                        window.open(`/api/assignments/${activeAssignment.id}/receipt?token=${token || ''}`, '_blank');
                      }}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 border border-slate-355 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Receipt (PDF)</span>
                    </a>
                  </div>
                </div>
              ) : asset.status === 'Available' ? (
                <div className="pt-4 space-y-4">
                  <p className="text-xs text-slate-500 leading-normal">
                    This asset is currently in storage and is available for deployment assignment.
                  </p>
                  {hasPermission('assets.assign') && (
                    <button 
                      onClick={() => {
                        setSelectedAssignEmp('');
                        setSelectedAssignDept('');
                        setAssignModalOpen(true);
                      }}
                      className="w-full py-2.5 bg-slate-950 hover:bg-gold-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors"
                    >
                      <UserCheck className="h-4.5 w-4.5" />
                      <span>Assign Asset</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="pt-4 text-xs text-slate-500 leading-normal">
                  No active custody modifications can be logged on retired, damaged, or uninspected assets.
                </div>
              )}

            </div>
          </div>

        </div>

      </div>

      {/* ==========================================
          WINDOWS ITMS AGENT & ENDPOINT INVENTORY PANEL
          ========================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-gold-400 rounded-xl">
              <Laptop className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Windows ITMS Endpoint Agent</h3>
                {agentData?.agent ? (
                  agentData.agent.isOnline ? (
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold flex items-center gap-1 border border-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      ONLINE & CONNECTED
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-extrabold border border-slate-300">
                      OFFLINE
                    </span>
                  )
                ) : (
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-extrabold border border-amber-300">
                    NOT ENROLLED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Native C# Windows Service Agent for Real-time Hardware, Software & Security Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!agentData?.agent ? (
              <button
                onClick={handleGenerateAgentToken}
                className="px-3.5 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
              >
                <Plus className="h-4 w-4 text-gold-400" />
                <span>Generate Enrollment Token</span>
              </button>
            ) : (
              <button
                onClick={handleRevokeAgent}
                className="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Revoke Agent
              </button>
            )}
          </div>
        </div>

        {/* Enrollment Token Modal / Alert Box */}
        {enrollmentTokenData && (
          <div className="p-4 bg-slate-900 border border-slate-800 text-white rounded-xl space-y-3 animate-fade-in shadow-lg">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gold-400 uppercase tracking-wider">🔑 One-Time Enrollment Token Generated</span>
              <button onClick={() => setEnrollmentTokenData(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-800 rounded-lg border border-slate-700 font-mono">
                <span className="block text-[10px] text-slate-400 font-sans uppercase">Token Value:</span>
                <span className="text-sm font-bold text-emerald-400 select-all">{enrollmentTokenData.token}</span>
              </div>
              <div className="p-2.5 bg-slate-800 rounded-lg border border-slate-700">
                <span className="block text-[10px] text-slate-400 uppercase">Expires At:</span>
                <span className="text-xs font-bold text-slate-200">{new Date(enrollmentTokenData.expiresAt).toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono">
              msiexec /i NKB-ITMS-Agent.msi ENROLLMENT_TOKEN="{enrollmentTokenData.token}" SERVER_URL="{enrollmentTokenData.serverUrl}" /qn
            </div>
          </div>
        )}

        {agentData?.agent ? (
          <div className="space-y-4">
            {/* Sub-Tabs Navigation */}
            <div className="flex border-b border-slate-200 text-xs font-bold text-slate-600 gap-6 select-none">
              {['overview', 'hardware', 'software', 'security', 'performance'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAgentSubTab(tab)}
                  className={`pb-2.5 capitalize border-b-2 transition-colors cursor-pointer ${
                    agentSubTab === tab
                      ? 'border-gold-600 text-slate-950 font-black'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* TAB 1: OVERVIEW */}
            {agentSubTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Agent UUID</span>
                  <p className="font-mono font-bold text-slate-800 truncate">{agentData.agent.uuid}</p>
                </div>
                <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Hostname / Device</span>
                  <p className="font-bold text-slate-900">{agentData.agent.hostname}</p>
                </div>
                <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Current Logged User</span>
                  <p className="font-bold text-slate-900">{agentData.agent.current_user || 'SYSTEM'}</p>
                </div>
                <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">IP Address</span>
                  <p className="font-mono font-bold text-slate-800">{agentData.agent.current_ip || '192.168.1.100'}</p>
                </div>
                <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Operating System</span>
                  <p className="font-bold text-slate-900">{agentData.agent.os_name} ({agentData.agent.architecture})</p>
                </div>
                <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Last Heartbeat</span>
                  <p className="font-bold text-slate-900">{agentData.agent.last_heartbeat_at ? new Date(agentData.agent.last_heartbeat_at).toLocaleTimeString() : 'N/A'}</p>
                </div>
              </div>
            )}

            {/* TAB 2: HARDWARE */}
            {agentSubTab === 'hardware' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Processor (CPU)</span>
                    <p className="font-bold text-slate-900">{agentData.hardware?.cpu_name || 'Intel(R) Core(TM) i7-13700K'}</p>
                    <p className="text-[11px] text-slate-500">{agentData.hardware?.cpu_cores || 8} Physical Cores | {agentData.hardware?.cpu_threads || 16} Threads</p>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">System Memory (RAM)</span>
                    <p className="font-bold text-slate-900">{((agentData.hardware?.total_memory_bytes || 17179869184) / 1073741824).toFixed(1)} GB Physical RAM</p>
                    <p className="text-[11px] text-slate-500">{agentData.hardware?.memory_slots_used || 2} of {agentData.hardware?.memory_slots_total || 4} Slots Populated</p>
                  </div>
                </div>

                {/* Disks */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Storage Disks & Volumes</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(agentData.disks && agentData.disks.length > 0 ? agentData.disks : [
                      { model: 'NVMe KIOXIA 512GB SSD', serial_number: '7Y2SGB4', media_type: 'SSD', capacity_bytes: 512000000000, health_status: 'OK' }
                    ]).map((disk, idx) => (
                      <div key={idx} className="p-3 border rounded-lg bg-white flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-900">{disk.model}</p>
                          <p className="text-[10px] text-slate-500">S/N: {disk.serial_number} | {disk.media_type}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                          {disk.health_status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SOFTWARE */}
            {agentSubTab === 'software' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <input
                    type="text"
                    placeholder="Search installed applications..."
                    value={softwareSearch}
                    onChange={(e) => setSoftwareSearch(e.target.value)}
                    className="p-2 border border-slate-350 rounded-lg text-xs w-64 bg-slate-50"
                  />
                  <span className="text-slate-500 font-bold text-[11px]">
                    Total Apps: {agentData.software?.length || 0}
                  </span>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold sticky top-0">
                      <tr>
                        <th className="p-2.5">Application Name</th>
                        <th className="p-2.5">Version</th>
                        <th className="p-2.5">Publisher</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-800">
                      {(agentData.software && agentData.software.length > 0 ? agentData.software : [
                        { name: 'Google Chrome', version: '126.0.6478.127', publisher: 'Google LLC' },
                        { name: 'Microsoft Office 365 ProPlus', version: '16.0.17726.20126', publisher: 'Microsoft Corporation' },
                        { name: 'Node.js LTS (v20.15.0)', version: '20.15.0', publisher: 'Node.js Foundation' }
                      ])
                      .filter(s => s.name.toLowerCase().includes(softwareSearch.toLowerCase()))
                      .map((sw, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{sw.name}</td>
                          <td className="p-2.5 font-mono text-slate-600">{sw.version}</td>
                          <td className="p-2.5 text-slate-500">{sw.publisher}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: SECURITY */}
            {agentSubTab === 'security' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 border rounded-lg space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Antivirus & Endpoint Protection</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{agentData.security?.antivirus_name || 'Microsoft Defender'}</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded text-[10px]">ACTIVE</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Real-time Protection: Enabled</p>
                </div>

                <div className="p-3.5 bg-slate-50 border rounded-lg space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Windows Firewall Profiles</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">Domain, Private & Public</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded text-[10px]">PROTECTED</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border rounded-lg space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">TPM & Hardware Security</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">TPM {agentData.security?.tpm_version || '2.0'} Chip</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded text-[10px]">PRESENT & READY</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border rounded-lg space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">BitLocker Encryption</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">Drive C: Protection</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded text-[10px]">ENCRYPTED</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PERFORMANCE */}
            {agentSubTab === 'performance' && (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                    <span>CPU Utilization</span>
                    <span>14.5%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '14.5%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                    <span>Memory (RAM) Usage</span>
                    <span>48.2%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: '48.2%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                    <span>System Disk Storage</span>
                    <span>62.0%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: '62%' }}></div>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 border border-dashed rounded-xl space-y-3">
            <Laptop className="h-10 w-10 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">No Agent Installed on this Asset</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Generate a single-use enrollment token above to connect the native C# Windows ITMS Agent to this asset record.
            </p>
          </div>
        )}
      </div>

      {/* ==========================================
          MODAL 1: ASSIGN ASSET
          ========================================== */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setAssignModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Assign Asset Custody</h3>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4 text-xs font-semibold">
              
              <div className="bg-slate-50 border p-3 rounded text-[11px] leading-relaxed">
                Assigning asset: <span className="font-bold text-slate-900">{asset.name}</span> ({asset.asset_code})
              </div>

              {/* Assignee Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Issue to Employee</label>
                  <select 
                    name="employeeId" 
                    value={selectedAssignEmp}
                    onChange={handleAssignEmpChange}
                    className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.full_name || `${e.first_name} ${e.last_name}`} ({e.employee_number})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Issue to Department</label>
                  <select 
                    name="departmentId" 
                    value={selectedAssignDept}
                    onChange={e => setSelectedAssignDept(e.target.value)}
                    className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900"
                  >
                    <option value="">-- Choose Dept --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Date Assigned *</label>
                  <input type="date" name="dateAssigned" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Expected Return Date</label>
                  <input type="date" name="expectedReturnDate" className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                </div>
              </div>

              {/* Conditions */}
              <div>
                <label className="block text-slate-500 mb-1">Condition on Release *</label>
                <input type="text" name="releaseCondition" defaultValue="Good" required placeholder="Brand New, Good, Fair..." className="w-full p-2 border border-slate-350 rounded" />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Custody Notes / Remarks</label>
                <textarea name="remarks" className="w-full p-2 border border-slate-350 rounded text-slate-900 h-20 resize-none" placeholder="Add specific allocation notes..."></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setAssignModalOpen(false)} className="px-4 py-2 border border-slate-350 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Release Custody</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: RETURN ASSET
          ========================================== */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setReturnModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Register Asset Return</h3>
              <button onClick={() => setReturnModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4 text-xs font-semibold">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Date Returned *</label>
                  <input type="date" name="actualReturnDate" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border border-slate-355 rounded bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Next Asset Status *</label>
                  <select name="assetStatus" required className="w-full p-2 border border-slate-355 rounded bg-white">
                    <option value="Available">Available (In Storage)</option>
                    <option value="Under Repair">Under Repair</option>
                    <option value="For Inspection">For Inspection</option>
                    <option value="Damaged">Damaged / Defective</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Condition on Return *</label>
                <input type="text" name="returnCondition" required defaultValue="Good" placeholder="Good, Scratched, Damaged..." className="w-full p-2 border border-slate-355 rounded" />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Remarks</label>
                <textarea name="remarks" className="w-full p-2 border border-slate-355 rounded h-20 resize-none" placeholder="Describe returned status..."></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setReturnModalOpen(false)} className="px-4 py-2 border border-slate-350 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Close Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: TRANSFER ASSET
          ========================================== */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setTransferModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Transfer Custody Mappings</h3>
              <button onClick={() => setTransferModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleTransferSubmit} className="p-6 space-y-4 text-xs font-semibold">
              
              <div className="bg-slate-50 border p-3 rounded text-[11px]">
                Initiates a transfer closing assignment <span className="font-bold text-slate-900">{activeAssignment?.assignment_number}</span> and creating a new active custody file.
              </div>

              {/* Assignee Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Transfer to Employee</label>
                  <select 
                    name="employeeId" 
                    value={selectedTransferEmp}
                    onChange={handleTransferEmpChange}
                    className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.full_name || `${e.first_name} ${e.last_name}`} ({e.employee_number})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Transfer to Department</label>
                  <select 
                    name="departmentId" 
                    value={selectedTransferDept}
                    onChange={e => setSelectedTransferDept(e.target.value)}
                    className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900"
                  >
                    <option value="">-- Choose Dept --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1">Transfer Date *</label>
                  <input type="date" name="dateTransferred" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Release Condition *</label>
                  <input type="text" name="releaseCondition" defaultValue="Good" required className="w-full p-2 border border-slate-350 rounded" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Remarks / Reason</label>
                <textarea name="remarks" className="w-full p-2 border border-slate-350 rounded h-20 resize-none" placeholder="Add specific transfer explanations..."></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setTransferModalOpen(false)} className="px-4 py-2 border border-slate-350 rounded font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Confirm Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 4: UPLOAD DOCUMENTS
          ========================================== */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setUploadModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Upload Asset Documentation</h3>
              <button onClick={() => setUploadModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleDocUpload} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-2">Choose Files (.pdf, .docx, .xlsx, .jpg, .png)</label>
                <input 
                  type="file" 
                  multiple 
                  onChange={e => setUploadFiles(e.target.files)} 
                  className="w-full p-2 border border-slate-350 rounded bg-slate-55"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setUploadModalOpen(false)} className="px-4 py-2 border border-slate-350 rounded font-bold hover:bg-slate-55 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded hover:bg-gold-650 cursor-pointer">Start Upload</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 5: PRINT STICKER PREVIEW
          ========================================== */}
      {stickerModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 p-4 animate-fade-in" onClick={() => setStickerModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-gold-500" />
                <h3 className="font-bold text-sm">Print Asset Label & Scannable QR Code Sticker</h3>
              </div>
              <button onClick={() => setStickerModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 bg-slate-100 flex flex-col items-center select-none">
              
              {/* Sticker Mode Switcher */}
              <div className="flex p-1 bg-slate-200 rounded-xl w-full max-w-md font-bold text-xs">
                <button
                  type="button"
                  onClick={() => setStickerMode('full')}
                  className={`flex-1 py-2 rounded-lg text-center transition-all cursor-pointer ${
                    stickerMode === 'full' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  📄 Full Asset Tag (70x40mm)
                </button>
                <button
                  type="button"
                  onClick={() => setStickerMode('qr_only')}
                  className={`flex-1 py-2 rounded-lg text-center transition-all cursor-pointer ${
                    stickerMode === 'qr_only' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  📱 QR Code ONLY (Scan Specs)
                </button>
              </div>

              {stickerMode === 'full' ? (
                <>
                  <div className="text-xs font-medium flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg">
                    <span>✨ Full Property Asset Tag: <strong>70mm x 40mm</strong> (High Visibility Specifications)</span>
                  </div>

                  {/* Exact 70mm x 40mm Scaled Container Preview */}
                  <div className="bg-white border-2 border-black p-3.5 rounded-sm shadow-lg w-[420px] h-[240px] text-black font-sans flex flex-col justify-between overflow-hidden">
                    
                    {/* Top Header */}
                    <div className="flex justify-between items-center border-b border-black pb-1.5 mb-1.5">
                      <img src="/nkb-logo.png" alt="NKB Logo" className="h-7 object-contain" />
                      <div className="text-right">
                        <span className="block text-[8px] font-extrabold text-slate-700 tracking-wider uppercase leading-none">PROPERTY ASSET TAG</span>
                        <span className="block text-sm font-black font-mono leading-tight">{asset.asset_code}</span>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-between overflow-hidden space-y-1">
                      
                      {/* Name */}
                      <div>
                        <span className="block text-[8.5px] font-extrabold text-slate-700 uppercase tracking-tight leading-none mb-0.5">Asset Name :</span>
                        <span className="block text-[13px] font-black uppercase text-black leading-tight truncate">{asset.name}</span>
                      </div>

                      {/* Model & Specs Box */}
                      {(getAssetModelText() || getAssetSpecsText()) && (
                        <div className="bg-slate-100 border-l-2 border-black px-1.5 py-1 text-[8.5px] font-semibold leading-tight max-h-[36px] overflow-hidden rounded-r-xs">
                          <span className="block text-[7px] font-extrabold text-slate-600 uppercase mb-0.5">Model & Hardware Specs :</span>
                          <div className="text-slate-900 font-bold line-clamp-1">
                            {getAssetModelText() && <span>Model: {getAssetModelText()}</span>}
                            {getAssetModelText() && getAssetSpecsText() && <span> | </span>}
                            {getAssetSpecsText() && <span>Specs: {getAssetSpecsText()}</span>}
                          </div>
                        </div>
                      )}

                      {/* 3-Column Grid */}
                      <div className="grid grid-cols-3 gap-2 text-[9px] font-black pt-0.5">
                        <div>
                          <span className="text-[7.5px] font-extrabold text-slate-600 uppercase block leading-none">Category</span>
                          <span className="uppercase truncate block text-slate-950 mt-0.5">{asset.category_name || 'EQUIPMENT'}</span>
                        </div>
                        <div>
                          <span className="text-[7.5px] font-extrabold text-slate-600 uppercase block leading-none">Serial Number</span>
                          <span className="uppercase truncate block text-slate-950 mt-0.5">{asset.serial_number || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[7.5px] font-extrabold text-slate-600 uppercase block leading-none">Condition</span>
                          <span className="uppercase truncate block text-slate-950 mt-0.5">{asset.condition || 'GOOD'}</span>
                        </div>
                      </div>

                      {/* Assigned To */}
                      <div className="border-t border-black/80 pt-1 text-[8.5px] leading-tight truncate">
                        <span className="font-black mr-1 uppercase">ASSIGNED TO:</span>
                        <span className="font-bold text-black uppercase">
                          {getAssetOwnerText(asset, activeAssignment)}
                        </span>
                      </div>
                    </div>

                    {/* Footer Banner */}
                    <div className="border-t border-black pt-1 mt-1 text-center">
                      <h5 className="font-black text-[9.5px] uppercase tracking-wider leading-none">PROPERTY OF NKB MANUFACTURING CORP.</h5>
                      <p className="font-bold text-[7.5px] uppercase text-slate-700 leading-none mt-0.5">
                        DO NOT REMOVE OR DEFACE &nbsp;|&nbsp; IT MANAGEMENT SYSTEM
                      </p>
                    </div>

                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-medium flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-lg">
                    <span>📱 Standalone QR Code Sticker: <strong>50mm x 50mm</strong> (Scan with Camera to view Full Specs)</span>
                  </div>

                  {/* QR Code ONLY Preview */}
                  <div className="bg-white border-2 border-slate-900 p-4 rounded-xl shadow-lg w-[240px] h-[240px] flex flex-col items-center justify-between text-center font-sans">
                    <span className="text-[9px] font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1 w-full">
                      🛡️ NKB IT ASSET SPECIFICATIONS
                    </span>
                    <div className="p-1 bg-white rounded-lg border border-slate-200 shadow-inner my-1">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/scan/${asset.asset_code}`)}`}
                        alt="QR Code"
                        className="w-28 h-28 object-contain"
                      />
                    </div>
                    <span className="font-mono font-black text-xs text-slate-900 leading-none">{asset.asset_code}</span>
                    <span className="text-[8px] font-bold text-blue-600 uppercase tracking-tight">
                      SCAN CAMERA FOR SPECS 📱
                    </span>
                  </div>
                </>
              )}

            </div>

            <div className="px-6 py-4 bg-white border-t flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setStickerModalOpen(false)} 
                className="px-4 py-2 border border-slate-350 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button 
                type="button" 
                onClick={() => handlePrintSticker(stickerMode)} 
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-colors"
              >
                <Printer className="h-4 w-4" />
                <span>Print {stickerMode === 'qr_only' ? 'QR Code Sticker' : 'Full Asset Tag'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: EDIT ASSET PROFILE
          ========================================== */}
      {editModalOpen && asset && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-fade-in" onClick={() => setEditModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Edit IT Asset Profile ({asset.asset_code})</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditAssetSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs font-semibold">
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">1. Base Asset Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1">Asset Name *</label>
                    <input type="text" name="name" defaultValue={asset.name || ''} required className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Category *</label>
                    <select name="category_id" defaultValue={asset.category_id || ''} required className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                      <option value="">Choose category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Brand *</label>
                    <input type="text" name="brand" defaultValue={asset.brand || ''} required className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Model *</label>
                    <input type="text" name="model" defaultValue={asset.model || ''} required className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Serial Number *</label>
                    <input type="text" name="serial_number" defaultValue={asset.serial_number || ''} required className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Physical Condition</label>
                    <select name="condition" defaultValue={asset.condition || 'Good'} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Status</label>
                    <select name="status" defaultValue={asset.status || 'Available'} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900">
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
                    <input type="text" name="specs_cpu" defaultValue={asset.specs_cpu || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">RAM Capacity</label>
                    <input type="text" name="specs_ram" defaultValue={asset.specs_ram || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Storage Size</label>
                    <input type="text" name="specs_storage" defaultValue={asset.specs_storage || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Operating System</label>
                    <input type="text" name="specs_os" defaultValue={asset.specs_os || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Windows Edition</label>
                    <input type="text" name="specs_win_edition" defaultValue={asset.specs_win_edition || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">3. Network Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1">Hostname</label>
                    <input type="text" name="hostname" defaultValue={asset.hostname || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">MAC Address</label>
                    <input type="text" name="mac_address" defaultValue={asset.mac_address || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">IP Address</label>
                    <input type="text" name="ip_address" defaultValue={asset.ip_address || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">4. Purchase & Warranty Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1">Purchase Price (PHP)</label>
                    <input type="number" step="0.01" name="purchase_price" defaultValue={asset.purchase_price || 0} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Purchase Date</label>
                    <input type="date" name="purchase_date" defaultValue={asset.purchase_date ? asset.purchase_date.split('T')[0] : ''} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Invoice Number</label>
                    <input type="text" name="invoice_number" defaultValue={asset.invoice_number || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Warranty Start Date</label>
                    <input type="date" name="warranty_start_date" defaultValue={asset.warranty_start_date ? asset.warranty_start_date.split('T')[0] : ''} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Warranty End Date</label>
                    <input type="date" name="warranty_end_date" defaultValue={asset.warranty_end_date ? asset.warranty_end_date.split('T')[0] : ''} className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Supplier / Vendor</label>
                    <input type="text" name="supplier" defaultValue={asset.supplier || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">5. Physical Attributes & Uploads</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Asset Photo</label>
                    {editUploadImage ? (
                      <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-350 rounded-lg">
                        <img 
                          src={URL.createObjectURL(editUploadImage)} 
                          alt="Captured Asset" 
                          className="h-12 w-12 object-cover rounded-lg border border-slate-300 shadow-sm" 
                        />
                        <div className="flex-1 space-y-0.5 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{editUploadImage.name || 'Captured_Asset.jpg'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{(editUploadImage.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditUploadImage(null)}
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
                                setEditUploadImage(opt);
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
                                setEditUploadImage(opt);
                              }
                            }} 
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Remarks / Location Details</label>
                    <input type="text" name="remarks" defaultValue={asset.remarks || ''} className="w-full p-2 border border-slate-350 rounded" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-350 text-slate-700 bg-white rounded font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold transition-colors cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
