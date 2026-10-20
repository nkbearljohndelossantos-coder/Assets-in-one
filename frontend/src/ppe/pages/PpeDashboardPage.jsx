import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { 
  Building2, TrendingUp, Layers, CheckCircle2, AlertTriangle, 
  Download, Plus, ArrowUpRight, BarChart3, Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, AreaChart, Area 
} from 'recharts';

function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PpeDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sumRes, trRes] = await Promise.all([
          api.get('/ppe/dashboard/summary'),
          api.get('/ppe/dashboard/trends', { params: { year } })
        ]);
        setSummary(sumRes.data);
        setTrends(trRes.data.monthly || []);
      } catch (err) {
        console.error('Failed to load PPE dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [year]);

  if (loading && !summary) {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <span>Loading PPE valuation analytics...</span>
      </div>
    );
  }

  const categoryBreakdown = summary?.categoryBreakdown || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <span>PPE Valuation & Depreciation Dashboard</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time capitalization metrics, straight-line depreciation amortization, and Net Book Value (NBV)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/ppe/reports"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Reports & Labels</span>
          </Link>
          <Link
            to="/ppe/assets"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
          >
            <span>View All Assets</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Capital Cost</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">PHP {fmtMoney(summary?.totalAssetValue)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Across {summary?.totalAssets || 0} registered assets</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accumulated Depreciation</span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600">PHP {fmtMoney(summary?.totalDepreciation)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Total amortized asset write-downs</div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Total Net Book Value (NBV)</span>
            <span className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
              <Building2 className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-blue-900">PHP {fmtMoney(summary?.totalNetBookValue)}</div>
          <div className="text-[11px] text-blue-600 mt-1">Current balance sheet asset valuation</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operational Status</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">{summary?.statusCounts?.ACTIVE || 0} Active</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summary?.statusCounts?.UNDER_MAINTENANCE || 0} in repair • {summary?.statusCounts?.RETIRED || 0} retired
          </div>
        </div>
      </div>

      {/* Depreciation Trend & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart (2 columns) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Depreciation Schedule ({year})</h3>
              <p className="text-xs text-slate-500">Straight-line monthly amortization charges</p>
            </div>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="py-1 px-3 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => `₱${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(val) => [`PHP ${fmtMoney(val)}`, 'Depreciation']}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="depreciation" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown (1 column) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Valuation by Category</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {Object.keys(categoryBreakdown).length === 0 ? (
              <p className="text-slate-400 py-8 text-center">No categories recorded.</p>
            ) : (
              Object.entries(categoryBreakdown).map(([cat, data]) => (
                <div key={cat} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{cat}</div>
                    <div className="text-[11px] text-slate-400">{data.count} Asset(s)</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">PHP {fmtMoney(data.nbv)}</div>
                    <div className="text-[10px] text-slate-400">Cost: PHP {fmtMoney(data.cost)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
