import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connections
  }
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Helper wrapper to keep routes working with minimal changes
export async function runAsync(sql, params = []) {
  const convertedSql = convertPlaceholders(sql);
  const result = await pool.query(convertedSql, params);
  // Map lastID and changes to match sqlite3 result objects
  return {
    lastID: result.rows[0]?.id || null,
    changes: result.rowCount,
    rows: result.rows
  };
}

export async function getAsync(sql, params = []) {
  const convertedSql = convertPlaceholders(sql);
  const result = await pool.query(convertedSql, params);
  return result.rows[0] || null;
}

export async function allAsync(sql, params = []) {
  const convertedSql = convertPlaceholders(sql);
  const result = await pool.query(convertedSql, params);
  return result.rows;
}

function convertPlaceholders(sql) {
  let index = 1;
  let newSql = sql.replace(/\?/g, () => `$${index++}`);
  
  // If query is an INSERT and doesn't have RETURNING id, append it to get the lastID
  if (newSql.trim().toUpperCase().startsWith('INSERT') && !newSql.toUpperCase().includes('RETURNING')) {
    newSql += ' RETURNING id';
  }
  return newSql;
}

// Database Migrations (PostgreSQL version)
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) CHECK(role IN ('Administrador', 'Supervisor', 'Vistoriador')) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Vehicles
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        plate VARCHAR(50) UNIQUE NOT NULL,
        brand VARCHAR(255) NOT NULL,
        model VARCHAR(255) NOT NULL,
        version VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL,
        color VARCHAR(100) NOT NULL,
        mileage INTEGER NOT NULL,
        entry_date VARCHAR(100) NOT NULL,
        observations TEXT,
        status VARCHAR(100) CHECK(status IN ('Recebido', 'Em inspeção', 'Com pendências', 'Pronto para venda')) NOT NULL DEFAULT 'Recebido',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Checklist Categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS checklist_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Checklist Items
    await client.query(`
      CREATE TABLE IF NOT EXISTS checklist_items (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES checklist_categories(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category_id, name)
      )
    `);

    // 5. Inspections
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        signature_name VARCHAR(255)
      )
    `);

    // 6. Inspection Items (Responses)
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspection_items (
        id SERIAL PRIMARY KEY,
        inspection_id INTEGER REFERENCES inspections(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES checklist_items(id) ON DELETE SET NULL,
        status VARCHAR(50) CHECK(status IN ('OK', 'Atenção', 'Defeito')) NOT NULL,
        description TEXT,
        priority VARCHAR(50) CHECK(priority IN ('Baixa', 'Média', 'Alta')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Inspection Photos
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspection_photos (
        id SERIAL PRIMARY KEY,
        inspection_item_id INTEGER REFERENCES inspection_items(id) ON DELETE CASCADE,
        photo_path TEXT NOT NULL,
        type VARCHAR(50) CHECK(type IN ('defeito', 'reparo')) NOT NULL DEFAULT 'defeito',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Pendencies
    await client.query(`
      CREATE TABLE IF NOT EXISTS pendencies (
        id SERIAL PRIMARY KEY,
        inspection_item_id INTEGER REFERENCES inspection_items(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        status VARCHAR(50) CHECK(status IN ('Pendente', 'Em andamento', 'Resolvido')) NOT NULL DEFAULT 'Pendente',
        responsible_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. History Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS history_logs (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(255) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    await seedData();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
  }
}

async function seedData() {
  const userCount = await getAsync('SELECT COUNT(*) as count FROM users');
  if (parseInt(userCount.count) === 0) {
    console.log('Seeding users into PostgreSQL...');
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const superPassword = await bcrypt.hash('super123', salt);
    const vistoPassword = await bcrypt.hash('visto123', salt);

    await runAsync(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      ['admin', adminPassword, 'Administrador do Sistema', 'Administrador']
    );
    await runAsync(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      ['supervisor', superPassword, 'Supervisor de Vendas', 'Supervisor']
    );
    await runAsync(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      ['vistoriador', vistoPassword, 'Vistoriador Técnico', 'Vistoriador']
    );
    console.log('Seeded users successfully.');
  }

  const categoryCount = await getAsync('SELECT COUNT(*) as count FROM checklist_categories');
  if (parseInt(categoryCount.count) === 0) {
    console.log('Seeding default checklist categories and items...');

    const defaultChecklist = {
      'Pintura': [
        'Capô', 'Teto', 'Para-lama dianteiro direito', 'Para-lama dianteiro esquerdo',
        'Porta dianteira direita', 'Porta traseira direita', 'Porta dianteira esquerda',
        'Porta traseira esquerda', 'Porta-malas', 'Para-choque dianteiro', 'Para-choque traseiro'
      ],
      'Elétrica': [
        'Farol alto', 'Farol baixo', 'Farol de milha', 'Lanternas', 'Luz de freio',
        'Luz de ré', 'Pisca', 'Alerta', 'Luz interna', 'Limpador de para-brisa',
        'Esguicho', 'Buzina', 'Vidros elétricos', 'Travas elétricas', 'Retrovisores elétricos',
        'Ar condicionado - Resfriamento', 'Ar condicionado - Ventilação',
        'Ar condicionado - Compressor', 'Ar condicionado - Ruídos'
      ],
      'Som': [
        'Central multimídia', 'Rádio', 'Bluetooth', 'USB', 'Alto-falantes'
      ],
      'Interior': [
        'Bancos', 'Painel', 'Console', 'Forro de teto', 'Volante', 'Tapetes'
      ],
      'Pneus': [
        'Dianteiro direito', 'Dianteiro esquerdo', 'Traseiro direito', 'Traseiro esquerdo', 'Estepe'
      ],
      'Acessórios': [
        'Chave reserva', 'Manual', 'Macaco', 'Triângulo', 'Chave de roda'
      ]
    };

    for (const [categoryName, items] of Object.entries(defaultChecklist)) {
      await runAsync('INSERT INTO checklist_categories (name) VALUES (?)', [categoryName]);
      const category = await getAsync('SELECT id FROM checklist_categories WHERE name = ?', [categoryName]);
      
      for (const itemName of items) {
        await runAsync(
          'INSERT INTO checklist_items (category_id, name) VALUES (?, ?)',
          [category.id, itemName]
        );
      }
    }
    console.log('Seeded checklist categories and items successfully.');
  }
}

// Trigger DB Initialization
initDatabase();

export { pool as db };
