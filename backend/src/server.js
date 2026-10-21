const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const socketUtil = require('./utils/socket');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);

// 1. Initialize Socket.IO
socketUtil.init(server);
const { initBackupSocket } = require('./modules/enterprise-backup/socket/backupAgentSocket');
initBackupSocket(socketUtil.getIO());

// 2. Global Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"], // Socket.IO support
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://lh3.googleusercontent.com", "https://api.qrserver.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"]
    }
  }
}));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || origin.includes('nkbmanufacturing.com') || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-UUID', 'X-Agent-Key'],
  credentials: true
};
app.use(cors(corsOptions));

// Trust reverse proxy (Nginx) for accurate client IP identification in rate limiters
app.set('trust proxy', 1);

// 3. Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 4. Request Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log HTTP requests in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.http(`${req.method} ${req.url}`);
    next();
  });
}

// 5. Static folders serving
// Handle favicon requests gracefully to serve favicon.ico file or 204
app.get(['/favicon.ico', '/api/favicon.ico'], (req, res) => {
  const icoPath = path.resolve(__dirname, '../../client/dist/favicon.ico');
  if (fs.existsSync(icoPath)) {
    return res.sendFile(icoPath);
  }
  const publicIcoPath = path.resolve(__dirname, '../../client/public/favicon.ico');
  if (fs.existsSync(publicIcoPath)) {
    return res.sendFile(publicIcoPath);
  }
  const logoPath = path.resolve(__dirname, '../../client/dist/nkb-logo.png');
  if (fs.existsSync(logoPath)) {
    return res.sendFile(logoPath);
  }
  return res.status(204).end();
});

// Dedicated Android DPC Agent APK download route
app.get(['/uploads/NKB-ITMS-Agent.apk', '/api/uploads/NKB-ITMS-Agent.apk', '/api/mdm/download-apk'], (req, res) => {
  const apkPath = path.resolve(__dirname, '../uploads/NKB-ITMS-Agent.apk');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="NKB-ITMS-Agent.apk"');

  if (fs.existsSync(apkPath)) {
    return res.sendFile(apkPath);
  }
  const distApkPath = path.resolve(__dirname, '../../client/dist/uploads/NKB-ITMS-Agent.apk');
  if (fs.existsSync(distApkPath)) {
    return res.sendFile(distApkPath);
  }
  return res.status(404).json({ success: false, message: 'NKB ITMS Agent APK file not found.' });
});

// Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Clean SVG placeholder for missing images in uploads to prevent broken <img> boxes and console 404 errors
const fallbackAssetSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#f8fafc"/>
    <rect x="150" y="85" width="100" height="85" rx="12" fill="#e2e8f0"/>
    <path d="M175 140l15-20 20 25 15-15 15 20h-65z" fill="#94a3b8"/>
    <circle cx="178" cy="112" r="8" fill="#94a3b8"/>
    <text x="200" y="205" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#475569" text-anchor="middle">Photo Pending Upload</text>
    <text x="200" y="225" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">NKB Asset Registry</text>
  </svg>`,
  'utf-8'
);

// Fallback for missing upload files: return placeholder image for images, or 404 JSON for non-images
app.use(['/uploads', '/api/uploads', '/uploads/*', '/api/uploads/*'], (req, res) => {
  const targetUrl = req.originalUrl || req.url || req.path;
  const isImage = /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(targetUrl);
  if (isImage) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(fallbackAssetSvg);
  }
  res.status(404).json({ success: false, message: 'Requested upload file not found' });
});

// Attach request correlation ID early
const requestId = require('./middleware/requestId');
app.use(requestId);

// Interactive OpenAPI 3.0 Documentation
const { openapiSpec, serveSwaggerUI } = require('./config/swagger');
app.get('/docs/openapi.json', (req, res) => res.json(openapiSpec));
app.get('/docs', serveSwaggerUI);

// Health check probes
app.use('/api/health', require('./routes/apiV1/health'));

// 6. API Route Handlers
// PPE Domain Routes
const { ppeAssetsRouter } = require('./routes/ppe/ppeAssets');
const { ppeDashboardRouter } = require('./routes/ppe/ppeDashboard');
const { ppeReportsRouter } = require('./routes/ppe/ppeReports');
const { ppeContainersRouter } = require('./routes/ppe/ppeContainers');
const { ppeAccountingRouter } = require('./routes/ppe/ppeAccounting');
const { ppeMaintenanceRouter } = require('./routes/ppe/ppeMaintenance');

app.use('/api/ppe/assets', ppeAssetsRouter);
app.use('/api/ppe/dashboard', ppeDashboardRouter);
app.use('/api/ppe/reports', ppeReportsRouter);
app.use('/api/ppe/containers', ppeContainersRouter);
app.use('/api/ppe/accounting', ppeAccountingRouter);
app.use('/api/ppe/maintenance', ppeMaintenanceRouter);

// ITMS & Shared Platform Routes
app.use('/api/v1/documents', require('./routes/apiV1/documents'));
app.use('/api/v1/platform-assets', require('./routes/apiV1/assets'));
app.use('/api/admin/api-clients', require('./routes/apiClients'));

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/departments', require('./routes/employees'));
app.use(['/api/assets', '/api/v1/assets'], require('./routes/assets'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/repairs', require('./routes/repairs'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/licenses', require('./routes/licenses'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/reports/itops', require('./routes/reports-itops'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/backups', require('./routes/backups'));
app.use('/api/v1/backups', require('./modules/enterprise-backup/routes/enterpriseBackupRoutes'));
app.use('/api/endpoints', require('./routes/endpoints'));
app.use('/api/network', require('./routes/network'));
app.use('/api/printers', require('./routes/printers'));
app.use('/api/file-shares', require('./routes/fileShares'));
app.use('/api/guest-wifi', require('./routes/guestWifi'));
app.use('/api/websites', require('./routes/websites'));
app.use('/api/secrets', require('./routes/secrets'));
app.use('/api/remote', require('./routes/remoteManagement'));
app.use('/api/v1/agent', require('./routes/agentApi'));
app.use('/api/v1/webfilter', require('./routes/webFiltering'));
app.use('/api/mdm', require('./routes/mdm'));

// 7. Serve Static Frontend files (supporting either frontend/dist or client/dist or backend/public)
const candidateDistPaths = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../public')
];
const distPath = candidateDistPaths.find(p => fs.existsSync(p)) || candidateDistPaths[0];
app.use(express.static(distPath));

// Wildcard fallback for React Router SPA (Single Page Application)
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
    return next();
  }
  const indexPath = path.resolve(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).send('SPA index.html not found. Please run client build.');
});

// 8. Centralized Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled Exception: ${err.stack || err.message}`);
  
  const statusCode = err.status || (err.statusCode && Number(err.statusCode)) || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected error occurred on the server.',
    error: isProduction ? undefined : (err.stack || err.message)
  });
});

// 9. Startup Server
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  const db = require('./config/db');
  
  db.migrate.latest()
    .then(async () => {
      logger.info('Database migrated successfully');
      
      // Only run the seeder if the database is completely empty (no roles)
      const rolesCount = await db('roles').count('id as count').first();
      if (rolesCount.count === 0 || rolesCount.count === '0') {
        logger.info('Database is completely empty. Running initial system seeds...');
        await db.seed.run();
        logger.info('Database seeded successfully');
      } else {
        logger.info('Database already contains data. Skipping seeds to protect data.');
      }
      
      // Clean up legacy non-existent file paths to prevent broken <img> rendering
      try {
        const assets = await db('assets').select('id', 'name', 'image_path');
        for (const asset of assets) {
          if (asset.image_path && !asset.image_path.startsWith('data:') && !asset.image_path.startsWith('http') && !fs.existsSync(path.join(__dirname, '..', asset.image_path))) {
            await db('assets').where('id', asset.id).update({ image_path: null });
          }
        }
      } catch (e) {
        logger.error(`Image path cleanup error: ${e.message}`);
      }
      
      server.listen(PORT, () => {
        logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      });
    })
    .catch((err) => {
      logger.error(`Database startup sequence failed: ${err.message}`);
      // Fallback to start server anyway so frontend remains accessible
      server.listen(PORT, () => {
        logger.info(`Server started in recovery mode on port ${PORT}`);
      });
    });
}

module.exports = { app, server };
