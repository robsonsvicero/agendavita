const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Migracao concluida com sucesso.');
  } catch (err) {
    console.error('Erro na migracao:', err);
  } finally {
    await pool.end();
  }
}

migrate();
