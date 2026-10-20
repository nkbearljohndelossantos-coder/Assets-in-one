const MeshCentralProvider = require('./MeshCentralProvider');
const SimulationProvider = require('./SimulationProvider');
const db = require('../../config/db');
const logger = require('../../utils/logger');

/**
 * Factory for Remote Management Providers.
 * Mode is strictly dictated by environment configuration (process.env.REMOTE_MGMT_MODE).
 */
class RemoteProviderFactory {
  static async getProvider() {
    const envMode = (process.env.REMOTE_MGMT_MODE || 'production').toLowerCase();

    if (envMode === 'production') {
      const serverUrl = process.env.MESHCENTRAL_SERVER_URL || 'https://192.168.254.139';
      const apiUser = process.env.MESHCENTRAL_API_USER || 'itms_admin';
      const apiTokenHash = process.env.MESHCENTRAL_API_TOKEN_HASH || 'production_token_hash';

      logger.info(`[RemoteProviderFactory] Initializing MeshCentralProvider for server: ${serverUrl}`);
      return new MeshCentralProvider(serverUrl, apiUser, apiTokenHash);
    }

    logger.info('[RemoteProviderFactory] Environment set to SIMULATION. Initializing isolated SimulationProvider.');
    return new SimulationProvider();
  }

  static getEffectiveMode() {
    return (process.env.REMOTE_MGMT_MODE || 'production').toLowerCase();
  }
}

module.exports = RemoteProviderFactory;
