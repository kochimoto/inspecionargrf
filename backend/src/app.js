import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { allAsync, getAsync } from './database/db.js';
import authRouter from './routes/auth.js';
import vehiclesRouter from './routes/vehicles.js';
import checklistRouter from './routes/checklist.js';
import inspectionsRouter from './routes/inspections.js';
import pendenciesRouter from './routes/pendencies.js';
import { authenticateToken } from './middlewares/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend Vite development server (default port is usually 5173)
app.use(cors({
  origin: '*', // Allow all in development
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads static folder
const uploadsPath = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Mount Routers
app.use('/api/auth', authRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/checklist', checklistRouter);
app.use('/api/inspections', inspectionsRouter);
app.use('/api/pendencies', pendenciesRouter);

// Dashboard stats route
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    // 1. Vehicle counts by status
    const vehicleStats = await allAsync(`
      SELECT status, COUNT(*) as count 
      FROM vehicles 
      GROUP BY status
    `);

    const stats = {
      Recebido: 0,
      'Em inspeção': 0,
      'Com pendências': 0,
      'Pronto para venda': 0,
      total: 0
    };

    vehicleStats.forEach(row => {
      stats[row.status] = row.count;
      stats.total += row.count;
    });

    // 2. Open/active pendencies count
    const openPendencies = await getAsync(`
      SELECT COUNT(*) as count 
      FROM pendencies 
      WHERE status != 'Resolvido'
    `);

    // 3. Inspections completed in current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    const startOfMonthIso = startOfMonth.toISOString().split('T')[0] + ' 00:00:00';

    const monthlyInspections = await getAsync(`
      SELECT COUNT(*) as count 
      FROM inspections 
      WHERE completed_at >= ?
    `, [startOfMonthIso]);

    // 4. Top 5 items with highest defect rate
    const defectRates = await allAsync(`
      SELECT ci.name as item_name, cc.name as category_name, COUNT(*) as defect_count
      FROM inspection_items ii
      JOIN checklist_items ci ON ii.item_id = ci.id
      JOIN checklist_categories cc ON ci.category_id = cc.id
      WHERE ii.status = 'Defeito'
      GROUP BY ii.item_id
      ORDER BY defect_count DESC
      LIMIT 5
    `);

    // 5. Active inspectors/users for listing assignments
    const users = await allAsync('SELECT id, name, role FROM users');

    res.json({
      vehicleStats: stats,
      openPendencies: openPendencies.count,
      monthlyInspections: monthlyInspections.count,
      defectRates,
      users
    });
  } catch (error) {
    console.error('Dashboard stats fetch error:', error);
    res.status(500).json({ error: 'Erro ao gerar estatísticas do painel.' });
  }
});

// Start Express App
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
