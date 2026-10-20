import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileSpreadsheet, Filter, Search, Download, FileText, 
  Laptop, Users, Ticket, Package, Calendar
} from 'lucide-react';

export default function Reports() {
  const { hasPermission, showToast } = useAuth();
  
  // Active Report Category
  const [reportType, setReportType] = useState('assets'); // assets, assignments, tickets, inventory, maintenance

  // Filter criteria
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [extraFilter, setExtraFilter] = useState('');

  // Results State
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Metadata dropdowns
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        let endpoint = '/settings/asset-categories';
        if (reportType === 'tickets') endpoint = '/settings/ticket-categories';
        if (reportType === 'inventory') endpoint = '/settings/inventory-categories';

        const res = await api.get(endpoint);
        if (res.data.success) {
          setCategories(res.data.data);
        }
      } catch (e) {
        console.warn('Failed to load metadata for filters:', e.message);
      }
    };
    loadMetadata();
    setResults([]);
  }, [reportType]);

  const handleRunReport = async () => {
    setLoading(true);
    try {
      let endpoint = `/reports/${reportType}`;
      const params = {
        startDate,
        endDate,
        status,
        extraFilter
      };

      const res = await api.get(endpoint, { params });
      if (res.data.success) {
        setResults(res.data.data);
        showToast('Report Generated', `${res.data.data.length} records retrieved.`, 'success');
      }
    } catch (err) {
      showToast('Error', 'Failed to run report query.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!hasPermission('reports.export')) {
      showToast('Access Denied', 'You do not have permission to export reports.', 'error');
      return;
    }
    const query = new URLSearchParams({
      startDate,
      endDate,
      status,
      extraFilter
    }).toString();

    const token = localStorage.getItem('accessToken');
    const exportUrl = `/api/reports/${reportType}/export?token=${token || ''}&${query}`;
    window.open(exportUrl, '_blank');
    showToast('Exporting', 'Generating spreadsheet download...', 'info');
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Analytical Reports</h1>
          <p className="text-xs text-slate-500 mt-1">Generate tabular audits, activity worksheets, and export to Excel spreadsheets.</p>
        </div>
      </div>

      {/* Report Categories Select Bar */}
      <div className="mb-4">
        <label className="block text-slate-500 text-xs font-bold mb-2 uppercase tracking-wider">Select Reporting Module</label>
        <select 
          value={reportType} 
          onChange={e => { setReportType(e.target.value); setStatus(''); setExtraFilter(''); }}
          className="w-full p-3 border border-slate-350 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-gold-500"
        >
          <optgroup label="Core Modules">
            <option value="assets">Assets Registry</option>
            <option value="assignments">Custody Allocations</option>
            <option value="tickets">Help Desk Tickets</option>
            <option value="inventory">Spare Parts Stock</option>
            <option value="maintenance">Preventive Maintenance Log</option>
          </optgroup>
          <optgroup label="IT Operations Hub">
            <option value="itops/backups">Data Backups</option>
            <option value="itops/os">Endpoint OS</option>
            <option value="itops/antivirus">Antivirus Tracking</option>
            <option value="itops/network-devices">Network Devices</option>
            <option value="itops/wifi">WiFi Access Points</option>
            <option value="itops/printers">Printers Management</option>
            <option value="itops/file-shares">Network File Shares</option>
            <option value="itops/guest-wifi">Guest WiFi Accounts</option>
            <option value="itops/websites">Websites Monitoring</option>
          </optgroup>
        </select>
      </div>

      {/* Filter Parameters panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 text-xs font-semibold">
        <h4 className="text-xs font-bold text-slate-800 border-b pb-2 flex items-center gap-1">
          <Filter className="h-4 w-4 text-slate-400" />
          <span>Report Parameter Filters</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          
          {/* Start Date */}
          <div>
            <label className="block text-slate-500 mb-1">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" 
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-slate-500 mb-1">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900" 
            />
          </div>

          {/* Status filter context */}
          <div>
            <label className="block text-slate-500 mb-1">Status Code</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900"
            >
              <option value="">-- All Statuses --</option>
              {reportType === 'assets' && (
                <>
                  <option value="Available">Available</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Under Repair">Under Repair</option>
                  <option value="Retired">Retired</option>
                </>
              )}
              {reportType === 'assignments' && (
                <>
                  <option value="Active">Active Custody</option>
                  <option value="Returned">Returned</option>
                  <option value="Transferred">Transferred</option>
                </>
              )}
              {reportType === 'tickets' && (
                <>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </>
              )}
              {reportType === 'inventory' && (
                <>
                  <option value="Normal">Normal Stock</option>
                  <option value="Low">Low Stock Alerts</option>
                </>
              )}
              {reportType === 'maintenance' && (
                <>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Missed">Missed</option>
                </>
              )}
            </select>
          </div>

          {/* Extra filter - Categories */}
          {['assets', 'tickets', 'inventory'].includes(reportType) && (
            <div>
              <label className="block text-slate-500 mb-1">Category Group</label>
              <select
                value={extraFilter}
                onChange={e => setExtraFilter(e.target.value)}
                className="w-full p-2 border border-slate-350 rounded bg-white text-slate-900"
              >
                <option value="">-- All Categories --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

        </div>

        <div className="pt-2 border-t flex justify-end gap-2">
          <button
            onClick={handleRunReport}
            className="px-4 py-2 bg-slate-900 hover:bg-gold-650 text-white rounded font-bold transition-all cursor-pointer"
          >
            Run Report Query
          </button>
          
          <button
            onClick={handleExportExcel}
            disabled={results.length === 0}
            className="px-4 py-2 border border-slate-350 bg-white hover:bg-slate-55 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Result Grid Display */}
      <div className="bg-white rounded-xl border border-slate-205 shadow-sm overflow-hidden text-xs">
        <div className="p-4 bg-slate-50 border-b font-bold text-slate-800 flex justify-between items-center">
          <span>Results Preview Grid</span>
          <span className="text-[10px] text-slate-400 font-bold">{results.length} Records Found</span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-650"></div>
          </div>
        ) : results && results.length > 0 ? (
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  {reportType === 'assets' && (
                    <>
                      <th className="py-2.5 px-4">Asset Code</th>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Brand/Model</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Condition</th>
                      <th className="py-2.5 px-4">Status</th>
                    </>
                  )}
                  {reportType === 'assignments' && (
                    <>
                      <th className="py-2.5 px-4">Assign No</th>
                      <th className="py-2.5 px-4">Asset Code</th>
                      <th className="py-2.5 px-4">Employee / Dept</th>
                      <th className="py-2.5 px-4">Date Assigned</th>
                      <th className="py-2.5 px-4">Date Returned</th>
                      <th className="py-2.5 px-4">Status</th>
                    </>
                  )}
                  {reportType === 'tickets' && (
                    <>
                      <th className="py-2.5 px-4">Ticket No</th>
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-4">Priority</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Requester</th>
                      <th className="py-2.5 px-4">Created Date</th>
                    </>
                  )}
                  {reportType === 'inventory' && (
                    <>
                      <th className="py-2.5 px-4">Part Code</th>
                      <th className="py-2.5 px-4">Part Name</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4 text-center">Available Stock</th>
                      <th className="py-2.5 px-4">Unit Cost</th>
                    </>
                  )}
                  {reportType === 'maintenance' && (
                    <>
                      <th className="py-2.5 px-4">PM Code</th>
                      <th className="py-2.5 px-4">Plan Name</th>
                      <th className="py-2.5 px-4">Asset Code</th>
                      <th className="py-2.5 px-4">Frequency</th>
                      <th className="py-2.5 px-4">Scheduled Date</th>
                      <th className="py-2.5 px-4">Status</th>
                    </>
                  )}
                  {reportType === 'itops/backups' && (
                    <><th className="py-2.5 px-4">Job Name</th><th className="py-2.5 px-4">Type</th><th className="py-2.5 px-4">Storage</th><th className="py-2.5 px-4">Size</th><th className="py-2.5 px-4">Status</th><th className="py-2.5 px-4">Verification</th></>
                  )}
                  {reportType === 'itops/os' && (
                    <><th className="py-2.5 px-4">Hostname</th><th className="py-2.5 px-4">OS Name</th><th className="py-2.5 px-4">Edition</th><th className="py-2.5 px-4">Activation Status</th></>
                  )}
                  {reportType === 'itops/antivirus' && (
                    <><th className="py-2.5 px-4">Hostname</th><th className="py-2.5 px-4">AV Name</th><th className="py-2.5 px-4">Last Scan</th><th className="py-2.5 px-4">Result</th></>
                  )}
                  {reportType === 'itops/network-devices' && (
                    <><th className="py-2.5 px-4">Device Name</th><th className="py-2.5 px-4">Type</th><th className="py-2.5 px-4">IP Address</th><th className="py-2.5 px-4">Status</th></>
                  )}
                  {reportType === 'itops/wifi' && (
                    <><th className="py-2.5 px-4">AP Name</th><th className="py-2.5 px-4">SSID</th><th className="py-2.5 px-4">Location</th><th className="py-2.5 px-4">Status</th></>
                  )}
                  {reportType === 'itops/printers' && (
                    <><th className="py-2.5 px-4">Printer Name</th><th className="py-2.5 px-4">Brand/Model</th><th className="py-2.5 px-4">Location</th><th className="py-2.5 px-4">Status</th></>
                  )}
                  {reportType === 'itops/file-shares' && (
                    <><th className="py-2.5 px-4">Folder Name</th><th className="py-2.5 px-4">Location</th><th className="py-2.5 px-4">Quota (GB)</th></>
                  )}
                  {reportType === 'itops/guest-wifi' && (
                    <><th className="py-2.5 px-4">Guest Name</th><th className="py-2.5 px-4">Username</th><th className="py-2.5 px-4">Validity</th><th className="py-2.5 px-4">Status</th></>
                  )}
                  {reportType === 'itops/websites' && (
                    <><th className="py-2.5 px-4">Website</th><th className="py-2.5 px-4">Domain</th><th className="py-2.5 px-4">SSL Expiry</th><th className="py-2.5 px-4">Status</th></>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {results.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-slate-50/50">
                    {reportType === 'assets' && (
                      <>
                        <td className="py-3 px-4 font-bold text-slate-900">{row.asset_code}</td>
                        <td className="py-3 px-4 text-slate-805">{row.name}</td>
                        <td className="py-3 px-4">{row.brand} / {row.model}</td>
                        <td className="py-3 px-4">{row.category_name}</td>
                        <td className="py-3 px-4">{row.condition}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100`}>{row.status}</span>
                        </td>
                      </>
                    )}
                    {reportType === 'assignments' && (
                      <>
                        <td className="py-3 px-4 font-bold text-slate-900">{row.assignment_number}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{row.asset_code}</td>
                        <td className="py-3 px-4 text-slate-700">{row.employee_name || row.department_name || 'N/A'}</td>
                        <td className="py-3 px-4">{row.date_assigned}</td>
                        <td className="py-3 px-4">{row.actual_return_date || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100`}>{row.status}</span>
                        </td>
                      </>
                    )}
                    {reportType === 'tickets' && (
                      <>
                        <td className="py-3 px-4 font-bold text-slate-900">{row.ticket_number}</td>
                        <td className="py-3 px-4 text-slate-850 truncate max-w-[200px]">{row.subject}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100`}>{row.priority}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100`}>{row.status}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{row.requested_by_name}</td>
                        <td className="py-3 px-4 text-slate-450">{new Date(row.created_at).toLocaleDateString()}</td>
                      </>
                    )}
                    {reportType === 'inventory' && (
                      <>
                        <td className="py-3 px-4 font-bold text-slate-900">{row.item_code}</td>
                        <td className="py-3 px-4 text-slate-800">{row.name}</td>
                        <td className="py-3 px-4">{row.category_name}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-950">
                          {row.current_quantity} {row.unit_of_measure}
                        </td>
                        <td className="py-3 px-4">₱ {Number(row.unit_cost).toLocaleString()}</td>
                      </>
                    )}
                    {reportType === 'maintenance' && (
                      <>
                        <td className="py-3 px-4 font-bold text-slate-900">{row.maintenance_number}</td>
                        <td className="py-3 px-4 text-slate-850">{row.title}</td>
                        <td className="py-3 px-4 font-semibold text-slate-805">{row.asset_code}</td>
                        <td className="py-3 px-4">{row.frequency}</td>
                        <td className="py-3 px-4">📅 {row.scheduled_date}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100`}>{row.status}</span>
                        </td>
                      </>
                    )}
                    {reportType === 'itops/backups' && (
                      <><td className="py-3 px-4 font-bold">{row.job_name}</td><td className="py-3 px-4">{row.backup_type}</td><td className="py-3 px-4">{row.storage_location}</td><td className="py-3 px-4">{row.size_mb} MB</td><td className="py-3 px-4 font-bold text-slate-700">{row.status}</td><td className="py-3 px-4">{row.verification_status}</td></>
                    )}
                    {reportType === 'itops/os' && (
                      <><td className="py-3 px-4 font-bold">{row.hostname}</td><td className="py-3 px-4">{row.os_name}</td><td className="py-3 px-4">{row.edition}</td><td className="py-3 px-4 font-bold text-emerald-700">{row.activation_status}</td></>
                    )}
                    {reportType === 'itops/antivirus' && (
                      <><td className="py-3 px-4 font-bold">{row.hostname}</td><td className="py-3 px-4">{row.antivirus_name}</td><td className="py-3 px-4">{row.last_scan_date ? new Date(row.last_scan_date).toLocaleDateString() : 'N/A'}</td><td className="py-3 px-4 font-bold">{row.scan_result}</td></>
                    )}
                    {reportType === 'itops/network-devices' && (
                      <><td className="py-3 px-4 font-bold">{row.device_name}</td><td className="py-3 px-4">{row.device_type}</td><td className="py-3 px-4">{row.ip_address || 'DHCP'}</td><td className="py-3 px-4">{row.status}</td></>
                    )}
                    {reportType === 'itops/wifi' && (
                      <><td className="py-3 px-4 font-bold">{row.ap_name}</td><td className="py-3 px-4">{row.ssid}</td><td className="py-3 px-4">{row.location}</td><td className="py-3 px-4">{row.status}</td></>
                    )}
                    {reportType === 'itops/printers' && (
                      <><td className="py-3 px-4 font-bold">{row.printer_name}</td><td className="py-3 px-4">{row.brand} / {row.model}</td><td className="py-3 px-4">{row.location}</td><td className="py-3 px-4">{row.status}</td></>
                    )}
                    {reportType === 'itops/file-shares' && (
                      <><td className="py-3 px-4 font-bold">{row.folder_name}</td><td className="py-3 px-4">{row.server_location}</td><td className="py-3 px-4 font-semibold text-slate-800">{row.allocated_quota_gb} GB</td></>
                    )}
                    {reportType === 'itops/guest-wifi' && (
                      <><td className="py-3 px-4 font-bold">{row.guest_name}</td><td className="py-3 px-4 text-emerald-700 font-semibold">{row.wifi_username}</td><td className="py-3 px-4">{row.start_date} - {row.end_date}</td><td className="py-3 px-4">{row.status}</td></>
                    )}
                    {reportType === 'itops/websites' && (
                      <><td className="py-3 px-4 font-bold">{row.name}</td><td className="py-3 px-4">{row.domain}</td><td className="py-3 px-4">{row.ssl_expiry_date || 'N/A'}</td><td className="py-3 px-4">{row.status}</td></>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400 py-16 text-center">Run a report query to view catalog sheets.</p>
        )}
      </div>

    </div>
  );
}
