const crypto = require('crypto');
const logger = require('./logger');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size in bytes

// Encryption key must be exactly 32 bytes.
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY 
  ? crypto.createHash('sha256').update(process.env.DB_ENCRYPTION_KEY).digest() 
  : crypto.createHash('sha256').update('nkb_itms_secret_db_encryption_key_2026').digest();

/**
 * Encrypt a text string
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted cipher text formatted as iv_hex:encrypted_hex
 */
function encrypt(text) {
  try {
    if (!text) return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    logger.error(`Encryption error: ${err.message}`);
    throw new Error('Failed to encrypt sensitive data.');
  }
}

/**
 * Decrypt a cipher text
 * @param {string} cipherText - Encrypted string (iv_hex:encrypted_hex)
 * @returns {string} Decrypted plain text
 */
function decrypt(cipherText) {
  try {
    if (!cipherText) return '';
    const parts = cipherText.split(':');
    if (parts.length !== 2) {
      // Return plain value if it was not encrypted (handles seed/legacy data)
      return cipherText;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    logger.error(`Decryption error: ${err.message}`);
    // If decryption fails, return a masked indicator or fallback
    return '*** DECRYPTION ERROR ***';
  }
}

const ALGORITHM_GCM = 'aes-256-gcm';
const IV_LENGTH_GCM = 12; // Standard IV length for AES-GCM
const KEY_VERSION = 'v1';

const ENCRYPTION_KEY_GCM = process.env.ENCRYPTION_KEY
  ? crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest()
  : crypto.createHash('sha256').update('nkb_itms_secret_gcm_master_key_2026').digest();

/**
 * Encrypt a string using AES-256-GCM
 * @param {string} text 
 * @returns {Object} { ciphertext, iv, tag, version }
 */
function encryptGCM(text) {
  try {
    if (!text) return { ciphertext: '', iv: '', tag: '', version: KEY_VERSION };
    const iv = crypto.randomBytes(IV_LENGTH_GCM);
    const cipher = crypto.createCipheriv(ALGORITHM_GCM, ENCRYPTION_KEY_GCM, iv);
    let ciphertext = cipher.update(text, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return {
      ciphertext,
      iv: iv.toString('hex'),
      tag,
      version: KEY_VERSION
    };
  } catch (err) {
    logger.error(`AES-GCM Encryption error: ${err.message}`);
    throw new Error('Failed to encrypt secret key.');
  }
}

/**
 * Decrypt a string using AES-256-GCM
 * @param {string} ciphertext 
 * @param {string} iv 
 * @param {string} tag 
 * @param {string} version 
 * @returns {string} Plain text
 */
function decryptGCM(ciphertext, iv, tag, version) {
  try {
    if (!ciphertext || !iv || !tag) return '';
    const ivBuf = Buffer.from(iv, 'hex');
    const tagBuf = Buffer.from(tag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM_GCM, ENCRYPTION_KEY_GCM, ivBuf);
    decipher.setAuthTag(tagBuf);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    logger.error(`AES-GCM Decryption error: ${err.message}`);
    return '*** DECRYPTION ERROR ***';
  }
}

module.exports = {
  encrypt,
  decrypt,
  encryptGCM,
  decryptGCM
};
