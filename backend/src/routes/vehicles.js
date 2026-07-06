import express from 'express';
import { runAsync, getAsync, allAsync } from '../database/db.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// List vehicles with search
router.get('/', authenticateToken, async (req, res) => {
  const { search } = req.query;
  
  let sql = 'SELECT * FROM vehicles';
  const params = [];

  if (search) {
    sql += ' WHERE plate LIKE ? OR brand LIKE ? OR model LIKE ? OR year LIKE ?';
    const wild = `%${search}%`;
    params.push(wild, wild, wild, wild);
  }

  sql += ' ORDER BY created_at DESC';

  try {
    const vehicles = await allAsync(sql, params);
    res.json(vehicles);
  } catch (error) {
    console.error('List vehicles error:', error);
    res.status(500).json({ error: 'Erro ao buscar veículos.' });
  }
});

// Get vehicle details and complete history
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const vehicle = await getAsync('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Veículo não encontrado.' });
    }

    // Get all inspections done for this vehicle
    const inspections = await allAsync(
      `SELECT i.*, u.name as inspector_name 
       FROM inspections i 
       LEFT JOIN users u ON i.user_id = u.id 
       WHERE i.vehicle_id = ? 
       ORDER BY i.created_at DESC`,
      [id]
    );

    // For each inspection, load its items and photos
    for (const inspection of inspections) {
      const items = await allAsync(
        `SELECT ii.*, ci.name as item_name, cc.name as category_name
         FROM inspection_items ii
         JOIN checklist_items ci ON ii.item_id = ci.id
         JOIN checklist_categories cc ON ci.category_id = cc.id
         WHERE ii.inspection_id = ?`,
        [inspection.id]
      );

      for (const item of items) {
        item.photos = await allAsync(
          'SELECT * FROM inspection_photos WHERE inspection_item_id = ?',
          [item.id]
        );
      }

      inspection.items = items;
    }

    // Get all history logs
    const logs = await allAsync(
      `SELECT hl.*, u.name as user_name 
       FROM history_logs hl 
       LEFT JOIN users u ON hl.user_id = u.id 
       WHERE hl.vehicle_id = ? 
       ORDER BY hl.created_at DESC`,
      [id]
    );

    // Get active pendencies for vehicle
    const pendencies = await allAsync(
      `SELECT p.*, ii.status as original_status, ci.name as item_name, cc.name as category_name,
              u1.name as responsible_name, u2.name as resolver_name
       FROM pendencies p
       JOIN inspection_items ii ON p.inspection_item_id = ii.id
       JOIN checklist_items ci ON ii.item_id = ci.id
       JOIN checklist_categories cc ON ci.category_id = cc.id
       JOIN inspections i ON ii.inspection_id = i.id
       LEFT JOIN users u1 ON p.responsible_id = u1.id
       LEFT JOIN users u2 ON p.resolved_by = u2.id
       WHERE i.vehicle_id = ?
       ORDER BY p.created_at DESC`,
      [id]
    );

    for (const pend of pendencies) {
      pend.photos = await allAsync(
        'SELECT * FROM inspection_photos WHERE inspection_item_id = ?',
        [pend.inspection_item_id]
      );
    }

    res.json({
      vehicle,
      inspections,
      pendencies,
      logs
    });
  } catch (error) {
    console.error('Get vehicle detail error:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes do veículo.' });
  }
});

// Create vehicle
router.post('/', authenticateToken, async (req, res) => {
  const { plate, brand, model, version, year, color, mileage, entry_date, observations } = req.body;

  if (!plate || !brand || !model || !version || !year || !color || mileage === undefined || !entry_date) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  }

  // Validate format and uniqueness of plate (standard alphanumeric check or uppercase convert)
  const cleanPlate = plate.toUpperCase().trim();

  try {
    const existing = await getAsync('SELECT id FROM vehicles WHERE plate = ?', [cleanPlate]);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um veículo cadastrado com esta placa.' });
    }

    const result = await runAsync(
      `INSERT INTO vehicles (plate, brand, model, version, year, color, mileage, entry_date, observations, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Recebido')`,
      [cleanPlate, brand, model, version, year, color, mileage, entry_date, observations]
    );

    const newVehicleId = result.lastID;

    // Log this action
    await runAsync(
      'INSERT INTO history_logs (vehicle_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [newVehicleId, req.user.id, 'Cadastro de Veículo', `Veículo ${brand} ${model} (${cleanPlate}) cadastrado no sistema.`]
    );

    const newVehicle = await getAsync('SELECT * FROM vehicles WHERE id = ?', [newVehicleId]);
    res.status(201).json(newVehicle);
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ error: 'Erro ao cadastrar veículo.' });
  }
});

// Update vehicle status/details
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { brand, model, version, year, color, mileage, entry_date, observations, status } = req.body;

  try {
    const oldVehicle = await getAsync('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!oldVehicle) {
      return res.status(404).json({ error: 'Veículo não encontrado.' });
    }

    // Check for unresolved pendencies if setting to 'Pronto para venda'
    if (status === 'Pronto para venda') {
      const unresolved = await getAsync(
        `SELECT COUNT(*) as count 
         FROM pendencies p
         JOIN inspection_items ii ON p.inspection_item_id = ii.id
         JOIN inspections i ON ii.inspection_id = i.id
         WHERE i.vehicle_id = ? AND p.status != 'Resolvido'`,
        [id]
      );
      if (unresolved.count > 0) {
        return res.status(400).json({ error: 'Não é possível colocar o veículo como "Pronto para venda" pois existem pendências de reparo em aberto.' });
      }
    }

    await runAsync(
      `UPDATE vehicles 
       SET brand = ?, model = ?, version = ?, year = ?, color = ?, mileage = ?, entry_date = ?, observations = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        brand || oldVehicle.brand,
        model || oldVehicle.model,
        version || oldVehicle.version,
        year || oldVehicle.year,
        color || oldVehicle.color,
        mileage !== undefined ? mileage : oldVehicle.mileage,
        entry_date || oldVehicle.entry_date,
        observations !== undefined ? observations : oldVehicle.observations,
        status || oldVehicle.status,
        id
      ]
    );

    // If status changed, log it specifically
    if (status && status !== oldVehicle.status) {
      await runAsync(
        'INSERT INTO history_logs (vehicle_id, user_id, action, details) VALUES (?, ?, ?, ?)',
        [id, req.user.id, 'Alteração de Status', `Status alterado de "${oldVehicle.status}" para "${status}".`]
      );
    } else {
      await runAsync(
        'INSERT INTO history_logs (vehicle_id, user_id, action, details) VALUES (?, ?, ?, ?)',
        [id, req.user.id, 'Edição de Cadastro', 'Dados cadastrais do veículo atualizados.']
      );
    }

    const updated = await getAsync('SELECT * FROM vehicles WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ error: 'Erro ao atualizar veículo.' });
  }
});

export default router;
