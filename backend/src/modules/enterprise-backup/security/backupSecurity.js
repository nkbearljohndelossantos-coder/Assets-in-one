const crypto = require('crypto');
const db = require('../../../config/db');

// Master Server KEK for wrapping DEKs and SMB passwords (32 bytes)
const SERVER_MASTER_KEK = Buffer.from(
  (process.env.BACKUP_MASTER_KEY || 'nkb_enterprise_backup_master_key_2026_32bytes!').slice(0, 32),
  'utf-8'
);

/**
 * Encrypt a string/buffer payload with AES-256-GCM
 */
function encryptAES256GCM(plainText, key = SERVER_MASTER_KEK) {
  const iv = crypto.randomBytes(12); // 96-bit nonce
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

/**
 * Decrypt AES-256-GCM ciphertext
 */
function decryptAES256GCM(ciphertextBase64, ivBase64, tagBase64, key = SERVER_MASTER_KEK) {
  const iv = Buffer.from(ivBase64, 'base64');
  const tag = Buffer.from(tagBase64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, 'base64')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Create a random 256-bit Data Encryption Key (DEK)
 */
function generateDEK() {
  return crypto.randomBytes(32);
}

/**
 * Calculate SHA-256 hex checksum
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Append an immutable, cryptographic hash-chained audit event (Mandatory Correction #14)
 */
async function appendAuditLog(trxOrDb, { actorType, actorId, deviceId, action, result, correlationId, metadata }) {
  const knexClient = trxOrDb || db;

  // Get last audit event sequence & record_hash
  const lastEvent = await knexClient('backup_audit_events')
    .orderBy('sequence_number', 'desc')
    .first();

  const sequenceNumber = lastEvent ? BigInt(lastEvent.sequence_number) + 1n : 1n;
  const previousHash = lastEvent ? lastEvent.record_hash : '0000000000000000000000000000000000000000000000000000000000000000';

  const timestamp = new Date().toISOString();
  const metadataStr = metadata ? JSON.stringify(metadata) : '{}';

  // Build string to hash
  const payloadToHash = `${sequenceNumber}:${previousHash}:${actorType}:${actorId}:${deviceId || ''}:${action}:${result}:${correlationId}:${timestamp}:${metadataStr}`;
  const recordHash = sha256(payloadToHash);

  const [id] = await knexClient('backup_audit_events').insert({
    sequence_number: sequenceNumber.toString(),
    previous_hash: previousHash,
    record_hash: recordHash,
    actor_type: actorType,
    actor_id: String(actorId),
    device_id: deviceId || null,
    action,
    result,
    correlation_id: correlationId || crypto.randomUUID(),
    event_timestamp: timestamp,
    metadata_json: metadataStr
  });

  return { id, sequenceNumber: sequenceNumber.toString(), recordHash };
}

module.exports = {
  encryptAES256GCM,
  decryptAES256GCM,
  generateDEK,
  sha256,
  appendAuditLog
};
