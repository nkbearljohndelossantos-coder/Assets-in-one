import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  Laptop, Ticket, Wrench, AlertTriangle, Key, 
  Calendar, ArrowRight, UserPlus, Info, CheckCircle2, ShieldAlert, Calculator
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard');
        if (response.data && response.data.success) {
          setData(response.data.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500">
        Failed to load analytical metrics.
      </div>
    );
  }

  const { assetCounts, ticketCounts, lowStockCount, expiringWarranties, expiringLicenses, overduePM, totalRepairCost, recentActivities, recentTickets, recentAssignments, itOps, charts } = data;

  // Chart Palette Colors
  const COLORS = ['#0f172a', '#d97706', '#0284c7', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
  const PRIORITY_COLORS = {
    Low: '#10b981',
    Medium: '#0284c7',
    High: '#d97706',
    Critical: '#ef4444'
  };

  const getPriorityColor = (prio) => PRIORITY_COLORS[prio] || '#cbd5e1';

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">Real-time IT infrastructure and service metrics.</p>
        </div>
        <button
          onClick={() => navigate('/calculator')}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-gold-400 border border-gold-500/30 rounded-xl text-xs font-bold shadow-sm transition"
        >
          <Calculator className="h-4 w-4 text-gold-400" />
          <span>Hardware Calculator (CCTV, PC, Laptop, Printer)</span>
        </button>
      </div>

      {/* ==========================================
          ANALYTICS CARD GRID (Clickable)
          ========================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Assets */}
        <div 
          onClick={() => navigate('/assets')}
          className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-gold-500 hover:shadow-md transition-all duration-200 group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">IT Assets</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2">{assetCounts.Total}</h3>
              <p className="text-[10px] text-slate-400 mt-1">
                {assetCounts.Available} Available / {assetCounts.Assigned} Assigned
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 text-gold-500 group-hover:bg-gold-600 group-hover:text-white transition-colors">
              <Laptop className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Help Desk Tickets */}
        <div 
          onClick={() => navigate('/tickets?status=Open')}
          className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-gold-500 hover:shadow-md transition-all duration-200 group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open Tickets</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2">{ticketCounts.Open}</h3>
              <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> {ticketCounts.HighPriority} High / {ticketCounts.Overdue} Overdue
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 text-gold-500 group-hover:bg-gold-600 group-hover:text-white transition-colors">
              <Ticket className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Low Stock Parts */}
        <div 
          onClick={() => navigate('/inventory?lowStock=true')}
          className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-gold-500 hover:shadow-md transition-all duration-200 group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Parts</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2">{lowStockCount}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Requires reorder attention</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 text-gold-500 group-hover:bg-gold-600 group-hover:text-white transition-colors">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Expiring Warranties / Licenses */}
        <div 
          onClick={() => navigate('/assets?warrantyExpiring=true')}
          className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-gold-500 hover:shadow-md transition-all duration-200 group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expiring Items</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2">
                {expiringWarranties + expiringLicenses}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                {expiringWarranties} Warranties / {expiringLicenses} Licenses
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 text-gold-500 group-hover:bg-gold-600 group-hover:text-white transition-colors">
              <Key className="h-5 w-5" />
            </div>
          </div>
        </div>

      </div>

      {/* Secondary Statistics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900 text-white p-4 rounded-xl shadow-sm border border-slate-800">
        <div className="text-center border-r border-slate-850 last:border-0 py-2">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Total Repair Expenses</p>
          <h4 className="text-xl font-bold text-gold-500 mt-1">₱ {totalRepairCost.toLocaleString([], { minimumFractionDigits: 2 })}</h4>
        </div>
        <div className="text-center border-r border-slate-850 last:border-0 py-2">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Maintenance Overdue</p>
          <h4 className="text-xl font-bold mt-1 text-rose-500">{overduePM} Due Cycle(s)</h4>
        </div>
        <div className="text-center py-2">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Resolved Tickets (Month)</p>
          <h4 className="text-xl font-bold mt-1 text-emerald-400">{ticketCounts.ResolvedThisMonth} Closed</h4>
        </div>
      </div>

      {/* IT Operations Secondary Metrics Banner */}
      {itOps && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 text-slate-800 p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-center border-r border-slate-200 last:border-0 py-2 cursor-pointer hover:bg-slate-100 transition-colors rounded" onClick={() => navigate('/printers')}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">Active Printers</p>
            <h4 className="text-xl font-black text-slate-900 mt-1">{itOps.totalPrinters} Devices</h4>
          </div>
          <div className="text-center border-r border-slate-200 last:border-0 py-2 cursor-pointer hover:bg-slate-100 transition-colors rounded" onClick={() => navigate('/network')}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">Wi-Fi Access Points</p>
            <h4 className="text-xl font-black text-slate-900 mt-1">{itOps.totalAPs} Active</h4>
          </div>
          <div className="text-center py-2 cursor-pointer hover:bg-slate-100 transition-colors rounded" onClick={() => navigate('/backups')}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">Backup Alerts</p>
            <h4 className={`text-xl font-black mt-1 ${itOps.backupAlerts > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {itOps.backupAlerts} {itOps.backupAlerts === 1 ? 'Failure' : 'Failures'}
            </h4>
          </div>
        </div>
      )}

      {/* ==========================================
          RECHARTS ANALYSIS CHARTS
          ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ticket opened vs resolved trend */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Monthly Ticket Trend (Opened vs Resolved)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.ticketTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: '#64748b' }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: '#64748b' }} />
                <Tooltip contentStyle={{ fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Opened" fill="#0f172a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Resolved" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Assets by Category */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Assets by Category</h3>
          <div className="h-64 w-full relative flex items-center justify-center">
            {charts.assetsByCategory && charts.assetsByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.assetsByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {charts.assetsByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">No category inventory to display.</p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 justify-center max-h-16 overflow-y-auto">
            {charts.assetsByCategory?.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="truncate max-w-[80px]">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Monthly Repair Cost Expense Trend */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Monthly Repair Costs (Last 6 Months)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.repairTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: '#64748b' }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: '#64748b' }} />
                <Tooltip contentStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="Cost" stroke="#d97706" fill="#fef3c7" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tickets by priority donut chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Active Tickets by Priority</h3>
          <div className="h-64 w-full flex items-center justify-center">
            {charts.ticketsByPriority && charts.ticketsByPriority.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.ticketsByPriority}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {charts.ticketsByPriority.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getPriorityColor(entry.name)} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">No active tickets to plot.</p>
            )}
          </div>
          <div className="mt-2 flex gap-4 justify-center">
            {Object.entries(PRIORITY_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ==========================================
          LOGS & DETAILS ROW
          ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Tickets list */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent Help Desk Tickets</h3>
            <button 
              onClick={() => navigate('/tickets')}
              className="text-xs font-bold text-gold-700 hover:text-slate-900 flex items-center gap-1 hover:underline transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2.5 pr-3">Ticket No</th>
                  <th className="py-2.5">Subject</th>
                  <th className="py-2.5">Requester</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {recentTickets && recentTickets.length > 0 ? (
                  recentTickets.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => navigate(`/tickets/${t.id}`)}>
                      <td className="py-3 font-semibold text-slate-900 pr-3">{t.ticket_number}</td>
                      <td className="py-3 truncate max-w-[200px]">{t.subject}</td>
                      <td className="py-3">{t.requester_name}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          t.status === 'Open' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                          t.status === 'Assigned' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          t.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          t.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">No recent tickets available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Audit Activities */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Recent System Log Activities</h3>
          <div className="flex-1 space-y-4 max-h-72 overflow-y-auto pr-1">
            {recentActivities && recentActivities.length > 0 ? (
              recentActivities.map(log => (
                <div key={log.id} className="flex items-start gap-2.5 text-[11px] leading-relaxed">
                  <div className="mt-0.5">
                    {log.action.includes('Create') ? <UserPlus className="h-4 w-4 text-emerald-600" /> :
                     log.action.includes('Delete') ? <ShieldAlert className="h-4 w-4 text-rose-600" /> :
                     log.action.includes('Update') ? <Info className="h-4 w-4 text-sky-600" /> :
                     <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                  </div>
                  <div>
                    <p className="text-slate-800">
                      <span className="font-bold text-slate-900">{log.username}</span> {log.action} in <span className="font-semibold">{log.module}</span>
                    </p>
                    <span className="text-[9px] text-slate-400">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 py-8 text-xs">No logged activities yet.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
