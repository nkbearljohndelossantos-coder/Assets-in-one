const crypto = require('crypto');
const db = require('../config/db');

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Authenticate enrolled MDM Android devices via X-Device-Key + X-Device-Id headers
 */
async function authenticateDevice(req, res, next) {
  const deviceId = req.headers['x-device-id'];
  const apiKey = req.headers['x-device-key'];

  if (!deviceId || !apiKey) {
    return res.status(401).json({
      success: false,
      message: 'Device authentication required. Provide X-Device-Id and X-Device-Key headers.'
    });
  }

  try {
    const device = await db('mdm_enrolled_devices')
      .where({ device_id: deviceId, status: 'enrolled' })
      .first();

    if (!device) {
      return res.status(401).json({ success: false, message: 'Device not enrolled or revoked.' });
    }

    const keyHash = hashApiKey(apiKey);
    if (keyHash !== device.api_key_hash) {
      return res.status(401).json({ success: false, message: 'Invalid device API key.' });
    }

    await db('mdm_enrolled_devices')
      .where('id', device.id)
      .update({ last_seen: new Date(), is_online: true });

    req.mdmDevice = device;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Device authentication failed.' });
  }
}

module.exports = { authenticateDevice, hashApiKey };
