const db = require('../config/db');

const moduleTableMap = {
  'Asset': { table: 'assets', column: 'asset_code' },
  'Assignment': { table: 'asset_assignments', column: 'assignment_number' },
  'Ticket': { table: 'tickets', column: 'ticket_number' },
  'Repair': { table: 'repairs', column: 'repair_number' },
  'Maintenance': { table: 'maintenance_schedules', column: 'pm_number' },
  'Inventory': { table: 'inventory_items', column: 'item_code' }
};

/**
 * Generates a unique, formatted, concurrent-safe document number for a given module.
 * Self-healing: verifies candidate number against actual database records to prevent collisions.
 * e.g., AST-2026-000001, ASN-2026-000043, TKT-2026-000001
 * 
 * @param {string} moduleCode - The target module code ('Asset', 'Ticket', 'Assignment', 'Repair', 'Maintenance', 'Inventory')
 * @param {Object} [trx] - Optional Knex transaction instance to reuse
 * @returns {Promise<string>} The generated unique document number
 */
async function getNextNumber(moduleCode, trx = null) {
  const executeWithTrx = async (t) => {
    // 1. Fetch sequence settings with row lock (forUpdate)
    const seq = await t('number_sequences')
      .where('module', moduleCode)
      .select('*')
      .forUpdate()
      .first();

    if (!seq) {
      throw new Error(`Number sequence configuration for module '${moduleCode}' not found.`);
    }

    let currentNumber = Number(seq.last_number) || 0;
    let candidateNumber = '';
    const mapping = moduleTableMap[moduleCode];

    // 2. Self-healing loop: ensure the generated number does NOT already exist in target table
    while (true) {
      currentNumber++;
      const paddedNum = String(currentNumber).padStart(seq.length, '0');
      candidateNumber = `${seq.prefix}${paddedNum}`;

      if (mapping) {
        const conflict = await t(mapping.table).where(mapping.column, candidateNumber).first();
        if (!conflict) {
          break; // Guaranteed unique number found
        }
      } else {
        break;
      }
    }

    // 3. Update the sequence record with the newly used number
    await t('number_sequences')
      .where('module', moduleCode)
      .update({
        last_number: currentNumber,
        updated_at: new Date()
      });

    return candidateNumber;
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
