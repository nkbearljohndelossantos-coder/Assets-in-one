import React, { useState, useMemo } from 'react';
import { 
  Calculator, Video, Monitor, Laptop, Printer, HardDrive, 
  Zap, Battery, DollarSign, FileText, Download, RotateCcw, 
  HelpCircle, CheckCircle2, TrendingUp, ShieldAlert, Cpu, 
  Clock, Server, Info, Layers, ArrowRight, Copy, Check,
  Network, Wifi, Globe, Terminal, Sliders, Shield, ListFilter,
  FileSpreadsheet, Search, AlertTriangle, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, ExternalLink, ArrowUpDown, Smartphone,
  Edit, RefreshCw, SmartphoneNfc
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
    dns1: '192.168.1.10', // Corporate Internal AD/DNS primary
    dns2: '1.1.1.1',      // Corporate Failover DNS secondary
    // Quantities for each device category
    infraCount: 5,     // Gateways, Switches, Routers, APs
    printerCount: 8,   // Static Network Printers / Copiers
    cctvCount: 16,     // Static CCTV Cameras & NVRs
    pcCount: 45,       // Static Workstation Desktop PCs
    laptopCount: 60,   // Laptops & Mobile (DHCP Scope)
    bufferPercent: 15  // Buffer reserved headroom per group
  });

  // Per-Device Administrator Overrides state { [deviceId]: { ip, gateway, dns1, dns2, hostname, role, assignmentType, isOverridden } }
  const [deviceOverrides, setDeviceOverrides] = useState({});
  const [editingOverrideModal, setEditingOverrideModal] = useState(null);
  const [overrideForm, setOverrideForm] = useState({
    ip: '',
    gateway: '',
    dns1: '',
    dns2: '',
    hostname: '',
    role: '',
    assignmentType: 'Static IP'
  });

  // Table filter & sorting state
  const [ipTableCategoryFilter, setIpTableCategoryFilter] = useState('all');
  const [ipTableTypeFilter, setIpTableTypeFilter] = useState('all');
  const [ipTableSearch, setIpTableSearch] = useState('');
  const [ipTableSortKey, setIpTableSortKey] = useState('ip');
  const [ipTableSortDir, setIpTableSortDir] = useState('asc');
  const [ipTablePage, setIpTablePage] = useState(1);
  const [ipTablePageSize, setIpTablePageSize] = useState(25);

  // Selected device for configuration generator & setup guide
  const [selectedGeneratorDevice, setSelectedGeneratorDevice] = useState('infra_1');
  const [generatorInterface, setGeneratorInterface] = useState('Ethernet');
  const [generatorScriptTab, setGeneratorScriptTab] = useState('cmd'); // 'cmd', 'ps', 'netplan', 'params'
  const [deviceGuidePlatform, setDeviceGuidePlatform] = useState('windows'); // 'windows', 'macos', 'android', 'ios'

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

    const maskStr = cidrToMask(cidr);

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
      mask: maskStr,
      cidr,
      gateway: 'Self',
      dns1: subnetParams.dns1 || 'N/A',
      dns2: subnetParams.dns2 || 'N/A',
      isOverridden: false
    });

    // Infrastructure Devices
    if (infraSize > 0) {
      for (let i = 1; i <= subnetParams.infraCount; i++) {
        const devId = `infra_${i}`;
        const ipVal = ((infraStart + i - 1) >>> 0);
        if (ipVal <= infraEnd) {
          const override = deviceOverrides[devId];
          generatedIps.push({
            id: devId,
            ip: override?.ip || intToIp(ipVal),
            hostname: override?.hostname || `NKB-SW-ACCESS-${String(i).padStart(2, '0')}`,
            category: 'infra',
            categoryLabel: 'Network Infrastructure',
            assignmentType: override?.assignmentType || 'Static IP',
            role: override?.role || (i === 1 ? 'Primary Core L3 Switch' : `Access Switch / AP Node ${i}`),
            mask: maskStr,
            cidr,
            gateway: override?.gateway || gatewayIp,
            dns1: override?.dns1 || subnetParams.dns1 || 'N/A',
            dns2: override?.dns2 || subnetParams.dns2 || 'N/A',
            isOverridden: !!override?.isOverridden
          });
        }
      }
    }

    // Printers
    if (printerSize > 0) {
      for (let i = 1; i <= subnetParams.printerCount; i++) {
        const devId = `printer_${i}`;
        const ipVal = ((printerStart + i - 1) >>> 0);
        if (ipVal <= printerEnd) {
          const override = deviceOverrides[devId];
          generatedIps.push({
            id: devId,
            ip: override?.ip || intToIp(ipVal),
            hostname: override?.hostname || `NKB-PRN-${String(i).padStart(2, '0')}`,
            category: 'printer',
            categoryLabel: 'Network Printer / Copier',
            assignmentType: override?.assignmentType || 'Static IP',
            role: override?.role || (i === 1 ? 'Heavy Duty MFP Copier (Admin Office)' : `Department Network Printer ${i}`),
            mask: maskStr,
            cidr,
            gateway: override?.gateway || gatewayIp,
            dns1: override?.dns1 || subnetParams.dns1 || 'N/A',
            dns2: override?.dns2 || subnetParams.dns2 || 'N/A',
            isOverridden: !!override?.isOverridden
          });
        }
      }
    }

    // CCTV
    if (cctvSize > 0) {
      for (let i = 1; i <= subnetParams.cctvCount; i++) {
        const devId = `cctv_${i}`;
        const ipVal = ((cctvStart + i - 1) >>> 0);
        if (ipVal <= cctvEnd) {
          const override = deviceOverrides[devId];
          generatedIps.push({
            id: devId,
            ip: override?.ip || intToIp(ipVal),
            hostname: override?.hostname || `NKB-CAM-${String(i).padStart(2, '0')}`,
            category: 'cctv',
            categoryLabel: 'CCTV Camera / NVR',
            assignmentType: override?.assignmentType || 'Static IP',
            role: override?.role || (i === 1 ? 'NVR Master Storage Server' : `IP Surveillance Camera ${i}`),
            mask: maskStr,
            cidr,
            gateway: override?.gateway || gatewayIp,
            dns1: override?.dns1 || subnetParams.dns1 || 'N/A',
            dns2: override?.dns2 || subnetParams.dns2 || 'N/A',
            isOverridden: !!override?.isOverridden
          });
        }
      }
    }

    // Desktop PCs
    if (pcSize > 0) {
      for (let i = 1; i <= subnetParams.pcCount; i++) {
        const devId = `pc_${i}`;
        const ipVal = ((pcStart + i - 1) >>> 0);
        if (ipVal <= pcEnd) {
          const override = deviceOverrides[devId];
          generatedIps.push({
            id: devId,
            ip: override?.ip || intToIp(ipVal),
            hostname: override?.hostname || `NKB-PC-${String(i).padStart(3, '0')}`,
            category: 'pc',
            categoryLabel: 'Desktop Workstation',
            assignmentType: override?.assignmentType || 'Static IP',
            role: override?.role || `Fixed Office Workstation Desk ${i}`,
            mask: maskStr,
            cidr,
            gateway: override?.gateway || gatewayIp,
            dns1: override?.dns1 || subnetParams.dns1 || 'N/A',
            dns2: override?.dns2 || subnetParams.dns2 || 'N/A',
            isOverridden: !!override?.isOverridden
          });
        }
      }
    }

    // Laptops (DHCP Scope)
    if (laptopSize > 0) {
      const displayLaptops = Math.min(30, subnetParams.laptopCount);
      for (let i = 1; i <= displayLaptops; i++) {
        const devId = `laptop_${i}`;
        const ipVal = ((laptopStart + i - 1) >>> 0);
        if (ipVal <= laptopEnd) {
          const override = deviceOverrides[devId];
          generatedIps.push({
            id: devId,
            ip: override?.ip || intToIp(ipVal),
            hostname: override?.hostname || `NKB-LAP-${String(i).padStart(3, '0')}`,
            category: 'laptop',
            categoryLabel: 'Laptop / Mobile',
            assignmentType: override?.assignmentType || 'DHCP Reservation',
            role: override?.role || `Staff Mobile Unit ${i} (DHCP Reservation)`,
            mask: maskStr,
            cidr,
            gateway: override?.gateway || gatewayIp,
            dns1: override?.dns1 || subnetParams.dns1 || 'N/A',
            dns2: override?.dns2 || subnetParams.dns2 || 'N/A',
            isOverridden: !!override?.isOverridden
          });
        }
      }
    }

    // Check for IP address collisions across the generated set
    const ipCounts = {};
    generatedIps.forEach(d => {
      ipCounts[d.ip] = (ipCounts[d.ip] || 0) + 1;
    });
    const duplicateIps = Object.keys(ipCounts).filter(ip => ipCounts[ip] > 1);

    return {
      network: intToIp(networkInt),
      broadcast: intToIp(broadcastInt),
      mask: maskStr,
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
      duplicateIps,
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
  }, [subnetParams, deviceOverrides]);

  // Selected device for configuration generator & setup guide
  const activeDeviceRow = useMemo(() => {
    return subnetResults.generatedIps.find(x => x.id === selectedGeneratorDevice) || 
      subnetResults.generatedIps[1] || 
      subnetResults.generatedIps[0] || {
        id: 'infra_1',
        ip: '192.168.1.2',
        hostname: 'NKB-SW-ACCESS-01',
        category: 'infra',
        categoryLabel: 'Network Infrastructure',
        assignmentType: 'Static IP',
        role: 'Primary Core L3 Switch',
        mask: '255.255.255.0',
        cidr: 24,
        gateway: '192.168.1.1',
        dns1: '192.168.1.10',
        dns2: '1.1.1.1'
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

  // Open Administrator Override Modal for a device
  const handleOpenOverrideModal = (dev) => {
    setEditingOverrideModal(dev);
    setOverrideForm({
      ip: dev.ip,
      gateway: dev.gateway === 'Self' ? dev.ip : dev.gateway,
      dns1: dev.dns1 === 'N/A' ? (subnetParams.dns1 || '') : dev.dns1,
      dns2: dev.dns2 === 'N/A' ? (subnetParams.dns2 || '') : dev.dns2,
      hostname: dev.hostname,
      role: dev.role,
      assignmentType: dev.assignmentType
    });
  };

  const handleSaveOverride = (e) => {
    e.preventDefault();
    if (!editingOverrideModal) return;

    if (!isValidIpv4(overrideForm.ip)) {
      alert('Invalid IP address entered. Please enter a valid IPv4 address.');
      return;
    }
    if (overrideForm.gateway && !isValidIpv4(overrideForm.gateway)) {
      alert('Invalid Gateway IP address entered.');
      return;
    }
    if (overrideForm.dns1 && !isValidIpv4(overrideForm.dns1)) {
      alert('Invalid Preferred DNS address entered.');
      return;
    }
    if (overrideForm.dns2 && !isValidIpv4(overrideForm.dns2)) {
      alert('Invalid Alternate DNS address entered.');
      return;
    }

    setDeviceOverrides(prev => ({
      ...prev,
      [editingOverrideModal.id]: {
        ...overrideForm,
        isOverridden: true
      }
    }));

    setEditingOverrideModal(null);
  };

  const handleResetOverride = (deviceId) => {
    setDeviceOverrides(prev => {
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
    setEditingOverrideModal(null);
  };

  // Download IP Table CSV (all 10 required fields)
  const handleDownloadCsv = () => {
    const headers = [
      'IP Address', 
      'Hostname', 
      'Device Category', 
      'Assignment Type', 
      'Subnet Mask', 
      'CIDR Prefix', 
      'Default Gateway', 
      'Preferred DNS', 
      'Alternate DNS', 
      'Description / Location'
    ];
    const rows = subnetResults.generatedIps.map(r => [
      `"${r.ip}"`,
      `"${r.hostname}"`,
      `"${r.categoryLabel}"`,
      `"${r.assignmentType}"`,
      `"${r.mask}"`,
      `"/${r.cidr}"`,
      `"${r.gateway}"`,
      `"${r.dns1}"`,
      `"${r.dns2}"`,
      `"${r.role}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NKB_IPAM_Schedule_${subnetParams.baseIp.replace(/\./g, '_')}_slash${subnetParams.cidr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Printable Device Setup Sheet
  const handlePrintDeviceGuide = (device) => {
    const target = device || activeDeviceRow;
    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (!printWin) {
      alert('Please allow popups to open the printable device setup guide.');
      return;
    }

    const platformName = {
      windows: 'Windows 10 / Windows 11',
      macos: 'macOS (Sonoma / Ventura / Sequoia)',
      android: 'Android 11–15 (Samsung / Pixel / MIUI)',
      ios: 'Apple iOS (iPhone / iPad)'
    }[deviceGuidePlatform] || 'Standard Operating System';

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>NKB Device Setup Guide - ${target.hostname}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body {
              font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 0;
              font-size: 11pt;
              line-height: 1.5;
            }
            .header-bar {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .title { font-size: 16pt; font-weight: 800; color: #0f172a; margin: 0; }
            .subtitle { font-size: 9pt; color: #64748b; margin-top: 2px; }
            .badge { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 9pt; }
            .param-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
            .param-table th, .param-table td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 10pt; text-align: left; }
            .param-table th { background: #f8fafc; font-weight: 700; width: 35%; color: #334155; }
            .param-table td { font-family: monospace; font-size: 10.5pt; font-weight: 700; color: #0f172a; }
            .section-title { font-size: 12pt; font-weight: 800; margin: 18px 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; color: #1e293b; }
            .steps-list { margin: 0; padding-left: 20px; font-size: 10pt; }
            .steps-list li { margin-bottom: 6px; }
            .alert-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 8px 12px; margin: 14px 0; font-size: 9pt; color: #92400e; }
            .signoff-table { width: 100%; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 15px; }
            .signoff-table td { width: 50%; padding: 10px 0; font-size: 9pt; vertical-align: bottom; }
            .sign-line { border-bottom: 1px solid #000; width: 80%; height: 25px; margin-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h1 class="title">NKB ITMS — DEVICE SETUP INSTRUCTIONS</h1>
              <div class="subtitle">Official Static IP & Subnetting Deployment Guide | Network Infrastructure Protocol</div>
            </div>
            <div class="badge">${platformName}</div>
          </div>

          <table class="param-table">
            <tr><th>Device Hostname</th><td>${target.hostname}</td></tr>
            <tr><th>Device Category & Role</th><td>${target.categoryLabel} &bull; ${target.role}</td></tr>
            <tr><th>Assignment Mode</th><td>${target.assignmentType}</td></tr>
            <tr><th>Static IPv4 Address</th><td style="color: #2563eb;">${target.ip}</td></tr>
            <tr><th>Subnet Mask</th><td>${target.mask} (Prefix: /${target.cidr})</td></tr>
            <tr><th>Default Gateway</th><td>${target.gateway}</td></tr>
            <tr><th>Preferred DNS Server</th><td>${target.dns1}</td></tr>
            <tr><th>Alternate DNS Server</th><td>${target.dns2}</td></tr>
          </table>

          <div class="alert-box">
            <strong>Precautionary Warning:</strong> Before changing configuration, write down or photograph existing network settings. Entering incorrect gateway or mask parameters will immediately sever host network connectivity.
          </div>

          <div class="section-title">Deployment Steps (${platformName})</div>
          <ol class="steps-list">
            <li><strong>Preparation:</strong> Record or screenshot all existing active network adapter properties.</li>
            <li><strong>Mode Selection:</strong> Open adapter properties and change configuration method from <em>Automatic (DHCP)</em> to <strong>Manual / Static</strong>.</li>
            <li><strong>IP Address:</strong> Enter exact assigned address <strong>${target.ip}</strong>.</li>
            <li><strong>Subnet Mask:</strong> Enter <strong>${target.mask}</strong> (or prefix length <strong>${target.cidr}</strong>).</li>
            <li><strong>Default Gateway:</strong> Enter <strong>${target.gateway}</strong> in the Gateway / Router field.</li>
            <li><strong>DNS Configuration:</strong> Set Preferred DNS to <strong>${target.dns1}</strong> and Alternate DNS to <strong>${target.dns2}</strong>.</li>
            <li><strong>Commit & Save:</strong> Click <em>Save</em> or <em>Apply</em> to commit configuration changes.</li>
            <li><strong>Connectivity Verification:</strong> Verify local reachability by testing ping to gateway: <code>ping ${target.gateway}</code>. Confirm corporate resolution via <code>nslookup asset.nkbmanufacturing.com</code>.</li>
          </ol>

          <table class="signoff-table">
            <tr>
              <td>
                Configured By (IT Technician Signature):
                <div class="sign-line"></div>
                Date: ________________________
              </td>
              <td>
                Acknowledged By (Department / Custodian):
                <div class="sign-line"></div>
                Date: ________________________
              </td>
            </tr>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
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
Preferred DNS Server: ${subnetParams.dns1 || 'N/A'}
Alternate DNS Server: ${subnetParams.dns2 || 'N/A'}
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
            {subnetResults.duplicateIps.length > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-rose-600 font-bold inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {subnetResults.duplicateIps.length} IP Conflict(s) Detected
                </span>
              </>
            )}
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
          ==================================================================== */}
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
                  <h2 className="font-bold text-slate-900 text-sm">Network Configuration & Gateway/DNS Policy</h2>
                  <p className="text-xs text-slate-500 mt-0.5">First-class gateway and corporate DNS policy with device sizing</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSubnetParams({
                      planName: 'Production Plant Primary Subnet',
                      baseIp: '192.168.1.0',
                      cidr: 24,
                      gatewayMode: 'first',
                      dns1: '192.168.1.10',
                      dns2: '1.1.1.1',
                      infraCount: 5,
                      printerCount: 8,
                      cctvCount: 16,
                      pcCount: 45,
                      laptopCount: 60,
                      bufferPercent: 15
                    });
                    setDeviceOverrides({});
                  }}
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
                    { label: '172.16.0.0/22 (Large Campus /22)', ip: '172.16.0.0', cidr: 22, name: 'Large Campus /22' }
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
                  <p className="text-[10px] text-slate-400 mt-1">Accepts network or host address (0.0.0.0 – 255.255.255.255)</p>
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
                  <p className="text-[10px] text-slate-400 mt-1">Defines network boundary and usable host address capacity</p>
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
                  <p className="text-[10px] text-slate-400 mt-1">Subnet gateway address: <span className="font-mono font-bold text-slate-700">{subnetResults.gatewayIp}</span></p>
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

                {/* Preferred DNS (Supports Corporate Internal DNS) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Preferred DNS Server:</label>
                    {!isDns1Valid && (
                      <span className="text-[10px] text-rose-600 font-bold">Invalid IPv4</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={subnetParams.dns1}
                    onChange={e => setSubnetParams({ ...subnetParams, dns1: e.target.value.trim() })}
                    placeholder="e.g. 192.168.1.10 (Internal AD DNS)"
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white ${
                      isDns1Valid ? 'border-slate-300' : 'border-rose-400 bg-rose-50/30'
                    }`}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Supports internal corporate Active Directory DNS or public resolvers</p>
                </div>

                {/* Alternate DNS */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Alternate DNS Server:</label>
                    {!isDns2Valid && (
                      <span className="text-[10px] text-rose-600 font-bold">Invalid IPv4</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={subnetParams.dns2}
                    onChange={e => setSubnetParams({ ...subnetParams, dns2: e.target.value.trim() })}
                    placeholder="e.g. 1.1.1.1 or 8.8.8.8"
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white ${
                      isDns2Valid ? 'border-slate-300' : 'border-rose-400 bg-rose-50/30'
                    }`}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Secondary fallback DNS resolver for redundancy</p>
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
                    <span className="text-slate-400 font-sans">Default Gateway:</span>
                    <span className="font-semibold text-emerald-400">{subnetResults.gatewayIp}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Preferred DNS:</span>
                    <span className="font-semibold text-slate-200">{subnetParams.dns1 || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Alternate DNS:</span>
                    <span className="font-semibold text-slate-200">{subnetParams.dns2 || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Usable Host Scope:</span>
                    <span className="font-semibold text-white">{subnetResults.firstUsable} – {subnetResults.lastUsable}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Broadcast Address:</span>
                    <span className="text-slate-300">{subnetResults.broadcast}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-sans">Wildcard Mask:</span>
                    <span className="text-slate-400">{subnetResults.wildcard}</span>
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
              IP ASSIGNMENT MASTER DIRECTORY (TABLE)
              ===================================================================== */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ListFilter className="w-4 h-4 text-blue-600" />
                  <span>IP Address Assignment Master Directory</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Static IP mapping schedule with individual gateway & DNS server tracking
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  title="Export complete 10-field IP plan as a CSV spreadsheet"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV (10 Fields)</span>
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
                  <option value="all">All Types</option>
                  <option value="static">Static IP Only</option>
                  <option value="dhcp">DHCP Reservation Only</option>
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
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Mask / Prefix</th>
                    <th className="py-2.5 px-3">Default Gateway</th>
                    <th className="py-2.5 px-3">Preferred DNS</th>
                    <th className="py-2.5 px-3">Alternate DNS</th>
                    <th className="py-2.5 px-3">Description / Role</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-8 text-center text-slate-400 font-sans text-xs">
                        No IP assignments matching active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map(row => {
                      const isSelectedInGenerator = selectedGeneratorDevice === row.id;
                      return (
                        <tr 
                          key={row.id} 
                          className={`transition ${isSelectedInGenerator ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                        >
                          {/* IP Address */}
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                            <span className="font-mono">{row.ip}</span>
                            {row.isOverridden && (
                              <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] font-sans font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Overridden
                              </span>
                            )}
                          </td>

                          {/* Hostname */}
                          <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap font-sans">
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
                              row.assignmentType.includes('DHCP') ? 'text-emerald-700 font-semibold' : 'text-slate-700'
                            }`}>
                              {row.assignmentType}
                            </span>
                          </td>

                          {/* Mask / Prefix */}
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                            {row.mask} <span className="text-slate-400">/{row.cidr}</span>
                          </td>

                          {/* Gateway */}
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                            {row.gateway}
                          </td>

                          {/* Preferred DNS */}
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                            {row.dns1}
                          </td>

                          {/* Alternate DNS */}
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                            {row.dns2}
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
                                {copiedKey === row.id ? 'Copied' : 'Copy IP'}
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedGeneratorDevice(row.id);
                                  const el = document.getElementById('device-setup-guide-section');
                                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-medium transition cursor-pointer border border-blue-200"
                                title="Select device for interactive setup guide & script generation"
                              >
                                Setup Guide
                              </button>

                              {row.id !== 'gateway' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenOverrideModal(row)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-medium transition cursor-pointer border border-slate-200"
                                  title="Admin override for Gateway, DNS, or custom IP"
                                >
                                  Override
                                </button>
                              )}
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
              DEDICATED DEVICE SETUP INSTRUCTIONS & INTERACTIVE GUIDE (SECTION B & C)
              ===================================================================== */}
          <div id="device-setup-guide-section" className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100">
                    <FileText className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">Device Setup Instructions & Interactive Guide</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Step-by-step operating system deployment guides with actual parameters for <strong>{activeDeviceRow.hostname}</strong> ({activeDeviceRow.ip})
                </p>
              </div>

              {/* Action Buttons for Device Guide */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cfgBlock = `HOSTNAME: ${activeDeviceRow.hostname}
IP ADDRESS: ${activeDeviceRow.ip}
SUBNET MASK: ${activeDeviceRow.mask} (/${activeDeviceRow.cidr})
DEFAULT GATEWAY: ${activeDeviceRow.gateway}
PREFERRED DNS: ${activeDeviceRow.dns1}
ALTERNATE DNS: ${activeDeviceRow.dns2}
CATEGORY: ${activeDeviceRow.categoryLabel}
ASSIGNMENT: ${activeDeviceRow.assignmentType}
DESCRIPTION: ${activeDeviceRow.role}`;
                    copyText(cfgBlock, 'device_config');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition cursor-pointer"
                  title="Copy full 10-field configuration block"
                >
                  {copiedKey === 'device_config' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiedKey === 'device_config' ? 'Copied Configuration!' : 'Copy Configuration'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintDeviceGuide(activeDeviceRow)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  title="Print single-device A4 setup & sign-off sheet"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Setup Sheet</span>
                </button>
              </div>
            </div>

            {/* Live Device Configuration Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected Hardware Profile:</span>
                  <span className="text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                    {activeDeviceRow.hostname}
                  </span>
                  <span className="text-xs text-slate-500">({activeDeviceRow.categoryLabel})</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Assignment Type:</span>
                  <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                    {activeDeviceRow.assignmentType}
                  </span>
                </div>
              </div>

              {/* Parameter Tiles (All 10 required fields populated from real state) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">1. IP Address</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-blue-700 text-xs">{activeDeviceRow.ip}</span>
                    <button onClick={() => copyText(activeDeviceRow.ip, 'p_ip')} className="text-slate-400 hover:text-slate-600">
                      {copiedKey === 'p_ip' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">2. Subnet Mask</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-slate-800 text-xs">{activeDeviceRow.mask}</span>
                    <button onClick={() => copyText(activeDeviceRow.mask, 'p_mask')} className="text-slate-400 hover:text-slate-600">
                      {copiedKey === 'p_mask' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">3. CIDR Prefix</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-slate-800 text-xs">/{activeDeviceRow.cidr}</span>
                    <span className="text-[10px] text-slate-400 font-sans">Prefix Length</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">4. Default Gateway</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-emerald-700 text-xs">{activeDeviceRow.gateway}</span>
                    <button onClick={() => copyText(activeDeviceRow.gateway, 'p_gw')} className="text-slate-400 hover:text-slate-600">
                      {copiedKey === 'p_gw' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">5. Preferred DNS</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-slate-800 text-xs">{activeDeviceRow.dns1}</span>
                    <button onClick={() => copyText(activeDeviceRow.dns1, 'p_dns1')} className="text-slate-400 hover:text-slate-600">
                      {copiedKey === 'p_dns1' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">6. Alternate DNS</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-slate-800 text-xs">{activeDeviceRow.dns2}</span>
                    <button onClick={() => copyText(activeDeviceRow.dns2, 'p_dns2')} className="text-slate-400 hover:text-slate-600">
                      {copiedKey === 'p_dns2' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Operating System Platform Selector Tabs */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 select-none">
                {[
                  { id: 'windows', label: 'Windows 10 / Windows 11', icon: Monitor },
                  { id: 'macos', label: 'macOS (Apple Mac)', icon: Laptop },
                  { id: 'android', label: 'Android (Phone / Tablet / Scanner)', icon: Smartphone },
                  { id: 'ios', label: 'iPhone / iPad (Apple iOS)', icon: SmartphoneNfc }
                ].map(p => {
                  const Icon = p.icon;
                  const isActive = deviceGuidePlatform === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDeviceGuidePlatform(p.id)}
                      className={`inline-flex items-center gap-2 py-2 px-3.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                        isActive 
                          ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-bold' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Precaution Warning Banner */}
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Record Existing Settings First:</span> Before applying manual network changes, record or take a screenshot of your current adapter properties. Setting an incorrect gateway or mask will interrupt local connectivity.
                </div>
              </div>

              {/* Platform Specific Step-by-Step Instructions */}

              {/* 1. WINDOWS GUIDE */}
              {deviceGuidePlatform === 'windows' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
                  <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-blue-600" />
                      <span>Windows 10 & Windows 11 Manual IPv4 Setup</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">Settings app & Control Panel methods</span>
                  </div>

                  <div className="space-y-3 text-slate-700 leading-relaxed">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                      <div>
                        <strong>Open Network Settings:</strong> Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Win + I</kbd> to open Windows Settings, navigate to <strong>Network & internet</strong>, then click on your active connection (<strong>Ethernet</strong> or <strong>Wi-Fi</strong>).
                        <span className="block text-slate-500 text-[11px] mt-0.5">Alternative: Press <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Win + R</kbd>, type <code>ncpa.cpl</code>, right-click adapter &rarr; Properties &rarr; double-click <em>Internet Protocol Version 4 (TCP/IPv4)</em>.</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                      <div>
                        <strong>Switch to Manual IPv4:</strong> Under <strong>IP assignment</strong>, click <strong>Edit</strong>. Change dropdown from <em>Automatic (DHCP)</em> to <strong>Manual</strong>, then toggle the <strong>IPv4</strong> switch to <strong>On</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                      <div>
                        <strong>Enter Exact IP Coordinates:</strong>
                        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px]">
                          <div>IP address: <strong className="text-blue-700">{activeDeviceRow.ip}</strong></div>
                          <div>Subnet prefix length: <strong>{activeDeviceRow.cidr}</strong> (or mask: <strong>{activeDeviceRow.mask}</strong>)</div>
                          <div>Default gateway: <strong className="text-emerald-700">{activeDeviceRow.gateway}</strong></div>
                          <div>Preferred DNS: <strong>{activeDeviceRow.dns1}</strong></div>
                          <div>Alternate DNS: <strong>{activeDeviceRow.dns2}</strong></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">4</span>
                      <div>
                        <strong>Save & Commit:</strong> Click <strong>Save</strong> (or <strong>OK</strong> in Control Panel). Windows will reinitialize the network adapter.
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">5</span>
                      <div>
                        <strong>Verify Connection:</strong> Open Command Prompt (<kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">cmd</kbd>) and test:
                        <code className="block mt-1 p-2 bg-slate-900 text-emerald-400 rounded font-mono text-[11px] select-all">
                          ping {activeDeviceRow.gateway} && nslookup asset.nkbmanufacturing.com
                        </code>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0">?</span>
                      <div>
                        <strong>Troubleshooting:</strong> If gateway ping fails, verify cable/Wi-Fi connection and ensure subnet mask is exactly <code>{activeDeviceRow.mask}</code>. If IP conflict message appears, verify no other machine is set to <code>{activeDeviceRow.ip}</code>.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. MACOS GUIDE */}
              {deviceGuidePlatform === 'macos' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
                  <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-blue-600" />
                      <span>macOS (Sonoma / Ventura / Sequoia) Manual IPv4 Setup</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">System Settings &rarr; Network panel</span>
                  </div>

                  <div className="space-y-3 text-slate-700 leading-relaxed">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                      <div>
                        <strong>Open Network Settings:</strong> Click the <strong>Apple Menu ()</strong> in the top-left &rarr; <strong>System Settings...</strong> &rarr; Click <strong>Network</strong> in the left sidebar.
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                      <div>
                        <strong>Open Connection Details:</strong> Click on your active connection (<strong>Wi-Fi</strong> or <strong>Ethernet</strong>), then click the <strong>Details...</strong> button next to the connected network.
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                      <div>
                        <strong>Configure TCP/IP:</strong> In the left tabs of the modal, click <strong>TCP/IP</strong>. Change <strong>Configure IPv4</strong> from <em>Using DHCP</em> to <strong>Manually</strong>.
                        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px]">
                          <div>IP Address: <strong className="text-blue-700">{activeDeviceRow.ip}</strong></div>
                          <div>Subnet Mask: <strong>{activeDeviceRow.mask}</strong></div>
                          <div>Router (Gateway): <strong className="text-emerald-700">{activeDeviceRow.gateway}</strong></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">4</span>
                      <div>
                        <strong>Configure DNS Servers:</strong> Click the <strong>DNS</strong> tab on the left sidebar. Under <strong>DNS Servers</strong>, click the <strong>+ (Add)</strong> button and enter:
                        <div className="mt-1 flex gap-2 font-mono text-[11px]">
                          <span className="bg-white px-2 py-1 rounded border border-slate-300">1: {activeDeviceRow.dns1}</span>
                          <span className="bg-white px-2 py-1 rounded border border-slate-300">2: {activeDeviceRow.dns2}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">5</span>
                      <div>
                        <strong>Apply & Verify:</strong> Click <strong>OK</strong>, then click <strong>Apply</strong>. Open <strong>Terminal</strong> and run:
                        <code className="block mt-1 p-2 bg-slate-900 text-emerald-400 rounded font-mono text-[11px] select-all">
                          ping -c 3 {activeDeviceRow.gateway}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. ANDROID GUIDE */}
              {deviceGuidePlatform === 'android' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
                  <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <span>Android (Phones, Tablets & Barcode Scanners) Wi-Fi Setup</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">Samsung OneUI / Pixel / MIUI / Zebra Android</span>
                  </div>

                  <div className="space-y-3 text-slate-700 leading-relaxed">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                      <div>
                        <strong>Navigate to Wi-Fi:</strong> Open <strong>Settings</strong> &rarr; <strong>Connections</strong> (or <em>Network & internet</em>) &rarr; Tap <strong>Wi-Fi</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                      <div>
                        <strong>Edit Network Settings:</strong> Tap the <strong>Gear icon (⚙️)</strong> next to your connected corporate Wi-Fi network &rarr; Tap <strong>View more</strong> (or the <em>Pencil / Edit</em> icon).
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                      <div>
                        <strong>Switch IP Settings to Static:</strong> Locate <strong>IP settings</strong> and change from <em>DHCP</em> to <strong>Static</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">4</span>
                      <div>
                        <strong>Enter Exact Network Parameters:</strong>
                        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px]">
                          <div>IP address: <strong className="text-blue-700">{activeDeviceRow.ip}</strong></div>
                          <div>Gateway: <strong className="text-emerald-700">{activeDeviceRow.gateway}</strong></div>
                          <div>Network prefix length: <strong>{activeDeviceRow.cidr}</strong> (Important: enter prefix integer, not 255.255.255.0)</div>
                          <div>DNS 1: <strong>{activeDeviceRow.dns1}</strong></div>
                          <div>DNS 2: <strong>{activeDeviceRow.dns2}</strong></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">5</span>
                      <div>
                        <strong>Save & Scope Notice:</strong> Tap <strong>Save</strong>. The device will reconnect with the static lease.
                        <span className="block text-slate-500 text-[11px] mt-0.5"><em>Scope Notice:</em> Static IP applies solely to this corporate Wi-Fi SSID. Connecting to external or home Wi-Fi networks will automatically retain normal DHCP operation.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. IPHONE / IOS GUIDE */}
              {deviceGuidePlatform === 'ios' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
                  <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <SmartphoneNfc className="w-4 h-4 text-blue-600" />
                      <span>Apple iOS (iPhone & iPad) Wi-Fi Configuration</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">iOS 16 / 17 / 18 Settings app</span>
                  </div>

                  <div className="space-y-3 text-slate-700 leading-relaxed">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                      <div>
                        <strong>Open Wi-Fi Settings:</strong> Open the iOS <strong>Settings</strong> app &rarr; Tap <strong>Wi-Fi</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                      <div>
                        <strong>Open Network Information:</strong> Tap the blue information icon (<strong>ⓘ</strong>) next to the connected NKB corporate Wi-Fi network.
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                      <div>
                        <strong>Configure IPv4 Manually:</strong> Scroll down and tap <strong>Configure IP</strong>. Change from <em>Automatic</em> to <strong>Manual</strong>:
                        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px]">
                          <div>IP Address: <strong className="text-blue-700">{activeDeviceRow.ip}</strong></div>
                          <div>Subnet Mask: <strong>{activeDeviceRow.mask}</strong></div>
                          <div>Router: <strong className="text-emerald-700">{activeDeviceRow.gateway}</strong></div>
                        </div>
                        <span className="block text-slate-500 text-[11px] mt-1">Tap <strong>Save</strong> in the top-right corner.</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">4</span>
                      <div>
                        <strong>Configure DNS Manually (Separate Section):</strong> On the same network page, tap <strong>Configure DNS</strong>. Change from <em>Automatic</em> to <strong>Manual</strong>.
                        Delete any old DNS entries, tap <strong>Add Server</strong>, and enter:
                        <div className="mt-1 flex gap-2 font-mono text-[11px]">
                          <span className="bg-white px-2 py-1 rounded border border-slate-300">Server 1: {activeDeviceRow.dns1}</span>
                          <span className="bg-white px-2 py-1 rounded border border-slate-300">Server 2: {activeDeviceRow.dns2}</span>
                        </div>
                        <span className="block text-slate-500 text-[11px] mt-1">Tap <strong>Save</strong> in the top-right corner.</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">5</span>
                      <div>
                        <strong>Verify Connection:</strong> Toggle Wi-Fi off and back on in Settings to confirm lease binding. Open Safari and browse to <code>https://asset.nkbmanufacturing.com</code>.
                        <span className="block text-slate-500 text-[11px] mt-0.5"><em>Notice:</em> Do not alter Cellular / APN settings. This procedure applies solely to the corporate Wi-Fi profile.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* =====================================================================
              AUTOMATED CONFIGURATION SCRIPT GENERATOR (WINDOWS CMD, PS, NETPLAN)
              ===================================================================== */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-600" />
                  <span>Automated Command Generator (CMD / PowerShell / Netplan)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Single-click deployable scripts for system administrators and automation tools
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Network Interface:</span>
                <input
                  type="text"
                  value={generatorInterface}
                  onChange={e => setGeneratorInterface(e.target.value)}
                  placeholder="Ethernet"
                  className="px-2.5 py-1 rounded border border-slate-300 text-xs font-mono font-medium text-slate-800 w-28 bg-white"
                />
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
                      const cmd = `:: NKB ITMS - Static IPv4 & DNS Script\n:: Target: ${activeDeviceRow.hostname} (${activeDeviceRow.categoryLabel})\nnetsh interface ip set address name="${generatorInterface}" static ${activeDeviceRow.ip} ${activeDeviceRow.mask} ${activeDeviceRow.gateway} 1\nnetsh interface ip set dns name="${generatorInterface}" static ${activeDeviceRow.dns1}\nnetsh interface ip add dns name="${generatorInterface}" ${activeDeviceRow.dns2} index=2`;
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
netsh interface ip set address name="${generatorInterface}" static ${activeDeviceRow.ip} ${activeDeviceRow.mask} ${activeDeviceRow.gateway} 1
netsh interface ip set dns name="${generatorInterface}" static ${activeDeviceRow.dns1}
netsh interface ip add dns name="${generatorInterface}" ${activeDeviceRow.dns2} index=2`}
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
                      const ps = `# NKB ITMS PowerShell IPv4 Deployment\n# Target Host: ${activeDeviceRow.hostname} (${activeDeviceRow.categoryLabel})\nNew-NetIPAddress -InterfaceAlias "${generatorInterface}" -IPAddress "${activeDeviceRow.ip}" -PrefixLength ${activeDeviceRow.cidr} -DefaultGateway "${activeDeviceRow.gateway}"\nSet-DnsClientServerAddress -InterfaceAlias "${generatorInterface}" -ServerAddresses ("${activeDeviceRow.dns1}","${activeDeviceRow.dns2}")`;
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
New-NetIPAddress -InterfaceAlias "${generatorInterface}" -IPAddress "${activeDeviceRow.ip}" -PrefixLength ${activeDeviceRow.cidr} -DefaultGateway "${activeDeviceRow.gateway}"
Set-DnsClientServerAddress -InterfaceAlias "${generatorInterface}" -ServerAddresses ("${activeDeviceRow.dns1}","${activeDeviceRow.dns2}")`}
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
                      const netplan = `# /etc/netplan/01-netcfg.yaml\nnetwork:\n  version: 2\n  renderer: networkd\n  ethernets:\n    ${generatorInterface.toLowerCase()}:\n      dhcp4: no\n      addresses:\n        - ${activeDeviceRow.ip}/${activeDeviceRow.cidr}\n      routes:\n        - to: default\n          via: ${activeDeviceRow.gateway}\n      nameservers:\n        addresses: [${activeDeviceRow.dns1}, ${activeDeviceRow.dns2}]`;
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
        - ${activeDeviceRow.ip}/${activeDeviceRow.cidr}
      routes:
        - to: default
          via: ${activeDeviceRow.gateway}
      nameservers:
        addresses: [${activeDeviceRow.dns1}, ${activeDeviceRow.dns2}]`}
                </pre>
              </div>
            )}

            {generatorScriptTab === 'params' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">IP Address</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{activeDeviceRow.ip}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Subnet Mask</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{activeDeviceRow.mask}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">CIDR Prefix</span>
                  <span className="font-mono font-bold text-slate-900 select-all">/{activeDeviceRow.cidr}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Default Gateway</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{activeDeviceRow.gateway}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Preferred DNS</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{activeDeviceRow.dns1}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Alternate DNS</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{activeDeviceRow.dns2}</span>
                </div>
              </div>
            )}
          </div>

          {/* =====================================================================
              MODAL: ADMINISTRATOR DEVICE CONFIGURATION OVERRIDE
              ===================================================================== */}
          {editingOverrideModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={() => setEditingOverrideModal(null)}>
              <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Administrator Device Configuration Override</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Customize gateway, DNS, or IP coordinates for {editingOverrideModal.hostname}</p>
                  </div>
                  <button onClick={() => setEditingOverrideModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveOverride} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Host Device Name:</label>
                    <input
                      type="text"
                      required
                      value={overrideForm.hostname}
                      onChange={e => setOverrideForm({ ...overrideForm, hostname: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Custom IPv4 Address:</label>
                      <input
                        type="text"
                        required
                        value={overrideForm.ip}
                        onChange={e => setOverrideForm({ ...overrideForm, ip: e.target.value.trim() })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-medium text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Assignment Type:</label>
                      <select
                        value={overrideForm.assignmentType}
                        onChange={e => setOverrideForm({ ...overrideForm, assignmentType: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium text-slate-900"
                      >
                        <option value="Static IP">Static IP</option>
                        <option value="DHCP Reservation">DHCP Reservation</option>
                        <option value="Static Core">Static Core</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Custom Default Gateway:</label>
                    <input
                      type="text"
                      required
                      value={overrideForm.gateway}
                      onChange={e => setOverrideForm({ ...overrideForm, gateway: e.target.value.trim() })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-medium text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Preferred DNS:</label>
                      <input
                        type="text"
                        value={overrideForm.dns1}
                        onChange={e => setOverrideForm({ ...overrideForm, dns1: e.target.value.trim() })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-medium text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Alternate DNS:</label>
                      <input
                        type="text"
                        value={overrideForm.dns2}
                        onChange={e => setOverrideForm({ ...overrideForm, dns2: e.target.value.trim() })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-medium text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Role / Location Description:</label>
                    <input
                      type="text"
                      value={overrideForm.role}
                      onChange={e => setOverrideForm({ ...overrideForm, role: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium text-slate-900"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleResetOverride(editingOverrideModal.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold cursor-pointer"
                    >
                      Reset to Plan Defaults
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingOverrideModal(null)}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs"
                      >
                        Save Override
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

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
                  Camera Channels: <span className="font-bold text-blue-600">{cctvParams.cameras} Channels</span>
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
