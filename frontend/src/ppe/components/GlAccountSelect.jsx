import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X, AlertCircle } from 'lucide-react';
import api from '../../services/api';

/**
 * Enterprise-Grade Two-Line Searchable GL Account Dropdown Component
 * 
 * Displays:
 *  - First line: GL Account Name / Account Title
 *  - Second line: GL Account Code in smaller, muted text
 * 
 * Supports:
 *  - Real-time search by Account Name or Account Code
 *  - Keyboard navigation (Up/Down/Enter/Esc)
 *  - Customizable valueKey ('code' for assets, 'id' for journal entries)
 *  - Self-fetching if accounts array is not supplied
 *  - Responsive mobile and desktop layouts
 */
export default function GlAccountSelect({
  value,
  onChange,
  accounts: externalAccounts,
  valueKey = 'code', // 'code' | 'id'
  placeholder = 'Select GL Account...',
  label = null,
  required = false,
  disabled = false,
  error = null,
  size = 'md', // 'sm' | 'md'
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [accountsList, setAccountsList] = useState(externalAccounts || []);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Sync external accounts or fetch from API if not provided
  useEffect(() => {
    if (externalAccounts && externalAccounts.length > 0) {
      setAccountsList(externalAccounts);
      return;
    }
    let isMounted = true;
    setLoading(true);
    api.get('/ppe/accounting/accounts')
      .then((res) => {
        if (isMounted) {
          setAccountsList(res.data?.data || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load GL accounts in GlAccountSelect:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [externalAccounts]);

  // Resolve currently selected account based on value
  const selectedAccount = useMemo(() => {
    if (value === null || value === undefined || value === '') return null;
    
    // 1. Direct match on valueKey
    let match = accountsList.find(
      (a) => String(a[valueKey] ?? '').trim().toLowerCase() === String(value).trim().toLowerCase()
    );
    if (match) return match;

    // 2. Fallback: match on alternative key (code or id)
    match = accountsList.find(
      (a) => String(a.code ?? '').trim().toLowerCase() === String(value).trim().toLowerCase() ||
             String(a.id ?? '').trim() === String(value).trim()
    );
    if (match) return match;

    // 3. Fallback: match by account name (for legacy assets storing title)
    match = accountsList.find(
      (a) => String(a.name ?? '').trim().toLowerCase() === String(value).trim().toLowerCase()
    );
    if (match) return match;

    // 4. If non-empty but unmatched, present fallback structure so value is preserved
    return {
      id: value,
      code: String(value),
      name: String(value),
    };
  }, [accountsList, value, valueKey]);

  // Filter accounts by search query (name or code)
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accountsList;
    const q = searchQuery.toLowerCase().trim();
    return accountsList.filter((acc) => {
      const nameMatch = (acc.name || '').toLowerCase().includes(q);
      const codeMatch = (acc.code || '').toLowerCase().includes(q);
      const typeMatch = (acc.type || '').toLowerCase().includes(q);
      return nameMatch || codeMatch || typeMatch;
    });
  }, [accountsList, searchQuery]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle selection
  const handleSelect = (account) => {
    if (!account) {
      onChange?.('', null);
    } else {
      const outputVal = account[valueKey];
      onChange?.(outputVal, account);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  // Keyboard navigation inside search / list
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => 
        prev < filteredAccounts.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => 
        prev > 0 ? prev - 1 : filteredAccounts.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredAccounts[highlightedIndex]) {
        handleSelect(filteredAccounts[highlightedIndex]);
      }
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex];
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const isSmall = size === 'sm';

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Dropdown Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full text-left bg-white border transition-all duration-150 flex items-center justify-between gap-2 shadow-sm ${
          isSmall 
            ? 'px-3 py-1.5 min-h-[38px] rounded-lg text-xs' 
            : 'px-3.5 py-2 min-h-[46px] rounded-xl text-sm'
        } ${
          disabled ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : 'cursor-pointer'
        } ${
          error ? 'border-rose-400 ring-2 ring-rose-100' : ''
        } ${
          isOpen ? 'ring-2 ring-blue-600 border-blue-600' : 'border-slate-300 hover:border-slate-400'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedAccount ? (
          <div className="flex flex-col text-left min-w-0 pr-1 flex-1">
            {/* First line: GL Account Name / Account Title */}
            <span className={`font-semibold text-slate-900 truncate leading-snug ${isSmall ? 'text-xs' : 'text-sm'}`}>
              {selectedAccount.name}
            </span>
            {/* Second line: GL Account Code in smaller, muted text */}
            <span className={`font-mono text-slate-500 leading-tight mt-0.5 ${isSmall ? 'text-[10px]' : 'text-xs'}`}>
              {selectedAccount.code}
            </span>
          </div>
        ) : (
          <span className={`text-slate-400 truncate ${isSmall ? 'text-xs' : 'text-sm'}`}>
            {loading ? 'Loading accounts...' : placeholder}
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {selectedAccount && !required && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              title="Clear selection"
              className="hover:text-slate-700 hover:bg-slate-100 p-1 rounded transition"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </div>
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div 
          className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ minWidth: '260px' }}
        >
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search account name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder:text-slate-400 text-slate-800"
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Accounts Options List */}
          <div 
            ref={listRef} 
            className="max-h-64 overflow-y-auto divide-y divide-slate-100"
            role="listbox"
          >
            {loading ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                Loading Chart of Accounts...
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                No GL accounts match "{searchQuery}"
              </div>
            ) : (
              filteredAccounts.map((acc, index) => {
                const isSelected = selectedAccount && String(selectedAccount[valueKey]) === String(acc[valueKey]);
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={acc.id || acc.code}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(acc)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3.5 py-2.5 cursor-pointer transition-colors duration-100 flex items-center justify-between text-left ${
                      isSelected
                        ? 'bg-blue-50/90 text-blue-900 border-l-4 border-l-blue-600'
                        : isHighlighted
                        ? 'bg-slate-50 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      {/* First line: GL Account Name / Account Title */}
                      <span className={`text-sm font-semibold truncate leading-tight ${
                        isSelected ? 'text-blue-950 font-bold' : 'text-slate-900'
                      }`}>
                        {acc.name}
                      </span>
                      {/* Second line: GL Account Code in smaller, muted text */}
                      <span className={`text-xs font-mono mt-1 ${
                        isSelected ? 'text-blue-700' : 'text-slate-500'
                      }`}>
                        {acc.code}
                      </span>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer count indicator */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between items-center font-medium">
            <span>{filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''} available</span>
            <span>Chart of Accounts</span>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-rose-500 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
