import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  BookOpen, Plus, RefreshCw, DollarSign, Calendar, CheckCircle2, 
  AlertCircle, ChevronRight, X, ArrowUpRight, ArrowDownLeft, FileText, Layers
} from 'lucide-react';

export default function PpeAccountingPage() {
  const [activeTab, setActiveTab] = useState('journals'); // 'journals' | 'accounts'
  const [accounts, setAccounts] = useState([]);
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Journal detail modal
  const [selectedJournal, setSelectedJournal] = useState(null);
  const [journalLoading, setJournalLoading] = useState(false);

  // Manual Journal Entry Modal state
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [journalForm, setJournalForm] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    lines: [
      { accountId: '', debit: 0, credit: 0, description: '' },
      { accountId: '', debit: 0, credit: 0, description: '' }
    ]
  });

  // Monthly Depreciation Modal state
  const [showDepreciationModal, setShowDepreciationModal] = useState(false);
  const [deprForm, setDeprForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [postingDepr, setPostingDepr] = useState(false);

  // Add Account Modal state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({
    code: '',
    name: '',
    type: 'ASSET',
    description: '',
    balance: 0
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, jnlRes] = await Promise.all([
        api.get('/ppe/accounting/accounts'),
        api.get('/ppe/accounting/journals')
      ]);
      setAccounts(accRes.data?.data || []);
      setJournals(jnlRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load accounting data:', err);
      setError(err.response?.data?.message || 'Failed to load accounting records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openJournalDetails = async (id) => {
    setJournalLoading(true);
    setSelectedJournal(null);
    try {
      const res = await api.get(`/ppe/accounting/journals/${id}`);
      setSelectedJournal(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load journal lines:', err);
      setError('Unable to load journal entry details.');
    } finally {
      setJournalLoading(false);
    }
  };

  // Line helpers for manual entry
  const addJournalLine = () => {
    setJournalForm(prev => ({
      ...prev,
      lines: [...prev.lines, { accountId: '', debit: 0, credit: 0, description: '' }]
    }));
  };

  const removeJournalLine = (index) => {
    if (journalForm.lines.length <= 2) return;
    setJournalForm(prev => ({
      ...prev,
      lines: prev.lines.filter((_, idx) => idx !== index)
    }));
  };

  const updateJournalLine = (index, field, value) => {
    setJournalForm(prev => {
      const newLines = [...prev.lines];
      newLines[index] = { ...newLines[index], [field]: value };
      return { ...prev, lines: newLines };
    });
  };

  const totalDebits = journalForm.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredits = journalForm.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const difference = Math.abs(totalDebits - totalCredits);
  const isBalanced = difference < 0.01 && totalDebits > 0;

  const handlePostJournal = async (e) => {
    e.preventDefault();
    if (!isBalanced) {
      alert('Cannot post unbalanced journal entry. Total debits must equal total credits.');
      return;
    }

    try {
      const payload = {
        entryDate: journalForm.entryDate,
        reference: journalForm.reference,
        description: journalForm.description,
        lines: journalForm.lines.map(l => ({
          accountId: Number(l.accountId),
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || journalForm.description
        }))
      };

      await api.post('/ppe/accounting/journals', payload);
      setSuccessMsg('Double-entry journal posted and general ledger updated successfully!');
      setShowJournalModal(false);
      // Reset form
      setJournalForm({
        entryDate: new Date().toISOString().split('T')[0],
        reference: '',
        description: '',
        lines: [
          { accountId: '', debit: 0, credit: 0, description: '' },
          { accountId: '', debit: 0, credit: 0, description: '' }
        ]
      });
      loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to post journal entry.');
    }
  };

  const handleRunDepreciation = async (e) => {
    e.preventDefault();
    setPostingDepr(true);
    try {
      const res = await api.post('/ppe/accounting/post-depreciation', deprForm);
      setSuccessMsg(`Automated depreciation executed: ${res.data?.message || 'Journal posted'}`);
      setShowDepreciationModal(false);
      loadData();
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to post monthly depreciation.');
    } finally {
      setPostingDepr(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      await api.post('/ppe/accounting/accounts', {
        ...accountForm,
        balance: Number(accountForm.balance) || 0
      });
      setSuccessMsg(`Account ${accountForm.code} - ${accountForm.name} created successfully!`);
      setShowAccountModal(false);
      setAccountForm({ code: '', name: '', type: 'ASSET', description: '', balance: 0 });
      loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create GL account.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-emerald-600" />
            PPE General Ledger & Accounting
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Double-entry bookkeeping, Chart of Accounts, audit-compliant journals, and automated straight-line depreciation postings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowDepreciationModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"
          >
            <Calendar className="h-4 w-4" />
            Run Monthly Depreciation
          </button>
          <button
            onClick={() => setShowJournalModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Journal Entry
          </button>
        </div>
      </div>

      {/* Success / Error notification banner */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex items-center border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('journals')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'journals'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          General Journal ({journals.length})
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'accounts'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="h-4 w-4" />
          Chart of Accounts ({accounts.length})
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-2" />
          Loading accounting records...
        </div>
      ) : activeTab === 'journals' ? (
        /* Journal Entries Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Posted Journal Entries</h2>
            <button
              onClick={loadData}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Entry #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Debit (₱)</th>
                  <th className="py-3 px-4 text-right">Credit (₱)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journals.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400">
                      No journal entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  journals.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{j.entry_number}</td>
                      <td className="py-3 px-4 text-slate-600">{j.entry_date}</td>
                      <td className="py-3 px-4 text-slate-500">{j.reference || '-'}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{j.description}</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700">
                        ₱{Number(j.total_debit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700">
                        ₱{Number(j.total_credit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                          {j.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openJournalDetails(j.id)}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:underline"
                        >
                          View Lines
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Chart of Accounts */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">General Ledger Accounts</h2>
            <button
              onClick={() => setShowAccountModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Add GL Account
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Account Code</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Current Balance (₱)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No accounts configured.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => {
                    const badgeColor = {
                      ASSET: 'bg-blue-100 text-blue-800',
                      LIABILITY: 'bg-amber-100 text-amber-800',
                      EQUITY: 'bg-purple-100 text-purple-800',
                      REVENUE: 'bg-emerald-100 text-emerald-800',
                      EXPENSE: 'bg-rose-100 text-rose-800'
                    }[acc.type] || 'bg-slate-100 text-slate-700';

                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">{acc.code}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{acc.name}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badgeColor}`}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{acc.description || '-'}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          ₱{Number(acc.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: VIEW JOURNAL LINES */}
      {selectedJournal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  Journal Details: {selectedJournal.entry_number}
                </h3>
                <p className="text-xs text-slate-500">Date: {selectedJournal.entry_date} | Ref: {selectedJournal.reference || 'N/A'}</p>
              </div>
              <button
                onClick={() => setSelectedJournal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-700 font-medium">
                <span className="text-slate-400 font-normal">Memo:</span> {selectedJournal.description}
              </p>
              
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Debit (₱)</th>
                      <th className="py-2.5 px-3 text-right">Credit (₱)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedJournal.lines?.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {line.account_code} - {line.account_name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{line.description || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          {Number(line.debit) > 0 ? `₱${Number(line.debit).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          {Number(line.credit) > 0 ? `₱${Number(line.credit).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold border-t border-slate-200 text-slate-900">
                    <tr>
                      <td colSpan="2" className="py-2.5 px-3 text-right">Totals:</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                        ₱{Number(selectedJournal.total_debit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                        ₱{Number(selectedJournal.total_credit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedJournal(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POST MANUAL DOUBLE-ENTRY JOURNAL */}
      {showJournalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-600" />
                  Post Double-Entry Journal Entry
                </h3>
                <p className="text-xs text-slate-500">Debits and Credits must be completely balanced to submit.</p>
              </div>
              <button onClick={() => setShowJournalModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePostJournal} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Date *</label>
                  <input
                    type="date"
                    required
                    value={journalForm.entryDate}
                    onChange={(e) => setJournalForm({ ...journalForm, entryDate: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reference #</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-1002, ADJ-01"
                    value={journalForm.reference}
                    onChange={(e) => setJournalForm({ ...journalForm, reference: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Memo *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asset Acquisition, Adjustment"
                    value={journalForm.description}
                    onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Journal Lines */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Journal Lines</h4>
                  <button
                    type="button"
                    onClick={addJournalLine}
                    className="text-xs text-emerald-600 font-medium hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Line
                  </button>
                </div>

                <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                  {journalForm.lines.map((line, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-center gap-2">
                      <select
                        required
                        value={line.accountId}
                        onChange={(e) => updateJournalLine(idx, 'accountId', e.target.value)}
                        className="text-xs border border-slate-300 rounded-lg px-2 py-2 flex-1 w-full bg-white"
                      >
                        <option value="">Select GL Account *</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Debit"
                        value={line.debit || ''}
                        onChange={(e) => updateJournalLine(idx, 'debit', e.target.value)}
                        className="text-xs border border-slate-300 rounded-lg px-2 py-2 w-full sm:w-28 text-right bg-white"
                      />

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Credit"
                        value={line.credit || ''}
                        onChange={(e) => updateJournalLine(idx, 'credit', e.target.value)}
                        className="text-xs border border-slate-300 rounded-lg px-2 py-2 w-full sm:w-28 text-right bg-white"
                      />

                      {journalForm.lines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeJournalLine(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Balance Summary Verification */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
                <div className="flex gap-6">
                  <div>
                    <span className="text-slate-400">Total Debits:</span>
                    <span className="font-mono font-bold text-slate-800 ml-2">₱{totalDebits.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Credits:</span>
                    <span className="font-mono font-bold text-slate-800 ml-2">₱{totalCredits.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Difference:</span>
                    <span className={`font-mono font-bold ml-2 ${difference < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ₱{difference.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  {isBalanced ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Balanced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                      <AlertCircle className="h-3.5 w-3.5" /> Unbalanced
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowJournalModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Post Journal Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RUN MONTHLY DEPRECIATION */}
      {showDepreciationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                Run Monthly Depreciation
              </h3>
              <button onClick={() => setShowDepreciationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRunDepreciation} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                This will automatically calculate straight-line depreciation for all active PPE assets for the chosen period, update their accumulated depreciation, and generate a balanced double-entry Journal Voucher debiting Depreciation Expense and crediting Accumulated Depreciation.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Year</label>
                  <input
                    type="number"
                    required
                    value={deprForm.year}
                    onChange={(e) => setDeprForm({ ...deprForm, year: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Month (1 - 12)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    value={deprForm.month}
                    onChange={(e) => setDeprForm({ ...deprForm, month: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDepreciationModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postingDepr}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {postingDepr ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                  Calculate & Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD GL ACCOUNT */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                Add GL Account
              </h3>
              <button onClick={() => setShowAccountModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1500, 5200"
                  value={accountForm.code}
                  onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Plant Equipment, Accumulated Depreciation"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type *</label>
                <select
                  value={accountForm.type}
                  onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="REVENUE">REVENUE</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional details..."
                  value={accountForm.description}
                  onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
