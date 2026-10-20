import React, { useState } from 'react';
import { 
  ShieldCheck, HardDrive, Cpu, Play, RotateCcw, 
  Database, FileText, Plus, RefreshCw, Lock, AlertCircle, Wrench
} from 'lucide-react';
import BackupDashboardPage from './BackupDashboardPage';
import BackupDevicesPage from './BackupDevicesPage';
import BackupJobsPage from './BackupJobsPage';
import BackupExecutionsPage from './BackupExecutionsPage';
import BackupRestorePage from './BackupRestorePage';
import BackupRepositoriesPage from './BackupRepositoriesPage';
import BackupAuditPage from './BackupAuditPage';

export default function EnterpriseBackupLayout() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'devices' | 'jobs' | 'executions' | 'restores' | 'repositories' | 'audit' | 'baremetal'

  return (
    <div className="space-y-6 select-none">
      
      {/* Top Header */}
      <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-gold-400" />
            <h1 className="text-xl font-black tracking-tight">NKB Enterprise Backup & Recovery Console</h1>
            <span className="bg-gold-500/20 text-gold-400 border border-gold-500/40 text-[10px] font-black px-2 py-0.5 rounded uppercase">
              Phase 1 File-Level Production
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise backup repository management, file imaging, AES-256-GCM encryption, and Windows Service Agent telemetry.
          </p>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1 bg-white p-2 rounded-xl border shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'dashboard' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="h-4 w-4 text-gold-500" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'devices' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Cpu className="h-4 w-4 text-gold-500" />
          <span>Backup Devices</span>
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'jobs' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Play className="h-4 w-4 text-gold-500" />
          <span>Backup Jobs</span>
        </button>

        <button
          onClick={() => setActiveTab('executions')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'executions' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <RefreshCw className="h-4 w-4 text-gold-500" />
          <span>Executions</span>
        </button>

        <button
          onClick={() => setActiveTab('restores')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'restores' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <RotateCcw className="h-4 w-4 text-gold-500" />
          <span>File Restore</span>
        </button>

        <button
          onClick={() => setActiveTab('repositories')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'repositories' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HardDrive className="h-4 w-4 text-gold-500" />
          <span>Repositories</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'audit' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="h-4 w-4 text-gold-500" />
          <span>Audit Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('baremetal')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors text-slate-400 hover:text-slate-600 ${
            activeTab === 'baremetal' ? 'bg-slate-200 text-slate-800' : ''
          }`}
        >
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          <span>Bare-Metal & WinPE (Phase 3)</span>
        </button>
      </div>

      {/* Render Active Tab Page */}
      {activeTab === 'dashboard' && <BackupDashboardPage />}
      {activeTab === 'devices' && <BackupDevicesPage />}
      {activeTab === 'jobs' && <BackupJobsPage />}
      {activeTab === 'executions' && <BackupExecutionsPage />}
      {activeTab === 'restores' && <BackupRestorePage />}
      {activeTab === 'repositories' && <BackupRepositoriesPage />}
      {activeTab === 'audit' && <BackupAuditPage />}
      {activeTab === 'baremetal' && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <Wrench className="h-10 w-10 text-amber-500 mx-auto" />
          <h3 className="font-extrabold text-slate-900 text-base">WinPE Bare-Metal & System Disk Clone (Phase 3 Feature)</h3>
          <p className="text-xs text-slate-500 max-w-xl mx-auto leading-normal">
            Per Phase 1 engineering guidelines, live system disk cloning and offline WinPE bare-metal recovery features are safely disabled until Phase 3 to prevent unsafe live raw writes against active Windows system drives.
          </p>
        </div>
      )}

    </div>
  );
}
