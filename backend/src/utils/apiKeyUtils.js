const crypto = require('crypto');

const API_KEY_PEPPER = process.env.API_KEY_PEPPER || 'nkb_api_platform_secret_pepper_2026';

/**
 * Hash raw API Key using SHA-256 and secret pepper
 */
function hashApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return '';
  return crypto.createHash('sha256').update(rawKey.trim() + API_KEY_PEPPER).digest('hex');
}

/**
 * Generate a new secure API Key with prefix and SHA-256 hash
 * Format: nkb_live_xxxxxxxxxxxxxxxxxxxxxxxxx
 */
function generateApiKey(customPrefix = 'nkb_live_') {
  const randomHex = crypto.randomBytes(18).toString('hex');
  const rawKey = `${customPrefix}${randomHex}`;
  const maskedKey = maskApiKey(rawKey);
  const hash = hashApiKey(rawKey);

  return {
    rawKey,
    keyPrefix: customPrefix,
    prefix: `nkb_live_${randomHex.substring(0, 4)}...${randomHex.substring(randomHex.length - 4)}`,
    maskedKey,
    hash
  };
}

/**
 * Create a display mask for API Key (e.g. nkb_live_**************7X92)
 */
function maskApiKey(keyOrPrefix) {
  if (!keyOrPrefix) return 'nkb_live_**************';
  if (keyOrPrefix.includes('...')) {
    const parts = keyOrPrefix.split('...');
    return `${parts[0]}**************${parts[1] || ''}`;
  }
  if (keyOrPrefix.length > 12) {
    const prefix = keyOrPrefix.startsWith('nkb_live_') ? 'nkb_live_' : keyOrPrefix.substring(0, 8);
    const suffix = keyOrPrefix.substring(keyOrPrefix.length - 4);
    return `${prefix}**************${suffix}`;
  }
  return 'nkb_live_**************';
}

module.exports = {
  hashApiKey,
  generateApiKey,
  maskApiKey
};
