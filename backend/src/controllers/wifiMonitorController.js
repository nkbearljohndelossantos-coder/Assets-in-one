const wifiMonitorService = require('../services/wifiMonitorService');
const { z } = require('zod');

// Schema for registering/updating trusted devices
const trustedDeviceSchema = z.object({
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
  deviceName: z.string().min(1, 'Device name is required').max(255),
  ownerName: z.string().max(255).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  deviceType: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable()
});

// Schema for block/unblock actions
const accessControlSchema = z.object({
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
  ipAddress: z.string().optional().nullable(),
  routerId: z.number().int().positive().optional().nullable(),
  reason: z.string().max(500).optional().nullable()
});

// Schema for telemetry ingestion
const telemetrySchema = z.object({
  source: z.string().min(1).max(100),
  timestamp: z.union([z.number(), z.string()]).optional(),
  devices: z.array(z.object({
    mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
    ip: z.string().optional().nullable(),
    hostname: z.string().max(255).optional().nullable(),
    connectionType: z.enum(['Wi-Fi', 'Wired', 'LAN (ARP Observed)', 'Unknown']).optional().default('Unknown'),
    ssid: z.string().max(100).optional().nullable(),
    signalStrength: z.string().max(50).optional().nullable()
  }))
});

class WifiMonitorController {
  async getOverview(req, res, next) {
    try {
      const data = await wifiMonitorService.getOverview();
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getDevices(req, res, next) {
    try {
      const { page, limit, search, classification, status } = req.query;
      const data = await wifiMonitorService.getMonitoredDevices({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        search: search || '',
        classification: classification || 'ALL',
        status: status || 'ALL'
      });
      return res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  async getTrusted(req, res, next) {
    try {
      const { page, limit, search } = req.query;
      const data = await wifiMonitorService.getTrustedInventory({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        search: search || ''
      });
      return res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  async registerTrusted(req, res, next) {
    try {
      const validated = trustedDeviceSchema.parse(req.body);
      const result = await wifiMonitorService.registerTrustedDevice(validated, req.user);
      return res.json({ success: true, data: result, message: 'Device registered to Trusted Inventory.' });
    } catch (err) {
      next(err);
    }
  }

  async removeTrusted(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'INVALID_ID', message: 'Valid record ID required' });
      await wifiMonitorService.removeTrustedDevice(id, req.user);
      return res.json({ success: true, message: 'Device removed from Trusted Inventory.' });
    } catch (err) {
      next(err);
    }
  }

  async getRouters(req, res, next) {
    try {
      const overview = await wifiMonitorService.getOverview();
      return res.json({ success: true, data: overview.routers });
    } catch (err) {
      next(err);
    }
  }

  async blockDevice(req, res, next) {
    try {
      const validated = accessControlSchema.parse(req.body);
      const result = await wifiMonitorService.blockDevice(validated, req.user);
      if (!result.success) {
        return res.status(422).json(result);
      }
      return res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async unblockDevice(req, res, next) {
    try {
      const validated = accessControlSchema.parse(req.body);
      const result = await wifiMonitorService.unblockDevice(validated, req.user);
      if (!result.success) {
        return res.status(422).json(result);
      }
      return res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getLogs(req, res, next) {
    try {
      const { page, limit } = req.query;
      const data = await wifiMonitorService.getAccessLogs({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 25
      });
      return res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  async ingestTelemetry(req, res, next) {
    try {
      const validated = telemetrySchema.parse(req.body);
      const result = await wifiMonitorService.ingestTelemetry(validated, req.agent);
      return res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WifiMonitorController();
