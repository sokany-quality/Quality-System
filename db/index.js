const { getDatabase } = require('./schema');

class QualityDB {
  constructor() {
    this.db = getDatabase();
  }

  // ==========================================
  // AUDIT LOG HELPER
  // ==========================================
  logAudit(userId, userName, action, entityName, entityId, summary, details = null) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_logs (user_id, user_name, action, entity_name, entity_id, summary, details_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        userId || null,
        userName || 'نظام',
        action,
        entityName,
        entityId || 0,
        summary,
        details ? JSON.stringify(details) : null
      );
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }

  getAuditLogs(limit = 100) {
    return this.db.prepare(`
      SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?
    `).all(limit);
  }

  // ==========================================
  // AUTH & USERS & ROLES
  // ==========================================
  getAllUsers() {
    return this.db.prepare(`
      SELECT u.id, u.username, u.full_name, u.role_id, u.is_active, u.created_at,
             r.name as role_name, r.code as role_code, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.id ASC
    `).all();
  }

  getUserById(id) {
    return this.db.prepare(`
      SELECT u.id, u.username, u.full_name, u.role_id, u.is_active,
             r.name as role_name, r.code as role_code, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(id);
  }

  getAllRoles() {
    return this.db.prepare('SELECT * FROM roles ORDER BY id ASC').all();
  }

  createUser(data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      INSERT INTO users (username, full_name, password, role_id, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    const res = stmt.run(data.username, data.full_name, data.password || '123456', data.role_id, data.is_active ?? 1);
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'users', res.lastInsertRowid, `إضافة مستخدم جديد: ${data.full_name}`);
    return this.getUserById(res.lastInsertRowid);
  }

  updateUser(id, data, currentUserId, currentUserName) {
    let sql = 'UPDATE users SET full_name = ?, role_id = ?, is_active = ?';
    const params = [data.full_name, data.role_id, data.is_active ?? 1];
    if (data.password) {
      sql += ', password = ?';
      params.push(data.password);
    }
    sql += ' WHERE id = ?';
    params.push(id);
    this.db.prepare(sql).run(...params);
    this.logAudit(currentUserId, currentUserName, 'UPDATE', 'users', id, `تعديل بيانات المستخدم: ${data.full_name}`);
    return this.getUserById(id);
  }

  deleteUser(id, currentUserId, currentUserName) {
    const user = this.getUserById(id);
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'users', id, `حذف المستخدم: ${user ? user.full_name : id}`);
    return true;
  }

  // ==========================================
  // PRODUCTION LINES
  // ==========================================
  getAllLines() {
    return this.db.prepare(`
      SELECT l.*, p.name as current_product_name, p.code as current_product_code,
             (SELECT COUNT(*) FROM pallets WHERE line_id = l.id) as pallets_count
      FROM production_lines l
      LEFT JOIN products p ON l.current_product_id = p.id
      ORDER BY l.line_number ASC
    `).all();
  }

  getLineById(id) {
    return this.db.prepare(`
      SELECT l.*, p.name as current_product_name, p.code as current_product_code
      FROM production_lines l
      LEFT JOIN products p ON l.current_product_id = p.id
      WHERE l.id = ?
    `).get(id);
  }

  createLine(data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      INSERT INTO production_lines (line_number, name, supervisor_name, current_product_id, status, notes, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      parseInt(data.line_number, 10),
      data.name,
      data.supervisor_name,
      data.current_product_id ? parseInt(data.current_product_id, 10) : null,
      data.status || 'نشط',
      data.notes || null,
      currentUserId || null,
      currentUserId || null
    );
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'production_lines', res.lastInsertRowid, `إضافة خط إنتاج جديد رقم ${data.line_number} (${data.name})`);
    return this.getLineById(res.lastInsertRowid);
  }

  updateLine(id, data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      UPDATE production_lines
      SET line_number = ?, name = ?, supervisor_name = ?, current_product_id = ?, status = ?, notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      parseInt(data.line_number, 10),
      data.name,
      data.supervisor_name,
      data.current_product_id ? parseInt(data.current_product_id, 10) : null,
      data.status || 'نشط',
      data.notes || null,
      currentUserId || null,
      id
    );
    this.logAudit(currentUserId, currentUserName, 'UPDATE', 'production_lines', id, `تعديل خط الإنتاج رقم ${data.line_number} (${data.name})`);
    return this.getLineById(id);
  }

  deleteLine(id, currentUserId, currentUserName) {
    const line = this.getLineById(id);
    if (!line) throw new Error('خط الإنتاج غير موجود');

    const count = this.db.prepare('SELECT COUNT(*) as count FROM pallets WHERE line_id = ?').get(id).count;
    if (count > 0) {
      throw new Error(`لا يمكن حذف خط الإنتاج لوجود ${count} بالته مسجلة مرتبطة به. يمكنك تغيير حالته إلى متوقف.`);
    }

    this.db.prepare('DELETE FROM production_lines WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'production_lines', id, `حذف خط الإنتاج رقم ${line.line_number} (${line.name})`);
    return true;
  }

  // ==========================================
  // PRODUCTS (HOME APPLIANCES)
  // ==========================================
  getAllProducts() {
    return this.db.prepare(`
      SELECT p.*, l.name as default_line_name, l.line_number as default_line_number
      FROM products p
      LEFT JOIN production_lines l ON p.default_line_id = l.id
      ORDER BY p.id ASC
    `).all();
  }

  getProductById(id) {
    return this.db.prepare(`
      SELECT p.*, l.name as default_line_name, l.line_number as default_line_number
      FROM products p
      LEFT JOIN production_lines l ON p.default_line_id = l.id
      WHERE p.id = ?
    `).get(id);
  }

  createProduct(data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      INSERT INTO products (code, name, specifications, weight, unit, default_line_id, extra_info, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      data.code,
      data.name,
      data.specifications || null,
      data.weight || null,
      data.unit || 'جهاز',
      data.default_line_id ? parseInt(data.default_line_id, 10) : null,
      data.extra_info || null,
      data.is_active ?? 1,
      currentUserId || null
    );
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'products', res.lastInsertRowid, `إضافة منتج أجهزة منزلية: ${data.name} (${data.code})`);
    return this.getProductById(res.lastInsertRowid);
  }

  updateProduct(id, data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      UPDATE products
      SET code = ?, name = ?, specifications = ?, weight = ?, unit = ?, default_line_id = ?, extra_info = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      data.code,
      data.name,
      data.specifications || null,
      data.weight || null,
      data.unit || 'جهاز',
      data.default_line_id ? parseInt(data.default_line_id, 10) : null,
      data.extra_info || null,
      data.is_active ?? 1,
      id
    );
    this.logAudit(currentUserId, currentUserName, 'UPDATE', 'products', id, `تعديل منتج: ${data.name} (${data.code})`);
    return this.getProductById(id);
  }

  deleteProduct(id, currentUserId, currentUserName) {
    const product = this.getProductById(id);
    if (!product) throw new Error('المنتج غير موجود');

    const count = this.db.prepare('SELECT COUNT(*) as count FROM pallets WHERE product_id = ?').get(id).count;
    if (count > 0) {
      throw new Error(`لا يمكن حذف المنتج لوجود ${count} بالته مسجلة مرتبطة به. يمكنك تعطيل المنتج.`);
    }

    this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'products', id, `حذف منتج: ${product.name}`);
    return true;
  }

  // ==========================================
  // AQL SAMPLING PLANS (المستوى العام الثاني ISO 2859-1 Level II)
  // ==========================================
  getAllAqlPlans() {
    return this.db.prepare(`
      SELECT * FROM aql_sampling_plans ORDER BY batch_min ASC
    `).all();
  }

  getAqlPlanForBatch(quantity) {
    const qty = parseInt(quantity || 0, 10);
    if (qty <= 0) return { sample_size: 0, accept_limit: 0, reject_limit: 1, aql_level: 'غير محدد' };

    // Find exact range
    let plan = this.db.prepare(`
      SELECT * FROM aql_sampling_plans
      WHERE batch_min <= ? AND batch_max >= ? AND is_active = 1
      ORDER BY batch_min ASC LIMIT 1
    `).get(qty, qty);

    if (!plan) {
      // Find nearest upper or max plan
      plan = this.db.prepare(`
        SELECT * FROM aql_sampling_plans
        WHERE is_active = 1
        ORDER BY ABS(batch_max - ?) ASC LIMIT 1
      `).get(qty);
    }

    return plan || {
      sample_size: Math.min(20, Math.max(2, Math.round(qty * 0.1))),
      accept_limit: 1,
      reject_limit: 2,
      aql_level: 'المستوى العام الثاني (افتراضي)'
    };
  }

  createAqlPlan(data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      INSERT INTO aql_sampling_plans (batch_min, batch_max, sample_size, accept_limit, reject_limit, aql_level, notes, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      parseInt(data.batch_min, 10),
      parseInt(data.batch_max, 10),
      parseInt(data.sample_size, 10),
      parseInt(data.accept_limit, 10),
      parseInt(data.reject_limit, 10),
      data.aql_level || 'المستوى العام الثاني (Level II)',
      data.notes || null,
      data.is_active ?? 1
    );
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'aql_sampling_plans', res.lastInsertRowid, `إضافة نطاق فحص AQL: من ${data.batch_min} إلى ${data.batch_max}`);
    return this.db.prepare('SELECT * FROM aql_sampling_plans WHERE id = ?').get(res.lastInsertRowid);
  }

  updateAqlPlan(id, data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      UPDATE aql_sampling_plans
      SET batch_min = ?, batch_max = ?, sample_size = ?, accept_limit = ?, reject_limit = ?, aql_level = ?, notes = ?, is_active = ?
      WHERE id = ?
    `);
    stmt.run(
      parseInt(data.batch_min, 10),
      parseInt(data.batch_max, 10),
      parseInt(data.sample_size, 10),
      parseInt(data.accept_limit, 10),
      parseInt(data.reject_limit, 10),
      data.aql_level || 'المستوى العام الثاني (Level II)',
      data.notes || null,
      data.is_active ?? 1,
      id
    );
    this.logAudit(currentUserId, currentUserName, 'UPDATE', 'aql_sampling_plans', id, `تعديل نطاق فحص AQL: من ${data.batch_min} إلى ${data.batch_max}`);
    return this.db.prepare('SELECT * FROM aql_sampling_plans WHERE id = ?').get(id);
  }

  deleteAqlPlan(id, currentUserId, currentUserName) {
    this.db.prepare('DELETE FROM aql_sampling_plans WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'aql_sampling_plans', id, `حذف نطاق فحص AQL معرّف: ${id}`);
    return true;
  }

  // Automatic / Manual Decision Calculation based on AQL
  calculateAqlDecision(rejectedQty, acceptLimit, rejectLimit, decisionMode = 'auto') {
    if (decisionMode === 'manual_accept') return 'مقبول';
    if (decisionMode === 'manual_reject') return 'مرفوض';

    const rQty = parseInt(rejectedQty || 0, 10);
    const ac = parseInt(acceptLimit ?? 0, 10);
    const re = parseInt(rejectLimit ?? 1, 10);

    if (rQty >= re) return 'مرفوض';
    if (rQty <= ac) return 'مقبول';
    return 'مرفوض';
  }

  // ==========================================
  // QUALITY INSPECTORS & ASSIGNMENTS
  // ==========================================
  getAllInspectors() {
    return this.db.prepare('SELECT * FROM quality_inspectors ORDER BY id ASC').all();
  }

  getInspectorById(id) {
    return this.db.prepare('SELECT * FROM quality_inspectors WHERE id = ?').get(id);
  }

  createInspector(data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      INSERT INTO quality_inspectors (code, name, phone, notes, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    const res = stmt.run(data.code, data.name, data.phone || null, data.notes || null, data.is_active ?? 1);
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'quality_inspectors', res.lastInsertRowid, `إضافة مراقب جودة: ${data.name}`);
    return this.getInspectorById(res.lastInsertRowid);
  }

  updateInspector(id, data, currentUserId, currentUserName) {
    this.db.prepare(`
      UPDATE quality_inspectors SET code = ?, name = ?, phone = ?, notes = ?, is_active = ? WHERE id = ?
    `).run(data.code, data.name, data.phone || null, data.notes || null, data.is_active ?? 1, id);
    this.logAudit(currentUserId, currentUserName, 'UPDATE', 'quality_inspectors', id, `تعديل مراقب جودة: ${data.name}`);
    return this.getInspectorById(id);
  }

  deleteInspector(id, currentUserId, currentUserName) {
    this.db.prepare('DELETE FROM quality_inspectors WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'quality_inspectors', id, `حذف مراقب جودة معرّف: ${id}`);
    return true;
  }

  getAssignments(date, shiftId = null) {
    let sql = `
      SELECT a.*,
             i.name as inspector_name, i.code as inspector_code,
             s.name as shift_name,
             t.name as task_name, t.code as task_code, t.requires_line,
             l.line_number, l.name as line_name, l.supervisor_name
      FROM inspector_assignments a
      JOIN quality_inspectors i ON a.inspector_id = i.id
      JOIN shifts s ON a.shift_id = s.id
      JOIN daily_task_types t ON a.task_type_id = t.id
      LEFT JOIN production_lines l ON a.line_id = l.id
      WHERE a.date = ?
    `;
    const params = [date];
    if (shiftId) {
      sql += ' AND a.shift_id = ?';
      params.push(shiftId);
    }
    sql += ' ORDER BY a.id ASC';
    return this.db.prepare(sql).all(...params);
  }

  saveAssignment(data, currentUserId, currentUserName) {
    const existing = this.db.prepare(`
      SELECT id FROM inspector_assignments WHERE date = ? AND shift_id = ? AND inspector_id = ?
    `).get(data.date, data.shift_id, data.inspector_id);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE inspector_assignments
        SET task_type_id = ?, line_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(data.task_type_id, data.line_id ? parseInt(data.line_id, 10) : null, data.notes || null, existing.id);
      this.logAudit(currentUserId, currentUserName, 'UPDATE', 'inspector_assignments', existing.id, `تحديث تكليف المراقب بتاريخ ${data.date}`);
      return this.db.prepare('SELECT * FROM inspector_assignments WHERE id = ?').get(existing.id);
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO inspector_assignments (date, shift_id, inspector_id, task_type_id, line_id, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const res = stmt.run(
        data.date, data.shift_id, data.inspector_id, data.task_type_id,
        data.line_id ? parseInt(data.line_id, 10) : null, data.notes || null, currentUserId || null
      );
      this.logAudit(currentUserId, currentUserName, 'CREATE', 'inspector_assignments', res.lastInsertRowid, `تسجيل تكليف للمراقب بتاريخ ${data.date}`);
      return this.db.prepare('SELECT * FROM inspector_assignments WHERE id = ?').get(res.lastInsertRowid);
    }
  }

  deleteAssignment(id, currentUserId, currentUserName) {
    this.db.prepare('DELETE FROM inspector_assignments WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'inspector_assignments', id, `حذف تكليف معرّف: ${id}`);
    return true;
  }

  getLineInspectorForDate(lineId, date, shiftId = null) {
    let sql = `
      SELECT i.id, i.name, i.code, s.name as shift_name
      FROM inspector_assignments a
      JOIN quality_inspectors i ON a.inspector_id = i.id
      JOIN shifts s ON a.shift_id = s.id
      JOIN daily_task_types t ON a.task_type_id = t.id
      WHERE a.line_id = ? AND a.date = ? AND t.code = 'ON_LINE'
    `;
    const params = [lineId, date];
    if (shiftId) {
      sql += ' AND a.shift_id = ?';
      params.push(shiftId);
    }
    sql += ' LIMIT 1';
    return this.db.prepare(sql).get(...params);
  }

  // ==========================================
  // PALLETS & TWO-STAGE INSPECTION WORKFLOW
  // ==========================================
  getPallets(filters = {}) {
    let sql = `
      SELECT p.*,
             l.line_number, l.name as line_name, l.supervisor_name,
             prod.name as product_name, prod.code as product_code, prod.unit as product_unit,
             s.name as shift_name,
             i.name as inspector_name, i.code as inspector_code,
             u.full_name as created_by_name,
             (p.inspected_quantity - p.rejected_quantity) as accepted_quantity,
             CASE
               WHEN p.inspected_quantity > 0 THEN ROUND((CAST(p.rejected_quantity AS FLOAT) / p.inspected_quantity) * 100, 2)
               ELSE 0.0
             END as rejection_rate
      FROM pallets p
      JOIN production_lines l ON p.line_id = l.id
      JOIN products prod ON p.product_id = prod.id
      JOIN shifts s ON p.shift_id = s.id
      LEFT JOIN quality_inspectors i ON p.inspector_id = i.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.date) {
      sql += ' AND p.date = ?';
      params.push(filters.date);
    }
    if (filters.inspection_date) {
      sql += ' AND p.inspection_date = ?';
      params.push(filters.inspection_date);
    }
    if (filters.date_from) {
      sql += ' AND p.date >= ?';
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ' AND p.date <= ?';
      params.push(filters.date_to);
    }
    if (filters.line_id) {
      sql += ' AND p.line_id = ?';
      params.push(parseInt(filters.line_id, 10));
    }
    if (filters.product_id) {
      sql += ' AND p.product_id = ?';
      params.push(parseInt(filters.product_id, 10));
    }
    if (filters.shift_id) {
      sql += ' AND p.shift_id = ?';
      params.push(parseInt(filters.shift_id, 10));
    }
    if (filters.inspector_id) {
      sql += ' AND p.inspector_id = ?';
      params.push(parseInt(filters.inspector_id, 10));
    }
    if (filters.inspection_status) {
      sql += ' AND p.inspection_status = ?';
      params.push(filters.inspection_status);
    }
    if (filters.pallet_decision) {
      sql += ' AND p.pallet_decision = ?';
      params.push(filters.pallet_decision);
    }
    if (filters.pallet_number) {
      sql += ' AND p.pallet_number = ?';
      params.push(parseInt(filters.pallet_number, 10));
    }
    if (filters.search) {
      sql += ' AND (prod.name LIKE ? OR prod.code LIKE ? OR l.name LIKE ? OR i.name LIKE ? OR p.notes LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY p.date DESC, p.line_id ASC, p.pallet_number DESC';

    const pallets = this.db.prepare(sql).all(...params);

    if (pallets.length > 0) {
      const palletIds = pallets.map(p => p.id);
      const itemsSql = `
        SELECT pri.*, rr.name as reason_name, rr.code as reason_code, rr.category as reason_category
        FROM pallet_rejection_items pri
        JOIN rejection_reasons rr ON pri.reason_id = rr.id
        WHERE pri.pallet_id IN (${palletIds.join(',')})
      `;
      const allItems = this.db.prepare(itemsSql).all();
      const itemsByPallet = {};
      allItems.forEach(item => {
        if (!itemsByPallet[item.pallet_id]) itemsByPallet[item.pallet_id] = [];
        itemsByPallet[item.pallet_id].push(item);
      });

      pallets.forEach(p => {
        p.rejection_items = itemsByPallet[p.id] || [];
        p.rejection_summary = p.rejection_items.map(i => `${i.reason_name} (${i.count})`).join('، ') || 'لا توجد عيوب مسجلة';
      });
    }

    return pallets;
  }

  getPalletById(id) {
    const list = this.getPallets();
    return list.find(p => p.id === parseInt(id, 10)) || null;
  }

  // STEP 1: استلام البالتة (Receipt Stage)
  receivePallet(data, currentUserId, currentUserName) {
    const lineId = parseInt(data.line_id, 10);
    const palletNumber = parseInt(data.pallet_number, 10);
    const date = data.date || new Date().toISOString().slice(0, 10);
    const receivedTime = data.received_time || new Date().toTimeString().slice(0, 5);

    // Enforce Unique (line_id, pallet_number, date)
    const existing = this.db.prepare(`
      SELECT id FROM pallets WHERE line_id = ? AND pallet_number = ? AND date = ?
    `).get(lineId, palletNumber, date);

    if (existing) {
      throw new Error(`رقم البالتة (${palletNumber}) مسجل بالفعل لنفس خط الإنتاج في نفس التاريخ (${date})! يرجى اختيار رقم آخر أو تاريخ مختلف.`);
    }

    const palletQty = parseInt(data.quantity_on_pallet, 10);
    if (isNaN(palletQty) || palletQty <= 0) {
      throw new Error('الكمية على البالتة يجب أن تكون رقماً موجباً أكبر من صفر');
    }

    // Lookup AQL Sampling Plan automatically based on pallet quantity
    const aql = this.getAqlPlanForBatch(palletQty);

    const inspectionStatus = data.inspection_status || 'في انتظار الفحص';
    const sampleSizeReq = aql.sample_size;
    const maxAllowedAc = aql.accept_limit;
    const rejectLimitRe = aql.reject_limit;

    // Check if inspection data was also provided during registration
    const isInspected = inspectionStatus === 'تم الفحص';
    const inspectedQty = isInspected ? parseInt(data.inspected_quantity || sampleSizeReq, 10) : 0;
    const rejectedQty = isInspected ? parseInt(data.rejected_quantity || 0, 10) : 0;
    const decisionMode = data.decision_mode || 'auto';

    let decision = 'قيد الفحص';
    if (isInspected) {
      decision = this.calculateAqlDecision(rejectedQty, maxAllowedAc, rejectLimitRe, decisionMode);
    }

    const stmt = this.db.prepare(`
      INSERT INTO pallets (
        date, received_time, shift_id, line_id, pallet_number, product_id,
        quantity_on_pallet, inspection_status, inspection_date, inspection_started_at, inspection_completed_at,
        sample_size_required, max_allowed_defects, reject_limit,
        inspected_quantity, rejected_quantity, pallet_decision, decision_mode,
        inspector_id, notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const res = stmt.run(
      date,
      receivedTime,
      parseInt(data.shift_id, 10),
      lineId,
      palletNumber,
      parseInt(data.product_id, 10),
      palletQty,
      inspectionStatus,
      isInspected ? (data.inspection_date || date) : null,
      data.inspection_started_at || (inspectionStatus === 'جاري الفحص' ? receivedTime : null),
      data.inspection_completed_at || (isInspected ? receivedTime : null),
      sampleSizeReq,
      maxAllowedAc,
      rejectLimitRe,
      inspectedQty,
      rejectedQty,
      decision,
      decisionMode,
      data.inspector_id ? parseInt(data.inspector_id, 10) : null,
      data.notes || null,
      currentUserId || null,
      currentUserId || null
    );

    const palletId = res.lastInsertRowid;

    // Insert defect details if inspected
    if (isInspected && Array.isArray(data.rejection_items)) {
      const itemStmt = this.db.prepare(`
        INSERT INTO pallet_rejection_items (pallet_id, reason_id, count, notes) VALUES (?, ?, ?, ?)
      `);
      for (const item of data.rejection_items) {
        if (item.reason_id) {
          itemStmt.run(palletId, parseInt(item.reason_id, 10), parseInt(item.count || 0, 10), item.notes || null);
        }
      }
    }

    this.logAudit(
      currentUserId,
      currentUserName,
      'CREATE',
      'pallets',
      palletId,
      `استلام بالته رقم ${palletNumber} (خط ${lineId}) بتاريخ ${date} ${receivedTime} [حالة: ${inspectionStatus}] - AQL عينة: ${sampleSizeReq}، رفض عند: ${rejectLimitRe}`
    );

    return this.getPalletById(palletId);
  }

  // STEP 2: تسجيل نتائج الفحص وإصدار القرار (Inspection Stage)
  inspectPallet(id, data, currentUserId, currentUserName) {
    const pallet = this.getPalletById(id);
    if (!pallet) throw new Error('البالتة غير موجودة');

    const palletQty = parseInt(data.quantity_on_pallet || pallet.quantity_on_pallet, 10);
    const aql = this.getAqlPlanForBatch(palletQty);

    const sampleSizeReq = parseInt(data.sample_size_required || aql.sample_size, 10);
    const maxAllowedAc = parseInt(data.max_allowed_defects ?? aql.accept_limit, 10);
    const rejectLimitRe = parseInt(data.reject_limit ?? aql.reject_limit, 10);

    const inspectedQty = parseInt(data.inspected_quantity, 10);
    const rejectedQty = parseInt(data.rejected_quantity || 0, 10);
    const decisionMode = data.decision_mode || pallet.decision_mode || 'auto';

    if (inspectedQty > palletQty) {
      throw new Error('كمية الفحص لا يمكن أن تتجاوز الكمية الإجمالية على البالتة');
    }
    if (rejectedQty > inspectedQty) {
      throw new Error('الكمية المرفوضة لا يمكن أن تزيد عن الكمية المفحوصة');
    }

    // Calculate decision
    const decision = this.calculateAqlDecision(rejectedQty, maxAllowedAc, rejectLimitRe, decisionMode);
    const inspectionStatus = data.inspection_status || 'تم الفحص';
    const inspectionDate = data.inspection_date || new Date().toISOString().slice(0, 10);
    const currentTime = new Date().toTimeString().slice(0, 5);

    const startedAt = pallet.inspection_started_at || data.inspection_started_at || currentTime;
    const completedAt = inspectionStatus === 'تم الفحص' ? (data.inspection_completed_at || currentTime) : null;

    const stmt = this.db.prepare(`
      UPDATE pallets
      SET inspection_status = ?,
          inspection_date = ?,
          inspection_started_at = ?,
          inspection_completed_at = ?,
          sample_size_required = ?,
          max_allowed_defects = ?,
          reject_limit = ?,
          inspected_quantity = ?,
          rejected_quantity = ?,
          pallet_decision = ?,
          decision_mode = ?,
          inspector_id = ?,
          notes = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      inspectionStatus,
      inspectionDate,
      startedAt,
      completedAt,
      sampleSizeReq,
      maxAllowedAc,
      rejectLimitRe,
      inspectedQty,
      rejectedQty,
      decision,
      decisionMode,
      data.inspector_id ? parseInt(data.inspector_id, 10) : pallet.inspector_id,
      data.notes || pallet.notes,
      currentUserId || null,
      pallet.id
    );

    // Update rejection items
    this.db.prepare('DELETE FROM pallet_rejection_items WHERE pallet_id = ?').run(pallet.id);
    if (Array.isArray(data.rejection_items)) {
      const itemStmt = this.db.prepare(`
        INSERT INTO pallet_rejection_items (pallet_id, reason_id, count, notes) VALUES (?, ?, ?, ?)
      `);
      for (const item of data.rejection_items) {
        if (item.reason_id) {
          itemStmt.run(pallet.id, parseInt(item.reason_id, 10), parseInt(item.count || 0, 10), item.notes || null);
        }
      }
    }

    this.logAudit(
      currentUserId,
      currentUserName,
      'UPDATE',
      'pallets',
      pallet.id,
      `تسجيل فحص بالته رقم ${pallet.pallet_number} (خط ${pallet.line_number}) - القرار: ${decision} (${decisionMode === 'auto' ? 'تلقائي AQL' : 'يدوي'})`
    );

    return this.getPalletById(pallet.id);
  }

  // Quick Status Transition (e.g. "بدء الفحص الآن" / "إعادة إلى الانتظار")
  updatePalletStatus(id, newStatus, currentUserId, currentUserName) {
    const pallet = this.getPalletById(id);
    if (!pallet) throw new Error('البالتة غير موجودة');

    const currentTime = new Date().toTimeString().slice(0, 5);
    const currentDate = new Date().toISOString().slice(0, 10);

    let startedAt = pallet.inspection_started_at;
    let completedAt = pallet.inspection_completed_at;

    if (newStatus === 'جاري الفحص' && !startedAt) {
      startedAt = currentTime;
    }
    if (newStatus === 'تم الفحص' && !completedAt) {
      completedAt = currentTime;
    }

    this.db.prepare(`
      UPDATE pallets
      SET inspection_status = ?,
          inspection_date = COALESCE(inspection_date, ?),
          inspection_started_at = ?,
          inspection_completed_at = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, currentDate, startedAt, completedAt, currentUserId || null, id);

    this.logAudit(
      currentUserId,
      currentUserName,
      'UPDATE',
      'pallets',
      id,
      `تحديث حالة فحص البالتة رقم ${pallet.pallet_number} إلى: ${newStatus} (الوقت: ${currentTime})`
    );

    return this.getPalletById(id);
  }

  // Quick Manual Decision Override (زر قبول يدوي / زر رفض يدوي)
  overrideDecision(id, mode, currentUserId, currentUserName) {
    const pallet = this.getPalletById(id);
    if (!pallet) throw new Error('البالتة غير موجودة');

    let newDecision = pallet.pallet_decision;
    if (mode === 'manual_accept') newDecision = 'مقبول';
    else if (mode === 'manual_reject') newDecision = 'مرفوض';
    else if (mode === 'auto') {
      newDecision = this.calculateAqlDecision(pallet.rejected_quantity, pallet.max_allowed_defects, pallet.reject_limit, 'auto');
    }

    this.db.prepare(`
      UPDATE pallets
      SET pallet_decision = ?, decision_mode = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newDecision, mode, currentUserId || null, id);

    this.logAudit(
      currentUserId,
      currentUserName,
      'UPDATE',
      'pallets',
      id,
      `تعديل قرار البالتة رقم ${pallet.pallet_number} إلى: ${newDecision} [النمط: ${mode}]`
    );

    return this.getPalletById(id);
  }

  deletePallet(id, currentUserId, currentUserName) {
    const pallet = this.getPalletById(id);
    if (!pallet) throw new Error('البالتة غير موجودة');

    this.db.prepare('DELETE FROM pallets WHERE id = ?').run(id);
    this.logAudit(
      currentUserId,
      currentUserName,
      'DELETE',
      'pallets',
      id,
      `حذف بالته رقم ${pallet.pallet_number} (خط ${pallet.line_number}) بتاريخ ${pallet.date}`
    );
    return true;
  }

  // ==========================================
  // QUALITY SUMMARY & DAILY PRODUCTION BREAKDOWN
  // ==========================================
  getLineQualitySummary(filters = {}) {
    const lines = this.getAllLines();
    const queryDate = filters.date || new Date().toISOString().slice(0, 10);
    const dateFrom = filters.date_from || queryDate;
    const dateTo = filters.date_to || queryDate;

    return lines.map(line => {
      // Find assigned inspector
      let inspectorName = 'غير محدد';
      const assign = this.db.prepare(`
        SELECT i.name as inspector_name
        FROM inspector_assignments a
        JOIN quality_inspectors i ON a.inspector_id = i.id
        JOIN daily_task_types t ON a.task_type_id = t.id
        WHERE a.line_id = ? AND a.date >= ? AND a.date <= ? AND t.code = 'ON_LINE'
        ORDER BY a.date DESC LIMIT 1
      `).get(line.id, dateFrom, dateTo);

      if (assign) inspectorName = assign.inspector_name;

      // Statistics
      let sql = `
        SELECT
          COUNT(p.id) as pallets_count,
          COALESCE(SUM(p.quantity_on_pallet), 0) as total_produced,
          COALESCE(SUM(p.inspected_quantity), 0) as total_inspected,
          COALESCE(SUM(p.rejected_quantity), 0) as total_rejected,
          COALESCE(SUM(CASE WHEN p.inspection_status = 'في انتظار الفحص' THEN 1 ELSE 0 END), 0) as waiting_pallets,
          COALESCE(SUM(CASE WHEN p.inspection_status = 'جاري الفحص' THEN 1 ELSE 0 END), 0) as in_progress_pallets,
          COALESCE(SUM(CASE WHEN p.inspection_status = 'تم الفحص' THEN 1 ELSE 0 END), 0) as completed_pallets,
          COALESCE(SUM(CASE WHEN p.pallet_decision = 'مقبول' THEN 1 ELSE 0 END), 0) as accepted_pallets,
          COALESCE(SUM(CASE WHEN p.pallet_decision = 'مرفوض' THEN 1 ELSE 0 END), 0) as rejected_pallets,
          GROUP_CONCAT(DISTINCT prod.name) as products_produced
        FROM pallets p
        JOIN products prod ON p.product_id = prod.id
        WHERE p.line_id = ? AND p.date >= ? AND p.date <= ?
      `;
      const params = [line.id, dateFrom, dateTo];

      if (filters.shift_id) {
        sql += ' AND p.shift_id = ?';
        params.push(parseInt(filters.shift_id, 10));
      }

      const stats = this.db.prepare(sql).get(...params);

      const totalProduced = stats.total_produced;
      const totalInspected = stats.total_inspected;
      const totalRejected = stats.total_rejected;
      const totalAccepted = Math.max(0, totalInspected - totalRejected);

      // Safe division protected against division by zero
      const rejectionRate = totalInspected > 0
        ? parseFloat(((totalRejected / totalInspected) * 100).toFixed(2))
        : 0.0;

      // Aggregated reasons
      const reasons = this.db.prepare(`
        SELECT rr.name as reason_name, SUM(pri.count) as count
        FROM pallet_rejection_items pri
        JOIN pallets p ON pri.pallet_id = p.id
        JOIN rejection_reasons rr ON pri.reason_id = rr.id
        WHERE p.line_id = ? AND p.date >= ? AND p.date <= ?
        GROUP BY rr.id
        ORDER BY count DESC
      `).all(line.id, dateFrom, dateTo);

      const aggregatedReasons = reasons.map(r => `${r.reason_name} (${r.count})`).join('، ') || 'لا توجد عيوب مسجلة';

      return {
        line_id: line.id,
        line_number: line.line_number,
        line_name: line.name,
        supervisor_name: line.supervisor_name,
        inspector_name: inspectorName,
        current_product_name: line.current_product_name || 'غير محدد',
        products_produced: stats.products_produced || line.current_product_name || 'غير محدد',
        total_produced: totalProduced,
        total_inspected: totalInspected,
        total_rejected: totalRejected,
        total_accepted: totalAccepted,
        rejection_rate: rejectionRate,
        pallets_count: stats.pallets_count,
        waiting_pallets: stats.waiting_pallets,
        in_progress_pallets: stats.in_progress_pallets,
        completed_pallets: stats.completed_pallets,
        accepted_pallets: stats.accepted_pallets,
        rejected_pallets: stats.rejected_pallets,
        aggregated_reasons: aggregatedReasons,
        reasons_breakdown: reasons,
        status: line.status
      };
    });
  }

  // Daily Products Production Breakdown (الإنتاج والمفحوص وقيد الانتظار حسب المنتج)
  getDailyProductsSummary(filters = {}) {
    const dateFrom = filters.date_from || filters.date || new Date().toISOString().slice(0, 10);
    const dateTo = filters.date_to || filters.date || new Date().toISOString().slice(0, 10);

    return this.db.prepare(`
      SELECT
        prod.id as product_id,
        prod.code as product_code,
        prod.name as product_name,
        l.name as line_name,
        l.line_number,
        COUNT(p.id) as total_pallets,
        COALESCE(SUM(p.quantity_on_pallet), 0) as total_produced_qty,
        COALESCE(SUM(CASE WHEN p.inspection_status = 'تم الفحص' THEN p.quantity_on_pallet ELSE 0 END), 0) as inspected_pallet_qty,
        COALESCE(SUM(CASE WHEN p.inspection_status = 'في انتظار الفحص' THEN p.quantity_on_pallet ELSE 0 END), 0) as waiting_pallet_qty,
        COALESCE(SUM(CASE WHEN p.inspection_status = 'جاري الفحص' THEN p.quantity_on_pallet ELSE 0 END), 0) as in_progress_qty,
        COALESCE(SUM(p.inspected_quantity), 0) as total_inspected_samples,
        COALESCE(SUM(p.rejected_quantity), 0) as total_defects,
        COALESCE(SUM(CASE WHEN p.pallet_decision = 'مقبول' THEN 1 ELSE 0 END), 0) as accepted_pallets,
        COALESCE(SUM(CASE WHEN p.pallet_decision = 'مرفوض' THEN 1 ELSE 0 END), 0) as rejected_pallets,
        COALESCE(SUM(CASE WHEN p.inspection_status = 'في انتظار الفحص' THEN 1 ELSE 0 END), 0) as waiting_pallets_count,
        CASE
          WHEN SUM(p.inspected_quantity) > 0 THEN ROUND((CAST(SUM(p.rejected_quantity) AS FLOAT) / SUM(p.inspected_quantity)) * 100, 2)
          ELSE 0.0
        END as rejection_rate
      FROM products prod
      LEFT JOIN pallets p ON prod.id = p.product_id AND p.date >= ? AND p.date <= ?
      LEFT JOIN production_lines l ON prod.default_line_id = l.id
      GROUP BY prod.id
      ORDER BY total_produced_qty DESC
    `).all(dateFrom, dateTo);
  }

  // ==========================================
  // DASHBOARD METRICS
  // ==========================================
  getDashboardMetrics(filters = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (filters.date) {
      whereClause += ' AND p.date = ?';
      params.push(filters.date);
    }
    if (filters.date_from) {
      whereClause += ' AND p.date >= ?';
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      whereClause += ' AND p.date <= ?';
      params.push(filters.date_to);
    }
    if (filters.line_id) {
      whereClause += ' AND p.line_id = ?';
      params.push(parseInt(filters.line_id, 10));
    }
    if (filters.product_id) {
      whereClause += ' AND p.product_id = ?';
      params.push(parseInt(filters.product_id, 10));
    }
    if (filters.shift_id) {
      whereClause += ' AND p.shift_id = ?';
      params.push(parseInt(filters.shift_id, 10));
    }
    if (filters.inspection_status) {
      whereClause += ' AND p.inspection_status = ?';
      params.push(filters.inspection_status);
    }

    const totalsSql = `
      SELECT
        COUNT(p.id) as total_pallets,
        COALESCE(SUM(p.quantity_on_pallet), 0) as total_produced,
        COALESCE(SUM(p.inspected_quantity), 0) as total_inspected,
        COALESCE(SUM(p.rejected_quantity), 0) as total_rejected,
        COALESCE(SUM(CASE WHEN p.inspection_status = 'في انتظار الفحص' THEN 1 ELSE 0 END), 0) as waiting_pallets,
        COALESCE(SUM(CASE WHEN p.inspection_status = 'في انتظار الفحص' THEN p.quantity_on_pallet ELSE 0 END), 0) as waiting_qty,
        COALESCE(SUM(CASE WHEN p.inspection_status = 'جاري الفحص' THEN 1 ELSE 0 END), 0) as in_progress_pallets,
        COALESCE(SUM(CASE WHEN p.inspection_status = 'تم الفحص' THEN 1 ELSE 0 END), 0) as completed_pallets,
        COALESCE(SUM(CASE WHEN p.pallet_decision = 'مقبول' THEN 1 ELSE 0 END), 0) as accepted_pallets,
        COALESCE(SUM(CASE WHEN p.pallet_decision = 'مرفوض' THEN 1 ELSE 0 END), 0) as rejected_pallets
      FROM pallets p
      ${whereClause}
    `;
    const totals = this.db.prepare(totalsSql).get(...params);

    const totalProduced = totals.total_produced;
    const totalInspected = totals.total_inspected;
    const totalRejected = totals.total_rejected;
    const totalAccepted = Math.max(0, totalInspected - totalRejected);
    const avgRejectionRate = totalInspected > 0
      ? parseFloat(((totalRejected / totalInspected) * 100).toFixed(2))
      : 0.0;

    // Top Defect Reasons
    const topReasonsSql = `
      SELECT rr.id, rr.name, rr.category, SUM(pri.count) as total_count
      FROM pallet_rejection_items pri
      JOIN pallets p ON pri.pallet_id = p.id
      JOIN rejection_reasons rr ON pri.reason_id = rr.id
      ${whereClause}
      GROUP BY rr.id
      ORDER BY total_count DESC
      LIMIT 6
    `;
    const topReasons = this.db.prepare(topReasonsSql).all(...params);

    // Line Comparison
    const lineCompSql = `
      SELECT
        l.line_number,
        l.name as line_name,
        l.supervisor_name,
        COALESCE(SUM(p.quantity_on_pallet), 0) as total_produced,
        COALESCE(SUM(p.inspected_quantity), 0) as total_inspected,
        COALESCE(SUM(p.rejected_quantity), 0) as total_rejected,
        COALESCE(SUM(CASE WHEN p.inspection_status = 'في انتظار الفحص' THEN 1 ELSE 0 END), 0) as waiting_pallets,
        COALESCE(SUM(CASE WHEN p.inspection_status = 'تم الفحص' THEN 1 ELSE 0 END), 0) as completed_pallets,
        COALESCE(SUM(CASE WHEN p.pallet_decision = 'مقبول' THEN 1 ELSE 0 END), 0) as accepted_pallets,
        COALESCE(SUM(CASE WHEN p.pallet_decision = 'مرفوض' THEN 1 ELSE 0 END), 0) as rejected_pallets,
        CASE
          WHEN SUM(p.inspected_quantity) > 0 THEN ROUND((CAST(SUM(p.rejected_quantity) AS FLOAT) / SUM(p.inspected_quantity)) * 100, 2)
          ELSE 0.0
        END as rejection_rate
      FROM production_lines l
      LEFT JOIN pallets p ON l.id = p.line_id ${whereClause.replace('WHERE 1=1', '')}
      GROUP BY l.id
      ORDER BY l.line_number ASC
    `;
    const lineComparison = this.db.prepare(lineCompSql).all(...params);

    return {
      totals: {
        total_produced: totalProduced,
        total_inspected: totalInspected,
        total_accepted: totalAccepted,
        total_rejected: totalRejected,
        avg_rejection_rate: avgRejectionRate,
        waiting_pallets: totals.waiting_pallets,
        waiting_qty: totals.waiting_qty,
        in_progress_pallets: totals.in_progress_pallets,
        completed_pallets: totals.completed_pallets,
        accepted_pallets: totals.accepted_pallets,
        rejected_pallets: totals.rejected_pallets,
        total_pallets: totals.total_pallets
      },
      top_reasons: topReasons,
      line_comparison: lineComparison
    };
  }

  // ==========================================
  // REPORTS
  // ==========================================
  generateReport(type, filters = {}) {
    switch (type) {
      case 'daily':
      case 'weekly':
      case 'monthly':
      case 'line_production':
        return this.getLineQualitySummary(filters);

      case 'product_daily_breakdown':
      case 'product_quality':
        return this.getDailyProductsSummary(filters);

      case 'waiting_pallets':
        return this.getPallets({ ...filters, inspection_status: 'في انتظار الفحص' });

      case 'rejected_pallets':
        return this.getPallets({ ...filters, pallet_decision: 'مرفوض' });

      case 'rejection_reasons': {
        let where = 'WHERE 1=1';
        const params = [];
        if (filters.date_from) { where += ' AND p.date >= ?'; params.push(filters.date_from); }
        if (filters.date_to) { where += ' AND p.date <= ?'; params.push(filters.date_to); }
        if (filters.line_id) { where += ' AND p.line_id = ?'; params.push(filters.line_id); }

        return this.db.prepare(`
          SELECT rr.name as reason_name, rr.code as reason_code, rr.category,
                 COUNT(DISTINCT p.id) as pallets_affected,
                 SUM(pri.count) as total_defects,
                 l.name as line_name, prod.name as product_name
          FROM pallet_rejection_items pri
          JOIN pallets p ON pri.pallet_id = p.id
          JOIN rejection_reasons rr ON pri.reason_id = rr.id
          JOIN production_lines l ON p.line_id = l.id
          JOIN products prod ON p.product_id = prod.id
          ${where}
          GROUP BY rr.id, p.line_id, p.product_id
          ORDER BY total_defects DESC
        `).all(...params);
      }

      case 'inspector_performance': {
        let where = 'WHERE 1=1';
        const params = [];
        if (filters.date_from) { where += ' AND p.date >= ?'; params.push(filters.date_from); }
        if (filters.date_to) { where += ' AND p.date <= ?'; params.push(filters.date_to); }

        return this.db.prepare(`
          SELECT i.id, i.name as inspector_name, i.code as inspector_code,
                 COUNT(p.id) as pallets_inspected,
                 SUM(p.inspected_quantity) as total_inspected_qty,
                 SUM(p.rejected_quantity) as total_rejected_qty,
                 SUM(CASE WHEN p.pallet_decision = 'مرفوض' THEN 1 ELSE 0 END) as rejected_pallets_found,
                 SUM(CASE WHEN p.pallet_decision = 'مقبول' THEN 1 ELSE 0 END) as accepted_pallets,
                 CASE
                   WHEN SUM(p.inspected_quantity) > 0 THEN ROUND((CAST(SUM(p.rejected_quantity) AS FLOAT) / SUM(p.inspected_quantity)) * 100, 2)
                   ELSE 0.0
                 END as rejection_rate
          FROM quality_inspectors i
          LEFT JOIN pallets p ON i.id = p.inspector_id ${where.replace('WHERE 1=1', '')}
          GROUP BY i.id
          ORDER BY pallets_inspected DESC
        `).all(...params);
      }

      default:
        return this.getPallets(filters);
    }
  }

  // ==========================================
  // LOOKUPS & SETTINGS
  // ==========================================
  getAllRejectionReasons() {
    return this.db.prepare('SELECT * FROM rejection_reasons ORDER BY category ASC, id ASC').all();
  }

  createRejectionReason(data, currentUserId, currentUserName) {
    const stmt = this.db.prepare('INSERT INTO rejection_reasons (code, name, category, is_active) VALUES (?, ?, ?, ?)');
    const res = stmt.run(data.code, data.name, data.category || 'عام', data.is_active ?? 1);
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'rejection_reasons', res.lastInsertRowid, `إضافة سبب عيب: ${data.name}`);
    return this.db.prepare('SELECT * FROM rejection_reasons WHERE id = ?').get(res.lastInsertRowid);
  }

  deleteRejectionReason(id, currentUserId, currentUserName) {
    this.db.prepare('DELETE FROM rejection_reasons WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'rejection_reasons', id, `حذف سبب عيب معرّف: ${id}`);
    return true;
  }

  getAllTaskTypes() {
    return this.db.prepare('SELECT * FROM daily_task_types ORDER BY id ASC').all();
  }

  getAllShifts() {
    return this.db.prepare('SELECT * FROM shifts ORDER BY id ASC').all();
  }

  getAllSupervisors() {
    return this.db.prepare('SELECT * FROM supervisors ORDER BY id ASC').all();
  }

  createSupervisor(data, currentUserId, currentUserName) {
    const stmt = this.db.prepare('INSERT INTO supervisors (name, phone, notes) VALUES (?, ?, ?)');
    const res = stmt.run(data.name, data.phone || null, data.notes || null);
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'supervisors', res.lastInsertRowid, `إضافة مشرف إنتاج: ${data.name}`);
    return this.db.prepare('SELECT * FROM supervisors WHERE id = ?').get(res.lastInsertRowid);
  }

  deleteSupervisor(id, currentUserId, currentUserName) {
    this.db.prepare('DELETE FROM supervisors WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'supervisors', id, `حذف مشرف معرّف: ${id}`);
    return true;
  }

  getSavedFilters(type = null) {
    let sql = 'SELECT * FROM saved_filters';
    const params = [];
    if (type) { sql += ' WHERE filter_type = ?'; params.push(type); }
    sql += ' ORDER BY id DESC';
    return this.db.prepare(sql).all(...params);
  }

  createSavedFilter(data, userId) {
    const stmt = this.db.prepare('INSERT INTO saved_filters (name, filter_type, criteria_json, created_by) VALUES (?, ?, ?, ?)');
    const res = stmt.run(data.name, data.filter_type, JSON.stringify(data.criteria), userId || null);
    return this.db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(res.lastInsertRowid);
  }

  deleteSavedFilter(id) {
    this.db.prepare('DELETE FROM saved_filters WHERE id = ?').run(id);
    return true;
  }
}

module.exports = new QualityDB();
