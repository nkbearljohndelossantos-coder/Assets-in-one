const knex = require('../backend/src/config/db');

async function inspect() {
  const tables = await knex.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'knex_%' ORDER BY name");
  console.log('--- ALL NON-EMPTY TABLES ---');
  for (const row of tables) {
    const t = row.name;
    try {
      const [{ count }] = await knex(t).count('* as count');
      if (count > 0) {
        console.log(`${t}: ${count}`);
      }
    } catch (e) {
      // ignore view / virtual table errors
    }
  }
  process.exit(0);
}

inspect();
