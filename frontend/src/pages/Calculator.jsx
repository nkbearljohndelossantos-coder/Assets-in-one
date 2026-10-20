import React, { useState, useMemo } from 'react';
import { 
  Calculator, Video, Monitor, Laptop, Printer, HardDrive, 
  Zap, Battery, DollarSign, FileText, Download, RotateCcw, 
  HelpCircle, CheckCircle2, TrendingUp, ShieldAlert, Cpu, 
  Clock, Server, Info, Layers, ArrowRight, Copy, Check,
  Network, Wifi, Globe, Terminal, Sliders, Shield, ListFilter,
  FileSpreadsheet, Search, AlertTriangle
} from 'lucide-react';

// =========================================================================
// IP HELPER UTILITIES
// =========================================================================
function ipToInt(ip) {
  if (!ip || typeof ip !== 'string') return 0;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return 0;
  return parts.reduce((acc, oct) => ((acc << 8) + (parseInt(oct, 10) || 0)) >>> 0, 0);
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
  // Default to the Static IP & Subnetting tab requested by the user
  const [activeTab, setActiveTab] = useState('subnet');
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Currency formatting helper (Philippine Peso)
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
    navigator.clipboard.writeText(text);
    if (key === 'global') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // =========================================================================
  // 0. STATIC IP & SUBNETTING CALCULATOR STATE & LOGIC
  // =========================================================================
  const [subnetParams, setSubnetParams] = useState({
    baseIp: '192.168.1.0',
    cidr: 24,
    gatewayMode: 'first', // 'first' (.1) or 'last' (.254)
    dns1: '8.8.8.8',
    dns2: '1.1.1.1',
    // Quantities for each device category
    infraCount: 5,     // Gateways, Switches, Routers, APs
    printerCount: 8,   // Static Network Printers / Copiers
    cctvCount: 16,     // Static CCTV Cameras & NVRs
    pcCount: 45,       // Static Workstation Desktop PCs
    laptopCount: 60,   // Laptops & Mobile (DHCP Scope)
    bufferPercent: 15  // Buffer reserved headroom per group
  });

  // Table filter state
  const [ipTableFilter, setIpTableFilter] = useState('all');
  const [ipTableSearch, setIpTableSearch] = useState('');

  // Selected device for config command generator
  const [selectedGeneratorDevice, setSelectedGeneratorDevice] = useState('cctv_1');
  const [customHostName, setCustomHostName] = useState('NKB-CAM-01');

  // Subnet Calculation Results
  const subnetResults = useMemo(() => {
    const cidr = parseInt(subnetParams.cidr, 10) || 24;
    const maskInt = cidrToMaskInt(cidr);
    const ipInt = ipToInt(subnetParams.baseIp);
    const networkInt = (ipInt & maskInt) >>> 0;
    const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;

    const totalHosts = Math.pow(2, 32 - cidr);
    const usableHosts = cidr >= 31 ? (cidr === 31 ? 2 : 1) : Math.max(0, totalHosts - 2);

    const firstUsableInt = cidr >= 31 ? networkInt : networkInt + 1;
    const lastUsableInt = cidr >= 31 ? broadcastInt : broadcastInt - 1;

    const gatewayInt = subnetParams.gatewayMode === 'last' ? lastUsableInt : firstUsableInt;
    const gatewayIp = intToIp(gatewayInt);

    // Calculate required hosts with buffer
    const bufferMultiplier = 1 + (subnetParams.bufferPercent / 100);
    const infraSize = Math.max(1, Math.ceil(subnetParams.infraCount * bufferMultiplier));
    const printerSize = Math.max(1, Math.ceil(subnetParams.printerCount * bufferMultiplier));
    const cctvSize = Math.max(1, Math.ceil(subnetParams.cctvCount * bufferMultiplier));
    const pcSize = Math.max(1, Math.ceil(subnetParams.pcCount * bufferMultiplier));
    const laptopSize = Math.max(1, Math.ceil(subnetParams.laptopCount * bufferMultiplier));

    const totalRequestedDevices = subnetParams.infraCount + subnetParams.printerCount + 
      subnetParams.cctvCount + subnetParams.pcCount + subnetParams.laptopCount;
    const totalAllocatedSize = infraSize + printerSize + cctvSize + pcSize + laptopSize;

    // Partition ranges consecutively starting after gateway
    let currentStartInt = subnetParams.gatewayMode === 'first' ? firstUsableInt + 1 : firstUsableInt;

    // 1. Infra Range
    const infraStart = currentStartInt;
    const infraEnd = Math.min(lastUsableInt, infraStart + infraSize - 1);
    currentStartInt = infraEnd + 1;

    // 2. Printer Range (Static)
    const printerStart = currentStartInt;
    const printerEnd = Math.min(lastUsableInt, printerStart + printerSize - 1);
    currentStartInt = printerEnd + 1;

    // 3. CCTV Range (Static)
    const cctvStart = currentStartInt;
    const cctvEnd = Math.min(lastUsableInt, cctvStart + cctvSize - 1);
    currentStartInt = cctvEnd + 1;

    // 4. Desktop PC Range (Static)
    const pcStart = currentStartInt;
    const pcEnd = Math.min(lastUsableInt, pcStart + pcSize - 1);
    currentStartInt = pcEnd + 1;

    // 5. Laptop & Wi-Fi DHCP Pool
    const laptopStart = currentStartInt;
    const laptopEnd = Math.min(
      subnetParams.gatewayMode === 'last' ? lastUsableInt - 1 : lastUsableInt,
      laptopStart + laptopSize - 1
    );
    currentStartInt = laptopEnd + 1;

    // Free / Unallocated IPs
    const freeStart = currentStartInt;
    const freeEnd = subnetParams.gatewayMode === 'last' ? lastUsableInt - 1 : lastUsableInt;
    const freeCount = Math.max(0, freeEnd - freeStart + 1);

    const isOverCapacity = totalAllocatedSize > usableHosts;
    const utilizationPercent = Math.min(100, Math.round((totalAllocatedSize / Math.max(1, usableHosts)) * 100));

    // IP Class detection
    const firstOctet = parseInt(subnetParams.baseIp.split('.')[0], 10) || 192;
    let ipClass = 'Class C (Private: 192.168.0.0/16)';
    if (firstOctet < 128) ipClass = 'Class A (Private: 10.0.0.0/8)';
    else if (firstOctet < 192) ipClass = 'Class B (Private: 172.16.0.0/12)';

    // Generate static IP assignment rows for the table
    const generatedIps = [];

    // Gateway
    generatedIps.push({
      id: 'gateway',
      ip: gatewayIp,
      hostname: 'NKB-CORE-GW01',
      category: 'infra',
      categoryLabel: 'Default Gateway / Router',
      assignmentType: 'Static Core',
      role: 'Network Gateway'
    });

    // Infrastructure
    for (let i = 1; i <= subnetParams.infraCount; i++) {
      const ip = intToIp(infraStart + i - 1);
      if (ipToInt(ip) <= infraEnd) {
        generatedIps.push({
          id: `infra_${i}`,
          ip,
          hostname: `NKB-SW-ACCESS-${String(i).padStart(2, '0')}`,
          category: 'infra',
          categoryLabel: 'Network Infrastructure',
          assignmentType: 'Static IP',
          role: i === 1 ? 'Core Switch' : `Access Switch / AP ${i}`
        });
      }
    }

    // Printers
    for (let i = 1; i <= subnetParams.printerCount; i++) {
      const ip = intToIp(printerStart + i - 1);
      if (ipToInt(ip) <= printerEnd) {
        generatedIps.push({
          id: `printer_${i}`,
          ip,
          hostname: `NKB-PRN-${String(i).padStart(2, '0')}`,
          category: 'printer',
          categoryLabel: 'Network Printer / Copier',
          assignmentType: 'Static IP',
          role: i === 1 ? 'Heavy MFP Copier (Admin)' : `Office Printer ${i}`
        });
      }
    }

    // CCTV
    for (let i = 1; i <= subnetParams.cctvCount; i++) {
      const ip = intToIp(cctvStart + i - 1);
      if (ipToInt(ip) <= cctvEnd) {
        generatedIps.push({
          id: `cctv_${i}`,
          ip,
          hostname: `NKB-CAM-${String(i).padStart(2, '0')}`,
          category: 'cctv',
          categoryLabel: 'CCTV Camera / NVR',
          assignmentType: 'Static IP',
          role: i === 1 ? 'NVR Recording Server' : `IP Camera ${i}`
        });
      }
    }

    // Desktop PCs
    for (let i = 1; i <= subnetParams.pcCount; i++) {
      const ip = intToIp(pcStart + i - 1);
      if (ipToInt(ip) <= pcEnd) {
        generatedIps.push({
          id: `pc_${i}`,
          ip,
          hostname: `NKB-PC-${String(i).padStart(3, '0')}`,
          category: 'pc',
          categoryLabel: 'Desktop Workstation',
          assignmentType: 'Static / Reserved IP',
          role: `Workstation Desk ${i}`
        });
      }
    }

    // Laptops
    for (let i = 1; i <= Math.min(20, subnetParams.laptopCount); i++) {
      const ip = intToIp(laptopStart + i - 1);
      if (ipToInt(ip) <= laptopEnd) {
        generatedIps.push({
          id: `laptop_${i}`,
          ip,
          hostname: `NKB-LAP-${String(i).padStart(3, '0')}`,
          category: 'laptop',
          categoryLabel: 'Laptop / Mobile',
          assignmentType: 'DHCP Pool / Reservation',
          role: `Staff Mobile Unit ${i}`
        });
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
      isOverCapacity,
      utilizationPercent,
      ipClass,
      ranges: {
        infra: { start: intToIp(infraStart), end: intToIp(infraEnd), count: infraSize, active: subnetParams.infraCount },
        printer: { start: intToIp(printerStart), end: intToIp(printerEnd), count: printerSize, active: subnetParams.printerCount },
        cctv: { start: intToIp(cctvStart), end: intToIp(cctvEnd), count: cctvSize, active: subnetParams.cctvCount },
        pc: { start: intToIp(pcStart), end: intToIp(pcEnd), count: pcSize, active: subnetParams.pcCount },
        laptop: { start: intToIp(laptopStart), end: intToIp(laptopEnd), count: laptopSize, active: subnetParams.laptopCount },
        free: { start: intToIp(freeStart), end: intToIp(freeEnd), count: freeCount }
      },
      generatedIps
    };
  }, [subnetParams]);

  // Selected device config commands
  const activeDeviceRow = useMemo(() => {
    return subnetResults.generatedIps.find(x => x.id === selectedGeneratorDevice) || subnetResults.generatedIps[0] || {
      ip: '192.168.1.50',
      hostname: 'NKB-DEVICE-01',
      category: 'pc',
      categoryLabel: 'Workstation'
    };
  }, [subnetResults, selectedGeneratorDevice]);

  // Filtered IP Table
  const filteredIpTable = useMemo(() => {
    return subnetResults.generatedIps.filter(row => {
      const matchCat = ipTableFilter === 'all' || row.category === ipTableFilter;
      const matchSearch = !ipTableSearch || 
        row.ip.includes(ipTableSearch) || 
        row.hostname.toLowerCase().includes(ipTableSearch.toLowerCase()) ||
        row.role.toLowerCase().includes(ipTableSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [subnetResults, ipTableFilter, ipTableSearch]);

  // Download IP Table CSV
  const handleDownloadCsv = () => {
    const headers = ['IP Address', 'Hostname', 'Device Type', 'Assignment Type', 'Subnet Mask', 'Gateway', 'Role / Description'];
    const rows = subnetResults.generatedIps.map(r => [
      r.ip,
      r.hostname,
      r.categoryLabel,
      r.assignmentType,
      subnetResults.mask,
      subnetResults.gatewayIp,
      r.role
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NKB_Static_IP_Subnet_Plan_${subnetParams.baseIp}_cidr${subnetParams.cidr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // =========================================================================
  // 1. CCTV HARDWARE SIZING STATE & LOGIC
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

    return {
      bitratePerCam,
      totalBandwidthMbps,
      dailyStoragePerCamGb,
      totalDailyGb,
      totalStorageGb,
      totalStorageTb,
      usableStorageTb,
      grossStorageNeededTb,
      driveSize,
      recommendedDrivesCount,
      totalPurchasedTb,
      estimatedHddCost,
      nvrChannels,
      switchSpeed: totalBandwidthMbps > 75 ? '1 Gbps (Gigabit PoE)' : '100 Mbps (Fast Ethernet PoE)'
    };
  }, [cctvParams]);

  // =========================================================================
  // 2. PC & WORKSTATION SIZING STATE & LOGIC
  // =========================================================================
  const [pcParams, setPcParams] = useState({
    preset: 'office',
    unitDrawWatts: 90,
    monitors: 1,
    monitorWatts: 25,
    peripheralsWatts: 15,
    quantity: 15,
    hoursPerDay: 9,
    workdaysPerMonth: 22,
    electricityRate: 12.00,
    unitCost: 38000,
    usefulLifeYears: 4,
    salvageValue: 4000
  });

  const pcResults = useMemo(() => {
    const totalWattsPerUnit = pcParams.unitDrawWatts + (pcParams.monitors * pcParams.monitorWatts) + pcParams.peripheralsWatts;
    const fleetActiveKw = (totalWattsPerUnit * pcParams.quantity) / 1000;

    const dailyActiveKwhPerUnit = (totalWattsPerUnit * pcParams.hoursPerDay) / 1000;
    const standbyHours = Math.max(0, 24 - pcParams.hoursPerDay);
    const dailyStandbyKwhPerUnit = (5 * standbyHours) / 1000;
    const monthlyKwhPerUnit = (dailyActiveKwhPerUnit * pcParams.workdaysPerMonth) + (dailyStandbyKwhPerUnit * 30);
    const monthlyCostPerUnit = monthlyKwhPerUnit * pcParams.electricityRate;
    const annualCostPerUnit = monthlyCostPerUnit * 12;

    const fleetMonthlyKwh = monthlyKwhPerUnit * pcParams.quantity;
    const fleetMonthlyCost = fleetMonthlyKwh * pcParams.electricityRate;
    const fleetAnnualCost = fleetMonthlyCost * 12;

    const upsMinWatts = Math.round(totalWattsPerUnit * 1.25);
    const upsMinVa = Math.round(upsMinWatts / 0.6);

    let recommendedUpsRating = '650VA / 360W';
    if (upsMinVa > 2000) recommendedUpsRating = '3000VA / 2700W Online UPS';
    else if (upsMinVa > 1400) recommendedUpsRating = '2000VA / 1200W Line-Interactive';
    else if (upsMinVa > 900) recommendedUpsRating = '1500VA / 900W Line-Interactive';
    else if (upsMinVa > 600) recommendedUpsRating = '1000VA / 600W Line-Interactive';

    const monthlyDepreciationPerUnit = (pcParams.unitCost - pcParams.salvageValue) / (pcParams.usefulLifeYears * 12);
    const totalFleetMonthlyTco = (monthlyDepreciationPerUnit * pcParams.quantity) + fleetMonthlyCost;

    return {
      totalWattsPerUnit,
      fleetActiveKw,
      monthlyKwhPerUnit,
      monthlyCostPerUnit,
      annualCostPerUnit,
      fleetMonthlyKwh,
      fleetMonthlyCost,
      fleetAnnualCost,
      upsMinWatts,
      upsMinVa,
      recommendedUpsRating,
      monthlyDepreciationPerUnit,
      fleetMonthlyDepreciation: monthlyDepreciationPerUnit * pcParams.quantity,
      totalFleetMonthlyTco
    };
  }, [pcParams]);

  // =========================================================================
  // 3. LAPTOP CALCULATOR STATE & LOGIC
  // =========================================================================
  const [laptopParams, setLaptopParams] = useState({
    tier: 'corporate',
    avgWatts: 28,
    chargerWatts: 65,
    batteryWh: 56,
    quantity: 20,
    hoursPlugged: 8,
    workdaysPerMonth: 22,
    electricityRate: 12.00,
    unitCost: 45000,
    usefulLifeYears: 3.5,
    cyclesPerWeek: 4
  });

  const laptopResults = useMemo(() => {
    const dailyKwh = (laptopParams.avgWatts * laptopParams.hoursPlugged) / 1000;
    const monthlyKwhPerUnit = dailyKwh * laptopParams.workdaysPerMonth;
    const monthlyCostPerUnit = monthlyKwhPerUnit * laptopParams.electricityRate;

    const fleetMonthlyKwh = monthlyKwhPerUnit * laptopParams.quantity;
    const fleetMonthlyCost = fleetMonthlyKwh * laptopParams.electricityRate;
    const fleetAnnualCost = fleetMonthlyCost * 12;

    const desktopEqKwhPerUnit = (130 * laptopParams.hoursPlugged * laptopParams.workdaysPerMonth) / 1000;
    const desktopMonthlyCost = desktopEqKwhPerUnit * laptopParams.electricityRate;
    const monthlySavingsPerLaptop = Math.max(0, desktopMonthlyCost - monthlyCostPerUnit);
    const fleetAnnualSavings = monthlySavingsPerLaptop * laptopParams.quantity * 12;

    const cyclesPerYear = laptopParams.cyclesPerWeek * 52;
    const monthsTo80Percent = cyclesPerYear > 0 ? Math.round((500 / cyclesPerYear) * 12) : 36;

    const monthlyDepreciationPerUnit = (laptopParams.unitCost * 0.9) / (laptopParams.usefulLifeYears * 12);
    const fleetMonthlyDepreciation = monthlyDepreciationPerUnit * laptopParams.quantity;
    const totalFleetMonthlyTco = fleetMonthlyDepreciation + fleetMonthlyCost;

    return {
      monthlyKwhPerUnit,
      monthlyCostPerUnit,
      fleetMonthlyKwh,
      fleetMonthlyCost,
      fleetAnnualCost,
      monthlySavingsPerLaptop,
      fleetAnnualSavings,
      cyclesPerYear,
      monthsTo80Percent,
      monthlyDepreciationPerUnit,
      fleetMonthlyDepreciation,
      totalFleetMonthlyTco
    };
  }, [laptopParams]);

  // =========================================================================
  // 4. PRINTER CALCULATOR STATE & LOGIC
  // =========================================================================
  const [printerParams, setPrinterParams] = useState({
    category: 'mono_laser',
    printerPrice: 18500,
    lifespanMonths: 48,
    monthlyMonoPages: 2500,
    monthlyColorPages: 400,
    blackConsumableCost: 3200,
    blackYieldPages: 3000,
    colorConsumablesCost: 8500,
    colorYieldPages: 2200,
    drumCost: 3500,
    drumLifespanPages: 18000,
    paperReamCost: 240,
    monthlyPowerMaint: 250
  });

  const printerResults = useMemo(() => {
    const blackInkCpp = printerParams.blackYieldPages > 0 ? (printerParams.blackConsumableCost / printerParams.blackYieldPages) : 0;
    const colorInkOnlyCpp = (printerParams.colorYieldPages > 0 && printerParams.category !== 'mono_laser') 
      ? (printerParams.colorConsumablesCost / printerParams.colorYieldPages) 
      : 0;
    const colorInkTotalCpp = blackInkCpp + colorInkOnlyCpp;
    const drumCpp = printerParams.drumLifespanPages > 0 ? (printerParams.drumCost / printerParams.drumLifespanPages) : 0;
    const paperCpp = printerParams.paperReamCost / 500;

    const totalMonoCpp = blackInkCpp + drumCpp + paperCpp;
    const totalColorCpp = colorInkTotalCpp + drumCpp + paperCpp;

    const totalPages = printerParams.monthlyMonoPages + printerParams.monthlyColorPages;
    const monthlyBlackInkCost = printerParams.monthlyMonoPages * blackInkCpp;
    const monthlyColorInkCost = printerParams.monthlyColorPages * colorInkTotalCpp;
    const monthlyConsumablesCost = monthlyBlackInkCost + monthlyColorInkCost;
    const monthlyDrumCost = totalPages * drumCpp;
    const monthlyPaperCost = totalPages * paperCpp;
    const monthlyTotalOpex = monthlyConsumablesCost + monthlyDrumCost + monthlyPaperCost + printerParams.monthlyPowerMaint;

    const monthlyDepreciation = printerParams.lifespanMonths > 0 ? (printerParams.printerPrice / printerParams.lifespanMonths) : 0;
    const monthlyTotalTco = monthlyTotalOpex + monthlyDepreciation;
    const threeYearTco = (printerParams.printerPrice) + (monthlyTotalOpex * 36);
    const fiveYearTco = (printerParams.printerPrice) + (monthlyTotalOpex * 60);

    return {
      blackInkCpp,
      colorInkTotalCpp,
      drumCpp,
      paperCpp,
      totalMonoCpp,
      totalColorCpp,
      totalPages,
      monthlyConsumablesCost,
      monthlyPaperCost,
      monthlyTotalOpex,
      monthlyDepreciation,
      monthlyTotalTco,
      threeYearTco,
      fiveYearTco
    };
  }, [printerParams]);

  // Copy summary to clipboard
  const handleCopySummary = () => {
    let summary = '';
    if (activeTab === 'subnet') {
      summary = `[NKB ITMS - Static IP & Subnetting Allocation Plan]
Base Network: ${subnetResults.network}/${subnetParams.cidr}
Subnet Mask: ${subnetResults.mask} (Wildcard: ${subnetResults.wildcard})
Usable Range: ${subnetResults.firstUsable} - ${subnetResults.lastUsable} (${subnetResults.usableHosts} Usable Hosts)
Default Gateway: ${subnetResults.gatewayIp}
DNS Servers: ${subnetParams.dns1}, ${subnetParams.dns2}

--- SEGMENTED STATIC IP RANGES ---
• Network Infra (${subnetParams.infraCount} units): ${subnetResults.ranges.infra.start} - ${subnetResults.ranges.infra.end}
• Network Printers (${subnetParams.printerCount} units): ${subnetResults.ranges.printer.start} - ${subnetResults.ranges.printer.end}
• CCTV Surveillance (${subnetParams.cctvCount} units): ${subnetResults.ranges.cctv.start} - ${subnetResults.ranges.cctv.end}
• Workstation PCs (${subnetParams.pcCount} units): ${subnetResults.ranges.pc.start} - ${subnetResults.ranges.pc.end}
• Laptops / Mobile DHCP (${subnetParams.laptopCount} units): ${subnetResults.ranges.laptop.start} - ${subnetResults.ranges.laptop.end}
• Free / Unallocated IPs: ${subnetResults.ranges.free.count} IPs (${subnetResults.ranges.free.start} - ${subnetResults.ranges.free.end})
Subnet Utilization: ${subnetResults.utilizationPercent}% (${subnetResults.totalAllocatedSize} / ${subnetResults.usableHosts} hosts)`;
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

    copyText(summary, 'global');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gold-500/20 text-gold-400 rounded-xl border border-gold-500/30">
              <Network className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Static IP & Subnetting Calculator</h1>
              <p className="text-slate-400 text-xs mt-0.5">
                Subnet partitioning, CIDR sizing, and static IP address allocation planner for CCTV, PC, Laptop, and Printer devices.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handleCopySummary}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Summary!' : 'Copy Summary'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-gold-600/20 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Tabs Selection Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 bg-slate-200/70 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-300/60 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('subnet')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'subnet'
              ? 'bg-white dark:bg-slate-900 text-gold-600 dark:text-gold-400 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Static IP & Subnetting</span>
        </button>

        <button
          onClick={() => setActiveTab('cctv')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'cctv'
              ? 'bg-white dark:bg-slate-900 text-gold-600 dark:text-gold-400 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>CCTV Storage</span>
        </button>

        <button
          onClick={() => setActiveTab('pc')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pc'
              ? 'bg-white dark:bg-slate-900 text-gold-600 dark:text-gold-400 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>PC Power & UPS</span>
        </button>

        <button
          onClick={() => setActiveTab('laptop')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'laptop'
              ? 'bg-white dark:bg-slate-900 text-gold-600 dark:text-gold-400 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>Laptop & Battery</span>
        </button>

        <button
          onClick={() => setActiveTab('printer')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'printer'
              ? 'bg-white dark:bg-slate-900 text-gold-600 dark:text-gold-400 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Printer Cost-Per-Page</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 0: STATIC IP & SUBNETTING CALCULATOR (PRIMARY FEATURE)
          ===================================================================== */}
      {activeTab === 'subnet' && (
        <div className="space-y-6">
          {/* Top Configuration & Overview Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Network Parameters Form */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-gold-500" />
                  <h2 className="font-bold text-slate-800 dark:text-white text-base">Network Base & Device Counts</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSubnetParams({
                    baseIp: '192.168.1.0',
                    cidr: 24,
                    gatewayMode: 'first',
                    dns1: '8.8.8.8',
                    dns2: '1.1.1.1',
                    infraCount: 5,
                    printerCount: 8,
                    cctvCount: 16,
                    pcCount: 45,
                    laptopCount: 60,
                    bufferPercent: 15
                  })}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Quick Network Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Base Subnet Templates:</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '192.168.1.0/24 (Standard Office /24)', ip: '192.168.1.0', cidr: 24 },
                    { label: '192.168.10.0/24 (Production Plant /24)', ip: '192.168.10.0', cidr: 24 },
                    { label: '10.0.0.0/23 (Medium Enterprise /23)', ip: '10.0.0.0', cidr: 23 },
                    { label: '172.16.0.0/22 (Large Campus /22)', ip: '172.16.0.0', cidr: 22 }
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSubnetParams(prev => ({ ...prev, baseIp: p.ip, cidr: p.cidr }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                        subnetParams.baseIp === p.ip && subnetParams.cidr === p.cidr
                          ? 'bg-gold-500/20 text-gold-700 dark:text-gold-300 border-gold-500 font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Base IP Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Network Address / Host IP:
                  </label>
                  <input
                    type="text"
                    value={subnetParams.baseIp}
                    onChange={e => setSubnetParams({ ...subnetParams, baseIp: e.target.value.trim() })}
                    placeholder="e.g. 192.168.1.0"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-mono font-medium focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                {/* CIDR Prefix */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subnet Mask / CIDR:
                  </label>
                  <select
                    value={subnetParams.cidr}
                    onChange={e => setSubnetParams({ ...subnetParams, cidr: parseInt(e.target.value, 10) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-gold-500"
                  >
                    <option value="16">/16 — 255.255.0.0 (65,534 Hosts)</option>
                    <option value="20">/20 — 255.255.240.0 (4,094 Hosts)</option>
                    <option value="22">/22 — 255.255.252.0 (1,022 Hosts)</option>
                    <option value="23">/23 — 255.255.254.0 (510 Hosts)</option>
                    <option value="24">/24 — 255.255.255.0 (254 Hosts - Standard)</option>
                    <option value="25">/25 — 255.255.255.128 (126 Hosts)</option>
                    <option value="26">/26 — 255.255.255.192 (62 Hosts)</option>
                    <option value="27">/27 — 255.255.255.224 (30 Hosts)</option>
                    <option value="28">/28 — 255.255.255.240 (14 Hosts)</option>
                    <option value="29">/29 — 255.255.255.248 (6 Hosts)</option>
                  </select>
                </div>

                {/* Gateway Position */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Gateway IP Position:
                  </label>
                  <select
                    value={subnetParams.gatewayMode}
                    onChange={e => setSubnetParams({ ...subnetParams, gatewayMode: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                  >
                    <option value="first">First Usable IP (e.g. .1 - Industry Standard)</option>
                    <option value="last">Last Usable IP (e.g. .254)</option>
                  </select>
                </div>

                {/* Growth Headroom Buffer */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Spare Buffer Headroom: <span className="font-bold text-gold-600 dark:text-gold-400">+{subnetParams.bufferPercent}%</span>
                  </label>
                  <select
                    value={subnetParams.bufferPercent}
                    onChange={e => setSubnetParams({ ...subnetParams, bufferPercent: parseInt(e.target.value, 10) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                  >
                    <option value="0">0% (Exact allocation, no spare spacing)</option>
                    <option value="15">+15% (Recommended spacing)</option>
                    <option value="25">+25% (Room for future expansion)</option>
                    <option value="50">+50% (High-growth infrastructure)</option>
                  </select>
                </div>
              </div>

              {/* Device Sizing Inputs (CCTV, PC, Laptop, Printer) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Device Capacity Requirements
                  </h3>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Total: {subnetResults.totalRequestedDevices} Devices ({subnetResults.totalAllocatedSize} IPs with buffer)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* CCTV */}
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                    <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 text-xs font-bold mb-1">
                      <Video className="w-3.5 h-3.5" />
                      <span>CCTV / NVR</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={subnetParams.cctvCount}
                      onChange={e => setSubnetParams({ ...subnetParams, cctvCount: parseInt(e.target.value, 10) || 0 })}
                      className="w-full p-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-sm font-bold font-mono"
                    />
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 block">Static IP Cameras</span>
                  </div>

                  {/* Desktop PC */}
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                    <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-400 text-xs font-bold mb-1">
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Desktop PC</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={subnetParams.pcCount}
                      onChange={e => setSubnetParams({ ...subnetParams, pcCount: parseInt(e.target.value, 10) || 0 })}
                      className="w-full p-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-sm font-bold font-mono"
                    />
                    <span className="text-[10px] text-blue-700 dark:text-blue-400 mt-1 block">Fixed Workstations</span>
                  </div>

                  {/* Laptops */}
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                    <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400 text-xs font-bold mb-1">
                      <Laptop className="w-3.5 h-3.5" />
                      <span>Laptops (DHCP)</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={subnetParams.laptopCount}
                      onChange={e => setSubnetParams({ ...subnetParams, laptopCount: parseInt(e.target.value, 10) || 0 })}
                      className="w-full p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-sm font-bold font-mono"
                    />
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 block">Mobile & Wi-Fi Pool</span>
                  </div>

                  {/* Printers */}
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50">
                    <div className="flex items-center gap-1.5 text-purple-800 dark:text-purple-400 text-xs font-bold mb-1">
                      <Printer className="w-3.5 h-3.5" />
                      <span>Printers / MFPs</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={subnetParams.printerCount}
                      onChange={e => setSubnetParams({ ...subnetParams, printerCount: parseInt(e.target.value, 10) || 0 })}
                      className="w-full p-1.5 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-sm font-bold font-mono"
                    />
                    <span className="text-[10px] text-purple-700 dark:text-purple-400 mt-1 block">Static Network Printers</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Subnet Diagnostics Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-5">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Subnet Calculation Metrics</span>
                  <span className="bg-gold-500/20 text-gold-300 border border-gold-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                    /{subnetParams.cidr}
                  </span>
                </div>

                {/* Subnet Big Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] text-slate-400 block">Usable Host Capacity</span>
                    <div className="text-2xl font-black text-white mt-1">
                      {subnetResults.usableHosts} <span className="text-xs font-bold text-gold-400">IPs</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Total: {subnetResults.totalHosts} (inc. Net/Bcast)</span>
                  </div>

                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] text-slate-400 block">Subnet Utilization</span>
                    <div className={`text-2xl font-black mt-1 ${subnetResults.isOverCapacity ? 'text-rose-500' : 'text-emerald-400'}`}>
                      {subnetResults.utilizationPercent}%
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {subnetResults.totalAllocatedSize} / {subnetResults.usableHosts} Allocated
                    </span>
                  </div>
                </div>

                {/* Warning if over capacity */}
                {subnetResults.isOverCapacity && (
                  <div className="bg-rose-950/60 border border-rose-600/60 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Subnet Overflow!</strong>
                      The total requested device allocation ({subnetResults.totalAllocatedSize} IPs) exceeds the usable hosts ({subnetResults.usableHosts} IPs) in /{subnetParams.cidr}. Expand to /{subnetParams.cidr - 1} or reduce buffer.
                    </div>
                  </div>
                )}

                {/* Technical Specifications */}
                <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800/80 pt-3 font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-sans">Network ID:</span>
                    <span className="font-bold text-white">{subnetResults.network}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-sans">Subnet Mask:</span>
                    <span className="font-bold text-gold-400">{subnetResults.mask}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-sans">Default Gateway:</span>
                    <span className="font-bold text-emerald-400">{subnetResults.gatewayIp}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-sans">Broadcast IP:</span>
                    <span className="text-slate-300">{subnetResults.broadcast}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-sans">Usable IP Range:</span>
                    <span className="font-semibold text-white">{subnetResults.firstUsable} - {subnetResults.lastUsable}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-sans">Wildcard Mask:</span>
                    <span className="text-slate-400">{subnetResults.wildcard}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual IP Allocation Spectrum Bar */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-gold-500" />
                  <span>Subnet Partitioning & Static IP Spectrum</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Visual partition of static IP blocks allocated for CCTV, PC, Laptop, Printer, and Infrastructure.
                </p>
              </div>

              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Total Usable Range: <span className="font-mono font-bold text-gold-600 dark:text-gold-400">{subnetResults.firstUsable}</span> to <span className="font-mono font-bold text-gold-600 dark:text-gold-400">{subnetResults.lastUsable}</span>
              </div>
            </div>

            {/* Segmented Progress Bar */}
            <div className="h-6 w-full rounded-xl overflow-hidden flex bg-slate-200 dark:bg-slate-700 p-0.5 gap-0.5 shadow-inner">
              {/* Infra */}
              <div 
                style={{ width: `${Math.max(2, (subnetResults.ranges.infra.count / subnetResults.usableHosts) * 100)}%` }}
                className="bg-slate-800 dark:bg-slate-950 text-white text-[10px] font-bold flex items-center justify-center truncate px-1"
                title={`Infra: ${subnetResults.ranges.infra.start} - ${subnetResults.ranges.infra.end} (${subnetResults.ranges.infra.count} IPs)`}
              >
                GW/Infra
              </div>

              {/* Printers */}
              <div 
                style={{ width: `${Math.max(2, (subnetResults.ranges.printer.count / subnetResults.usableHosts) * 100)}%` }}
                className="bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center truncate px-1"
                title={`Printers: ${subnetResults.ranges.printer.start} - ${subnetResults.ranges.printer.end} (${subnetResults.ranges.printer.count} IPs)`}
              >
                Printers
              </div>

              {/* CCTV */}
              <div 
                style={{ width: `${Math.max(2, (subnetResults.ranges.cctv.count / subnetResults.usableHosts) * 100)}%` }}
                className="bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center truncate px-1"
                title={`CCTV: ${subnetResults.ranges.cctv.start} - ${subnetResults.ranges.cctv.end} (${subnetResults.ranges.cctv.count} IPs)`}
              >
                CCTV
              </div>

              {/* Desktop PC */}
              <div 
                style={{ width: `${Math.max(2, (subnetResults.ranges.pc.count / subnetResults.usableHosts) * 100)}%` }}
                className="bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center truncate px-1"
                title={`PCs: ${subnetResults.ranges.pc.start} - ${subnetResults.ranges.pc.end} (${subnetResults.ranges.pc.count} IPs)`}
              >
                Desktop PCs
              </div>

              {/* Laptops */}
              <div 
                style={{ width: `${Math.max(2, (subnetResults.ranges.laptop.count / subnetResults.usableHosts) * 100)}%` }}
                className="bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center truncate px-1"
                title={`Laptops DHCP: ${subnetResults.ranges.laptop.start} - ${subnetResults.ranges.laptop.end} (${subnetResults.ranges.laptop.count} IPs)`}
              >
                Laptop DHCP
              </div>

              {/* Free */}
              {subnetResults.ranges.free.count > 0 && (
                <div 
                  style={{ width: `${(subnetResults.ranges.free.count / subnetResults.usableHosts) * 100}%` }}
                  className="bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-[10px] font-medium flex items-center justify-center truncate px-1"
                  title={`Free Pool: ${subnetResults.ranges.free.start} - ${subnetResults.ranges.free.end} (${subnetResults.ranges.free.count} IPs)`}
                >
                  Free ({subnetResults.ranges.free.count})
                </div>
              )}
            </div>

            {/* Range Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              {/* Infra */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Server className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Gateway & Infra</span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {subnetResults.ranges.infra.start} - {subnetResults.ranges.infra.end}
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>Capacity: {subnetResults.ranges.infra.count} IPs</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{subnetResults.ranges.infra.active} active</span>
                </div>
              </div>

              {/* Printers */}
              <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/20 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
                  <Printer className="w-3.5 h-3.5" />
                  <span>Static Printers</span>
                </div>
                <div className="text-xs font-mono font-bold text-purple-900 dark:text-purple-200">
                  {subnetResults.ranges.printer.start} - {subnetResults.ranges.printer.end}
                </div>
                <div className="text-[10px] text-purple-600 dark:text-purple-400 flex justify-between">
                  <span>Capacity: {subnetResults.ranges.printer.count} IPs</span>
                  <span className="font-semibold">{subnetResults.ranges.printer.active} active</span>
                </div>
              </div>

              {/* CCTV */}
              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <Video className="w-3.5 h-3.5" />
                  <span>CCTV & Surveillance</span>
                </div>
                <div className="text-xs font-mono font-bold text-amber-900 dark:text-amber-200">
                  {subnetResults.ranges.cctv.start} - {subnetResults.ranges.cctv.end}
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400 flex justify-between">
                  <span>Capacity: {subnetResults.ranges.cctv.count} IPs</span>
                  <span className="font-semibold">{subnetResults.ranges.cctv.active} active</span>
                </div>
              </div>

              {/* Desktop PCs */}
              <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Workstation PCs</span>
                </div>
                <div className="text-xs font-mono font-bold text-blue-900 dark:text-blue-200">
                  {subnetResults.ranges.pc.start} - {subnetResults.ranges.pc.end}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 flex justify-between">
                  <span>Capacity: {subnetResults.ranges.pc.count} IPs</span>
                  <span className="font-semibold">{subnetResults.ranges.pc.active} active</span>
                </div>
              </div>

              {/* Laptops */}
              <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Laptops & Wi-Fi DHCP</span>
                </div>
                <div className="text-xs font-mono font-bold text-emerald-900 dark:text-emerald-200">
                  {subnetResults.ranges.laptop.start} - {subnetResults.ranges.laptop.end}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex justify-between">
                  <span>Capacity: {subnetResults.ranges.laptop.count} IPs</span>
                  <span className="font-semibold">{subnetResults.ranges.laptop.active} active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Device Command Generator (Windows netsh / Linux / Web) */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-gold-500" />
                <h3 className="font-bold text-slate-800 dark:text-white text-base">Device Static IP Configuration Generator</h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                1-click copy for Windows cmd, PowerShell, and Network Cards
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Device Target:</label>
                <select
                  value={selectedGeneratorDevice}
                  onChange={e => {
                    setSelectedGeneratorDevice(e.target.value);
                    const dev = subnetResults.generatedIps.find(x => x.id === e.target.value);
                    if (dev) setCustomHostName(dev.hostname);
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                >
                  <optgroup label="CCTV Surveillance">
                    {subnetResults.generatedIps.filter(x => x.category === 'cctv').map(x => (
                      <option key={x.id} value={x.id}>{x.hostname} ({x.ip})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Desktop PCs">
                    {subnetResults.generatedIps.filter(x => x.category === 'pc').map(x => (
                      <option key={x.id} value={x.id}>{x.hostname} ({x.ip})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Network Printers">
                    {subnetResults.generatedIps.filter(x => x.category === 'printer').map(x => (
                      <option key={x.id} value={x.id}>{x.hostname} ({x.ip})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Laptops">
                    {subnetResults.generatedIps.filter(x => x.category === 'laptop').map(x => (
                      <option key={x.id} value={x.id}>{x.hostname} ({x.ip})</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Hostname / Asset Label:</label>
                <input
                  type="text"
                  value={customHostName}
                  onChange={e => setCustomHostName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-mono font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Static IP:</label>
                <div className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-mono font-bold text-gold-600 dark:text-gold-400">
                  {activeDeviceRow.ip}
                </div>
              </div>
            </div>

            {/* Terminal Command Output Box */}
            <div className="space-y-3">
              <div className="bg-slate-950 text-slate-200 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                  <span className="flex items-center gap-1.5 font-bold text-gold-400">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Windows Netsh Static IP Command (Admin CMD):</span>
                  </span>
                  <button
                    onClick={() => copyText(
                      `netsh interface ip set address name="Ethernet" static ${activeDeviceRow.ip} ${subnetResults.mask} ${subnetResults.gatewayIp}\nnetsh interface ip set dns name="Ethernet" static ${subnetParams.dns1}\nnetsh interface ip add dns name="Ethernet" ${subnetParams.dns2} index=2`,
                      'cmd'
                    )}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-gold-400 transition"
                  >
                    {copiedKey === 'cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'cmd' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-emerald-400 select-all">
                  netsh interface ip set address name="Ethernet" static {activeDeviceRow.ip} {subnetResults.mask} {subnetResults.gatewayIp}
                </div>
                <div className="text-emerald-400 select-all">
                  netsh interface ip set dns name="Ethernet" static {subnetParams.dns1}
                </div>
                <div className="text-emerald-400 select-all">
                  netsh interface ip add dns name="Ethernet" {subnetParams.dns2} index=2
                </div>
              </div>

              {/* Parameters Summary for Device Web GUI (Cameras & Printers) */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">DEVICE IP:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{activeDeviceRow.ip}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SUBNET MASK:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{subnetResults.mask}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">GATEWAY:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{subnetResults.gatewayIp}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">PRIMARY DNS:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{subnetParams.dns1}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SECONDARY DNS:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{subnetParams.dns2}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Static IP Assignment Table */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                  <ListFilter className="w-5 h-5 text-gold-500" />
                  <span>Device Static IP Address Table</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete IP mapping for CCTV cameras, workstations, printers, and network nodes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download IP Plan (.CSV)</span>
                </button>
              </div>
            </div>

            {/* Filter buttons & Search */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All Devices' },
                  { id: 'cctv', label: 'CCTV / NVR' },
                  { id: 'pc', label: 'Desktop PCs' },
                  { id: 'printer', label: 'Printers' },
                  { id: 'laptop', label: 'Laptops' },
                  { id: 'infra', label: 'Infrastructure' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setIpTableFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      ipTableFilter === tab.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search IP, Hostname, Role..."
                  value={ipTableSearch}
                  onChange={e => setIpTableSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-semibold">
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Device Hostname</th>
                    <th className="py-2.5 px-3">Device Type</th>
                    <th className="py-2.5 px-3">Assignment Type</th>
                    <th className="py-2.5 px-3">Role / Location</th>
                    <th className="py-2.5 px-3 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono">
                  {filteredIpTable.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                      <td className="py-2.5 px-3 font-bold text-gold-600 dark:text-gold-400">
                        {row.ip}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {row.hostname}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.category === 'cctv' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                          row.category === 'pc' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                          row.category === 'printer' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300' :
                          row.category === 'laptop' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                          'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                        }`}>
                          {row.category === 'cctv' && <Video className="w-3 h-3" />}
                          {row.category === 'pc' && <Monitor className="w-3 h-3" />}
                          {row.category === 'printer' && <Printer className="w-3 h-3" />}
                          {row.category === 'laptop' && <Laptop className="w-3 h-3" />}
                          {row.category === 'infra' && <Server className="w-3 h-3" />}
                          <span>{row.categoryLabel}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-sans">
                        {row.assignmentType}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-sans">
                        {row.role}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => copyText(row.ip, row.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-[11px] font-sans font-medium transition cursor-pointer"
                        >
                          {copiedKey === row.id ? 'Copied!' : 'Copy IP'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 1: CCTV HARDWARE SIZING
          ===================================================================== */}
      {activeTab === 'cctv' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Configuration Form */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-gold-500" />
                <h2 className="font-bold text-slate-800 dark:text-white text-base">CCTV Sizing & Storage Parameters</h2>
              </div>
              <button
                type="button"
                onClick={() => setCctvParams({
                  cameras: 16, resolution: '1080p', codec: 'h265', fps: 20, activity: 'medium',
                  hoursPerDay: 24, retentionDays: 30, includeAudio: false, raidType: 'raid5', hddCostPerTb: 1850
                })}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Deployment Templates:</label>
              <div className="flex flex-wrap gap-2">
                {cctvPresets.map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setCctvParams(prev => ({ ...prev, ...preset }))}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Camera Count: <span className="font-bold text-gold-600 dark:text-gold-400">{cctvParams.cameras} Channels</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="128"
                  value={cctvParams.cameras}
                  onChange={e => setCctvParams({ ...cctvParams, cameras: parseInt(e.target.value) || 1 })}
                  className="w-full accent-gold-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Resolution:</label>
                <select
                  value={cctvParams.resolution}
                  onChange={e => setCctvParams({ ...cctvParams, resolution: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                >
                  <option value="720p">720p HD (1.0 MP)</option>
                  <option value="1080p">1080p Full HD (2.0 MP)</option>
                  <option value="3mp">3.0 Megapixel (2048x1536)</option>
                  <option value="4mp">4.0 Megapixel / 2K QHD (2560x1440)</option>
                  <option value="5mp">5.0 Megapixel Super HD</option>
                  <option value="4k">4K Ultra HD (8.0 MP / 3840x2160)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Compression Codec:</label>
                <select
                  value={cctvParams.codec}
                  onChange={e => setCctvParams({ ...cctvParams, codec: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                >
                  <option value="h264">H.264 (Standard)</option>
                  <option value="h264plus">H.264+ (25% Savings)</option>
                  <option value="h265">H.265 (Recommended / 50% Savings)</option>
                  <option value="h265plus">H.265+ (Smart H.265 / 65% Savings)</option>
                  <option value="ai_smart">AI Smart Codec (75% Savings)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Retention Period: <span className="font-bold text-gold-600 dark:text-gold-400">{cctvParams.retentionDays} Days</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={cctvParams.retentionDays}
                  onChange={e => setCctvParams({ ...cctvParams, retentionDays: parseInt(e.target.value) || 1 })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* Right Results Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Storage & Hardware Requirements</span>
                <span className="bg-gold-500/20 text-gold-300 border border-gold-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {cctvParams.cameras} Channels
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block">Usable Storage Needed</span>
                  <div className="text-2xl font-black text-white mt-1">
                    {formatNumber(cctvResults.usableStorageTb, 2)} <span className="text-xs font-bold text-gold-400">TB</span>
                  </div>
                </div>

                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block">Network Bandwidth</span>
                  <div className="text-2xl font-black text-gold-400 mt-1">
                    {formatNumber(cctvResults.totalBandwidthMbps, 1)} <span className="text-xs font-bold text-white">Mbps</span>
                  </div>
                </div>
              </div>

              <div className="bg-gold-950/40 border border-gold-600/40 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-gold-400 font-bold text-xs uppercase tracking-wide">
                  <HardDrive className="w-4 h-4" />
                  <span>Recommended Storage Setup</span>
                </div>
                <div className="text-sm font-extrabold text-white">
                  {cctvResults.recommendedDrivesCount}x {cctvResults.driveSize}TB Surveillance Hard Drives
                </div>
                <div className="text-xs text-slate-300 flex justify-between">
                  <span>Est. HDD Budget:</span>
                  <span className="font-bold text-gold-400">{formatCurrency(cctvResults.estimatedHddCost)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: PC POWER & SIZING
          ===================================================================== */}
      {activeTab === 'pc' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-gold-500" />
                <h2 className="font-bold text-slate-800 dark:text-white text-base">Desktop Workstation Configuration</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fleet Quantity: <span className="font-bold text-gold-600 dark:text-gold-400">{pcParams.quantity} PCs</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={pcParams.quantity}
                  onChange={e => setPcParams({ ...pcParams, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  PC Average Load: <span className="font-bold text-slate-900 dark:text-white">{pcParams.unitDrawWatts} W</span>
                </label>
                <input
                  type="number"
                  min="20"
                  max="1500"
                  value={pcParams.unitDrawWatts}
                  onChange={e => setPcParams({ ...pcParams, unitDrawWatts: parseInt(e.target.value) || 50 })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Power, UPS & Cost Analysis</span>
                <span className="bg-gold-500/20 text-gold-300 border border-gold-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {pcParams.quantity} Desktop Fleet
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block">Fleet Active Power</span>
                  <div className="text-2xl font-black text-white mt-1">
                    {formatNumber(pcResults.fleetActiveKw, 2)} <span className="text-xs font-bold text-gold-400">kW</span>
                  </div>
                </div>

                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block">Monthly Electricity</span>
                  <div className="text-2xl font-black text-gold-400 mt-1">
                    {formatCurrency(pcResults.fleetMonthlyCost)}
                  </div>
                </div>
              </div>

              <div className="bg-indigo-950/40 border border-indigo-600/40 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wide">
                  <Zap className="w-4 h-4" />
                  <span>Recommended UPS per Desk</span>
                </div>
                <div className="text-base font-extrabold text-white">
                  {pcResults.recommendedUpsRating}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: LAPTOP ENERGY & BATTERY
          ===================================================================== */}
      {activeTab === 'laptop' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-gold-500" />
                <h2 className="font-bold text-slate-800 dark:text-white text-base">Laptop Fleet & Battery Configuration</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fleet Quantity: <span className="font-bold text-gold-600 dark:text-gold-400">{laptopParams.quantity} Laptops</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={laptopParams.quantity}
                  onChange={e => setLaptopParams({ ...laptopParams, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Average Power Draw: <span className="font-bold text-slate-900 dark:text-white">{laptopParams.avgWatts} Watts</span>
                </label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={laptopParams.avgWatts}
                  onChange={e => setLaptopParams({ ...laptopParams, avgWatts: parseInt(e.target.value) || 25 })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Green IT & Battery Health</span>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {laptopParams.quantity} Laptops
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block">Fleet Monthly Power</span>
                  <div className="text-2xl font-black text-white mt-1">
                    {formatCurrency(laptopResults.fleetMonthlyCost)}
                  </div>
                </div>

                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block">Savings vs Desktop</span>
                  <div className="text-2xl font-black text-emerald-400 mt-1">
                    {formatCurrency(laptopResults.fleetAnnualSavings)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: PRINTER COST-PER-PAGE
          ===================================================================== */}
      {activeTab === 'printer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-gold-500" />
                <h2 className="font-bold text-slate-800 dark:text-white text-base">Printer Cost-Per-Page (CPP) Sizing</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly B&W Pages:
                </label>
                <input
                  type="number"
                  min="0"
                  value={printerParams.monthlyMonoPages}
                  onChange={e => setPrinterParams({ ...printerParams, monthlyMonoPages: parseInt(e.target.value) || 0 })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Color Pages:
                </label>
                <input
                  type="number"
                  min="0"
                  value={printerParams.monthlyColorPages}
                  onChange={e => setPrinterParams({ ...printerParams, monthlyColorPages: parseInt(e.target.value) || 0 })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Cost-Per-Page & TCO Breakdown</span>
                <span className="bg-gold-500/20 text-gold-300 border border-gold-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {printerResults.totalPages} Pages / Month
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block">B&W Cost-Per-Page</span>
                  <div className="text-2xl font-black text-white mt-1">
                    {formatCurrency(printerResults.totalMonoCpp)}
                  </div>
                </div>

                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block">Color Cost-Per-Page</span>
                  <div className="text-2xl font-black text-gold-400 mt-1">
                    {formatCurrency(printerResults.totalColorCpp)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
