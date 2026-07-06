import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { runAsync, getAsync, allAsync } from '../database/db.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer Storage Configuration using Memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// List all pendencies
router.get('/', authenticateToken, async (req, res) => {
  const { status, vehicle_id } = req.query;
  
  let sql = `
    SELECT p.*, ii.status as original_status, ci.name as item_name, cc.name as category_name,
           v.id as vehicle_id, v.plate, v.brand, v.model, v.version,
           u1.name as responsible_name, u2.name as resolver_name
    FROM pendencies p
    JOIN inspection_items ii ON p.inspection_item_id = ii.id
    JOIN checklist_items ci ON ii.item_id = ci.id
    JOIN checklist_categories cc ON ci.category_id = cc.id
    JOIN inspections i ON ii.inspection_id = i.id
    JOIN vehicles v ON i.vehicle_id = v.id
    LEFT JOIN users u1 ON p.responsible_id = u1.id
    LEFT JOIN users u2 ON p.resolved_by = u2.id
  `;
  const params = [];
  const filters = [];

  if (status) {
    filters.push('p.status = ?');
    params.push(status);
  }

  if (vehicle_id) {
    filters.push('v.id = ?');
    params.push(vehicle_id);
  }

  if (filters.length > 0) {
    sql += ' WHERE ' + filters.join(' AND ');
  }

  sql += ' ORDER BY p.created_at DESC';

  try {
    const pendencies = await allAsync(sql, params);
    
    // Attach photos to each pendency (both defect and repair photos)
    for (const pend of pendencies) {
      pend.photos = await allAsync(
        'SELECT * FROM inspection_photos WHERE inspection_item_id = ? ORDER BY type DESC',
        [pend.inspection_item_id]
      );
    }

    res.json(pendencies);
  } catch (error) {
    console.error('List pendencies error:', error);
    res.status(500).json({ error: 'Erro ao buscar pendências.' });
  }
});

// Update pendency status (e.g. to 'Em andamento' and assigning responsible user)
router.put('/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, responsible_id } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status é obrigatório.' });
  }

  try {
    const pendency = await getAsync(
      `SELECT p.*, i.vehicle_id, v.brand, v.model, v.plate, ci.name as item_name
       FROM pendencies p 
       JOIN inspection_items ii ON p.inspection_item_id = ii.id 
       JOIN inspections i ON ii.inspection_id = i.id
       JOIN vehicles v ON i.vehicle_id = v.id
       JOIN checklist_items ci ON ii.item_id = ci.id
       WHERE p.id = ?`,
      [id]
    );

    if (!pendency) {
      return res.status(404).json({ error: 'Pendência não encontrada.' });
    }

    await runAsync(
      'UPDATE pendencies SET status = ?, responsible_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, responsible_id || pendency.responsible_id, id]
    );

    // Add log
    await runAsync(
      'INSERT INTO history_logs (vehicle_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [
        pendency.vehicle_id,
        req.user.id,
        'Pendência Atualizada',
        `Pendência do item "${pendency.item_name}" atualizada para status "${status}".`
      ]
    );

    const updated = await getAsync('SELECT * FROM pendencies WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Update pendency status error:', error);
    res.status(500).json({ error: 'Erro ao atualizar pendência.' });
  }
});

// Resolve pendency (requires repair photos, comments, sets resolved by, and updates vehicle status if all pendencies resolved)
router.post('/:id/resolve', authenticateToken, authorizeRoles('Administrador'), upload.array('photos'), async (req, res) => {
  const { id } = req.params;
  const files = req.files || [];

  try {
    const pendency = await getAsync(
      `SELECT p.*, i.vehicle_id, v.brand, v.model, v.plate, ci.name as item_name
       FROM pendencies p 
       JOIN inspection_items ii ON p.inspection_item_id = ii.id 
       JOIN inspections i ON ii.inspection_id = i.id
       JOIN vehicles v ON i.vehicle_id = v.id
       JOIN checklist_items ci ON ii.item_id = ci.id
       WHERE p.id = ?`,
      [id]
    );

    if (!pendency) {
      return res.status(404).json({ error: 'Pendência não encontrada.' });
    }

    // Update pendency record to Resolved
    await runAsync(
      `UPDATE pendencies 
       SET status = "Resolvido", resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [req.user.id, id]
    );

    // Save repair photos to Supabase Storage
    for (const file of files) {
      const filename = `repairs/${id}/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      
      const { data, error } = await supabase.storage
        .from('fotos-checklist')
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) {
        console.error('Supabase Storage Upload Error (repair):', error);
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('fotos-checklist')
        .getPublicUrl(filename);

      const dbPath = publicUrlData.publicUrl;

      await runAsync(
        'INSERT INTO inspection_photos (inspection_item_id, photo_path, type) VALUES (?, ?, "reparo")',
        [pendency.inspection_item_id, dbPath]
      );
    }

    // Add history log
    await runAsync(
      'INSERT INTO history_logs (vehicle_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [
        pendency.vehicle_id,
        req.user.id,
        'Pendência Resolvida',
        `Pendência do item "${pendency.item_name}" resolvida com sucesso.`
      ]
    );

    // Check if there are any remaining unresolved pendencies for this vehicle
    const remaining = await getAsync(
      `SELECT COUNT(*) as count 
       FROM pendencies p
       JOIN inspection_items ii ON p.inspection_item_id = ii.id
       JOIN inspections i ON ii.inspection_id = i.id
       WHERE i.vehicle_id = ? AND p.status != 'Resolvido'`,
      [pendency.vehicle_id]
    );

    if (remaining.count === 0) {
      // Transition vehicle to "Pronto para venda"
      await runAsync(
        'UPDATE vehicles SET status = "Pronto para venda", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [pendency.vehicle_id]
      );

      // Log status transition
      await runAsync(
        'INSERT INTO history_logs (vehicle_id, user_id, action, details) VALUES (?, ?, ?, ?)',
        [
          pendency.vehicle_id,
          req.user.id,
          'Alteração de Status',
          'Veículo atualizado para "Pronto para venda" pois todas as pendências foram resolvidas.'
        ]
      );
    }

    res.json({ message: 'Pendência resolvida com sucesso.', remaining_pendencies: remaining.count });
  } catch (error) {
    console.error('Resolve pendency error:', error);
    res.status(500).json({ error: 'Erro ao resolver pendência.' });
  }
});

export default router;
