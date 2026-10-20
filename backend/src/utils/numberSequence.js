const db = require('../config/db');

/**
 * Generates a unique, formatted, concurrent-safe document number for a given module.
 * e.g., AST-2026-000001, TKT-2026-000001
 * 
 * @param {string} moduleCode - The target module code (e.g., 'Asset', 'Ticket', 'Assignment', 'Repair', 'Maintenance', 'Inventory')
 * @param {Object} [trx] - Optional Knex transaction instance to reuse
 * @returns {Promise<string>} The generated unique document number
 */
async function getNextNumber(moduleCode, trx = null) {
  const executeWithTrx = async (t) => {
    // 1. Fetch sequence settings with row lock (forUpdate) to prevent concurrent duplication
    const seq = await t('number_sequences')
      .where('module', moduleCode)
      .select('*')
      .forUpdate()
      .first();

    if (!seq) {
      throw new Error(`Number sequence configuration for module '${moduleCode}' not found.`);
    }

    // 2. Increment sequence number
    const nextNumber = seq.last_number + 1;

    // 3. Update the sequence record
    await t('number_sequences')
      .where('module', moduleCode)
      .update({
        last_number: nextNumber,
        updated_at: new Date()
      });

    // 4. Pad the number and append to prefix
    const paddedNum = String(nextNumber).padStart(seq.length, '0');
    return `${seq.prefix}${paddedNum}`;
  };

  // If a transaction is already active, use it. Otherwise, create a new transaction block.
  if (trx) {
    return executeWithTrx(trx);
  } else {
    return db.transaction(async (t) => {
      return executeWithTrx(t);
    });
  }
}

module.exports = {
  getNextNumber
};
