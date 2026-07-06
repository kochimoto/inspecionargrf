import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { createClient } from '@supabase/supabase-js';
import { runAsync, getAsync, allAsync } from '../database/db.js';
import { authenticateToken } from '../middlewares/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Initialize Supabase Client for Storage uploads
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer Storage Configuration using Memory for Supabase Uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Start an inspection
router.post('/start', authenticateToken, async (req, res) => {
  const { vehicle_id } = req.body;
  if (!vehicle_id) {
    return res.status(400).json({ error: 'Veículo é obrigatório.' });
  }

  try {
    const vehicle = await getAsync('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Veículo não encontrado.' });
    }

    // Set vehicle status to 'Em inspeção'
    await runAsync('UPDATE vehicles SET status = "Em inspeção", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [vehicle_id]);
    
    // Log history
    await runAsync(
      'INSERT INTO history_logs (vehicle_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [vehicle_id, req.user.id, 'Início de Inspeção', 'Inspeção iniciada pelo vistoriador.']
    );

    // Create inspection record
    const result = await runAsync(
      'INSERT INTO inspections (vehicle_id, user_id, signature_name) VALUES (?, ?, ?)',
      [vehicle_id, req.user.id, '']
    );

    res.json({ inspection_id: result.lastID });
  } catch (error) {
    console.error('Start inspection error:', error);
    res.status(500).json({ error: 'Erro ao iniciar inspeção.' });
  }
});

// Save single checklist item response (with dynamic photo upload)
// Expects: multipart form data with fields: status, description, priority, and files
router.post('/items/:inspection_id/:item_id', authenticateToken, upload.array('photos'), async (req, res) => {
  const { inspection_id, item_id } = req.params;
  const { status, description, priority } = req.body;
  const files = req.files || [];

  if (!status) {
    return res.status(400).json({ error: 'Status é obrigatório.' });
  }

  // Defect validation
  if (status === 'Defeito') {
    if (!description || description.trim() === '') {
      return res.status(400).json({ error: 'Para itens com defeito, a descrição do problema é obrigatória.' });
    }
    if (!priority) {
      return res.status(400).json({ error: 'Para itens com defeito, a prioridade é obrigatória.' });
    }
    if (files.length === 0) {
      return res.status(400).json({ error: 'Para itens com defeito, pelo menos uma foto é obrigatória.' });
    }
  }

  try {
    // Check if this answer already exists
    const existing = await getAsync(
      'SELECT id FROM inspection_items WHERE inspection_id = ? AND item_id = ?',
      [inspection_id, item_id]
    );

    let inspectionItemId;

    if (existing) {
      // Update
      await runAsync(
        `UPDATE inspection_items 
         SET status = ?, description = ?, priority = ?, created_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, description || null, priority || null, existing.id]
      );
      inspectionItemId = existing.id;
    } else {
      // Insert new
      const result = await runAsync(
        `INSERT INTO inspection_items (inspection_id, item_id, status, description, priority) 
         VALUES (?, ?, ?, ?, ?)`,
        [inspection_id, item_id, status, description || null, priority || null]
      );
      inspectionItemId = result.lastID;
    }

    // Save uploaded photos to Supabase Storage
    for (const file of files) {
      const filename = `inspections/${inspection_id}/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      
      const { data, error } = await supabase.storage
        .from('fotos-checklist')
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) {
        console.error('Supabase Storage Upload Error:', error);
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('fotos-checklist')
        .getPublicUrl(filename);

      const dbPath = publicUrlData.publicUrl;

      await runAsync(
        'INSERT INTO inspection_photos (inspection_item_id, photo_path, type) VALUES (?, ?, "defeito")',
        [inspectionItemId, dbPath]
      );
    }

    // Get vehicle and item info
    const inspection = await getAsync('SELECT vehicle_id FROM inspections WHERE id = ?', [inspection_id]);
    const item = await getAsync('SELECT name FROM checklist_items WHERE id = ?', [item_id]);

    // Handle instant pendency generation
    if (status === 'Defeito') {
      const pendencyExists = await getAsync('SELECT id FROM pendencies WHERE inspection_item_id = ?', [inspectionItemId]);
      if (!pendencyExists) {
        await runAsync(
          `INSERT INTO pendencies (inspection_item_id, description, status) 
           VALUES (?, ?, 'Pendente')`,
          [inspectionItemId, `Defeito encontrado em ${item.name}: ${description}`]
        );
      } else {
        // Update description if it changed
        await runAsync(
          `UPDATE pendencies SET description = ? WHERE inspection_item_id = ?`,
          [`Defeito encontrado em ${item.name}: ${description}`, inspectionItemId]
        );
      }

      if (inspection) {
        await runAsync(
          'UPDATE vehicles SET status = "Com pendências", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [inspection.vehicle_id]
        );
      }
    } else {
      // If it was corrected to OK or Attention, delete the pendency
      await runAsync('DELETE FROM pendencies WHERE inspection_item_id = ?', [inspectionItemId]);
      
      if (inspection) {
        const otherDefects = await getAsync(
          `SELECT COUNT(*) as count FROM inspection_items 
           WHERE inspection_id = ? AND status = 'Defeito' AND id != ?`,
          [inspection_id, inspectionItemId]
        );
        if (otherDefects.count === 0) {
          await runAsync(
            'UPDATE vehicles SET status = "Em inspeção", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [inspection.vehicle_id]
          );
        }
      }
    }

    // Return the created/updated item status along with its photos
    const responseItem = await getAsync('SELECT * FROM inspection_items WHERE id = ?', [inspectionItemId]);
    responseItem.photos = await allAsync('SELECT * FROM inspection_photos WHERE inspection_item_id = ?', [inspectionItemId]);

    res.json(responseItem);
  } catch (error) {
    console.error('Save checklist item error:', error);
    res.status(500).json({ error: 'Erro ao salvar item da inspeção.' });
  }
});

// Finalize Inspection
router.post('/finalize/:inspection_id', authenticateToken, async (req, res) => {
  const { inspection_id } = req.params;
  const { signature_name } = req.body;

  if (!signature_name || signature_name.trim() === '') {
    return res.status(400).json({ error: 'A assinatura digital do responsável é obrigatória.' });
  }

  try {
    const inspection = await getAsync('SELECT * FROM inspections WHERE id = ?', [inspection_id]);
    if (!inspection) {
      return res.status(404).json({ error: 'Inspeção não encontrada.' });
    }

    const wasAlreadyCompleted = inspection.completed_at !== null;

    // Update inspection details
    await runAsync(
      'UPDATE inspections SET completed_at = CURRENT_TIMESTAMP, signature_name = ? WHERE id = ?',
      [signature_name, inspection_id]
    );

    // Get list of items with status 'Defeito' to create pendencies
    const defects = await allAsync(
      `SELECT ii.*, ci.name as item_name 
       FROM inspection_items ii
       JOIN checklist_items ci ON ii.item_id = ci.id
       WHERE ii.inspection_id = ? AND ii.status = 'Defeito'`,
      [inspection_id]
    );

    let vehicleStatus = 'Pronto para venda';

    if (defects.length > 0) {
      vehicleStatus = 'Com pendências';

      for (const defect of defects) {
        // Check if pendency already exists for this inspection item
        const pendencyExists = await getAsync('SELECT id FROM pendencies WHERE inspection_item_id = ?', [defect.id]);
        if (!pendencyExists) {
          await runAsync(
            `INSERT INTO pendencies (inspection_item_id, description, status) 
             VALUES (?, ?, 'Pendente')`,
            [defect.id, `Defeito encontrado em ${defect.item_name}: ${defect.description}`]
          );
        }
      }
    }

    // Update vehicle status
    await runAsync(
      'UPDATE vehicles SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [vehicleStatus, inspection.vehicle_id]
    );

    // Log history
    const logAction = wasAlreadyCompleted ? 'Edição de Inspeção' : 'Inspeção Finalizada';
    const logDetails = wasAlreadyCompleted 
      ? `Inspeção #${inspection_id} editada e assinada por ${req.user.name}. Status do veículo: "${vehicleStatus}". Total de defeitos: ${defects.length}.`
      : `Inspeção finalizada. Veículo atualizado para status "${vehicleStatus}". Total de defeitos: ${defects.length}.`;

    await runAsync(
      'INSERT INTO history_logs (vehicle_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [
        inspection.vehicle_id,
        req.user.id,
        logAction,
        logDetails
      ]
    );

    res.json({ message: 'Inspeção finalizada com sucesso.', vehicle_status: vehicleStatus });
  } catch (error) {
    console.error('Finalize inspection error:', error);
    res.status(500).json({ error: 'Erro ao finalizar inspeção.' });
  }
});

// Get specific inspection details/items for editing
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const inspection = await getAsync('SELECT * FROM inspections WHERE id = ?', [id]);
    if (!inspection) {
      return res.status(404).json({ error: 'Inspeção não encontrada.' });
    }

    const items = await allAsync(
      `SELECT ii.*, ci.category_id, ci.name as item_name
       FROM inspection_items ii
       JOIN checklist_items ci ON ii.item_id = ci.id
       WHERE ii.inspection_id = ?`,
      [id]
    );

    for (const item of items) {
      item.photos = await allAsync(
        'SELECT * FROM inspection_photos WHERE inspection_item_id = ?',
        [item.id]
      );
    }

    res.json({ inspection, items });
  } catch (error) {
    console.error('Get inspection items error:', error);
    res.status(500).json({ error: 'Erro ao buscar itens da inspeção.' });
  }
});

// Generate PDF Report
router.get('/report/:inspection_id', authenticateToken, async (req, res) => {
  const { inspection_id } = req.params;

  try {
    const inspection = await getAsync(
      `SELECT i.*, u.name as inspector_name, v.plate, v.brand, v.model, v.version, v.year, v.color, v.mileage, v.entry_date
       FROM inspections i
       JOIN users u ON i.user_id = u.id
       JOIN vehicles v ON i.vehicle_id = v.id
       WHERE i.id = ?`,
      [inspection_id]
    );

    if (!inspection) {
      return res.status(404).json({ error: 'Relatório não encontrado.' });
    }

    // Get checklist items and statuses
    const items = await allAsync(
      `SELECT ii.*, ci.name as item_name, cc.name as category_name
       FROM inspection_items ii
       JOIN checklist_items ci ON ii.item_id = ci.id
       JOIN checklist_categories cc ON ci.category_id = cc.id
       WHERE ii.inspection_id = ?
       ORDER BY cc.name, ci.name`,
      [inspection_id]
    );

    for (const item of items) {
      item.photos = await allAsync(
        'SELECT * FROM inspection_photos WHERE inspection_item_id = ?',
        [item.id]
      );
    }

    // Create a PDF Document
    const doc = new PDFDocument({ margin: 40 });
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Relatorio_Inspecao_${inspection.plate}.pdf`);
    doc.pipe(res);

    // Premium styling - Color Palette
    const primaryColor = '#0F2C59'; // Deep Navy Blue
    const secondaryColor = '#007FFF'; // Accent Blue
    const darkGray = '#333333';
    const lightGray = '#F5F5F7';
    const green = '#2E7D32';
    const orange = '#EF6C00';
    const red = '#C62828';

    // 1. Header Area
    doc.rect(0, 0, 612, 100).fill(primaryColor);
    
    // Logo Simulation
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('AUTO PREMIUM', 40, 30);
    doc.fontSize(10).font('Helvetica').text('SISTEMA DE INSPEÇÃO E CONTROLE', 40, 58);
    
    doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold').text('RELATÓRIO DE VISTORIA', 420, 42, { align: 'right' });
    
    // Y tracker
    let y = 120;

    // 2. Vehicle & Inspector Metadata Info Cards
    doc.fillColor(darkGray).fontSize(14).font('Helvetica-Bold').text('DADOS DA INSPEÇÃO', 40, y);
    y += 20;

    // Outer Metadata box
    doc.rect(40, y, 532, 100).fill(lightGray);
    doc.fillColor(darkGray).fontSize(9).font('Helvetica');

    // Left Column
    doc.text(`MARCA/MODELO: ${inspection.brand} ${inspection.model} ${inspection.version}`, 50, y + 15);
    doc.text(`PLACA: ${inspection.plate}`, 50, y + 35);
    doc.text(`ANO: ${inspection.year}`, 50, y + 55);
    doc.text(`COR: ${inspection.color}`, 50, y + 75);

    // Right Column
    doc.text(`QUILOMETRAGEM: ${inspection.mileage.toLocaleString()} km`, 320, y + 15);
    doc.text(`DATA ENTRADA: ${inspection.entry_date}`, 320, y + 35);
    doc.text(`DATA INSPEÇÃO: ${new Date(inspection.completed_at || inspection.created_at).toLocaleString('pt-BR')}`, 320, y + 55);
    doc.text(`VISTORIADOR: ${inspection.inspector_name}`, 320, y + 75);

    y += 120;

    // Group items by category
    const categoriesMap = {};
    items.forEach(item => {
      if (!categoriesMap[item.category_name]) {
        categoriesMap[item.category_name] = [];
      }
      categoriesMap[item.category_name].push(item);
    });

    // 3. Render Checklist
    doc.fillColor(darkGray).fontSize(14).font('Helvetica-Bold').text('CHECKLIST DETALHADO', 40, y);
    y += 20;

    for (const [categoryName, categoryItems] of Object.entries(categoriesMap)) {
      // Check page break
      if (y > 700) {
        doc.addPage();
        y = 40;
      }

      // Category Header
      doc.rect(40, y, 532, 20).fill(primaryColor);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(categoryName.toUpperCase(), 50, y + 5);
      y += 25;

      for (const item of categoryItems) {
        if (y > 720) {
          doc.addPage();
          y = 40;
        }

        doc.fillColor(darkGray).fontSize(9).font('Helvetica').text(item.item_name, 50, y);

        // Render Status Icon / Text
        let statusText = '✓ OK';
        let statusColor = green;
        if (item.status === 'Atenção') {
          statusText = '⚠ Atenção';
          statusColor = orange;
        } else if (item.status === 'Defeito') {
          statusText = '✗ Defeito';
          statusColor = red;
        }

        doc.fillColor(statusColor).font('Helvetica-Bold').text(statusText, 450, y, { align: 'right', width: 120 });
        doc.fillColor(darkGray).font('Helvetica'); // reset
        
        y += 18;
      }
      y += 10;
    }

    // 4. Defects Details Section
    const defects = items.filter(item => item.status === 'Defeito');
    if (defects.length > 0) {
      doc.addPage();
      y = 40;

      doc.fillColor(red).fontSize(14).font('Helvetica-Bold').text('DETALHAMENTO DE DEFEITOS ENCONTRADOS', 40, y);
      y += 25;

      for (const defect of defects) {
        if (y > 600) {
          doc.addPage();
          y = 40;
        }

        doc.rect(40, y, 532, 5).fill(red);
        y += 15;

        doc.fillColor(darkGray).fontSize(11).font('Helvetica-Bold').text(`Item: ${defect.item_name} (${defect.category_name})`, 40, y);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(orange).text(`Prioridade: ${defect.priority}`, 350, y, { align: 'right', width: 220 });
        y += 18;

        doc.fillColor(darkGray).fontSize(9).font('Helvetica-Oblique').text(`Problema: ${defect.description}`, 40, y);
        y += 25;

        // Render Photos associated
        if (defect.photos && defect.photos.length > 0) {
          doc.font('Helvetica-Bold').fontSize(8).text('Fotos Anexadas:', 40, y);
          y += 12;

          let photoX = 40;
          for (const photo of defect.photos) {
            const fullPhotoPath = path.resolve(__dirname, '../../', photo.photo_path);
            if (fs.existsSync(fullPhotoPath)) {
              try {
                // Ensure room for photo
                if (y > 650) {
                  doc.addPage();
                  y = 40;
                  photoX = 40;
                }
                doc.image(fullPhotoPath, photoX, y, { fit: [100, 100] });
                photoX += 110;
              } catch (imgErr) {
                console.error('Error rendering image to PDF:', imgErr);
              }
            }
          }
          y += 110; // offset after rendering photos
        }
        y += 15;
      }
    }

    // 5. Signatures & Summary Block
    if (y > 600) {
      doc.addPage();
      y = 40;
    }

    y += 20;
    doc.rect(40, y, 532, 1).fill('#CCCCCC');
    y += 20;

    doc.fillColor(darkGray).fontSize(11).font('Helvetica-Bold').text('RESUMO GERAL', 40, y);
    y += 15;

    const okCount = items.filter(i => i.status === 'OK').length;
    const attentionCount = items.filter(i => i.status === 'Atenção').length;
    const defectCount = defects.length;

    doc.fontSize(9).font('Helvetica');
    doc.text(`Total de itens analisados: ${items.length}`, 40, y);
    doc.text(`Itens em conformidade (OK): ${okCount}`, 40, y + 15);
    doc.text(`Itens que necessitam de atenção: ${attentionCount}`, 40, y + 30);
    doc.text(`Itens com defeito: ${defectCount}`, 40, y + 45);

    y += 80;

    // Signature Area
    doc.rect(40, y, 220, 1).fill('#000000');
    doc.rect(340, y, 220, 1).fill('#000000');

    y += 10;
    doc.fillColor(darkGray).fontSize(8).font('Helvetica-Bold').text('ASSINATURA DO VISTORIADOR', 40, y, { width: 220, align: 'center' });
    doc.text(inspection.signature_name || '(Assinatura Eletrônica)', 40, y + 15, { width: 220, align: 'center' });

    doc.text('RESPONSÁVEL PELA LIBERAÇÃO', 340, y, { width: 220, align: 'center' });
    doc.font('Helvetica').text('Supervisor / Gerente', 340, y + 15, { width: 220, align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Generate PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao gerar relatório PDF.' });
    }
  }
});

export default router;
