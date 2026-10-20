import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { 
  FileSpreadsheet, FileText, Download, Filter, 
  Calendar, Layers, CheckCircle, RefreshCw 
} from 'lucide-react';

function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PpeReportsPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [previewAssets, setPreviewAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await api.get('/ppe/assets/categories');
        setCategories(res.data.data || []);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    loadCategories();
    loadPreview();
  }, []);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const params = { asOf: asOfDate };
      if (selectedCategory) params.category = selectedCategory;
      if (selectedYear) params.year = selectedYear;
      if (selectedMonth) params.month = selectedMonth;

      const res = await api.get('/ppe/assets', { params });
      setPreviewAssets(Array.isArray(res.data) ? res.data : (res.data.data || []));
    } catch (err) {
      console.error('Failed to load report preview:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDownloadUrl = (format) => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
    const params = new URLSearchParams();
    if (token) params.append('token', token);
    if (asOfDate) params.append('asOf', asOfDate);
    if (selectedCategory) params.append('category', selectedCategory);
    if (selectedYear) params.append('year', selectedYear);
    if (selectedMonth) params.append('month', selectedMonth);

    return `/api/ppe/reports/assets.${format}?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
          <span>PPE Valuation & Asset Reports</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Generate audit-compliant capital asset schedules, straight-line depreciation sheets, and printable PDF documents
        </p>
      </div>

      {/* Export Options & Filters Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <h3 className="text-sm font-bold text-slate-900">Report Generation Parameters</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Valuation As Of Date</label>
            <input
              type="date"
              className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Asset Category</label>
            <select
              className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Acquisition Year</label>
            <input
              type="number"
              placeholder="e.g. 2024 (leave blank for all)"
              className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Acquisition Month</label>
            <select
              className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2026, i, 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
          <button
            onClick={loadPreview}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Preview</span>
          </button>

          <div className="flex gap-2.5">
            <a
              href={getDownloadUrl('xlsx')}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Excel (.XLSX)</span>
            </a>
            <a
              href={getDownloadUrl('pdf')}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <FileText className="h-4 w-4" />
              <span>Export PDF (.PDF)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Live Preview Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Report Preview ({previewAssets.length} Assets Found)
          </h3>
          <span className="text-xs text-slate-400">Valuation calculated as of {asOfDate}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                <th className="px-3 py-2.5">Asset Code</th>
                <th className="px-3 py-2.5">Asset Name</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">GL Account</th>
                <th className="px-3 py-2.5 text-right">Cost (PHP)</th>
                <th className="px-3 py-2.5 text-right">Monthly Dep.</th>
                <th className="px-3 py-2.5 text-right">Accum. Dep.</th>
                <th className="px-3 py-2.5 text-right">Net Book Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    Loading report preview...
                  </td>
                </tr>
              ) : previewAssets.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    No assets found matching current criteria.
                  </td>
                </tr>
              ) : (
                previewAssets.map((a) => {
                  const dep = a.depreciation || {};
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-semibold text-blue-600 whitespace-nowrap">{a.asset_code}</td>
                      <td className="px-3 py-2.5 text-slate-900 font-medium">{a.asset_name}</td>
                      <td className="px-3 py-2.5 text-slate-600">{a.category_name}</td>
                      <td className="px-3 py-2.5 text-slate-600">{a.gl_account || '1500'}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-slate-900 whitespace-nowrap">
                        PHP {fmtMoney(a.acquisition_cost)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">
                        PHP {fmtMoney(dep.monthlyDepreciation)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">
                        PHP {fmtMoney(dep.accumulatedDepreciation)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                        PHP {fmtMoney(dep.netBookValue)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
