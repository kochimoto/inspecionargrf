import express from 'express';
import { runAsync, getAsync, allAsync } from '../database/db.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

// Get full checklist tree (active only by default for new inspections)
router.get('/', authenticateToken, async (req, res) => {
  const { all } = req.query; // If all=true, includes inactive items
  try {
    const categories = await allAsync('SELECT * FROM checklist_categories ORDER BY name ASC');
    
    for (const cat of categories) {
      const itemsQuery = all === 'true' 
        ? 'SELECT * FROM checklist_items WHERE category_id = ? ORDER BY name ASC'
        : 'SELECT * FROM checklist_items WHERE category_id = ? AND is_active = 1 ORDER BY name ASC';
      
      cat.items = await allAsync(itemsQuery, [cat.id]);
    }
    
    res.json(categories);
  } catch (error) {
    console.error('Get checklist structure error:', error);
    res.status(500).json({ error: 'Erro ao buscar itens de checklist.' });
  }
});

// Admin ONLY: Create new category
router.post('/categories', authenticateToken, authorizeRoles('Administrador'), async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
  }

  const cleanName = name.trim();

  try {
    const existing = await getAsync('SELECT id FROM checklist_categories WHERE name = ?', [cleanName]);
    if (existing) {
      return res.status(400).json({ error: 'Categoria já cadastrada.' });
    }

    const result = await runAsync('INSERT INTO checklist_categories (name) VALUES (?)', [cleanName]);
    res.status(201).json({ id: result.lastID, name: cleanName });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Erro ao criar categoria.' });
  }
});

// Admin ONLY: Edit category
router.put('/categories/:id', authenticateToken, authorizeRoles('Administrador'), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
  }

  try {
    await runAsync('UPDATE checklist_categories SET name = ? WHERE id = ?', [name.trim(), id]);
    res.json({ id: parseInt(id), name: name.trim() });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Erro ao atualizar categoria.' });
  }
});

// Admin ONLY: Delete category (Only if it has no items or cascading)
router.delete('/categories/:id', authenticateToken, authorizeRoles('Administrador'), async (req, res) => {
  const { id } = req.params;
  try {
    // Check if there are active inspections using items in this category
    const count = await getAsync(
      `SELECT COUNT(*) as count FROM inspection_items ii 
       JOIN checklist_items ci ON ii.item_id = ci.id 
       WHERE ci.category_id = ?`,
      [id]
    );

    if (count.count > 0) {
      // Logic deletion of items inside
      await runAsync('UPDATE checklist_items SET is_active = 0 WHERE category_id = ?', [id]);
      return res.json({ message: 'Categoria contem itens com histórico de inspeções. Itens desativados logicamente.' });
    }

    await runAsync('DELETE FROM checklist_categories WHERE id = ?', [id]);
    res.json({ message: 'Categoria excluída com sucesso.' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Erro ao excluir categoria.' });
  }
});

// Admin ONLY: Create new checklist item
router.post('/items', authenticateToken, authorizeRoles('Administrador'), async (req, res) => {
  const { category_id, name } = req.body;
  if (!category_id || !name || name.trim() === '') {
    return res.status(400).json({ error: 'Categoria e nome do item são obrigatórios.' });
  }

  const cleanName = name.trim();

  try {
    const existing = await getAsync(
      'SELECT id, is_active FROM checklist_items WHERE category_id = ? AND name = ?',
      [category_id, cleanName]
    );

    if (existing) {
      if (existing.is_active === 0) {
        // Reactivate
        await runAsync('UPDATE checklist_items SET is_active = 1 WHERE id = ?', [existing.id]);
        return res.json({ id: existing.id, category_id, name: cleanName, is_active: 1 });
      }
      return res.status(400).json({ error: 'Este item já existe nesta categoria.' });
    }

    const result = await runAsync(
      'INSERT INTO checklist_items (category_id, name) VALUES (?, ?)',
      [category_id, cleanName]
    );
    res.status(201).json({ id: result.lastID, category_id, name: cleanName, is_active: 1 });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Erro ao criar item de checklist.' });
  }
});

// Admin ONLY: Edit checklist item
router.put('/items/:id', authenticateToken, authorizeRoles('Administrador'), async (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body;

  try {
    const oldItem = await getAsync('SELECT * FROM checklist_items WHERE id = ?', [id]);
    if (!oldItem) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    const cleanName = name ? name.trim() : oldItem.name;
    const active = is_active !== undefined ? (is_active ? 1 : 0) : oldItem.is_active;

    await runAsync(
      'UPDATE checklist_items SET name = ?, is_active = ? WHERE id = ?',
      [cleanName, active, id]
    );

    res.json({ id: parseInt(id), category_id: oldItem.category_id, name: cleanName, is_active: active });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Erro ao atualizar item.' });
  }
});

// Admin ONLY: Delete checklist item (Logic delete if inspection exists, hard delete otherwise)
router.delete('/items/:id', authenticateToken, authorizeRoles('Administrador'), async (req, res) => {
  const { id } = req.params;
  try {
    const usage = await getAsync('SELECT COUNT(*) as count FROM inspection_items WHERE item_id = ?', [id]);
    if (usage.count > 0) {
      // Soft delete
      await runAsync('UPDATE checklist_items SET is_active = 0 WHERE id = ?', [id]);
      return res.json({ message: 'Item possui histórico de inspeções. Desativado logicamente com sucesso.' });
    }

    // Hard delete
    await runAsync('DELETE FROM checklist_items WHERE id = ?', [id]);
    res.json({ message: 'Item excluído fisicamente com sucesso.' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Erro ao excluir item.' });
  }
});

export default router;
