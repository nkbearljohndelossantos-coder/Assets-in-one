const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const { decrypt, decryptGCM } = require('../utils/encryption');

class SecretsService {
  async revealSecret({ module, recordId }, req) {
    let plainSecret = null;
    let identifier = '';

    switch (module) {
      case 'GuestWifi': {
        const gw = await db('guest_wifi_accounts').where({ id: recordId }).first();
        if (!gw) throw new Error('Guest WiFi account not found.');
        
        identifier = gw.wifi_username;
        plainSecret = decryptGCM(
          gw.wifi_password_ciphertext,
          gw.wifi_password_iv,
          gw.wifi_password_tag,
          gw.wifi_password_version
        );
        break;
      }
      
      case 'Antivirus': {
        const av = await db('antivirus_tracking').where({ id: recordId }).first();
        if (!av) throw new Error('Antivirus record not found.');
        
        identifier = av.antivirus_name;
        plainSecret = decryptGCM(
          av.license_key_ciphertext,
          av.license_key_iv,
          av.license_key_tag,
          av.license_key_version
        );
        break;
      }
      
      case 'OperatingSystems': {
        const os = await db('operating_systems').where({ id: recordId }).first();
        if (!os) throw new Error('Operating System record not found.');
        
        identifier = os.edition;
        plainSecret = decryptGCM(
          os.product_key_ciphertext,
          os.product_key_iv,
          os.product_key_tag,
          os.product_key_version
        );
        break;
      }

      case 'Licenses': {
        const license = await db('software_licenses').where({ id: recordId }).first();
        if (!license) throw new Error('Software license not found.');
        
        identifier = license.software_name;
        // Check if migrated to GCM or still using old CBC
        if (license.product_key_ciphertext) {
          plainSecret = decryptGCM(
            license.product_key_ciphertext,
            license.product_key_iv,
            license.product_key_tag,
            license.product_key_version
          );
        } else {
          plainSecret = decrypt(license.product_key_encrypted);
        }
        break;
      }

      default:
        throw new Error('Unsupported module for secret reveal.');
    }

    if (!plainSecret || plainSecret === '*** DECRYPTION ERROR ***') {
      throw new Error('Failed to decrypt the secret or secret is empty.');
    }

    // High Severity Audit Log
    await logAudit(req, { 
      action: 'Reveal Secret', 
      module: module, 
      recordId: recordId, 
      newValues: { revealed_identifier: identifier, note: 'User explicitly decrypted and viewed the secret.' } 
    });

    return plainSecret;
  }
}

module.exports = new SecretsService();
