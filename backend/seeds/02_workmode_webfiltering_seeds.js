/**
 * Seed initial Enterprise Web Filtering categories, policies, and default rules.
 */
exports.seed = async function(knex) {
  // Check if categories already exist
  const existingCount = await knex('webfilter_categories').count('id as count').first();
  if (existingCount.count > 0 && existingCount.count !== '0') {
    return;
  }

  // 1. Insert 18 Default Categories
  const categories = [
    { name: 'Gambling', code: 'GAMBLING', description: 'Online gambling, casino, sabong, and sports betting', is_blocked_by_default: true },
    { name: 'Casino', code: 'CASINO', description: 'Online slot games and live casino portals', is_blocked_by_default: true },
    { name: 'Sabong', code: 'SABONG', description: 'Cockfighting & e-sabong betting portals', is_blocked_by_default: true },
    { name: 'Sports Betting', code: 'SPORTS_BETTING', description: 'Sportsbook, football, basketball betting', is_blocked_by_default: true },
    { name: 'Lottery', code: 'LOTTERY', description: 'Online lottery, 6/58, lotto draw portals', is_blocked_by_default: true },
    { name: 'Crypto Gambling', code: 'CRYPTO_GAMBLING', description: 'Bitcoin, USDT crypto casinos', is_blocked_by_default: true },
    { name: 'Adult Content', code: 'ADULT', description: 'Pornography and explicit adult content', is_blocked_by_default: false },
    { name: 'Social Media', code: 'SOCIAL_MEDIA', description: 'Facebook, TikTok, Instagram, Twitter/X', is_blocked_by_default: false },
    { name: 'Video Streaming', code: 'STREAMING', description: 'YouTube, Netflix, Twitch, Disney+', is_blocked_by_default: false },
    { name: 'Messaging', code: 'MESSAGING', description: 'Telegram, Messenger, WhatsApp, Viber', is_blocked_by_default: false },
    { name: 'Games', code: 'GAMES', description: 'Online mobile games and gaming portals', is_blocked_by_default: false },
    { name: 'Shopping', code: 'SHOPPING', description: 'Shopee, Lazada, Amazon, Zalora', is_blocked_by_default: false },
    { name: 'Entertainment', code: 'ENTERTAINMENT', description: 'Celebrity news, meme sites, anime portals', is_blocked_by_default: false },
    { name: 'Torrent & P2P', code: 'TORRENT', description: 'BitTorrent, PirateBay, P2P file sharing', is_blocked_by_default: false },
    { name: 'Proxy & VPN', code: 'PROXY_VPN', description: 'Anonymizers, free VPNs, web proxies', is_blocked_by_default: false },
    { name: 'AI Chat', code: 'AI_CHAT', description: 'ChatGPT, Claude, Gemini, Character.AI', is_blocked_by_default: false },
    { name: 'File Sharing', code: 'FILE_SHARING', description: 'MediaFire, Mega, WeTransfer, Rapidgator', is_blocked_by_default: false },
    { name: 'Custom', code: 'CUSTOM', description: 'User-defined custom filtering rules', is_blocked_by_default: false }
  ];

  await knex('webfilter_categories').insert(categories);

  // 2. Insert Default Enterprise Policy Profile
  const [policyId] = await knex('webfilter_policies').insert({
    name: 'Enterprise Work Mode Standard Policy',
    description: 'Default enterprise security policy enforcing gambling, casino, sabong, and malicious domain blocking.',
    is_work_mode_enabled: true,
    block_gambling: true,
    block_adult: false,
    block_torrent: true,
    block_social_media: false,
    block_streaming: false,
    block_messaging: false,
    block_ai_chat: false,
    hide_camera: true,
    hide_browsers: false,
    disable_screenshots: false,
    disable_usb_transfer: false,
    disable_developer_options: true,
    is_active: true
  });

  // 3. Insert Initial Blacklist Domain Wildcards
  const gamblingCat = await knex('webfilter_categories').where('code', 'GAMBLING').first();
  const catId = gamblingCat ? gamblingCat.id : null;

  const defaultBlacklist = [
    { domain: '*.bet', pattern: '*.bet', category_id: catId, match_type: 'wildcard' },
    { domain: '*.casino', pattern: '*.casino', category_id: catId, match_type: 'wildcard' },
    { domain: '*.sabong', pattern: '*.sabong', category_id: catId, match_type: 'wildcard' },
    { domain: '*.poker', pattern: '*.poker', category_id: catId, match_type: 'wildcard' },
    { domain: '*.slot', pattern: '*.slot', category_id: catId, match_type: 'wildcard' },
    { domain: 'bet88.com', pattern: 'bet88.com', category_id: catId, match_type: 'exact' },
    { domain: 'abcbet.net', pattern: 'abcbet.net', category_id: catId, match_type: 'exact' },
    { domain: 'xyzcasino.com', pattern: 'xyzcasino.com', category_id: catId, match_type: 'exact' },
    { domain: 'bingo2plus.com', pattern: 'bingo2plus.com', category_id: catId, match_type: 'exact' }
  ];

  await knex('webfilter_blacklist').insert(defaultBlacklist);

  // 4. Insert Default Whitelist Exception Rules
  const defaultWhitelist = [
    { domain: 'nkbmanufacturing.com', pattern: 'nkbmanufacturing.com', description: 'Company Enterprise Portal' },
    { domain: 'google.com', pattern: 'google.com', description: 'Google Workspace & Search' },
    { domain: 'microsoft.com', pattern: 'microsoft.com', description: 'Microsoft Office 365' },
    { domain: 'gov.ph', pattern: '*.gov.ph', description: 'Philippine Government Official Sites' },
    { domain: 'bdo.com.ph', pattern: 'bdo.com.ph', description: 'BDO Unibank Online Banking' }
  ];

  await knex('webfilter_whitelist').insert(defaultWhitelist);

  // 5. Insert Default Gambling App Blacklist
  const defaultAppBlacklist = [
    { package_name: 'com.ph.sabong.live', app_name: 'Sabong Live', category: 'Sabong', is_hidden: true, is_disabled: true },
    { package_name: 'com.bingoplus.app', app_name: 'BingoPlus', category: 'Lottery', is_hidden: true, is_disabled: true },
    { package_name: 'com.bet88.ph', app_name: 'Bet88 Casino', category: 'Gambling', is_hidden: true, is_disabled: true },
    { package_name: 'com.pokerstars.net', app_name: 'PokerStars', category: 'Poker', is_hidden: true, is_disabled: true }
  ];

  await knex('webfilter_app_blacklist').insert(defaultAppBlacklist);

  console.log('[Seed] WebFilter seed executed successfully.');
};
