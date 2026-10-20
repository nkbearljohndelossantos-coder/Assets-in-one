import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { 
  Laptop, Smartphone, Radio, Mouse, ShieldCheck, CheckCircle2, 
  Calendar, Wrench, AlertCircle, RefreshCw, Cpu, HardDrive, Wifi, Lock
} from 'lucide-react';

export default function PublicAssetSpecs() {
  const { code } = useParams();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAssetSpecs = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/assets/public-specs/${code}`);
        if (res.data.success) {
          setAsset(res.data.data);
        } else {
          setError('Asset profile not found');
        }
      } catch (err) {
        console.error('Failed to fetch public asset specs', err);
        setError('Asset record not found or inaccessible');
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchAssetSpecs();
    }
  }, [code]);

  const categoryName = String(asset?.category_name || '').toLowerCase();
  const isPhone = categoryName.includes('phone') || categoryName.includes('mobile');
  const isRadio = categoryName.includes('radio') || categoryName.includes('walkie');
  const isMouse = categoryName.includes('mouse');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      
      {/* Top Brand Header */}
      <div className="max-w-md w-full space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-gold-400 font-extrabold text-xs shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>NKB ENTERPRISE IT MANAGEMENT SYSTEM</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Verified Equipment Specifications</h1>
        </div>

        {loading ? (
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-8 text-center space-y-3 backdrop-blur shadow-xl">
            <RefreshCw className="h-8 w-8 text-gold-400 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400">Loading Asset Data for {code}...</p>
          </div>
        ) : error || !asset ? (
          <div className="bg-slate-800/80 border border-rose-500/50 rounded-2xl p-8 text-center space-y-3 backdrop-blur shadow-xl">
            <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
            <h3 className="font-bold text-sm text-white">Asset Record Not Found</h3>
            <p className="text-xs text-slate-400">The QR Code code <span className="font-mono text-gold-400">{code}</span> does not match any registered asset in the NKB ITMS database.</p>
            <Link to="/login" className="inline-block mt-2 text-xs font-bold text-blue-400 hover:underline">
              Go to System Login
            </Link>
          </div>
        ) : (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden backdrop-blur space-y-0">
            
            {/* Asset Header Banner */}
            <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-gold-400 shadow-inner">
                  {isRadio ? (
                    <Radio className="h-7 w-7 text-emerald-400" />
                  ) : isMouse ? (
                    <Mouse className="h-7 w-7 text-purple-400" />
                  ) : isPhone ? (
                    <Smartphone className="h-7 w-7 text-blue-400" />
                  ) : (
                    <Laptop className="h-7 w-7 text-gold-400" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gold-400 tracking-wider font-mono">
                    {asset.asset_code}
                  </span>
                  <h2 className="font-black text-sm text-white leading-tight line-clamp-1">{asset.name}</h2>
                  <span className="text-[10px] text-slate-400 font-semibold">{asset.category_name}</span>
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase shadow-sm ${
                asset.status === 'Available' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                asset.status === 'Assigned' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {asset.status}
              </span>
            </div>

            {/* Photo Preview if available */}
            {asset.image_path && asset.image_path !== 'null' && (
              <div className="p-4 bg-slate-950/40 border-b border-slate-700/60 flex justify-center">
                <img
                  src={asset.image_path}
                  alt={asset.name}
                  className="max-h-44 object-contain rounded-lg border border-slate-700 shadow-md"
                />
              </div>
            )}

            {/* Asset General Specs Section */}
            <div className="p-5 space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-700 font-semibold">
                <div>
                  <span className="block text-[9px] font-extrabold uppercase text-slate-400">Brand & Model</span>
                  <span className="font-bold text-white">{asset.brand} {asset.model}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-extrabold uppercase text-slate-400">Serial Number</span>
                  <span className="font-mono font-bold text-gold-400 truncate block">{asset.serial_number}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-extrabold uppercase text-slate-400">Physical Condition</span>
                  <span className="font-bold text-emerald-400">{asset.condition || 'Good'}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-extrabold uppercase text-slate-400">Custody / Owner</span>
                  <span className="font-bold text-blue-300 truncate block">
                    {asset.employee_name || asset.department_name || 'Unassigned / Storage'}
                  </span>
                </div>
              </div>

              {/* Specialized Hardware Specs Breakdown */}
              {isRadio ? (
                <div className="space-y-2 bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 border-b border-emerald-500/30 pb-1.5 text-emerald-400 font-bold text-xs">
                    <Radio className="h-4 w-4" />
                    <span>Two-Way Radio Technical Specs</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div><span className="text-slate-400 block">Call Sign:</span> <span className="font-bold text-white">{asset.call_sign || 'N/A'}</span></div>
                    <div><span className="text-slate-400 block">Frequency Band:</span> <span className="font-bold text-emerald-300">{asset.radio_frequency_band || 'UHF/VHF'}</span></div>
                    <div><span className="text-slate-400 block">Channels / Power:</span> <span className="font-bold text-white">{asset.radio_channel_count || '16 Ch'} | {asset.radio_power_output || '5W'}</span></div>
                    <div><span className="text-slate-400 block">NTC License No:</span> <span className="font-bold text-white">{asset.license_number || 'N/A'}</span></div>
                  </div>
                </div>
              ) : isMouse ? (
                <div className="space-y-2 bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 border-b border-purple-500/30 pb-1.5 text-purple-400 font-bold text-xs">
                    <Mouse className="h-4 w-4" />
                    <span>Computer Mouse Specifications</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div><span className="text-slate-400 block">Connectivity:</span> <span className="font-bold text-white">{asset.mouse_connectivity || 'Wired/Wireless'}</span></div>
                    <div><span className="text-slate-400 block">Sensor DPI:</span> <span className="font-bold text-purple-300">{asset.mouse_sensor_dpi || 'Standard Optical'}</span></div>
                    <div><span className="text-slate-400 block">Buttons:</span> <span className="font-bold text-white">{asset.mouse_buttons_count || 'Standard'}</span></div>
                    <div><span className="text-slate-400 block">Form Factor:</span> <span className="font-bold text-white">{asset.mouse_hand_orientation || 'Ambidextrous'}</span></div>
                  </div>
                </div>
              ) : isPhone ? (
                <div className="space-y-2 bg-blue-950/30 border border-blue-500/30 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 border-b border-blue-500/30 pb-1.5 text-blue-400 font-bold text-xs">
                    <Smartphone className="h-4 w-4" />
                    <span>Smartphone & Enterprise MDM Details</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div><span className="text-slate-400 block">IMEI Number:</span> <span className="font-mono font-bold text-white">{asset.imei_number || 'N/A'}</span></div>
                    <div><span className="text-slate-400 block">Phone / SIM:</span> <span className="font-bold text-blue-300">{asset.phone_number || 'N/A'}</span></div>
                    <div><span className="text-slate-400 block">Network Carrier:</span> <span className="font-bold text-white">{asset.sim_carrier || 'Corporate Postpaid'}</span></div>
                    <div><span className="text-slate-400 block">MDM Enrolled:</span> <span className="font-bold text-emerald-400">{asset.mdm_enrolled ? 'Active 🛡️' : 'No'}</span></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 bg-slate-900 border border-slate-700 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 border-b border-slate-700 pb-1.5 text-gold-400 font-bold text-xs">
                    <Cpu className="h-4 w-4" />
                    <span>Hardware PC & Laptop Specifications</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div><span className="text-slate-400 block">Processor (CPU):</span> <span className="font-bold text-white">{asset.specs_cpu || 'Intel / AMD Core'}</span></div>
                    <div><span className="text-slate-400 block">RAM Memory:</span> <span className="font-bold text-white">{asset.specs_ram || 'Standard RAM'}</span></div>
                    <div><span className="text-slate-400 block">Storage:</span> <span className="font-bold text-white">{asset.specs_storage || 'SSD/HDD'}</span></div>
                    <div><span className="text-slate-400 block">Operating System:</span> <span className="font-bold text-white">{asset.specs_os || 'Windows / macOS'} {asset.specs_win_edition || ''}</span></div>
                  </div>
                </div>
              )}

              {/* Asset Remarks / Description */}
              {asset.description && (
                <div className="text-[11px] text-slate-300 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 font-bold block text-[9px] uppercase">Notes / Remarks</span>
                  <p>{asset.description}</p>
                </div>
              )}

              {/* Bottom Verification Footer */}
              <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between text-[10px]">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Verified NKB Asset Record</span>
                </span>
                <Link
                  to="/login"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 transition-colors"
                >
                  <Lock className="h-3 w-3" />
                  <span>ITMS Login</span>
                </Link>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
