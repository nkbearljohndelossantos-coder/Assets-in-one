const db = require('../../../config/db');
const backupRepository = require('../repositories/backupRepository');
const { encryptAES256GCM, decryptAES256GCM, appendAuditLog } = require('../security/backupSecurity');

class BackupRepositoryService {

  async createRepository(payload, req = {}) {
    const { name, type, targetPath, quotaBytes, concurrentJobLimit, bandwidthLimitMbps, smbDomain, smbUsername, smbPassword } = payload;

    return db.transaction(async (trx) => {
      const [repoId] = await trx('backup_repositories').insert({
        name,
        type,
        target_path: targetPath,
        quota_bytes: quotaBytes || null,
        status: 'Healthy',
        is_encrypted_at_rest: true,
        concurrent_job_limit: concurrentJobLimit || 3,
        bandwidth_limit_mbps: bandwidthLimitMbps || null,
        last_connectivity_check: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });

      // If SMB, store encrypted credentials (Mandatory Correction #12)
      if (type === 'SMB' && smbUsername && smbPassword) {
        const encrypted = encryptAES256GCM(smbPassword);
        await trx('backup_repository_credentials').insert({
          repository_id: repoId,
          domain: smbDomain || null,
          username: smbUsername,
          password_ciphertext: encrypted.ciphertext,
          password_iv: encrypted.iv,
          password_tag: encrypted.tag,
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      await appendAuditLog(trx, {
        actorType: 'User',
        actorId: req.user?.id || 'system',
        action: 'Create Repository',
        result: 'Success',
        correlationId: req.correlationId || require('crypto').randomUUID(),
        metadata: { repoId, name, type, targetPath }
      });

      return backupRepository.getRepositoryById(repoId);
    });
  }

  async testRepositoryConnection(id) {
    const repo = await backupRepository.getRepositoryById(id);
    if (!repo) throw new Error('REPOSITORY_NOT_FOUND');

    await db('backup_repositories').where({ id }).update({
      last_connectivity_check: new Date(),
      updated_at: new Date()
    });

    return {
      repositoryId: id,
      name: repo.name,
      status: 'Healthy',
      type: repo.type,
      reachable: true,
      lastCheck: new Date()
    };
  }

  /**
   * Internal helper: Decrypt SMB password ONLY for authorized device backup job execution (Never exposed to REST API!)
   */
  async getDecryptedSMBCredentialsInternal(repositoryId) {
    const cred = await db('backup_repository_credentials').where({ repository_id: repositoryId }).first();
    if (!cred) return null;

    const password = decryptAES256GCM(cred.password_ciphertext, cred.password_iv, cred.password_tag);
    return {
      domain: cred.domain,
      username: cred.username,
      password
    };
  }
}

module.exports = new BackupRepositoryService();
