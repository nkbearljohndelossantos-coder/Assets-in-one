const crypto = require('crypto');
const db = require('../config/db');

/**
 * Generate SHA-256 hash for append-only audit log chain.
 */
function calculateAuditHash(sequenceId, actionType, technicianId, deviceId, accessReason, sourceIp, previousHash, metadataJson, createdAt) {
  const payload = [
    String(sequenceId),
    String(actionType || ''),
    String(technicianId || ''),
    String(deviceId || ''),
    String(accessReason || ''),
    String(sourceIp || ''),
    String(previousHash || '0000000000000000000000000000000000000000000000000000000000000000'),
    String(metadataJson || '{}'),
    String(createdAt || '')
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Create an append-only audit record linked to the previous record's hash.
 */
async function appendAuditLog(actionType, technicianId, deviceId, accessReason, sourceIp, metadata = {}, isSimulated = true) {
  const lastRecord = await db('remote_action_audit_logs')
    .orderBy('sequence_id', 'desc')
    .first();

  const sequenceId = lastRecord ? parseInt(lastRecord.sequence_id) + 1 : 1;
  const previousHash = lastRecord ? lastRecord.hash : '0000000000000000000000000000000000000000000000000000000000000000';
  const createdAt = new Date().toISOString();
  const metadataJson = JSON.stringify(metadata);

  const hash = calculateAuditHash(sequenceId, actionType, technicianId, deviceId, accessReason, sourceIp, previousHash, metadataJson, createdAt);

  const [id] = await db('remote_action_audit_logs').insert({
    sequence_id: sequenceId,
    action_type: actionType,
    technician_id: technicianId,
    device_id: deviceId,
    access_reason: accessReason,
    source_ip: sourceIp || '127.0.0.1',
    previous_hash: previousHash,
    hash: hash,
    metadata_json: metadataJson,
    is_simulated: isSimulated,
    created_at: createdAt
  });

  return id;
}

/**
 * Verify integrity of the entire audit hash chain.
 */
async function verifyAuditChainIntegrity() {
  const records = await db('remote_action_audit_logs').orderBy('sequence_id', 'asc');
  
  if (records.length === 0) {
    return { valid: true, count: 0, message: 'Audit chain is empty and valid.' };
  }

  let expectedPreviousHash = '0000000000000000000000000000000000000000000000000000000000000000';

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    // Check previous hash link
    if (record.previous_hash !== expectedPreviousHash) {
      return {
        valid: false,
        brokenSequenceId: record.sequence_id,
        reason: `Previous hash mismatch at sequence ${record.sequence_id}. Expected ${expectedPreviousHash}, found ${record.previous_hash}`
      };
    }

    // Re-calculate record hash
    const calculatedHash = calculateAuditHash(
      record.sequence_id,
      record.action_type,
      record.technician_id,
      record.device_id,
      record.access_reason,
      record.source_ip,
      record.previous_hash,
      record.metadata_json,
      new Date(record.created_at).toISOString()
    );

    if (record.hash !== calculatedHash) {
      return {
        valid: false,
        brokenSequenceId: record.sequence_id,
        reason: `Content hash mismatch at sequence ${record.sequence_id}. Record tampered or modified.`
      };
    }

    expectedPreviousHash = record.hash;
  }

  return { valid: true, count: records.length, message: `All ${records.length} audit chain records verified successfully.` };
}

module.exports = {
  calculateAuditHash,
  appendAuditLog,
  verifyAuditChainIntegrity
};
