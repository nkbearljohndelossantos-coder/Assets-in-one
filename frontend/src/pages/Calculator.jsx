import React, { useState, useMemo } from 'react';
import { 
  Calculator, Video, Monitor, Laptop, Printer, HardDrive, 
  Zap, Battery, DollarSign, FileText, Download, RotateCcw, 
  HelpCircle, CheckCircle2, TrendingUp, ShieldAlert, Cpu, 
  Clock, Server, Info, Layers, ArrowRight, Copy, Check,
  Network, Wifi, Globe, Terminal, Sliders, Shield, ListFilter,
  FileSpreadsheet, Search, AlertTriangle, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, ExternalLink, ArrowUpDown
} from 'lucide-react';

// =========================================================================
// ENTERPRISE IP & BITWISE HELPER UTILITIES
// =========================================================================

function isValidIpv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false;
    const n = parseInt(part, 10);
    return n >= 0 && n <= 255;
  });
}

function ipToInt(ip) {
  if (!ip || typeof ip !== 'string') return 0;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return 0;
  return parts.reduce((acc, oct) => {
    const n = parseInt(oct, 10);
    const valid = isNaN(n) ? 0 : Math.max(0, Math.min(255, n));
    return ((acc << 8) + valid) >>> 0;
  }, 0);
}

function intToIp(intVal) {
  return [
    (intVal >>> 24) & 255,
    (intVal >>> 16) & 255,
    (intVal >>> 8) & 255,
    intVal & 255
  ].join('.');
}

function cidrToMaskInt(cidr) {
  if (cidr <= 0) return 0;
  if (cidr >= 32) return 0xFFFFFFFF >>> 0;
  return (~0 << (32 - cidr)) >>> 0;
}

function cidrToMask(cidr) {
  return intToIp(cidrToMaskInt(cidr));
}

function cidrToWildcard(cidr) {
  return intToIp((~cidrToMaskInt(cidr)) >>> 0);
}

export default function EquipmentCalculator() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('subnet');
  const [copiedKey, setCopiedKey] = useState(null);

  // Currency & number formatting helpers
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const formatNumber = (val, decimals = 1) => {
    return Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const copyText = (text, key = 'global') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  // =========================================================================
  // STATIC IP & SUBNETTING CALCULATOR STATE & LOGIC
  // =========================================================================
  const [subnetParams, setSubnetParams] = useState({
    planName: 'Production Plant Primary Subnet',
    baseIp: '192.168.1.0',
    cidr: 24,
    gatewayMode: 'first', // 'first' (.1) or 'last' (.254)
    dns1: '1.1.1.1',
    dns2: '8.8.8.8',
    // Quantities for each device category
    infraCount: 5,     // Gateways, Switches, Routers, APs
    printerCount: 8,   // Static Network Printers / Copiers
    cctvCount: 16,     // Static CCTV Cameras & NVRs
    pcCount: 45,       // Static Workstation Desktop PCs
    laptopCount: 60,   // Laptops & Mobile (DHCP Scope)
    bufferPercent: 15  // Buffer reserved headroom per group
  });

  // Table filter & sorting state
  const [ipTableCategoryFilter, setIpTableCategoryFilter] = useState('all');
  const [ipTableTypeFilter, setIpTableTypeFilter] = useState('all');
  const [ipTableSearch, setIpTableSearch] = useState('');
  const [ipTableSortKey, setIpTableSortKey] = useState('ip');
  const [ipTableSortDir, setIpTableSortDir] = useState('asc');
  const [ipTablePage, setIpTablePage] = useState(1);
  const [ipTablePageSize, setIpTablePageSize] = useState(25);

  // Selected device for configuration generator
  const [selectedGeneratorDevice, setSelectedGeneratorDevice] = useState('infra_1');
  const [generatorInterface, setGeneratorInterface] = useState('Ethernet');
  const [generatorScriptTab, setGeneratorScriptTab] = useState('cmd'); // 'cmd', 'ps', 'netplan', 'params'

  // Input validation
  const isBaseIpValid = useMemo(() => isValidIpv4(subnetParams.baseIp), [subnetParams.baseIp]);
  const isDns1Valid = useMemo(() => !subnetParams.dns1 || isValidIpv4(subnetParams.dns1), [subnetParams.dns1]);
  const isDns2Valid = useMemo(() => !subnetParams.dns2 || isValidIpv4(subnetParams.dns2), [subnetParams.dns2]);

  // Subnet Calculation Engine
  const subnetResults = useMemo(() => {
    const cidr = Math.max(8, Math.min(32, parseInt(subnetParams.cidr, 10) || 24));
    const maskInt = cidrToMaskInt(cidr);
    const ipInt = ipToInt(subnetParams.baseIp);
    const networkInt = (ipInt & maskInt) >>> 0;
    const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;

    const totalHosts = Math.pow(2, 32 - cidr);
    let usableHosts = 0;
    let firstUsableInt = networkInt;
    let lastUsableInt = broadcastInt;

    if (cidr === 32) {
      usableHosts = 1;
      firstUsableInt = networkInt;
      lastUsableInt = networkInt;
    } else if (cidr === 31) {
      usableHosts = 2;
      firstUsableInt = networkInt;
      lastUsableInt = broadcastInt;
    } else {
      usableHosts = Math.max(0, totalHosts - 2);
      firstUsableInt = (networkInt + 1) >>> 0;
      lastUsableInt = (broadcastInt - 1) >>> 0;
    }

    const gatewayInt = subnetParams.gatewayMode === 'last' ? lastUsableInt : firstUsableInt;
    const gatewayIp = intToIp(gatewayInt);

    // Calculate required hosts with buffer
    const bufferMultiplier = 1 + ((Math.max(0, Number(subnetParams.bufferPercent) || 0)) / 100);
    const infraSize = subnetParams.infraCount > 0 ? Math.max(1, Math.ceil(subnetParams.infraCount * bufferMultiplier)) : 0;
    const printerSize = subnetParams.printerCount > 0 ? Math.max(1, Math.ceil(subnetParams.printerCount * bufferMultiplier)) : 0;
    const cctvSize = subnetParams.cctvCount > 0 ? Math.max(1, Math.ceil(subnetParams.cctvCount * bufferMultiplier)) : 0;
    const pcSize = subnetParams.pcCount > 0 ? Math.max(1, Math.ceil(subnetParams.pcCount * bufferMultiplier)) : 0;
    const laptopSize = subnetParams.laptopCount > 0 ? Math.max(1, Math.ceil(subnetParams.laptopCount * bufferMultiplier)) : 0;

    const totalRequestedDevices = (Number(subnetParams.infraCount) || 0) + 
      (Number(subnetParams.printerCount) || 0) + 
      (Number(subnetParams.cctvCount) || 0) + 
      (Number(subnetParams.pcCount) || 0) + 
      (Number(subnetParams.laptopCount) || 0);

    // Gateway is 1 host reservation
    const totalAllocatedSize = 1 + infraSize + printerSize + cctvSize + pcSize + laptopSize;

    // Partition ranges consecutively excluding gateway
    let currentStartInt = subnetParams.gatewayMode === 'first' ? ((firstUsableInt + 1) >>> 0) : firstUsableInt;
    const maxAllocatableInt = subnetParams.gatewayMode === 'last' ? ((lastUsableInt - 1) >>> 0) : lastUsableInt;

    // 1. Infra Range
    let infraStart = 0;
    let infraEnd = 0;
    if (infraSize > 0 && currentStartInt <= maxAllocatableInt) {
      infraStart = currentStartInt;
      infraEnd = Math.min(maxAllocatableInt, ((infraStart + infraSize - 1) >>> 0));
      currentStartInt = ((infraEnd + 1) >>> 0);
    }

    // 2. Printer Range
    let printerStart = 0;
    let printerEnd = 0;
    if (printerSize > 0 && currentStartInt <= maxAllocatableInt) {
      printerStart = currentStartInt;
      printerEnd = Math.min(maxAllocatableInt, ((printerStart + printerSize - 1) >>> 0));
      currentStartInt = ((printerEnd + 1) >>> 0);
    }

    // 3. CCTV Range
    let cctvStart = 0;
    let cctvEnd = 0;
    if (cctvSize > 0 && currentStartInt <= maxAllocatableInt) {
      cctvStart = currentStartInt;
      cctvEnd = Math.min(maxAllocatableInt, ((cctvStart + cctvSize - 1) >>> 0));
      currentStartInt = ((cctvEnd + 1) >>> 0);
    }

    // 4. Desktop PC Range
    let pcStart = 0;
    let pcEnd = 0;
    if (pcSize > 0 && currentStartInt <= maxAllocatableInt) {
      pcStart = currentStartInt;
      pcEnd = Math.min(maxAllocatableInt, ((pcStart + pcSize - 1) >>> 0));
      currentStartInt = ((pcEnd + 1) >>> 0);
    }

    // 5. Laptop & Wi-Fi DHCP Pool
    let laptopStart = 0;
    let laptopEnd = 0;
    if (laptopSize > 0 && currentStartInt <= maxAllocatableInt) {
      laptopStart = currentStartInt;
      laptopEnd = Math.min(maxAllocatableInt, ((laptopStart + laptopSize - 1) >>> 0));
      currentStartInt = ((laptopEnd + 1) >>> 0);
    }

    // Free / Unallocated IPs
    let freeStart = 0;
    let freeEnd = 0;
    let freeCount = 0;
    if (currentStartInt <= maxAllocatableInt) {
      freeStart = currentStartInt;
      freeEnd = maxAllocatableInt;
      freeCount = Math.max(0, ((freeEnd - freeStart + 1) >>> 0));
    }

    const isOverCapacity = totalAllocatedSize > usableHosts;
    const utilizationPercent = Math.min(100, Math.round((totalAllocatedSize / Math.max(1, usableHosts)) * 100));
    const remainingCapacity = Math.max(0, usableHosts - totalAllocatedSize);

    // IP Class detection
    const firstOctet = parseInt(subnetParams.baseIp.split('.')[0], 10) || 192;
    let ipClass = 'Class C (Private: 192.168.0.0/16)';
    if (firstOctet < 128) ipClass = 'Class A (Private: 10.0.0.0/8)';
    else if (firstOctet < 192) ipClass = 'Class B (Private: 172.16.0.0/12)';

    // Generate individual device records
    const generatedIps = [];

    // Default Gateway
    generatedIps.push({
      id: 'gateway',
      ip: gatewayIp,
      hostname: 'NKB-CORE-GW01',
      category: 'infra',
      categoryLabel: 'Default Gateway / Router',
      assignmentType: 'Static Core',
      role: 'Enterprise Core Router / Default Gateway',
      mask: cidrToMask(cidr),
      gateway: 'Self',
      dns: `${subnetParams.dns1 || 'N/A'}, ${subnetParams.dns2 || 'N/A'}`
    });

    // Infrastructure Devices
    if (infraSize > 0) {
      for (let i = 1; i <= subnetParams.infraCount; i++) {
        const ipVal = ((infraStart + i - 1) >>> 0);
        if (ipVal <= infraEnd) {
          generatedIps.push({
            id: `infra_${i}`,
            ip: intToIp(ipVal),
            hostname: `NKB-SW-ACCESS-${String(i).padStart(2, '0')}`,
            category: 'infra',
            categoryLabel: 'Network Infrastructure',
            assignmentType: 'Static IP',
            role: i === 1 ? 'Primary Core L3 Switch' : `Access Switch / AP Node ${i}`,
            mask: cidrToMask(cidr),
            gateway: gatewayIp,
            dns: `${subnetParams.dns1}, ${subnetParams.dns2}`
          });
        }
      }
    }

    // Printers
    if (printerSize > 0) {
      for (let i = 1; i <= subnetParams.printerCount; i++) {
        const ipVal = ((printerStart + i - 1) >>> 0);
        if (ipVal <= printerEnd) {
          generatedIps.push({
            id: `printer_${i}`,
            ip: intToIp(ipVal),
            hostname: `NKB-PRN-${String(i).padStart(2, '0')}`,
            category: 'printer',
            categoryLabel: 'Network Printer / Copier',
            assignmentType: 'Static IP',
            role: i === 1 ? 'Heavy Duty MFP Copier (Admin Office)' : `Department Network Printer ${i}`,
            mask: cidrToMask(cidr),
            gateway: gatewayIp,
            dns: `${subnetParams.dns1}, ${subnetParams.dns2}`
          });
        }
      }
    }

    // CCTV
    if (cctvSize > 0) {
      for (let i = 1; i <= subnetParams.cctvCount; i++) {
        const ipVal = ((cctvStart + i - 1) >>> 0);
        if (ipVal <= cctvEnd) {
          generatedIps.push({
            id: `cctv_${i}`,
            ip: intToIp(ipVal),
            hostname: `NKB-CAM-${String(i).padStart(2, '0')}`,
            category: 'cctv',
            categoryLabel: 'CCTV Camera / NVR',
            assignmentType: 'Static IP',
            role: i === 1 ? 'NVR Master Storage Server' : `IP Surveillance Camera ${i}`,
            mask: cidrToMask(cidr),
            gateway: gatewayIp,
            dns: `${subnetParams.dns1}, ${subnetParams.dns2}`
          });
        }
      }
    }

    // Desktop PCs
    if (pcSize > 0) {
      for (let i = 1; i <= subnetParams.pcCount; i++) {
        const ipVal = ((pcStart + i - 1) >>> 0);
        if (ipVal <= pcEnd) {
          generatedIps.push({
            id: `pc_${i}`,
            ip: intToIp(ipVal),
            hostname: `NKB-PC-${String(i).padStart(3, '0')}`,
            category: 'pc',
            categoryLabel: 'Desktop Workstation',
            assignmentType: 'Static IP',
            role: `Fixed Office Workstation Desk ${i}`,
            mask: cidrToMask(cidr),
            gateway: gatewayIp,
            dns: `${subnetParams.dns1}, ${subnetParams.dns2}`
          });
        }
      }
    }

    // Laptops
    if (laptopSize > 0) {
      const displayLaptops = Math.min(30, subnetParams.laptopCount);
      for (let i = 1; i <= displayLaptops; i++) {
        const ipVal = ((laptopStart + i - 1) >>> 0);
        if (ipVal <= laptopEnd) {
          generatedIps.push({
            id: `laptop_${i}`,
            ip: intToIp(ipVal),
            hostname: `NKB-LAP-${String(i).padStart(3, '0')}`,
            category: 'laptop',
            categoryLabel: 'Laptop / Mobile',
            assignmentType: 'DHCP Pool',
            role: `Staff Mobile Unit ${i} (DHCP Reservation)`,
            mask: cidrToMask(cidr),
            gateway: gatewayIp,
            dns: `${subnetParams.dns1}, ${subnetParams.dns2}`
          });
        }
      }
    }

    return {
      network: intToIp(networkInt),
      broadcast: intToIp(broadcastInt),
      mask: cidrToMask(cidr),
      wildcard: cidrToWildcard(cidr),
      firstUsable: intToIp(firstUsableInt),
      lastUsable: intToIp(lastUsableInt),
      gatewayIp,
      totalHosts,
      usableHosts,
      totalRequestedDevices,
      totalAllocatedSize,
      remainingCapacity,
      isOverCapacity,
      utilizationPercent,
      ipClass,
      ranges: {
        infra: { 
          start: infraSize > 0 ? intToIp(infraStart) : 'N/A', 
          end: infraSize > 0 ? intToIp(infraEnd) : 'N/A', 
          count: infraSize, 
          active: subnetParams.infraCount 
        },
        printer: { 
          start: printerSize > 0 ? intToIp(printerStart) : 'N/A', 
          end: printerSize > 0 ? intToIp(printerEnd) : 'N/A', 
          count: printerSize, 
          active: subnetParams.printerCount 
        },
        cctv: { 
          start: cctvSize > 0 ? intToIp(cctvStart) : 'N/A', 
          end: cctvSize > 0 ? intToIp(cctvEnd) : 'N/A', 
          count: cctvSize, 
          active: subnetParams.cctvCount 
        },
        pc: { 
          start: pcSize > 0 ? intToIp(pcStart) : 'N/A', 
          end: pcSize > 0 ? intToIp(pcEnd) : 'N/A', 
          count: pcSize, 
          active: subnetParams.pcCount 
        },
        laptop: { 
          start: laptopSize > 0 ? intToIp(laptopStart) : 'N/A', 
          end: laptopSize > 0 ? intToIp(laptopEnd) : 'N/A', 
          count: laptopSize, 
          active: subnetParams.laptopCount 
        },
        free: { 
          start: freeCount > 0 ? intToIp(freeStart) : 'N/A', 
          end: freeCount > 0 ? intToIp(freeEnd) : 'N/A', 
          count: freeCount 
        }
      },
      generatedIps
    };
  }, [subnetParams]);

  // Selected device for configuration generator
  const activeDeviceRow = useMemo(() => {
    return subnetResults.generatedIps.find(x => x.id === selectedGeneratorDevice) || 
      subnetResults.generatedIps[1] || 
      subnetResults.generatedIps[0] || {
        ip: '192.168.1.10',
        hostname: 'NKB-DEVICE-01',
        category: 'pc',
        categoryLabel: 'Desktop Workstation',
        assignmentType: 'Static IP',
        role: 'Office Workstation',
        mask: '255.255.255.0',
        gateway: '192.168.1.1',
        dns: '1.1.1.1, 8.8.8.8'
      };
  }, [subnetResults, selectedGeneratorDevice]);

  // Filtered and Sorted IP Table Data
  const filteredAndSortedIps = useMemo(() => {
    let result = subnetResults.generatedIps.filter(row => {
      const matchCat = ipTableCategoryFilter === 'all' || row.category === ipTableCategoryFilter;
      const matchType = ipTableTypeFilter === 'all' || 
        (ipTableTypeFilter === 'static' && row.assignmentType.includes('Static')) ||
        (ipTableTypeFilter === 'dhcp' && row.assignmentType.includes('DHCP')) ||
        (ipTableTypeFilter === 'core' && row.assignmentType.includes('Core'));

      const searchLower = ipTableSearch.toLowerCase().trim();
      const matchSearch = !searchLower || 
        row.ip.includes(searchLower) || 
        row.hostname.toLowerCase().includes(searchLower) ||
        row.role.toLowerCase().includes(searchLower) ||
        row.categoryLabel.toLowerCase().includes(searchLower);

      return matchCat && matchType && matchSearch;
    });

    // Sorting
    result.sort((a, b) => {
      let comp = 0;
      if (ipTableSortKey === 'ip') {
        comp = ipToInt(a.ip) - ipToInt(b.ip);
      } else if (ipTableSortKey === 'hostname') {
        comp = a.hostname.localeCompare(b.hostname);
      } else if (ipTableSortKey === 'category') {
        comp = a.categoryLabel.localeCompare(b.categoryLabel);
      } else if (ipTableSortKey === 'role') {
        comp = a.role.localeCompare(b.role);
      }
      return ipTableSortDir === 'asc' ? comp : -comp;
    });

    return result;
  }, [subnetResults, ipTableCategoryFilter, ipTableTypeFilter, ipTableSearch, ipTableSortKey, ipTableSortDir]);

  // Paginated Rows
  const totalTableRows = filteredAndSortedIps.length;
  const totalPages = Math.max(1, Math.ceil(totalTableRows / ipTablePageSize));
  const currentPage = Math.min(ipTablePage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ipTablePageSize;
    return filteredAndSortedIps.slice(start, start + ipTablePageSize);
  }, [filteredAndSortedIps, currentPage, ipTablePageSize]);

  // Handle Sort Change
  const handleSort = (key) => {
    if (ipTableSortKey === key) {
      setIpTableSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setIpTableSortKey(key);
      setIpTableSortDir('asc');
    }
  };

  // Download IP Table CSV
  const handleDownloadCsv = () => {
    const headers = ['IP Address', 'Hostname', 'Device Category', 'Assignment Type', 'Subnet Mask', 'Gateway', 'Primary DNS', 'Secondary DNS', 'Role / Description'];
    const rows = subnetResults.generatedIps.map(r => [
      `"${r.ip}"`,
      `"${r.hostname}"`,
      `"${r.categoryLabel}"`,
      `"${r.assignmentType}"`,
      `"${subnetResults.mask}"`,
      `"${subnetResults.gatewayIp}"`,
      `"${subnetParams.dns1}"`,
      `"${subnetParams.dns2}"`,
      `"${r.role}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NKB_IP_Plan_${subnetParams.baseIp.replace(/\./g, '_')}_slash${subnetParams.cidr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Summary to Clipboard
  const handleCopySummary = () => {
    let summary = '';
    if (activeTab === 'subnet') {
      summary = `================================================================================
NKB IT MANAGEMENT SYSTEM — STATIC IP & SUBNETTING ALLOCATION PLAN
================================================================================
Network Plan: ${subnetParams.planName}
Base Subnet: ${subnetResults.network}/${subnetParams.cidr}
Subnet Mask: ${subnetResults.mask} (Wildcard: ${subnetResults.wildcard})
Usable IP Scope: ${subnetResults.firstUsable} – ${subnetResults.lastUsable} (${subnetResults.usableHosts} Usable Hosts)
Default Gateway: ${subnetResults.gatewayIp}
DNS Resolvers: Primary: ${subnetParams.dns1 || 'N/A'} | Secondary: ${subnetParams.dns2 || 'N/A'}
IP Class: ${subnetResults.ipClass}
Total Utilization: ${subnetResults.utilizationPercent}% (${subnetResults.totalAllocatedSize} allocated / ${subnetResults.usableHosts} usable hosts)
Spare Unallocated: ${subnetResults.remainingCapacity} IPs (${subnetResults.ranges.free.start} – ${subnetResults.ranges.free.end})

--------------------------------------------------------------------------------
ZONED IP ALLOCATION RANGES (EXPANSION BUFFER: +${subnetParams.bufferPercent}%)
--------------------------------------------------------------------------------
1. Core Gateway & Infra (${subnetParams.infraCount} devices): ${subnetResults.ranges.infra.start} – ${subnetResults.ranges.infra.end} (${subnetResults.ranges.infra.count} IPs)
2. Network Printers & MFPs (${subnetParams.printerCount} devices): ${subnetResults.ranges.printer.start} – ${subnetResults.ranges.printer.end} (${subnetResults.ranges.printer.count} IPs)
3. CCTV & Surveillance (${subnetParams.cctvCount} devices): ${subnetResults.ranges.cctv.start} – ${subnetResults.ranges.cctv.end} (${subnetResults.ranges.cctv.count} IPs)
4. Desktop Workstations (${subnetParams.pcCount} devices): ${subnetResults.ranges.pc.start} – ${subnetResults.ranges.pc.end} (${subnetResults.ranges.pc.count} IPs)
5. Laptops & Mobile DHCP (${subnetParams.laptopCount} devices): ${subnetResults.ranges.laptop.start} – ${subnetResults.ranges.laptop.end} (${subnetResults.ranges.laptop.count} IPs)
6. Free Unallocated Pool: ${subnetResults.ranges.free.start} – ${subnetResults.ranges.free.end} (${subnetResults.ranges.free.count} IPs)

Generated by NKB Unified ITMS IP Address Management Engine.
================================================================================`;
    } else if (activeTab === 'cctv') {
      summary = `[NKB ITMS - CCTV Sizing Summary]
Cameras: ${cctvParams.cameras} units (${cctvParams.resolution}, ${cctvParams.codec.toUpperCase()}, ${cctvParams.fps} FPS)
Retention: ${cctvParams.retentionDays} Days (${cctvParams.hoursPerDay} hrs/day)
Total Storage Required: ${formatNumber(cctvResults.usableStorageTb, 2)} TB (Usable) / ${formatNumber(cctvResults.grossStorageNeededTb, 2)} TB (Gross ${cctvParams.raidType.toUpperCase()})
Recommended Hardware: ${cctvResults.recommendedDrivesCount}x ${cctvResults.driveSize}TB Surveillance HDDs
NVR Recommendation: ${cctvResults.nvrChannels}-Channel NVR
Inbound Network Bandwidth: ${formatNumber(cctvResults.totalBandwidthMbps, 1)} Mbps (${cctvResults.switchSpeed})
Estimated HDD Storage Budget: ${formatCurrency(cctvResults.estimatedHddCost)}`;
    } else if (activeTab === 'pc') {
      summary = `[NKB ITMS - PC Power & Sizing Summary]
Fleet: ${pcParams.quantity}x Desktop Workstations (${pcParams.unitDrawWatts}W PC + ${pcParams.monitors} Monitors)
Total Fleet Active Power: ${formatNumber(pcResults.fleetActiveKw, 2)} kW
Monthly Power Usage: ${formatNumber(pcResults.fleetMonthlyKwh, 1)} kWh (${formatCurrency(pcResults.fleetMonthlyCost)}/mo @ ₱${pcParams.electricityRate}/kWh)
Annual Electricity Cost: ${formatCurrency(pcResults.fleetAnnualCost)}
Recommended UPS Rating: ${pcResults.recommendedUpsRating} (Min ${pcResults.upsMinVa} VA / ${pcResults.upsMinWatts} W)
Monthly Depreciation: ${formatCurrency(pcResults.fleetMonthlyDepreciation)}
Total Monthly TCO: ${formatCurrency(pcResults.totalFleetMonthlyTco)}`;
    } else if (activeTab === 'laptop') {
      summary = `[NKB ITMS - Laptop Power & TCO Summary]
Fleet: ${laptopParams.quantity}x Laptops (${laptopParams.chargerWatts}W Adapter, ~${laptopParams.avgWatts}W draw)
Monthly Power Usage: ${formatNumber(laptopResults.fleetMonthlyKwh, 1)} kWh (${formatCurrency(laptopResults.fleetMonthlyCost)}/mo)
Annual Green Savings vs Desktop: ${formatCurrency(laptopResults.fleetAnnualSavings)}
Projected Battery Lifespan: ~${laptopResults.monthsTo80Percent} months to 80% capacity (${laptopResults.cyclesPerYear} cycles/yr)
Monthly Fleet Depreciation: ${formatCurrency(laptopResults.fleetMonthlyDepreciation)}
Total Monthly TCO: ${formatCurrency(laptopResults.totalFleetMonthlyTco)}`;
    } else if (activeTab === 'printer') {
      summary = `[NKB ITMS - Printer Cost-Per-Page Summary]
Monthly Volume: ${printerResults.totalPages} pages (${printerParams.monthlyMonoPages} B&W, ${printerParams.monthlyColorPages} Color)
B&W Cost-Per-Page (CPP): ${formatCurrency(printerResults.totalMonoCpp)} (Toner: ${formatCurrency(printerResults.blackInkCpp)} + Paper: ${formatCurrency(printerResults.paperCpp)})
Color Cost-Per-Page (CPP): ${formatCurrency(printerResults.totalColorCpp)}
Monthly Operating Cost: ${formatCurrency(printerResults.monthlyTotalOpex)}
3-Year TCO: ${formatCurrency(printerResults.threeYearTco)} | 5-Year TCO: ${formatCurrency(printerResults.fiveYearTco)}`;
    }

    copyText(summary, 'summary');
  };

  const handlePrint = () => {
    window.print();
  };

  // =========================================================================
  // 1. CCTV HARDWARE SIZING STATE & LOGIC (PRESERVED)
  // =========================================================================
  const [cctvParams, setCctvParams] = useState({
    cameras: 16,
    resolution: '1080p',
    codec: 'h265',
    fps: 20,
    activity: 'medium',
    hoursPerDay: 24,
    retentionDays: 30,
    includeAudio: false,
    raidType: 'raid5',
    hddCostPerTb: 1850
  });

  const cctvPresets = [
    { name: 'Small Retail Store', cameras: 8, resolution: '1080p', codec: 'h265', fps: 15, activity: 'medium', hoursPerDay: 16, retentionDays: 30, raidType: 'none' },
    { name: 'Manufacturing Plant', cameras: 32, resolution: '4mp', codec: 'h265plus', fps: 20, activity: 'high', hoursPerDay: 24, retentionDays: 60, raidType: 'raid5' },
    { name: 'Corporate HQ / Perimeter', cameras: 64, resolution: '4k', codec: 'ai_smart', fps: 25, activity: 'medium', hoursPerDay: 24, retentionDays: 90, raidType: 'raid6' }
  ];

  const cctvResults = useMemo(() => {
    const baseBitrates = { '720p': 2.0, '1080p': 4.0, '3mp': 5.2, '4mp': 6.8, '5mp': 8.5, '4k': 14.5 };
    const codecMultipliers = { 'h264': 1.0, 'h264plus': 0.75, 'h265': 0.50, 'h265plus': 0.35, 'ai_smart': 0.25 };
    const activityMultipliers = { 'low': 0.65, 'medium': 1.0, 'high': 1.35 };

    const base = baseBitrates[cctvParams.resolution] || 4.0;
    const codecM = codecMultipliers[cctvParams.codec] || 0.5;
    const actM = activityMultipliers[cctvParams.activity] || 1.0;
    const fpsM = cctvParams.fps / 25;
    const audioStream = cctvParams.includeAudio ? 0.064 : 0;

    const bitratePerCam = Math.max(0.2, (base * codecM * fpsM * actM) + audioStream);
    const totalBandwidthMbps = bitratePerCam * cctvParams.cameras;

    const dailyStoragePerCamGb = (bitratePerCam * 3600 * cctvParams.hoursPerDay) / (8 * 1024);
    const totalDailyGb = dailyStoragePerCamGb * cctvParams.cameras;
    const totalStorageGb = totalDailyGb * cctvParams.retentionDays;
    const totalStorageTb = totalStorageGb / 1024;

    const raidMultipliers = { 'none': 1.0, 'raid1': 2.0, 'raid5': 1.25, 'raid6': 1.35 };
    const raidOverhead = raidMultipliers[cctvParams.raidType] || 1.0;
    const usableStorageTb = totalStorageTb;
    const grossStorageNeededTb = totalStorageTb * raidOverhead;

    let driveSize = 4;
    if (grossStorageNeededTb > 40) driveSize = 16;
    else if (grossStorageNeededTb > 20) driveSize = 10;
    else if (grossStorageNeededTb > 10) driveSize = 8;
    else driveSize = 4;

    const recommendedDrivesCount = Math.max(1, Math.ceil(grossStorageNeededTb / driveSize));
    const totalPurchasedTb = recommendedDrivesCount * driveSize;
    const estimatedHddCost = totalPurchasedTb * cctvParams.hddCostPerTb;

    let nvrChannels = 4;
    if (cctvParams.cameras > 64) nvrChannels = 128;
    else if (cctvParams.cameras > 32) nvrChannels = 64;
    else if (cctvParams.cameras > 16) nvrChannels = 32;
    else if (cctvParams.cameras > 8) nvrChannels = 16;
    else if (cctvParams.cameras > 4) nvrChannels = 8;

    const switchSpeed = totalBandwidthMbps > 800 ? '10 Gbps SFP+ Uplink Switch' : '1 Gbps Managed PoE Switch';

    return {
      bitratePerCam,
      totalBandwidthMbps,
      usableStorageTb,
      grossStorageNeededTb,
      recommendedDrivesCount,
      driveSize,
      totalPurchasedTb,
      estimatedHddCost,
      nvrChannels,
      switchSpeed
    };
  }, [cctvParams]);

  // =========================================================================
  // 2. PC SIZING & TCO STATE & LOGIC (PRESERVED)
  // =========================================================================
  const [pcParams, setPcParams] = useState({
    quantity: 25,
    unitDrawWatts: 140,
    monitors: 1,
    monitorWatts: 25,
    hoursPerDay: 9,
    daysPerMonth: 22,
    electricityRate: 11.5,
    unitPurchaseCost: 42000,
    depreciationYears: 4,
    upsMinutes: 15
  });

  const pcResults = useMemo(() => {
    const singlePcActiveWatts = pcParams.unitDrawWatts + (pcParams.monitors * pcParams.monitorWatts);
    const fleetActiveWatts = singlePcActiveWatts * pcParams.quantity;
    const fleetActiveKw = fleetActiveWatts / 1000;

    const fleetMonthlyKwh = (fleetActiveKw * pcParams.hoursPerDay * pcParams.daysPerMonth);
    const fleetMonthlyCost = fleetMonthlyKwh * pcParams.electricityRate;
    const fleetAnnualCost = fleetMonthlyCost * 12;

    const upsMinWatts = singlePcActiveWatts * 1.25;
    const upsMinVa = upsMinWatts / 0.6;
    let recommendedUpsRating = '650VA / 360W';
    if (upsMinVa > 1500) recommendedUpsRating = '2000VA / 1200W Online UPS';
    else if (upsMinVa > 1000) recommendedUpsRating = '1500VA / 900W Line-Interactive';
    else if (upsMinVa > 650) recommendedUpsRating = '1000VA / 600W Line-Interactive';

    const fleetTotalCapex = pcParams.unitPurchaseCost * pcParams.quantity;
    const fleetMonthlyDepreciation = fleetTotalCapex / (pcParams.depreciationYears * 12);
    const totalFleetMonthlyTco = fleetMonthlyCost + fleetMonthlyDepreciation;

    return {
      singlePcActiveWatts,
      fleetActiveKw,
      fleetMonthlyKwh,
      fleetMonthlyCost,
      fleetAnnualCost,
      upsMinWatts: Math.round(upsMinWatts),
      upsMinVa: Math.round(upsMinVa),
      recommendedUpsRating,
      fleetTotalCapex,
      fleetMonthlyDepreciation,
      totalFleetMonthlyTco
    };
  }, [pcParams]);

  // =========================================================================
  // 3. LAPTOP SIZING & BATTERY TCO STATE & LOGIC (PRESERVED)
  // =========================================================================
  const [laptopParams, setLaptopParams] = useState({
    quantity: 30,
    chargerWatts: 65,
    avgWatts: 28,
    hoursPerDay: 8,
    daysPerMonth: 22,
    electricityRate: 11.5,
    unitPurchaseCost: 55000,
    depreciationYears: 3,
    batteryCapWh: 54,
    chargeCyclesPerWeek: 4
  });

  const laptopResults = useMemo(() => {
    const fleetActiveWatts = laptopParams.avgWatts * laptopParams.quantity;
    const fleetActiveKw = fleetActiveWatts / 1000;

    const fleetMonthlyKwh = (fleetActiveKw * laptopParams.hoursPerDay * laptopParams.daysPerMonth);
    const fleetMonthlyCost = fleetMonthlyKwh * laptopParams.electricityRate;
    const fleetAnnualCost = fleetMonthlyCost * 12;

    const desktopComparableKwh = ((165 * laptopParams.quantity) / 1000) * laptopParams.hoursPerDay * laptopParams.daysPerMonth;
    const desktopMonthlyCost = desktopComparableKwh * laptopParams.electricityRate;
    const fleetAnnualSavings = (desktopMonthlyCost - fleetMonthlyCost) * 12;

    const cyclesPerYear = laptopParams.chargeCyclesPerWeek * 50;
    const typicalLifespanCycles = 500;
    const yearsTo80Percent = typicalLifespanCycles / Math.max(1, cyclesPerYear);
    const monthsTo80Percent = Math.round(yearsTo80Percent * 12);

    const fleetTotalCapex = laptopParams.unitPurchaseCost * laptopParams.quantity;
    const fleetMonthlyDepreciation = fleetTotalCapex / (laptopParams.depreciationYears * 12);
    const totalFleetMonthlyTco = fleetMonthlyCost + fleetMonthlyDepreciation;

    return {
      fleetActiveKw,
      fleetMonthlyKwh,
      fleetMonthlyCost,
      fleetAnnualCost,
      fleetAnnualSavings,
      cyclesPerYear,
      monthsTo80Percent,
      fleetTotalCapex,
      fleetMonthlyDepreciation,
      totalFleetMonthlyTco
    };
  }, [laptopParams]);

  // =========================================================================
  // 4. PRINTER COST-PER-PAGE (CPP) & TCO STATE & LOGIC (PRESERVED)
  // =========================================================================
  const [printerParams, setPrinterParams] = useState({
    printerName: 'Heavy MFP Copier',
    printerCapex: 75000,
    printerLifeYears: 5,
    monthlyMonoPages: 4500,
    monthlyColorPages: 1200,
    blackCartridgeCost: 3200,
    blackCartridgeYield: 6500,
    colorCartridgeCost: 4500,
    colorCartridgeYield: 4000,
    paperCostPerReam: 260,
    sheetsPerReam: 500,
    monthlyMaintKit: 450
  });

  const printerResults = useMemo(() => {
    const totalPages = printerParams.monthlyMonoPages + printerParams.monthlyColorPages;
    const blackInkCpp = printerParams.blackCartridgeCost / Math.max(1, printerParams.blackCartridgeYield);
    const colorInkCpp = (printerParams.colorCartridgeCost * 3) / Math.max(1, printerParams.colorCartridgeYield);
    const paperCpp = printerParams.paperCostPerReam / Math.max(1, printerParams.sheetsPerReam);

    const totalMonoCpp = blackInkCpp + paperCpp;
    const totalColorCpp = blackInkCpp + colorInkCpp + paperCpp;

    const monthlyPaperCost = totalPages * paperCpp;
    const monthlyBlackInkCost = totalPages * blackInkCpp;
    const monthlyColorInkCost = printerParams.monthlyColorPages * colorInkCpp;
    const monthlyConsumablesCost = monthlyPaperCost + monthlyBlackInkCost + monthlyColorInkCost;
    const monthlyTotalOpex = monthlyConsumablesCost + printerParams.monthlyMaintKit;

    const monthlyPrinterDepreciation = printerParams.printerCapex / (printerParams.printerLifeYears * 12);
    const monthlyTotalTco = monthlyTotalOpex + monthlyPrinterDepreciation;
    const threeYearTco = (monthlyTotalTco * 36);
    const fiveYearTco = (monthlyTotalTco * 60);

    return {
      totalPages,
      blackInkCpp,
      colorInkCpp,
      paperCpp,
      totalMonoCpp,
      totalColorCpp,
      monthlyPaperCost,
      monthlyBlackInkCost,
      monthlyColorInkCost,
      monthlyConsumablesCost,
      monthlyTotalOpex,
      monthlyPrinterDepreciation,
      monthlyTotalTco,
      threeYearTco,
      fiveYearTco
    };
  }, [printerParams]);

  return (
    <div className="space-y-6 pb-16 font-sans text-slate-800">
      
      {/* =====================================================================
          ENTERPRISE PAGE HEADER
          ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Static IP & Subnetting Calculator</h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Enterprise IPAM
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                IPv4 Network Planning & Address Allocation for Industrial Facilities & Corporate Infrastructure
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span className="text-slate-400">Current Plan:</span>
            <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {subnetParams.planName || `${subnetResults.network}/${subnetParams.cidr}`}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-slate-600">{subnetResults.network}/{subnetParams.cidr}</span>
            <span className="text-slate-300">•</span>
            <span className={`inline-flex items-center gap-1 font-semibold ${subnetResults.isOverCapacity ? 'text-rose-600' : 'text-emerald-600'}`}>
              <span className={`w-2 h-2 rounded-full ${subnetResults.isOverCapacity ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              {subnetResults.isOverCapacity ? 'Capacity Overrun' : 'Subnet Healthy'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition shadow-xs cursor-pointer"
            title="Copy structured IP subnet allocation plan to clipboard"
          >
            {copiedKey === 'summary' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedKey === 'summary' ? 'Copied Summary' : 'Copy Summary'}</span>
          </button>
          
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Print audit-compliant A4 IP schedule sheet"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          ENTERPRISE MODULE NAVIGATION TABS
          ===================================================================== */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 select-none">
        {[
          { id: 'subnet', label: 'Static IP & Subnetting', icon: Network },
          { id: 'cctv', label: 'CCTV Storage Sizing', icon: Video },
          { id: 'pc', label: 'Workstation Power & UPS', icon: Monitor },
          { id: 'laptop', label: 'Laptop Battery & TCO', icon: Laptop },
          { id: 'printer', label: 'Printer Cost-Per-Page', icon: Printer }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 py-2 px-3.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                isActive 
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          TAB 0: STATIC IP & SUBNETTING CALCULATOR (CORE FEATURE)
          ===================================================================== */}
      {activeTab === 'subnet' && (
        <div className="space-y-6">

          {/* TWO-COLUMN CONFIGURATION & DIAGNOSTICS LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT: NETWORK CONFIGURATION FORM */}
            <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Network Configuration & Device Requirements</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Define base network coordinates, gateway policy, and device counts</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubnetParams({
                    planName: 'Production Plant Primary Subnet',
                    baseIp: '192.168.1.0',
                    cidr: 24,
                    gatewayMode: 'first',
                    dns1: '1.1.1.1',
                    dns2: '8.8.8.8',
                    infraCount: 5,
                    printerCount: 8,
                    cctvCount: 16,
                    pcCount: 45,
                    laptopCount: 60,
                    bufferPercent: 15
                  })}
                  className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer font-medium"
                  title="Reset to factory baseline defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              {/* Quick Network Preset Templates */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Standard Enterprise Network Templates:</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '192.168.1.0/24 (Standard Office /24)', ip: '192.168.1.0', cidr: 24, name: 'Standard Office /24' },
                    { label: '192.168.10.0/24 (Plant Floor /24)', ip: '192.168.10.0', cidr: 24, name: 'Production Floor /24' },
                    { label: '10.0.0.0/23 (Medium Enterprise /23)', ip: '10.0.0.0', cidr: 23, name: 'Medium Enterprise /23' },
                    { label: '172.16.0.0/22 (Campus Campus /22)', ip: '172.16.0.0', cidr: 22, name: 'Large Campus /22' }
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSubnetParams(prev => ({ ...prev, baseIp: p.ip, cidr: p.cidr, planName: p.name }))}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
                        subnetParams.baseIp === p.ip && subnetParams.cidr === p.cidr
                          ? 'bg-blue-50 text-blue-700 border-blue-400 font-semibold'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Network Parameters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Plan Identifier */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Network Plan / Subnet Name:
                  </label>
                  <input
                    type="text"
                    value={subnetParams.planName}
                    onChange={e => setSubnetParams({ ...subnetParams, planName: e.target.value })}
                    placeholder="e.g. Building 2 Production Floor Subnet"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white"
                  />
                </div>

                {/* Base IPv4 Address */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Base IPv4 Network Address:
                    </label>
                    {!isBaseIpValid && (
                      <span className="text-[10px] text-rose-600 font-bold">Invalid IPv4 format</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={subnetParams.baseIp}
                    onChange={e => setSubnetParams({ ...subnetParams, baseIp: e.target.value.trim() })}
                    placeholder="e.g. 192.168.1.0"
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white ${
                      isBaseIpValid ? 'border-slate-300' : 'border-rose-400 bg-rose-50/30'
                    }`}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Accepts any host IP or network boundary (0.0.0.0 – 255.255.255.255)</p>
                </div>

                {/* CIDR Prefix */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CIDR Prefix / Subnet Mask:
                  </label>
                  <select
                    value={subnetParams.cidr}
                    onChange={e => setSubnetParams({ ...subnetParams, cidr: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                  >
                    <option value="16">/16 — 255.255.0.0 (65,534 Hosts)</option>
                    <option value="20">/20 — 255.255.240.0 (4,094 Hosts)</option>
                    <option value="21">/21 — 255.255.248.0 (2,046 Hosts)</option>
                    <option value="22">/22 — 255.255.252.0 (1,022 Hosts)</option>
                    <option value="23">/23 — 255.255.254.0 (510 Hosts)</option>
                    <option value="24">/24 — 255.255.255.0 (254 Hosts - Standard)</option>
                    <option value="25">/25 — 255.255.255.128 (126 Hosts)</option>
                    <option value="26">/26 — 255.255.255.192 (62 Hosts)</option>
                    <option value="27">/27 — 255.255.255.224 (30 Hosts)</option>
                    <option value="28">/28 — 255.255.255.240 (14 Hosts)</option>
                    <option value="29">/29 — 255.255.255.248 (6 Hosts)</option>
                    <option value="30">/30 — 255.255.255.252 (2 Point-to-Point)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Defines network boundary size and usable address ceiling</p>
                </div>

                {/* Gateway Placement */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Gateway IP Placement:
                  </label>
                  <select
                    value={subnetParams.gatewayMode}
                    onChange={e => setSubnetParams({ ...subnetParams, gatewayMode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                  >
                    <option value="first">First Usable Address (e.g. .1 - Recommended)</option>
                    <option value="last">Last Usable Address (e.g. .254)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Excluded automatically from device IP pool allocations</p>
                </div>

                {/* Spare Growth Headroom */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expansion Buffer Headroom: <span className="font-bold text-blue-600">+{subnetParams.bufferPercent}%</span>
                  </label>
                  <select
                    value={subnetParams.bufferPercent}
                    onChange={e => setSubnetParams({ ...subnetParams, bufferPercent: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                  >
                    <option value="0">0% (Exact allocation, no reserved spacing)</option>
                    <option value="15">+15% (Recommended enterprise standard)</option>
                    <option value="25">+25% (High growth infrastructure)</option>
                    <option value="50">+50% (Doubled provision headroom)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Appends contiguous spare IP slots per category</p>
                </div>

                {/* Primary & Secondary DNS */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary DNS Server:</label>
                  <input
                    type="text"
                    value={subnetParams.dns1}
                    onChange={e => setSubnetParams({ ...subnetParams, dns1: e.target.value.trim() })}
                    placeholder="1.1.1.1"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Secondary DNS Server:</label>
                  <input
                    type="text"
                    value={subnetParams.dns2}
                    onChange={e => setSubnetParams({ ...subnetParams, dns2: e.target.value.trim() })}
                    placeholder="8.8.8.8"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Device Sizing Controls */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                      Target Equipment Allocation Counts
                    </h3>
                    <p className="text-[11px] text-slate-400">Specify active physical hardware inventory to be addressed</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900">
                      {subnetResults.totalRequestedDevices} Devices Requested
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      ({subnetResults.totalAllocatedSize} IPs reserved with buffer)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {/* Infrastructure */}
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-800 text-xs font-semibold mb-1">
                      <Server className="w-3.5 h-3.5 text-slate-600" />
                      <span>Infrastructure</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={subnetParams.infraCount}
                      onChange={e => setSubnetParams({ ...subnetParams, infraCount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Switches, APs, Routers</span>
                  </div>

                  {/* Network Printers */}
                  <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-200">
                    <div className="flex items-center gap-1.5 text-purple-900 text-xs font-semibold mb-1">
                      <Printer className="w-3.5 h-3.5 text-purple-600" />
                      <span>Printers</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={subnetParams.printerCount}
                      onChange={e => setSubnetParams({ ...subnetParams, printerCount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-full px-2 py-1.5 rounded border border-purple-300 bg-white text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-[10px] text-purple-700 mt-1 block">MFP Copiers, Thermal</span>
                  </div>

                  {/* CCTV Surveillance */}
                  <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200">
                    <div className="flex items-center gap-1.5 text-amber-900 text-xs font-semibold mb-1">
                      <Video className="w-3.5 h-3.5 text-amber-600" />
                      <span>CCTV / NVR</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={subnetParams.cctvCount}
                      onChange={e => setSubnetParams({ ...subnetParams, cctvCount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-full px-2 py-1.5 rounded border border-amber-300 bg-white text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-amber-700 mt-1 block">IP Cameras, NVR Nodes</span>
                  </div>

                  {/* Desktop PCs */}
                  <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200">
                    <div className="flex items-center gap-1.5 text-blue-900 text-xs font-semibold mb-1">
                      <Monitor className="w-3.5 h-3.5 text-blue-600" />
                      <span>Workstations</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={subnetParams.pcCount}
                      onChange={e => setSubnetParams({ ...subnetParams, pcCount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-full px-2 py-1.5 rounded border border-blue-300 bg-white text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-blue-700 mt-1 block">Office PCs, QC Stations</span>
                  </div>

                  {/* Laptops DHCP */}
                  <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                    <div className="flex items-center gap-1.5 text-emerald-900 text-xs font-semibold mb-1">
                      <Laptop className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Laptops (DHCP)</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={subnetParams.laptopCount}
                      onChange={e => setSubnetParams({ ...subnetParams, laptopCount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-full px-2 py-1.5 rounded border border-emerald-300 bg-white text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-emerald-700 mt-1 block">Mobile & Wi-Fi Scope</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: NETWORK DIAGNOSTICS & SUBNET CAPACITY */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-md space-y-5">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Subnet Diagnostics</span>
                    <h3 className="text-sm font-bold text-white">IPv4 Routing & Capacity Telemetry</h3>
                  </div>
                  <span className="bg-blue-900/60 text-blue-300 border border-blue-700/60 text-xs px-2.5 py-0.5 rounded font-mono font-bold">
                    /{subnetParams.cidr}
                  </span>
                </div>

                {/* Subnet Big Metrics Grid */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700/80">
                    <span className="text-[11px] text-slate-400 block font-medium">Usable Host Capacity</span>
                    <div className="text-2xl font-extrabold text-white mt-0.5 font-mono">
                      {subnetResults.usableHosts.toLocaleString()} <span className="text-xs font-bold text-blue-400 font-sans">IPs</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Total {subnetResults.totalHosts.toLocaleString()} incl. Net & Bcast</span>
                  </div>

                  <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700/80">
                    <span className="text-[11px] text-slate-400 block font-medium">Subnet Utilization</span>
                    <div className={`text-2xl font-extrabold mt-0.5 font-mono ${subnetResults.isOverCapacity ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {subnetResults.utilizationPercent}%
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {subnetResults.totalAllocatedSize} allocated / {subnetResults.remainingCapacity} free
                    </span>
                  </div>
                </div>

                {/* Capacity Progress Bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Address Space Consumption</span>
                    <span className="font-mono font-medium">{subnetResults.totalAllocatedSize} / {subnetResults.usableHosts} IPs</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        subnetResults.isOverCapacity ? 'bg-rose-500' : subnetResults.utilizationPercent > 85 ? 'bg-amber-400' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(100, subnetResults.utilizationPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Capacity Overflow Warning */}
                {subnetResults.isOverCapacity && (
                  <div className="bg-rose-950/70 border border-rose-600/70 p-3.5 rounded-lg flex items-start gap-2.5 text-xs text-rose-200">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Capacity Overrun Alert</strong>
                      Total requested allocations ({subnetResults.totalAllocatedSize} IPs) exceed the usable capacity ({subnetResults.usableHosts} IPs) of /{subnetParams.cidr}. Expand to /{subnetParams.cidr - 1} or reduce expansion buffer.
                    </div>
                  </div>
                )}

                {/* Technical Specifications Matrix */}
                <div className="space-y-2 text-xs border-t border-slate-800 pt-3 font-mono">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Network ID:</span>
                    <span className="font-semibold text-white">{subnetResults.network}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Subnet Mask:</span>
                    <span className="font-semibold text-blue-300">{subnetResults.mask}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Wildcard Mask:</span>
                    <span className="text-slate-400">{subnetResults.wildcard}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Default Gateway:</span>
                    <span className="font-semibold text-emerald-400">{subnetResults.gatewayIp}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Usable Host Range:</span>
                    <span className="font-semibold text-white">{subnetResults.firstUsable} – {subnetResults.lastUsable}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Broadcast Address:</span>
                    <span className="text-slate-300">{subnetResults.broadcast}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">IPv4 Class Standard:</span>
                    <span className="text-slate-300 font-sans text-[11px]">{subnetResults.ipClass}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              ADDRESS SPACE VISUALIZATION (SPECTRUM BAR & COMPREHENSIVE LEGEND)
              ===================================================================== */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Subnet Partitioning & Address Space Spectrum</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Proportional representation of allocated address blocks across the usable IPv4 host pool
                </p>
              </div>

              <div className="text-xs font-semibold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                Usable Pool: <span className="font-mono font-bold text-blue-700">{subnetResults.firstUsable}</span> to <span className="font-mono font-bold text-blue-700">{subnetResults.lastUsable}</span>
              </div>
            </div>

            {/* Horizontal Segmented Allocation Bar */}
            <div className="h-7 w-full rounded-lg overflow-hidden flex bg-slate-100 p-0.5 gap-0.5 border border-slate-200 shadow-inner">
              {/* Gateway (1 IP) */}
              <div
                style={{ width: `${Math.max(1.5, (1 / Math.max(1, subnetResults.usableHosts)) * 100)}%` }}
                className="bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center truncate px-1"
                title={`Default Gateway: ${subnetResults.gatewayIp} (1 IP)`}
              >
                GW
              </div>

              {/* Infrastructure */}
              {subnetResults.ranges.infra.count > 0 && (
                <div 
                  style={{ width: `${Math.max(2, (subnetResults.ranges.infra.count / Math.max(1, subnetResults.usableHosts)) * 100)}%` }}
                  className="bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center truncate px-1"
                  title={`Infrastructure: ${subnetResults.ranges.infra.start} - ${subnetResults.ranges.infra.end} (${subnetResults.ranges.infra.count} IPs)`}
                >
                  Infra
                </div>
              )}

              {/* Network Printers */}
              {subnetResults.ranges.printer.count > 0 && (
                <div 
                  style={{ width: `${Math.max(2, (subnetResults.ranges.printer.count / Math.max(1, subnetResults.usableHosts)) * 100)}%` }}
                  className="bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center truncate px-1"
                  title={`Printers: ${subnetResults.ranges.printer.start} - ${subnetResults.ranges.printer.end} (${subnetResults.ranges.printer.count} IPs)`}
                >
                  Printers
                </div>
              )}

              {/* CCTV */}
              {subnetResults.ranges.cctv.count > 0 && (
                <div 
                  style={{ width: `${Math.max(2, (subnetResults.ranges.cctv.count / Math.max(1, subnetResults.usableHosts)) * 100)}%` }}
                  className="bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center truncate px-1"
                  title={`CCTV: ${subnetResults.ranges.cctv.start} - ${subnetResults.ranges.cctv.end} (${subnetResults.ranges.cctv.count} IPs)`}
                >
                  CCTV
                </div>
              )}

              {/* Desktop PCs */}
              {subnetResults.ranges.pc.count > 0 && (
                <div 
                  style={{ width: `${Math.max(2, (subnetResults.ranges.pc.count / Math.max(1, subnetResults.usableHosts)) * 100)}%` }}
                  className="bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center truncate px-1"
                  title={`Workstations: ${subnetResults.ranges.pc.start} - ${subnetResults.ranges.pc.end} (${subnetResults.ranges.pc.count} IPs)`}
                >
                  PCs
                </div>
              )}

              {/* Laptops DHCP */}
              {subnetResults.ranges.laptop.count > 0 && (
                <div 
                  style={{ width: `${Math.max(2, (subnetResults.ranges.laptop.count / Math.max(1, subnetResults.usableHosts)) * 100)}%` }}
                  className="bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center truncate px-1"
                  title={`Laptops & Mobile DHCP: ${subnetResults.ranges.laptop.start} - ${subnetResults.ranges.laptop.end} (${subnetResults.ranges.laptop.count} IPs)`}
                >
                  DHCP Scope
                </div>
              )}

              {/* Free Unallocated */}
              {subnetResults.ranges.free.count > 0 && (
                <div 
                  style={{ width: `${Math.max(2, (subnetResults.ranges.free.count / Math.max(1, subnetResults.usableHosts)) * 100)}%` }}
                  className="bg-slate-200 text-slate-600 text-[10px] font-semibold flex items-center justify-center truncate px-1"
                  title={`Free Pool: ${subnetResults.ranges.free.start} - ${subnetResults.ranges.free.end} (${subnetResults.ranges.free.count} IPs free)`}
                >
                  Free ({subnetResults.ranges.free.count})
                </div>
              )}
            </div>

            {/* Responsive Legend Bar */}
            <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 pt-1 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-600 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-900" />
                  <span className="font-semibold text-slate-800">Gateway:</span>
                  <span className="font-mono text-slate-500">{subnetResults.gatewayIp}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-700" />
                  <span className="font-semibold text-slate-800">Infra:</span>
                  <span className="font-mono text-slate-500">{subnetResults.ranges.infra.count} IPs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-purple-600" />
                  <span className="font-semibold text-slate-800">Printers:</span>
                  <span className="font-mono text-slate-500">{subnetResults.ranges.printer.count} IPs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                  <span className="font-semibold text-slate-800">CCTV:</span>
                  <span className="font-mono text-slate-500">{subnetResults.ranges.cctv.count} IPs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                  <span className="font-semibold text-slate-800">PCs:</span>
                  <span className="font-mono text-slate-500">{subnetResults.ranges.pc.count} IPs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                  <span className="font-semibold text-slate-800">DHCP Scope:</span>
                  <span className="font-mono text-slate-500">{subnetResults.ranges.laptop.count} IPs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-300" />
                  <span className="font-semibold text-slate-800">Free Pool:</span>
                  <span className="font-mono text-slate-500">{subnetResults.ranges.free.count} IPs</span>
                </div>
              </div>

              <div className="text-[11px] font-semibold text-slate-500">
                Total Capacity: <span className="font-mono font-bold text-slate-900">{subnetResults.usableHosts} Hosts</span>
              </div>
            </div>
          </div>

          {/* =====================================================================
              ALLOCATION SUMMARY CARDS (6 DEDICATED CARDS)
              ===================================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            
            {/* Card 1: Core Gateway & Infrastructure */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Server className="w-3.5 h-3.5 text-slate-700" />
                  <span>Infrastructure</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {subnetResults.ranges.infra.count > 0 ? 'Allocated' : 'Unallocated'}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-900">
                {subnetResults.ranges.infra.start} – {subnetResults.ranges.infra.end}
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Active Units:</span>
                  <span className="font-semibold text-slate-900">{subnetParams.infraCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Reserved:</span>
                  <span className="font-semibold text-slate-900">{subnetResults.ranges.infra.count} IPs</span>
                </div>
                <div className="flex justify-between">
                  <span>Headroom Buffer:</span>
                  <span className="font-semibold text-slate-700">+{subnetParams.bufferPercent}%</span>
                </div>
              </div>
            </div>

            {/* Card 2: Network Printers & MFPs */}
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-950">
                  <Printer className="w-3.5 h-3.5 text-purple-700" />
                  <span>Network Printers</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                  {subnetResults.ranges.printer.count > 0 ? 'Allocated' : 'Unallocated'}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-purple-950">
                {subnetResults.ranges.printer.start} – {subnetResults.ranges.printer.end}
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Active Units:</span>
                  <span className="font-semibold text-slate-900">{subnetParams.printerCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Reserved:</span>
                  <span className="font-semibold text-slate-900">{subnetResults.ranges.printer.count} IPs</span>
                </div>
                <div className="flex justify-between">
                  <span>Headroom Buffer:</span>
                  <span className="font-semibold text-slate-700">+{subnetParams.bufferPercent}%</span>
                </div>
              </div>
            </div>

            {/* Card 3: CCTV & Surveillance */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <Video className="w-3.5 h-3.5 text-amber-700" />
                  <span>CCTV & Security</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  {subnetResults.ranges.cctv.count > 0 ? 'Allocated' : 'Unallocated'}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-amber-950">
                {subnetResults.ranges.cctv.start} – {subnetResults.ranges.cctv.end}
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Active Units:</span>
                  <span className="font-semibold text-slate-900">{subnetParams.cctvCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Reserved:</span>
                  <span className="font-semibold text-slate-900">{subnetResults.ranges.cctv.count} IPs</span>
                </div>
                <div className="flex justify-between">
                  <span>Headroom Buffer:</span>
                  <span className="font-semibold text-slate-700">+{subnetParams.bufferPercent}%</span>
                </div>
              </div>
            </div>

            {/* Card 4: Desktop Workstations */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                  <Monitor className="w-3.5 h-3.5 text-blue-700" />
                  <span>Desktop PCs</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  {subnetResults.ranges.pc.count > 0 ? 'Allocated' : 'Unallocated'}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-blue-950">
                {subnetResults.ranges.pc.start} – {subnetResults.ranges.pc.end}
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Active Units:</span>
                  <span className="font-semibold text-slate-900">{subnetParams.pcCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Reserved:</span>
                  <span className="font-semibold text-slate-900">{subnetResults.ranges.pc.count} IPs</span>
                </div>
                <div className="flex justify-between">
                  <span>Headroom Buffer:</span>
                  <span className="font-semibold text-slate-700">+{subnetParams.bufferPercent}%</span>
                </div>
              </div>
            </div>

            {/* Card 5: Laptops & Mobile (DHCP Scope) */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                  <Laptop className="w-3.5 h-3.5 text-emerald-700" />
                  <span>DHCP Scope</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {subnetResults.ranges.laptop.count > 0 ? 'Allocated' : 'Unallocated'}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-emerald-950">
                {subnetResults.ranges.laptop.start} – {subnetResults.ranges.laptop.end}
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Active Units:</span>
                  <span className="font-semibold text-slate-900">{subnetParams.laptopCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Reserved:</span>
                  <span className="font-semibold text-slate-900">{subnetResults.ranges.laptop.count} IPs</span>
                </div>
                <div className="flex justify-between">
                  <span>Headroom Buffer:</span>
                  <span className="font-semibold text-slate-700">+{subnetParams.bufferPercent}%</span>
                </div>
              </div>
            </div>

            {/* Card 6: Free / Spare Subnet Pool */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 shadow-xs space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Shield className="w-3.5 h-3.5 text-slate-600" />
                  <span>Unallocated Free</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                  subnetResults.ranges.free.count > 0 
                    ? 'bg-slate-100 text-slate-700 border-slate-300' 
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {subnetResults.ranges.free.count > 0 ? 'Available' : 'Exhausted'}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-900">
                {subnetResults.ranges.free.start} – {subnetResults.ranges.free.end}
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Available Spare:</span>
                  <span className="font-semibold text-slate-900 font-mono">{subnetResults.ranges.free.count} IPs</span>
                </div>
                <div className="flex justify-between">
                  <span>Subnet Overhead:</span>
                  <span className="font-semibold text-slate-700 font-mono">2 IPs (Net/Bcast)</span>
                </div>
                <div className="flex justify-between">
                  <span>Unused Ratio:</span>
                  <span className="font-semibold text-slate-700 font-mono">
                    {Math.round((subnetResults.ranges.free.count / Math.max(1, subnetResults.usableHosts)) * 100)}%
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* =====================================================================
              IP ASSIGNMENT MASTER TABLE
              ===================================================================== */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ListFilter className="w-4 h-4 text-blue-600" />
                  <span>IP Address Assignment Master Directory</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Static IP mapping schedule for endpoints, servers, printers, and surveillance equipment
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  title="Export complete IP plan as a CSV spreadsheet"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              
              {/* Category Filter Tabs */}
              <div className="md:col-span-6 flex flex-wrap gap-1">
                {[
                  { id: 'all', label: 'All Categories' },
                  { id: 'infra', label: 'Infrastructure' },
                  { id: 'printer', label: 'Printers' },
                  { id: 'cctv', label: 'CCTV' },
                  { id: 'pc', label: 'Workstations' },
                  { id: 'laptop', label: 'Laptops' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setIpTableCategoryFilter(cat.id); setIpTablePage(1); }}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                      ipTableCategoryFilter === cat.id
                        ? 'bg-slate-900 text-white font-semibold shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Assignment Type Filter */}
              <div className="md:col-span-2">
                <select
                  value={ipTableTypeFilter}
                  onChange={e => { setIpTableTypeFilter(e.target.value); setIpTablePage(1); }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white"
                >
                  <option value="all">All Assignment Types</option>
                  <option value="static">Static IP Only</option>
                  <option value="dhcp">DHCP Scope Only</option>
                  <option value="core">Core Gateway Only</option>
                </select>
              </div>

              {/* Search Box */}
              <div className="md:col-span-4 relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search IP, Hostname, Role..."
                  value={ipTableSearch}
                  onChange={e => { setIpTableSearch(e.target.value); setIpTablePage(1); }}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Master Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                    <th 
                      onClick={() => handleSort('ip')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>IP Address</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('hostname')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Hostname</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('category')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Category</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3">Assignment Type</th>
                    <th className="py-2.5 px-3">Subnet Mask</th>
                    <th className="py-2.5 px-3">Gateway</th>
                    <th className="py-2.5 px-3">Description / Role</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-400 font-sans text-xs">
                        No IP assignments matching active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map(row => {
                      const isSelectedInGenerator = selectedGeneratorDevice === row.id;
                      return (
                        <tr 
                          key={row.id} 
                          className={`transition ${isSelectedInGenerator ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                        >
                          {/* IP Address */}
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                            <span className="font-mono">{row.ip}</span>
                          </td>

                          {/* Hostname */}
                          <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                            {row.hostname}
                          </td>

                          {/* Category Badge */}
                          <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.category === 'cctv' ? 'bg-amber-100/70 text-amber-900 border border-amber-200' :
                              row.category === 'pc' ? 'bg-blue-100/70 text-blue-900 border border-blue-200' :
                              row.category === 'printer' ? 'bg-purple-100/70 text-purple-900 border border-purple-200' :
                              row.category === 'laptop' ? 'bg-emerald-100/70 text-emerald-900 border border-emerald-200' :
                              'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}>
                              {row.category === 'cctv' && <Video className="w-2.5 h-2.5" />}
                              {row.category === 'pc' && <Monitor className="w-2.5 h-2.5" />}
                              {row.category === 'printer' && <Printer className="w-2.5 h-2.5" />}
                              {row.category === 'laptop' && <Laptop className="w-2.5 h-2.5" />}
                              {row.category === 'infra' && <Server className="w-2.5 h-2.5" />}
                              <span>{row.categoryLabel}</span>
                            </span>
                          </td>

                          {/* Assignment Type */}
                          <td className="py-2.5 px-3 text-slate-600 font-sans whitespace-nowrap">
                            <span className={`text-[11px] font-medium ${
                              row.assignmentType.includes('Core') ? 'font-bold text-slate-900' :
                              row.assignmentType.includes('DHCP') ? 'text-emerald-700' : 'text-slate-700'
                            }`}>
                              {row.assignmentType}
                            </span>
                          </td>

                          {/* Mask */}
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                            {row.mask}
                          </td>

                          {/* Gateway */}
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                            {row.gateway}
                          </td>

                          {/* Description / Role */}
                          <td className="py-2.5 px-3 text-slate-600 font-sans truncate max-w-xs text-[11px]">
                            {row.role}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-sans">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => copyText(row.ip, row.id)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-medium transition cursor-pointer border border-slate-200"
                                title="Copy IP address to clipboard"
                              >
                                {copiedKey === row.id ? 'Copied' : 'Copy'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedGeneratorDevice(row.id);
                                  const el = document.getElementById('config-generator-section');
                                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-medium transition cursor-pointer border border-blue-200"
                                title="Generate netsh, PowerShell, or Netplan scripts for this host"
                              >
                                Script
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Showing {totalTableRows > 0 ? ((currentPage - 1) * ipTablePageSize) + 1 : 0} to {Math.min(currentPage * ipTablePageSize, totalTableRows)} of {totalTableRows} records</span>
                <span className="text-slate-300">•</span>
                <select
                  value={ipTablePageSize}
                  onChange={e => { setIpTablePageSize(Number(e.target.value)); setIpTablePage(1); }}
                  className="px-2 py-1 rounded border border-slate-300 text-xs text-slate-700 bg-white"
                >
                  <option value="15">15 per page</option>
                  <option value="25">25 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
              </div>

              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setIpTablePage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2 font-medium text-slate-700">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setIpTablePage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* =====================================================================
              CONFIGURATION GENERATOR (WINDOWS CMD, POWERSHELL, LINUX NETPLAN)
              ===================================================================== */}
          <div id="config-generator-section" className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-600" />
                  <span>Host Network Configuration Script Generator</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated provisioning commands for selected network host ({activeDeviceRow.hostname} • {activeDeviceRow.ip})
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Target Adapter:</span>
                <input
                  type="text"
                  value={generatorInterface}
                  onChange={e => setGeneratorInterface(e.target.value)}
                  placeholder="Ethernet"
                  className="px-2.5 py-1 rounded border border-slate-300 text-xs font-mono font-medium text-slate-800 w-28 bg-white"
                />
              </div>
            </div>

            {/* Target Device Selector Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Target Endpoint Host:</label>
                <select
                  value={selectedGeneratorDevice}
                  onChange={e => setSelectedGeneratorDevice(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-900 bg-white font-mono"
                >
                  <optgroup label="Network Infrastructure">
                    {subnetResults.generatedIps.filter(x => x.category === 'infra').map(x => (
                      <option key={x.id} value={x.id}>{x.hostname} — {x.ip} ({x.role})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Desktop Workstations">
                    {subnetResults.generatedIps.filter(x => x.category === 'pc').map(x => (
                      <option key={x.id} value={x.id}>{x.hostname} — {x.ip}</option>
                    ))}
                  </optgroup>
                  <optgroup label="CCTV Surveillance">
                    {subnetResults.generatedIps.filter(x => x.category === 'cctv').map(x => (
                      <option key={x.id} value={x.id}>{x.hostname} — {x.ip}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Network Printers">
                    {subnetResults.generatedIps.filter(x => x.category === 'printer').map(x => (
                      <option key={x.id} value={x.id}>{x.hostname} — {x.ip}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Laptops">
                    {subnetResults.generatedIps.filter(x => x.category === 'laptop').map(x => (
                      <option key={x.id} value={x.id}>{x.hostname} — {x.ip}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Assigned Address:</label>
                <div className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white font-mono font-bold text-blue-700">
                  {activeDeviceRow.ip} /{subnetParams.cidr}
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Default Gateway & Mask:</label>
                <div className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white font-mono font-medium text-slate-700">
                  {subnetResults.gatewayIp} &bull; {subnetResults.mask}
                </div>
              </div>
            </div>

            {/* Script Format Tabs */}
            <div className="flex border-b border-slate-200 gap-1 text-xs select-none">
              <button
                type="button"
                onClick={() => setGeneratorScriptTab('cmd')}
                className={`px-3 py-2 font-semibold border-b-2 cursor-pointer transition ${
                  generatorScriptTab === 'cmd' 
                    ? 'border-blue-600 text-blue-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Windows CMD (netsh)
              </button>
              <button
                type="button"
                onClick={() => setGeneratorScriptTab('ps')}
                className={`px-3 py-2 font-semibold border-b-2 cursor-pointer transition ${
                  generatorScriptTab === 'ps' 
                    ? 'border-blue-600 text-blue-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Windows PowerShell
              </button>
              <button
                type="button"
                onClick={() => setGeneratorScriptTab('netplan')}
                className={`px-3 py-2 font-semibold border-b-2 cursor-pointer transition ${
                  generatorScriptTab === 'netplan' 
                    ? 'border-blue-600 text-blue-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Linux Netplan (YAML)
              </button>
              <button
                type="button"
                onClick={() => setGeneratorScriptTab('params')}
                className={`px-3 py-2 font-semibold border-b-2 cursor-pointer transition ${
                  generatorScriptTab === 'params' 
                    ? 'border-blue-600 text-blue-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Device Web GUI Parameters
              </button>
            </div>

            {/* Script Display Panels */}
            {generatorScriptTab === 'cmd' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Execute in Elevated Command Prompt (Run as Administrator):</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cmd = `:: Configure Static IPv4 and DNS for ${activeDeviceRow.hostname}\nnetsh interface ip set address name="${generatorInterface}" static ${activeDeviceRow.ip} ${subnetResults.mask} ${subnetResults.gatewayIp} 1\nnetsh interface ip set dns name="${generatorInterface}" static ${subnetParams.dns1 || '1.1.1.1'}\nnetsh interface ip add dns name="${generatorInterface}" ${subnetParams.dns2 || '8.8.8.8'} index=2`;
                      copyText(cmd, 'cmd');
                    }}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    {copiedKey === 'cmd' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd' ? 'Copied Command!' : 'Copy Script'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">
{`:: NKB ITMS Automated Network Adapter Configuration
:: Target Host: ${activeDeviceRow.hostname} (${activeDeviceRow.categoryLabel})
netsh interface ip set address name="${generatorInterface}" static ${activeDeviceRow.ip} ${subnetResults.mask} ${subnetResults.gatewayIp} 1
netsh interface ip set dns name="${generatorInterface}" static ${subnetParams.dns1 || '1.1.1.1'}
netsh interface ip add dns name="${generatorInterface}" ${subnetParams.dns2 || '8.8.8.8'} index=2`}
                </pre>
              </div>
            )}

            {generatorScriptTab === 'ps' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Execute in Elevated Windows PowerShell (Administrator):</span>
                  <button
                    type="button"
                    onClick={() => {
                      const ps = `# Configure Static IPv4 and DNS for ${activeDeviceRow.hostname}\nNew-NetIPAddress -InterfaceAlias "${generatorInterface}" -IPAddress "${activeDeviceRow.ip}" -PrefixLength ${subnetParams.cidr} -DefaultGateway "${subnetResults.gatewayIp}"\nSet-DnsClientServerAddress -InterfaceAlias "${generatorInterface}" -ServerAddresses ("${subnetParams.dns1 || '1.1.1.1'}","${subnetParams.dns2 || '8.8.8.8'}")`;
                      copyText(ps, 'ps');
                    }}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    {copiedKey === 'ps' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'ps' ? 'Copied Command!' : 'Copy Script'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">
{`# NKB ITMS PowerShell IPv4 Deployment
# Target Host: ${activeDeviceRow.hostname} (${activeDeviceRow.categoryLabel})
New-NetIPAddress -InterfaceAlias "${generatorInterface}" -IPAddress "${activeDeviceRow.ip}" -PrefixLength ${subnetParams.cidr} -DefaultGateway "${subnetResults.gatewayIp}"
Set-DnsClientServerAddress -InterfaceAlias "${generatorInterface}" -ServerAddresses ("${subnetParams.dns1 || '1.1.1.1'}","${subnetParams.dns2 || '8.8.8.8'}")`}
                </pre>
              </div>
            )}

            {generatorScriptTab === 'netplan' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Linux Netplan Configuration (/etc/netplan/01-netcfg.yaml):</span>
                  <button
                    type="button"
                    onClick={() => {
                      const netplan = `# /etc/netplan/01-netcfg.yaml\nnetwork:\n  version: 2\n  renderer: networkd\n  ethernets:\n    ${generatorInterface.toLowerCase()}:\n      dhcp4: no\n      addresses:\n        - ${activeDeviceRow.ip}/${subnetParams.cidr}\n      routes:\n        - to: default\n          via: ${subnetResults.gatewayIp}\n      nameservers:\n        addresses: [${subnetParams.dns1 || '1.1.1.1'}, ${subnetParams.dns2 || '8.8.8.8'}]`;
                      copyText(netplan, 'netplan');
                    }}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    {copiedKey === 'netplan' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'netplan' ? 'Copied YAML!' : 'Copy Netplan'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">
{`# /etc/netplan/01-netcfg.yaml
# Target Host: ${activeDeviceRow.hostname}
network:
  version: 2
  renderer: networkd
  ethernets:
    ${generatorInterface.toLowerCase()}:
      dhcp4: no
      addresses:
        - ${activeDeviceRow.ip}/${subnetParams.cidr}
      routes:
        - to: default
          via: ${subnetResults.gatewayIp}
      nameservers:
        addresses: [${subnetParams.dns1 || '1.1.1.1'}, ${subnetParams.dns2 || '8.8.8.8'}]`}
                </pre>
              </div>
            )}

            {generatorScriptTab === 'params' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">IP Address</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{activeDeviceRow.ip}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Subnet Mask</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{subnetResults.mask}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Default Gateway</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{subnetResults.gatewayIp}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Primary DNS</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{subnetParams.dns1}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Secondary DNS</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{subnetParams.dns2}</span>
                </div>
              </div>
            )}

            {/* Safety Warning Banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Operational Network Safety Warning:</span> Applying static IP configurations directly will temporarily terminate active TCP/IP sessions on the target adapter until network routing reconverges. Always verify IP address availability before applying.
              </div>
            </div>
          </div>

        </div>
      )}

      {/* =====================================================================
          TAB 1: CCTV HARDWARE SIZING (PRESERVED)
          ===================================================================== */}
      {activeTab === 'cctv' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h2 className="font-bold text-slate-900 text-sm">CCTV Sizing & Storage Requirements</h2>
                <p className="text-xs text-slate-500 mt-0.5">Bitrate modeling, bandwidth sizing, and retention HDD calculator</p>
              </div>
              <button
                type="button"
                onClick={() => setCctvParams({
                  cameras: 16, resolution: '1080p', codec: 'h265', fps: 20, activity: 'medium',
                  hoursPerDay: 24, retentionDays: 30, includeAudio: false, raidType: 'raid5', hddCostPerTb: 1850
                })}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Deployment Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Preset Deployment Profiles:</label>
              <div className="flex flex-wrap gap-2">
                {cctvPresets.map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setCctvParams(prev => ({ ...prev, ...preset }))}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Camera Channels: <span className="font-bold text-blue-600">{cctvParams.cameras} Cameras</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="128"
                  value={cctvParams.cameras}
                  onChange={e => setCctvParams({ ...cctvParams, cameras: parseInt(e.target.value, 10) || 1 })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Camera Resolution:</label>
                <select
                  value={cctvParams.resolution}
                  onChange={e => setCctvParams({ ...cctvParams, resolution: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 bg-white"
                >
                  <option value="720p">720p HD (1.0 MP)</option>
                  <option value="1080p">1080p Full HD (2.0 MP - Standard)</option>
                  <option value="3mp">3.0 Megapixels</option>
                  <option value="4mp">4.0 Megapixels (2K Quad HD)</option>
                  <option value="5mp">5.0 Megapixels</option>
                  <option value="4k">4K Ultra HD (8.0 MP)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Compression Codec:</label>
                <select
                  value={cctvParams.codec}
                  onChange={e => setCctvParams({ ...cctvParams, codec: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 bg-white"
                >
                  <option value="h264">H.264 (Legacy Standard)</option>
                  <option value="h264plus">H.264+ Smart Stream</option>
                  <option value="h265">H.265 / HEVC (Standard)</option>
                  <option value="h265plus">H.265+ Ultra Compression</option>
                  <option value="ai_smart">AI Smart Motion Codec</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Frame Rate: {cctvParams.fps} FPS</label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={cctvParams.fps}
                  onChange={e => setCctvParams({ ...cctvParams, fps: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Retention Duration: {cctvParams.retentionDays} Days</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={cctvParams.retentionDays}
                  onChange={e => setCctvParams({ ...cctvParams, retentionDays: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Redundancy (RAID):</label>
                <select
                  value={cctvParams.raidType}
                  onChange={e => setCctvParams({ ...cctvParams, raidType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 bg-white"
                >
                  <option value="none">JBOD / No RAID (100% Usable, No Parity)</option>
                  <option value="raid1">RAID 1 Mirroring (100% Overhead)</option>
                  <option value="raid5">RAID 5 Parity (25% Parity Overhead)</option>
                  <option value="raid6">RAID 6 Dual Parity (35% Parity Overhead)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right CCTV Diagnostics */}
          <div className="lg:col-span-5 bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-md space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">CCTV Telemetry</span>
              <h3 className="text-sm font-bold text-white">Recommended Storage & Hardware Bill of Materials</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700/80">
                <span className="text-[11px] text-slate-400 block font-medium">Usable Storage</span>
                <div className="text-2xl font-extrabold text-white mt-0.5 font-mono">
                  {formatNumber(cctvResults.usableStorageTb, 2)} <span className="text-xs font-bold text-blue-400 font-sans">TB</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Gross: {formatNumber(cctvResults.grossStorageNeededTb, 2)} TB</span>
              </div>

              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700/80">
                <span className="text-[11px] text-slate-400 block font-medium">Network Ingress</span>
                <div className="text-2xl font-extrabold text-white mt-0.5 font-mono">
                  {formatNumber(cctvResults.totalBandwidthMbps, 1)} <span className="text-xs font-bold text-blue-400 font-sans">Mbps</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">{cctvResults.switchSpeed}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-slate-800 pt-3 font-mono">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400 font-sans">Recommended NVR:</span>
                <span className="font-semibold text-white font-sans">{cctvResults.nvrChannels}-Channel NVR</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400 font-sans">Drive Configuration:</span>
                <span className="font-semibold text-blue-300 font-sans">{cctvResults.recommendedDrivesCount}x {cctvResults.driveSize}TB Surveillance HDDs</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400 font-sans">Estimated HDD Cost:</span>
                <span className="font-semibold text-emerald-400">{formatCurrency(cctvResults.estimatedHddCost)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: WORKSTATION PC POWER & UPS SIZING (PRESERVED)
          ===================================================================== */}
      {activeTab === 'pc' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="font-bold text-slate-900 text-sm">Desktop Workstation Fleet Power & UPS Sizing</h2>
              <p className="text-xs text-slate-500 mt-0.5">Fleet kilowatt load, electricity bill forecasting, and UPS battery backup requirements</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Workstation Quantity: {pcParams.quantity} PCs</label>
                <input
                  type="number"
                  min="1"
                  value={pcParams.quantity}
                  onChange={e => setPcParams({ ...pcParams, quantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Power Draw: {pcParams.unitDrawWatts} Watts</label>
                <input
                  type="number"
                  min="50"
                  max="600"
                  value={pcParams.unitDrawWatts}
                  onChange={e => setPcParams({ ...pcParams, unitDrawWatts: parseInt(e.target.value, 10) || 120 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Electricity Rate (PHP / kWh):</label>
                <input
                  type="number"
                  step="0.1"
                  value={pcParams.electricityRate}
                  onChange={e => setPcParams({ ...pcParams, electricityRate: parseFloat(e.target.value) || 11.5 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Daily Usage: {pcParams.hoursPerDay} hrs/day</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={pcParams.hoursPerDay}
                  onChange={e => setPcParams({ ...pcParams, hoursPerDay: parseInt(e.target.value, 10) || 8 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium text-slate-900 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-md space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Power Metrics</span>
              <h3 className="text-sm font-bold text-white">Workstation Fleet Energy & UPS Ratings</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700/80">
                <span className="text-[11px] text-slate-400 block font-medium">Fleet Peak Load</span>
                <div className="text-2xl font-extrabold text-white mt-0.5 font-mono">
                  {formatNumber(pcResults.fleetActiveKw, 2)} <span className="text-xs font-bold text-blue-400 font-sans">kW</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">{pcResults.singlePcActiveWatts}W per desk</span>
              </div>

              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700/80">
                <span className="text-[11px] text-slate-400 block font-medium">Monthly Power Bill</span>
                <div className="text-xl font-extrabold text-emerald-400 mt-0.5 font-mono">
                  {formatCurrency(pcResults.fleetMonthlyCost)}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">{formatNumber(pcResults.fleetMonthlyKwh, 0)} kWh/mo</span>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-slate-800 pt-3 font-mono">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400 font-sans">Recommended UPS (Per PC):</span>
                <span className="font-semibold text-blue-300 font-sans">{pcResults.recommendedUpsRating}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400 font-sans">Annual Electricity OpEx:</span>
                <span className="font-semibold text-white">{formatCurrency(pcResults.fleetAnnualCost)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: LAPTOP BATTERY & TCO (PRESERVED)
          ===================================================================== */}
      {activeTab === 'laptop' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="font-bold text-slate-900 text-sm">Laptop Fleet Battery Health & TCO Model</h2>
              <p className="text-xs text-slate-500 mt-0.5">Mobility energy efficiency, battery cycle wear estimation, and total cost of ownership</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Laptop Fleet Units: {laptopParams.quantity}</label>
                <input
                  type="number"
                  min="1"
                  value={laptopParams.quantity}
                  onChange={e => setLaptopParams({ ...laptopParams, quantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Charge Cycles Per Week: {laptopParams.chargeCyclesPerWeek}</label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={laptopParams.chargeCyclesPerWeek}
                  onChange={e => setLaptopParams({ ...laptopParams, chargeCyclesPerWeek: parseInt(e.target.value, 10) || 4 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium text-slate-900 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-md space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Mobility Financials</span>
              <h3 className="text-sm font-bold text-white">Efficiency & Battery Lifespan</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700/80">
                <span className="text-[11px] text-slate-400 block font-medium">Battery 80% Threshold</span>
                <div className="text-2xl font-extrabold text-blue-400 mt-0.5 font-mono">
                  ~{laptopResults.monthsTo80Percent} <span className="text-xs font-bold text-slate-300 font-sans">Months</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">{laptopResults.cyclesPerYear} cycles/year</span>
              </div>

              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700/80">
                <span className="text-[11px] text-slate-400 block font-medium">Annual Green Savings</span>
                <div className="text-xl font-extrabold text-emerald-400 mt-0.5 font-mono">
                  {formatCurrency(laptopResults.fleetAnnualSavings)}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">vs. Desktop Workstations</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: PRINTER COST-PER-PAGE (CPP) (PRESERVED)
          ===================================================================== */}
      {activeTab === 'printer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="font-bold text-slate-900 text-sm">Printer Cost-Per-Page (CPP) & Supplies TCO</h2>
              <p className="text-xs text-slate-500 mt-0.5">Toner cartridge yield, paper ream consumption, and long-term printing OpEx</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Mono Pages: {printerParams.monthlyMonoPages}</label>
                <input
                  type="number"
                  value={printerParams.monthlyMonoPages}
                  onChange={e => setPrinterParams({ ...printerParams, monthlyMonoPages: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Color Pages: {printerParams.monthlyColorPages}</label>
                <input
                  type="number"
                  value={printerParams.monthlyColorPages}
                  onChange={e => setPrinterParams({ ...printerParams, monthlyColorPages: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium text-slate-900 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-md space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Print Telemetry</span>
              <h3 className="text-sm font-bold text-white">Unit Page Economics</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700/80">
                <span className="text-[11px] text-slate-400 block font-medium">B&W Cost-Per-Page</span>
                <div className="text-xl font-extrabold text-blue-400 mt-0.5 font-mono">
                  {formatCurrency(printerResults.totalMonoCpp)}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Toner + Paper ream</span>
              </div>

              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700/80">
                <span className="text-[11px] text-slate-400 block font-medium">Monthly Operating Cost</span>
                <div className="text-xl font-extrabold text-emerald-400 mt-0.5 font-mono">
                  {formatCurrency(printerResults.monthlyTotalOpex)}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Consumables & kits</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
