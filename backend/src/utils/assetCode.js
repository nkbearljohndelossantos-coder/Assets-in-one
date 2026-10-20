const db = require('../config/db');

/**
 * Generate sequential asset code per year (e.g., PPE-2026-0001)
 * Safely handles concurrency using database transactions.
 * Compatible with SQLite, MySQL, and PostgreSQL.
 */
async function nextAssetCode(purchaseDate) {
  const parsedDate = new Date(purchaseDate);
  const year = parsedDate.getFullYear();
  if (!Number.isFinite(year) || isNaN(year)) {
    throw new Error('Invalid purchaseDate provided for asset code generation');
  }

  return await db.transaction(async (trx) => {
    // Check if counter for this year exists
    const counter = await trx('ppe_asset_code_counters').where({ year }).first();

    let seq = 1;
    if (counter) {
      seq = counter.last_seq + 1;
      await trx('ppe_asset_code_counters')
        .where({ year })
        .update({ last_seq: seq });
    } else {
      await trx('ppe_asset_code_counters').insert({
        year,
        last_seq: seq,
      });
    }

    const seqStr = String(seq).padStart(4, '0');
    return `PPE-${year}-${seqStr}`;
  });
}

module.exports = { nextAssetCode };
