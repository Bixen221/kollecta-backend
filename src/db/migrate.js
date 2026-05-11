require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('../config/db');

async function migrate() {
  console.log('🚀 Démarrage des migrations Kollecta...\n');

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql      = fs.readFileSync(filePath, 'utf8');

    try {
      console.log(`⏳ Exécution de ${file}...`);
      await db.query(sql);
      console.log(`✅ ${file} — succès\n`);
    } catch (err) {
      console.error(`❌ Erreur dans ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log('🎉 Toutes les migrations ont été appliquées !');
  process.exit(0);
}

migrate();
