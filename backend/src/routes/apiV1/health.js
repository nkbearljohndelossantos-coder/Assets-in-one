const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { sendSuccess, sendError } = require('../../utils/apiResponse');

const startTime = Date.now();

/**
 * GET /api/health
 * Public health probe endpoint (for load balancers, Kubernetes, uptime checks)
 */
router.get('/', (req, res) => {
  return sendSuccess(res, {
    status: 'UP',
    service: 'NKB Centralized API Platform',
    version: '1.0.0',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/health/details
 * Detailed system diagnostic probe (Database check, system memory, metrics)
 */
router.get('/details', async (req, res) => {
  try {
    const dbStart = Date.now();
    let dbStatus = 'HEALTHY';
    let dbLatencyMs = 0;

    try {
      await db.raw('SELECT 1');
      dbLatencyMs = Date.now() - dbStart;
    } catch (dbErr) {
      dbStatus = 'UNHEALTHY';
      console.error('Health Check Database Failure:', dbErr.message);
    }

    const memoryUsage = process.memoryUsage();

    const result = {
      status: dbStatus === 'HEALTHY' ? 'UP' : 'DEGRADED',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      components: {
        database: {
          status: dbStatus,
          client: db.client.config.client,
          latencyMs: dbLatencyMs
        },
        memory: {
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024)
        }
      },
      timestamp: new Date().toISOString()
    };

    const statusCode = dbStatus === 'HEALTHY' ? 200 : 503;
    return res.status(statusCode).json({
      success: dbStatus === 'HEALTHY',
      data: result,
      meta: {
        requestId: req.requestId || 'health-check'
      }
    });
  } catch (err) {
    return sendError(res, 500, 'HEALTH_CHECK_FAILED', 'Failed to perform health check.', { error: err.message });
  }
});

module.exports = router;
