const db = require('../config/db');

/**
 * Build full policy payload for MDM agent consumption
 */
async function buildDevicePolicyPayload(policyId) {
  const policy = policyId
    ? await db('webfilter_policies').where('id', policyId).first()
    : await db('webfilter_policies').where('is_active', true).first();

  if (!policy) {
    return null;
  }

  const [blacklist, whitelist, appBlacklist, categories] = await Promise.all([
    db('webfilter_blacklist').where('is_active', true).select('domain', 'pattern', 'match_type', 'category_id'),
    db('webfilter_whitelist').where('is_active', true).select('domain', 'pattern'),
    db('webfilter_app_blacklist').where('is_active', true).select('package_name', 'app_name', 'is_hidden', 'is_disabled'),
    db('webfilter_categories').select('code', 'name', 'is_blocked_by_default')
  ]);

  return {
    policyId: policy.id,
    policyName: policy.name,
    workModeEnabled: Boolean(policy.is_work_mode_enabled),
    restrictions: {
      hideCamera: Boolean(policy.hide_camera),
      hideBrowsers: Boolean(policy.hide_browsers),
      disableScreenshots: Boolean(policy.disable_screenshots),
      disableUsbTransfer: Boolean(policy.disable_usb_transfer),
      disableDeveloperOptions: Boolean(policy.disable_developer_options)
    },
    contentFilters: {
      blockGambling: Boolean(policy.block_gambling),
      blockAdult: Boolean(policy.block_adult),
      blockTorrent: Boolean(policy.block_torrent),
      blockSocialMedia: Boolean(policy.block_social_media),
      blockStreaming: Boolean(policy.block_streaming),
      blockMessaging: Boolean(policy.block_messaging),
      blockAiChat: Boolean(policy.block_ai_chat)
    },
    blacklistDomains: blacklist,
    whitelistDomains: whitelist,
    blockedApps: appBlacklist,
    categories: categories.filter(c => c.is_blocked_by_default).map(c => c.code),
    syncedAt: Date.now()
  };
}

/**
 * Apply work-mode security flags when enabling work mode
 */
function getWorkModePolicyUpdate(isEnable, currentPolicy) {
  if (!isEnable) {
    return {
      is_work_mode_enabled: false,
      updated_at: new Date()
    };
  }

  return {
    is_work_mode_enabled: true,
    hide_camera: true,
    hide_browsers: currentPolicy?.hide_browsers !== undefined ? Boolean(currentPolicy.hide_browsers) : false,
    disable_screenshots: true,
    disable_usb_transfer: true,
    block_gambling: true,
    updated_at: new Date()
  };
}

module.exports = { buildDevicePolicyPayload, getWorkModePolicyUpdate };
