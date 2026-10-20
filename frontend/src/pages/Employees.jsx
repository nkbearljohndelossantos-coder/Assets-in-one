import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Edit, Trash2, ArrowUpDown, Search, Filter, 
  Download, Upload, Check, AlertCircle, X, Info, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const employeeSchema = z.object({
  employee_number: z.string().min(1, 'Employee number is required'),
  first_name: z.string().min(1, 'First name is required'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  position_id: z.string().min(1, 'Position is required'),
  department_id: z.string().min(1, 'Department is required'),
  employment_status: z.string().min(1, 'Employment status is required'),
  date_hired: z.string().min(1, 'Date hired is required'),
  status: z.string().default('active')
});

export default function Employees() {
  const { hasPermission, showToast } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  
  // Search & Filtering State
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);

  // Modals Toggles
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [syncingCanteen, setSyncingCanteen] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(employeeSchema)
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load employees
      const empRes = await api.get('/employees', {
        params: {
          page,
          search,
          departmentId: deptFilter,
          status: statusFilter
        }
      });
      if (empRes.data.success) {
        setEmployees(empRes.data.data.employees);
        setPagination(empRes.data.data.pagination);
      }

      // 2. Load metadata (departments & positions)
      const deptRes = await api.get('/employees/departments');
      if (deptRes.data.success) setDepartments(deptRes.data.data);

      const posRes = await api.get('/settings/positions');
      if (posRes.data.success) setPositions(posRes.data.data);

    } catch (err) {
      showToast('Error', 'Failed to retrieve employees records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, deptFilter, statusFilter]);

  const handleSyncCanteen = async () => {
    setSyncingCanteen(true);
    showToast('Syncing', 'Fetching employees from Canteen Integration API...', 'info');
    try {
      const res = await api.post('/employees/sync-canteen');
      if (res.data.success) {
        showToast('Sync Complete', res.data.message, 'success');
        loadData();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to sync with Canteen System API.';
      showToast('Sync Error', msg, 'error');
    } finally {
      setSyncingCanteen(false);
    }
  };

  const openAddModal = () => {
    setEditingEmp(null);
    reset({
      employee_number: '', first_name: '', middle_name: '', last_name: '',
      email: '', phone: '', position_id: '', department_id: '',
      employment_status: 'Regular', date_hired: new Date().toISOString().split('T')[0], status: 'active'
    });
    setEmpModalOpen(true);
  };

  const openEditModal = (emp) => {
    setEditingEmp(emp);
    reset({
      employee_number: emp.employee_number,
      first_name: emp.first_name,
      middle_name: emp.middle_name || '',
      last_name: emp.last_name,
      email: emp.email,
      phone: emp.phone,
      position_id: String(emp.position_id),
      department_id: String(emp.department_id),
      employment_status: emp.employment_status,
      date_hired: emp.date_hired.split('T')[0],
      status: emp.status
    });
    setEmpModalOpen(true);
  };

  const onSaveEmployee = async (data) => {
    try {
      if (editingEmp) {
        // Edit Mode
        const res = await api.put(`/employees/${editingEmp.id}`, data);
        if (res.data.success) {
          showToast('Updated', 'Employee updated successfully.', 'success');
          setEmpModalOpen(false);
          loadData();
        }
      } else {
        // Create Mode
        const res = await api.post('/employees', data);
        if (res.data.success) {
          showToast('Created', 'Employee added successfully.', 'success');
          setEmpModalOpen(false);
          loadData();
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save employee.';
      showToast('Save Error', msg, 'error');
    }
  };

  const onDeleteEmployee = async (id) => {
    if (!window.confirm('Are you sure you want to delete/deactivate this employee?')) return;
    try {
      const res = await api.delete(`/employees/${id}`);
      if (res.data.success) {
        showToast('Success', res.data.message, 'success');
        loadData();
      }
    } catch (err) {
      showToast('Error', 'Failed to delete employee.', 'error');
    }
  };

  const handleExport = () => {
    const token = localStorage.getItem('accessToken');
    window.open(`/api/employees/export?token=${token || ''}`, '_blank');
    showToast('Exporting', 'Generating Excel spreadsheet list...', 'info');
  };

  const handleImport = async () => {
    if (!uploadFile) {
      alert('Please choose an Excel file first.');
      return;
    }
    setUploading(true);
    setImportResults(null);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await api.post('/employees/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResults(res.data);
      showToast('Import Complete', 'Excel file processed.', 'success');
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to process spreadsheet.';
      showToast('Import Failed', msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Employees Master List</h1>
          <p className="text-xs text-slate-500 mt-1">Manage corporate employees and department definitions.</p>
        </div>
        
        {/* Top Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('users.create') && (
            <button 
              onClick={openAddModal}
              className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-gold-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Employee</span>
            </button>
          )}
          {hasPermission('reports.export') && (
            <button 
              onClick={handleExport}
              className="px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span>Export Excel</span>
            </button>
          )}
          {hasPermission('users.create') && (
            <button 
              onClick={() => {
                setImportResults(null);
                setUploadFile(null);
                setImportModalOpen(true);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Upload className="h-4 w-4" />
              <span>Import Excel</span>
            </button>
          )}
          {hasPermission('users.create') && (
            <button 
              onClick={handleSyncCanteen}
              disabled={syncingCanteen}
              className="px-4 py-2 bg-gold-600 hover:bg-gold-700 text-slate-950 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              title="Sync employees from Canteen Integration API"
            >
              <RefreshCw className={`h-4 w-4 ${syncingCanteen ? 'animate-spin' : ''}`} />
              <span>{syncingCanteen ? 'Syncing API...' : 'Sync Canteen API'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ==========================================
          SEARCH AND FILTERS BAR
          ========================================== */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        
        {/* Search */}
        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by ID, name, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-slate-900"
          />
        </div>

        {/* Department Filter */}
        <div className="w-full md:w-48 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Filter className="h-3.5 w-3.5" />
          </span>
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-slate-900 appearance-none bg-white"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-36 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Filter className="h-3.5 w-3.5" />
          </span>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-slate-900 appearance-none bg-white"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

      </div>

      {/* ==========================================
          EMPLOYEES DATA TABLE
          ========================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Position</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Status</th>
                {(hasPermission('users.update') || hasPermission('users.disable')) && (
                  <th className="py-3 px-4 text-center">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gold-600"></div>
                  </td>
                </tr>
              ) : employees && employees.length > 0 ? (
                employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{emp.employee_number}</td>
                    <td className="py-3.5 px-4 text-slate-800">{emp.full_name}</td>
                    <td className="py-3.5 px-4">{emp.department_name}</td>
                    <td className="py-3.5 px-4">{emp.position_name}</td>
                    <td className="py-3.5 px-4 text-slate-500">{emp.email}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        emp.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    {(hasPermission('users.update') || hasPermission('users.disable')) && (
                      <td className="py-3.5 px-4">
                        <div className="flex justify-center items-center gap-1">
                          {hasPermission('users.update') && (
                            <button 
                              onClick={() => openEditModal(emp)}
                              className="p-1 text-slate-500 hover:text-gold-700 hover:bg-slate-100 rounded"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {hasPermission('users.disable') && (
                            <button 
                              onClick={() => onDeleteEmployee(emp.id)}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">No employees profiles match query filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Showing Page {pagination.page} of {pagination.pages} ({pagination.total} records total)
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 text-xs border border-slate-350 bg-white hover:bg-slate-100 text-slate-700 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={page === pagination.pages}
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                className="px-3 py-1 text-xs border border-slate-350 bg-white hover:bg-slate-100 text-slate-700 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==========================================
          EMPLOYEE CREATE/EDIT DIALOG MODAL
          ========================================== */}
      {empModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setEmpModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingEmp ? 'Edit Employee Details' : 'Add New Employee'}</h3>
              <button onClick={() => setEmpModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSaveEmployee)} className="p-6 space-y-4">
              
              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Employee ID */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Employee ID *</label>
                  <input
                    type="text"
                    {...register('employee_number')}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-gold-500 text-slate-900"
                  />
                  {errors.employee_number && <p className="text-rose-600 text-[10px] mt-0.5 font-semibold">{errors.employee_number.message}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Email Address *</label>
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-gold-500 text-slate-900"
                  />
                  {errors.email && <p className="text-rose-600 text-[10px] mt-0.5 font-semibold">{errors.email.message}</p>}
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">First Name *</label>
                  <input
                    type="text"
                    {...register('first_name')}
                    className="w-full p-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                  {errors.first_name && <p className="text-rose-600 text-[10px] mt-0.5 font-semibold">{errors.first_name.message}</p>}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Last Name *</label>
                  <input
                    type="text"
                    {...register('last_name')}
                    className="w-full p-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                  {errors.last_name && <p className="text-rose-600 text-[10px] mt-0.5 font-semibold">{errors.last_name.message}</p>}
                </div>

                {/* Middle Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Middle Name</label>
                  <input
                    type="text"
                    {...register('middle_name')}
                    className="w-full p-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    {...register('phone')}
                    className="w-full p-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                  {errors.phone && <p className="text-rose-600 text-[10px] mt-0.5 font-semibold">{errors.phone.message}</p>}
                </div>

                {/* Department */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Department *</label>
                  <select
                    {...register('department_id')}
                    className="w-full p-2 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                  >
                    <option value="">Choose department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {errors.department_id && <p className="text-rose-600 text-[10px] mt-0.5 font-semibold">{errors.department_id.message}</p>}
                </div>

                {/* Position */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Position *</label>
                  <select
                    {...register('position_id')}
                    className="w-full p-2 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                  >
                    <option value="">Choose position</option>
                    {positions.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {errors.position_id && <p className="text-rose-600 text-[10px] mt-0.5 font-semibold">{errors.position_id.message}</p>}
                </div>

                {/* Employment Status */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Employment Status *</label>
                  <select
                    {...register('employment_status')}
                    className="w-full p-2 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                  >
                    <option value="Regular">Regular</option>
                    <option value="Contractual">Contractual</option>
                    <option value="Probationary">Probationary</option>
                  </select>
                </div>

                {/* Date Hired */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Date Hired *</label>
                  <input
                    type="date"
                    {...register('date_hired')}
                    className="w-full p-2 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                  />
                </div>

                {/* Status (Edit mode only) */}
                {editingEmp && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Active Status</label>
                    <select
                      {...register('status')}
                      className="w-full p-2 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}

              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEmpModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-55 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-950 text-white rounded text-xs font-semibold hover:bg-gold-600 transition-colors cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          EXCEL IMPORT MODAL
          ========================================== */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-fade-in" onClick={() => setImportModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Batch Import Employees</h3>
              <button onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-normal">
                Upload an Excel file (.xlsx) containing employee columns:
                <br/>
                <b>Employee Number, First Name, Middle Name, Last Name, Email, Phone, Department, Position, Employment Status, Date Hired, Status</b>.
              </p>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-gold-500 bg-slate-50/50 transition-colors">
                <input
                  type="file"
                  id="excelFile"
                  accept=".xlsx"
                  onChange={e => setUploadFile(e.target.files[0])}
                  className="hidden"
                />
                <label htmlFor="excelFile" className="cursor-pointer block space-y-2">
                  <FileSpreadsheet className="h-10 w-10 text-slate-400 mx-auto" />
                  <span className="text-xs text-slate-700 block font-medium">
                    {uploadFile ? uploadFile.name : 'Click to select Excel spreadsheet file'}
                  </span>
                </label>
              </div>

              {/* Import progress/results feedback */}
              {importResults && (
                <div className="p-4 rounded-lg text-xs space-y-1.5 border max-h-48 overflow-y-auto bg-slate-50">
                  <p className="font-bold flex items-center gap-1">
                    {importResults.success ? <Check className="text-emerald-600 h-4.5 w-4.5" /> : <AlertCircle className="text-rose-600 h-4.5 w-4.5" />}
                    <span>Import Completed</span>
                  </p>
                  <p className="text-slate-600">Successfully imported: <b>{importResults.data?.imported}</b> records.</p>
                  {importResults.data?.errors && importResults.data.errors.length > 0 && (
                    <div className="text-rose-700 space-y-1 font-medium mt-2">
                      <p className="font-semibold underline">Parsing Errors:</p>
                      {importResults.data.errors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 border border-slate-350 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleImport}
                  disabled={uploading || !uploadFile}
                  className="px-4 py-2 bg-slate-950 text-white rounded text-xs font-semibold hover:bg-gold-650 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <span className="animate-spin h-3 w-3 border-b-2 border-white rounded-full"></span>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Start Import</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
