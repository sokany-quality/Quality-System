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
  getAllLines(department = null, includeArchived = false) {
    let sql = `
      SELECT l.*, p.name as current_product_name, p.code as current_product_code,
             (SELECT COUNT(*) FROM pallets WHERE line_id = l.id) as pallets_count
      FROM production_lines l
      LEFT JOIN products p ON l.current_product_id = p.id
    `;
    const params = [];
    const conditions = [];
    if (department && department !== 'all') {
      conditions.push('l.department = ?');
      params.push(department);
    }
    if (!includeArchived) conditions.push('l.is_archived = 0');
    if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ' ORDER BY l.line_number ASC';
    return this.db.prepare(sql).all(...params);
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
      INSERT INTO production_lines (line_number, name, supervisor_name, current_product_id, status, notes, department, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      parseInt(data.line_number, 10),
      data.name,
      data.supervisor_name,
      data.current_product_id ? parseInt(data.current_product_id, 10) : null,
      data.status || 'نشط',
      data.notes || null,
      data.department || 'home',
      currentUserId || null,
      currentUserId || null
    );
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'production_lines', res.lastInsertRowid, `إضافة خط إنتاج جديد رقم ${data.line_number} (${data.name})`);
    return this.getLineById(res.lastInsertRowid);
  }

  updateLine(id, data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      UPDATE production_lines
      SET line_number = ?, name = ?, supervisor_name = ?, current_product_id = ?, status = ?, notes = ?, department = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      parseInt(data.line_number, 10),
      data.name,
      data.supervisor_name,
      data.current_product_id ? parseInt(data.current_product_id, 10) : null,
      data.status || 'نشط',
      data.notes || null,
      data.department || 'home',
      currentUserId || null,
      id
    );
    this.logAudit(currentUserId, currentUserName, 'UPDATE', 'production_lines', id, `تعديل خط الإنتاج رقم ${data.line_number} (${data.name})`);
    return this.getLineById(id);
  }

  archiveLine(id, currentUserId, currentUserName) {
    const line = this.getLineById(id);
    if (!line) throw new Error('خط الإنتاج غير موجود');
    if (!line.is_archived) {
      this.db.prepare('UPDATE production_lines SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      this.logAudit(currentUserId, currentUserName, 'ARCHIVE', 'production_lines', id, `أرشفة خط الإنتاج رقم ${line.line_number} (${line.name})`);
    }
    return true;
  }

  restoreLine(id, currentUserId, currentUserName) {
    const line = this.getLineById(id);
    if (!line) throw new Error('خط الإنتاج غير موجود');
    if (line.is_archived) {
      this.db.prepare('UPDATE production_lines SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      this.logAudit(currentUserId, currentUserName, 'RESTORE', 'production_lines', id, `استعادة خط الإنتاج رقم ${line.line_number} (${line.name})`);
    }
    return true;
  }

  // ==========================================
  // PRODUCTS (HOME APPLIANCES & SERIA)
  // ==========================================
  getAllProducts(department = null) {
    let sql = `
      SELECT p.*, l.name as default_line_name, l.line_number as default_line_number
      FROM products p
      LEFT JOIN production_lines l ON p.default_line_id = l.id
    `;
    const params = [];
    if (department && department !== 'all') {
      sql += ' WHERE (p.department = ? OR p.department IS NULL)';
      params.push(department);
    }
    sql += ' ORDER BY p.id ASC';
    return this.db.prepare(sql).all(...params);
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
      INSERT INTO products (code, name, specifications, weight, unit, default_line_id, extra_info, is_active, department, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.department || 'home',
      currentUserId || null
    );
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'products', res.lastInsertRowid, `إضافة منتج: ${data.name} (${data.code})`);
    return this.getProductById(res.lastInsertRowid);
  }

  createQuickProduct(name, department, currentUserId, currentUserName) {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) throw new Error('اكتب اسم المنتج أولاً.');
    if (department !== null && !['home', 'seria'].includes(department)) {
      throw new Error('قسم المنتج غير صالح.');
    }
    const duplicate = this.db.prepare('SELECT id FROM products WHERE name = ? COLLATE NOCASE AND is_active = 1 ORDER BY id LIMIT 1').get(normalizedName);
    if (duplicate) {
      this.db.prepare('UPDATE products SET department = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(duplicate.id);
      this.logAudit(currentUserId, currentUserName, 'UPDATE', 'products', duplicate.id, `مشاركة المنتج بين الجودة والهوالك: ${normalizedName}`);
      return this.getProductById(duplicate.id);
    }

    const codePrefix = `SCRAP-${Date.now().toString(36).toUpperCase()}`;
    let code = '';
    let suffix = 1;
    while (!code) {
      const candidate = `${codePrefix}-${suffix++}`;
      if (!this.db.prepare('SELECT id FROM products WHERE code = ?').get(candidate)) code = candidate;
    }
    const result = this.db.prepare(`
      INSERT INTO products (code, name, unit, is_active, department, created_by)
      VALUES (?, ?, 'قطعة', 1, ?, ?)
    `).run(code, normalizedName, department, currentUserId || null);
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'products', result.lastInsertRowid, `إضافة منتج سريع مشترك: ${normalizedName}`);
    return this.getProductById(result.lastInsertRowid);
  }

  updateProduct(id, data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      UPDATE products
      SET code = ?, name = ?, specifications = ?, weight = ?, unit = ?, default_line_id = ?, extra_info = ?, is_active = ?, department = ?, updated_at = CURRENT_TIMESTAMP
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
      data.department || 'home',
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
    if (filters.department && filters.department !== 'all') {
      sql += ' AND (p.department = ? OR l.department = ?)';
      params.push(filters.department, filters.department);
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

    const line = this.getLineById(lineId);
    const department = data.department || (line ? line.department : 'home');

    const stmt = this.db.prepare(`
      INSERT INTO pallets (
        date, received_time, shift_id, line_id, pallet_number, product_id,
        quantity_on_pallet, inspection_status, inspection_date, inspection_started_at, inspection_completed_at,
        sample_size_required, max_allowed_defects, reject_limit,
        inspected_quantity, rejected_quantity, pallet_decision, decision_mode,
        inspector_id, notes, department, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      department,
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
    const lines = this.getAllLines(filters.department, true);
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
        status: line.status,
        date_from: dateFrom,
        date_to: dateTo,
        report_date: dateFrom === dateTo ? dateFrom : `${dateFrom} إلى ${dateTo}`
      };
    });
  }

  // Daily Products Production Breakdown (الإنتاج والمفحوص وقيد الانتظار حسب المنتج)
  getDailyProductsSummary(filters = {}) {
    const dateFrom = filters.date_from || filters.date || new Date().toISOString().slice(0, 10);
    const dateTo = filters.date_to || filters.date || new Date().toISOString().slice(0, 10);

    let where = 'WHERE 1=1';
    const params = [dateFrom, dateTo];
    if (filters.department && filters.department !== 'all') {
      where += ' AND (prod.department = ? OR l.department = ?)';
      params.push(filters.department, filters.department);
    }

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
      LEFT JOIN production_lines l ON COALESCE(p.line_id, prod.default_line_id) = l.id
      ${where}
      GROUP BY prod.id, l.id
      ORDER BY total_produced_qty DESC, l.line_number ASC
    `).all(...params);
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

  getLineSampleDashboardMetrics(filters = {}) {
    const parseDate = (value, label) => {
      if (!value) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} غير صالح.`);
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new Error(`${label} غير صالح.`);
      }
      return value;
    };
    const dateFrom = parseDate(filters.date_from, 'تاريخ البداية');
    const dateTo = parseDate(filters.date_to, 'تاريخ النهاية');
    const month = filters.month || null;
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('الشهر المحدد غير صالح.');
    if (dateFrom && dateTo && dateFrom > dateTo) throw new Error('تاريخ البداية يجب أن يسبق تاريخ النهاية.');

    const positiveId = (value, label) => {
      if (!value) return null;
      const id = Number(value);
      if (!Number.isInteger(id) || id < 1) throw new Error(`${label} غير صالح.`);
      return id;
    };
    const lineId = positiveId(filters.line_id, 'خط الإنتاج');
    const productId = positiveId(filters.product_id, 'المنتج');
    const reasonId = positiveId(filters.reason_id, 'العيب');
    const department = filters.department && filters.department !== 'all' ? filters.department : null;

    // Conditions applied on the unified inspections view
    const conditions = ['date(u.date) IS NOT NULL'];
    const params = [];
    if (dateFrom) { conditions.push('date(u.date) >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('date(u.date) <= ?'); params.push(dateTo); }
    if (month) { conditions.push('substr(date(u.date), 1, 7) = ?'); params.push(month); }
    if (lineId) { conditions.push('u.line_id = ?'); params.push(lineId); }
    if (productId) { conditions.push('u.product_id = ?'); params.push(productId); }
    if (department) {
      conditions.push('(l.department = ? OR prod.department = ?)');
      params.push(department, department);
    }
    if (reasonId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM (
          SELECT pull_id as insp_id, reason_id, 'line_pull' as src FROM line_sample_pull_defects
          UNION ALL
          SELECT pallet_id as insp_id, reason_id, 'pallet' as src FROM pallet_rejection_items
          UNION ALL
          SELECT hourly_sample_id as insp_id, reason_id, 'hourly' as src FROM hourly_sample_defects
        ) d_chk
        WHERE d_chk.insp_id = u.id AND d_chk.src = u.source AND d_chk.reason_id = ?
      )`);
      params.push(reasonId);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // CTE for unified inspection records from all sources (Line pulls, Pallets, Hourly samples)
    const baseCte = `
      WITH unified_inspections AS (
        SELECT 
          'line_pull' AS source,
          p.id,
          p.date,
          p.line_id,
          p.product_id,
          p.sample_count AS inspected_samples,
          (SELECT COALESCE(SUM(d.count), 0) FROM line_sample_pull_defects d WHERE d.pull_id = p.id) AS defect_count,
          COALESCE(p.completed_at, p.created_at) AS activity_time
        FROM line_sample_pulls p
        WHERE p.status = 'completed' AND p.sample_count > 0

        UNION ALL

        SELECT 
          'pallet' AS source,
          pal.id,
          pal.date,
          pal.line_id,
          pal.product_id,
          pal.inspected_quantity AS inspected_samples,
          (SELECT COALESCE(SUM(pri.count), 0) FROM pallet_rejection_items pri WHERE pri.pallet_id = pal.id) AS defect_count,
          COALESCE(pal.inspection_completed_at, pal.created_at) AS activity_time
        FROM pallets pal
        WHERE pal.inspected_quantity > 0

        UNION ALL

        SELECT 
          'hourly' AS source,
          h.id,
          h.date,
          h.line_id,
          h.product_id,
          h.sample_count AS inspected_samples,
          (SELECT COALESCE(SUM(hsd.count), 0) FROM hourly_sample_defects hsd WHERE hsd.hourly_sample_id = h.id) AS defect_count,
          COALESCE(h.updated_at, h.created_at) AS activity_time
        FROM hourly_samples h
        WHERE h.sample_count > 0
      )
    `;

    const fromUnified = `
      FROM unified_inspections u
      JOIN production_lines l ON l.id = u.line_id
      JOIN products prod ON prod.id = u.product_id
      ${whereSql}
    `;

    const aggregate = `
      COUNT(u.id) AS completed_pulls,
      COALESCE(SUM(u.inspected_samples), 0) AS inspected_samples,
      COALESCE(SUM(u.defect_count), 0) AS rejected_samples,
      COALESCE(SUM(u.defect_count), 0) AS defect_occurrences
    `;

    const withRate = rows => rows.map(row => ({
      ...row,
      rejection_rate: Number(row.inspected_samples) > 0
        ? Number(((row.rejected_samples / row.inspected_samples) * 100).toFixed(2))
        : null
    }));

    const totals = this.db.prepare(`
      ${baseCte}
      SELECT ${aggregate}, MAX(u.activity_time) AS last_updated
      ${fromUnified}
    `).get(...params);

    const daily = withRate(this.db.prepare(`
      ${baseCte}
      SELECT date(u.date) AS date, ${aggregate}
      ${fromUnified}
      GROUP BY date(u.date)
      ORDER BY date ASC
    `).all(...params));

    const dailyBreakdown = withRate(this.db.prepare(`
      ${baseCte}
      SELECT date(u.date) AS date, l.id AS line_id, l.line_number, l.name AS line_name,
             prod.id AS product_id, prod.name AS product_name, prod.code AS product_code,
             ${aggregate}
      ${fromUnified}
      GROUP BY date(u.date), l.id, l.line_number, l.name, prod.id, prod.name, prod.code
      ORDER BY date ASC, l.line_number ASC, prod.name COLLATE NOCASE
    `).all(...params));

    const products = withRate(this.db.prepare(`
      ${baseCte}
      SELECT prod.id AS product_id, prod.name AS product_name, prod.code AS product_code,
             ${aggregate}
      ${fromUnified}
      GROUP BY prod.id, prod.name, prod.code
      ORDER BY prod.name COLLATE NOCASE
    `).all(...params));

    const lineProducts = withRate(this.db.prepare(`
      ${baseCte}
      SELECT MIN(l.id) AS line_id, MIN(l.line_number) AS line_number, TRIM(l.name) AS line_name,
             prod.id AS product_id, prod.name AS product_name, prod.code AS product_code,
             ${aggregate}
      ${fromUnified}
      GROUP BY TRIM(l.name), prod.id, prod.name, prod.code
      ORDER BY MIN(l.line_number) ASC, prod.name COLLATE NOCASE
    `).all(...params));

    // Defect breakdown CTE for ALL defects from ALL sources
    const defectConditions = ['date(ud.date) IS NOT NULL'];
    const defectParams = [];
    if (dateFrom) { defectConditions.push('date(ud.date) >= ?'); defectParams.push(dateFrom); }
    if (dateTo) { defectConditions.push('date(ud.date) <= ?'); defectParams.push(dateTo); }
    if (month) { defectConditions.push('substr(date(ud.date), 1, 7) = ?'); defectParams.push(month); }
    if (lineId) { defectConditions.push('ud.line_id = ?'); defectParams.push(lineId); }
    if (productId) { defectConditions.push('ud.product_id = ?'); defectParams.push(productId); }
    if (department) {
      defectConditions.push('(l.department = ? OR prod.department = ?)');
      defectParams.push(department, department);
    }
    if (reasonId) {
      defectConditions.push('ud.reason_id = ?');
      defectParams.push(reasonId);
    }

    const defectWhereSql = defectConditions.length ? `WHERE ${defectConditions.join(' AND ')}` : '';

    const defectCte = `
      WITH unified_defects AS (
        SELECT 
          d.reason_id,
          d.count,
          p.date,
          p.line_id,
          p.product_id
        FROM line_sample_pull_defects d
        JOIN line_sample_pulls p ON p.id = d.pull_id
        WHERE p.status = 'completed'

        UNION ALL

        SELECT 
          pri.reason_id,
          pri.count,
          pal.date,
          pal.line_id,
          pal.product_id
        FROM pallet_rejection_items pri
        JOIN pallets pal ON pal.id = pri.pallet_id
        WHERE pal.inspected_quantity > 0

        UNION ALL

        SELECT 
          hsd.reason_id,
          hsd.count,
          h.date,
          h.line_id,
          h.product_id
        FROM hourly_sample_defects hsd
        JOIN hourly_samples h ON h.id = hsd.hourly_sample_id
      )
    `;

    const defectFrom = `
      FROM unified_defects ud
      JOIN rejection_reasons rr ON rr.id = ud.reason_id
      JOIN production_lines l ON l.id = ud.line_id
      JOIN products prod ON prod.id = ud.product_id
      ${defectWhereSql}
    `;

    const defects = this.db.prepare(`
      ${defectCte}
      SELECT rr.id AS reason_id, rr.name AS reason_name, rr.category,
             COALESCE(SUM(ud.count), 0) AS occurrences
      ${defectFrom}
      GROUP BY rr.id, rr.name, rr.category
      ORDER BY occurrences DESC, rr.name COLLATE NOCASE
    `).all(...defectParams);

    const totalDefectOccurrences = defects.reduce((sum, defect) => sum + Number(defect.occurrences || 0), 0);
    defects.forEach(defect => {
      defect.share = totalDefectOccurrences > 0
        ? Number(((defect.occurrences / totalDefectOccurrences) * 100).toFixed(2))
        : null;
    });

    const defectRelations = this.db.prepare(`
      ${defectCte}
      SELECT ud.reason_id, prod.id AS product_id, prod.name AS product_name, prod.code AS product_code,
             MIN(l.id) AS line_id, MIN(l.line_number) AS line_number, TRIM(l.name) AS line_name,
             COALESCE(SUM(ud.count), 0) AS occurrences
      ${defectFrom}
      GROUP BY ud.reason_id, prod.id, prod.name, prod.code, TRIM(l.name)
    `).all(...defectParams);

    const productDefects = this.db.prepare(`
      ${defectCte}
      SELECT prod.id AS product_id, ud.reason_id, rr.name AS reason_name,
             COALESCE(SUM(ud.count), 0) AS occurrences
      ${defectFrom}
      GROUP BY prod.id, ud.reason_id, rr.name
    `).all(...defectParams);

    const minimumSampleSize = 30;
    const bestItems = rows => {
      const eligible = rows.filter(row => Number(row.inspected_samples) >= minimumSampleSize && row.rejection_rate !== null);
      if (!eligible.length) return [];
      const bestRate = Math.min(...eligible.map(row => row.rejection_rate));
      return eligible.filter(row => Math.abs(row.rejection_rate - bestRate) < 0.005);
    };

    const bestLines = bestItems(withRate(this.db.prepare(`
      ${baseCte}
      SELECT MIN(l.id) AS line_id, MIN(l.line_number) AS line_number, TRIM(l.name) AS line_name, ${aggregate}
      ${fromUnified}
      GROUP BY TRIM(l.name)
    `).all(...params)));

    const bestProducts = bestItems(products);
    const maxDefects = defects.length ? defects[0].occurrences : 0;
    const minDefects = defects.length ? defects[defects.length - 1].occurrences : 0;

    return {
      filters: { date_from: dateFrom, date_to: dateTo, month, line_id: lineId, product_id: productId, reason_id: reasonId },
      totals: {
        completed_pulls: Number(totals.completed_pulls || 0),
        inspected_samples: Number(totals.inspected_samples || 0),
        rejected_pulls: Number(totals.rejected_samples || 0),
        rejected_samples: Number(totals.rejected_samples || 0),
        rejection_rate: Number(totals.inspected_samples) > 0
          ? Number(((totals.rejected_samples / totals.inspected_samples) * 100).toFixed(2))
          : null,
        total_defect_occurrences: totalDefectOccurrences,
        last_updated: totals.last_updated,
        invalid_date_records: 0
      },
      minimum_sample_size: minimumSampleSize,
      best_lines: bestLines,
      best_products: bestProducts,
      most_frequent_defects: defects.filter(defect => Number(defect.occurrences) === Number(maxDefects)),
      least_frequent_defects: defects.filter(defect => Number(defect.occurrences) === Number(minDefects)),
      daily,
      daily_breakdown: dailyBreakdown,
      products,
      line_products: lineProducts,
      defects,
      defect_relations: defectRelations,
      product_defects: productDefects
    };
  }

  getQualityDashboardMetrics(filters = {}) {
    const parseDate = (value, label) => {
      if (!value) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} غير صالح.`);
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new Error(`${label} غير صالح.`);
      }
      return value;
    };
    const dateFrom = parseDate(filters.date_from, 'تاريخ البداية');
    const dateTo = parseDate(filters.date_to, 'تاريخ النهاية');
    const month = filters.month || null;
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('الشهر المحدد غير صالح.');
    if (dateFrom && dateTo && dateFrom > dateTo) throw new Error('تاريخ البداية يجب أن يسبق تاريخ النهاية.');
    const positiveId = (value, label) => {
      if (!value) return null;
      const id = Number(value);
      if (!Number.isInteger(id) || id < 1) throw new Error(`${label} غير صالح.`);
      return id;
    };
    const lineId = positiveId(filters.line_id, 'خط الإنتاج');
    const productId = positiveId(filters.product_id, 'المنتج');
    const reasonId = positiveId(filters.reason_id, 'العيب');
    const department = filters.department && filters.department !== 'all' ? filters.department : null;

    const conditions = [
      "p.inspection_status = 'تم الفحص'",
      'date(p.inspection_date) IS NOT NULL'
    ];
    const invalidDateConditions = [];
    const invalidDateParams = [];
    const params = [];
    if (dateFrom) { conditions.push('date(p.inspection_date) >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('date(p.inspection_date) <= ?'); params.push(dateTo); }
    if (month) { conditions.push('substr(date(p.inspection_date), 1, 7) = ?'); params.push(month); }
    if (lineId) {
      conditions.push('p.line_id = ?'); params.push(lineId);
      invalidDateConditions.push('p.line_id = ?'); invalidDateParams.push(lineId);
    }
    if (productId) {
      conditions.push('p.product_id = ?'); params.push(productId);
      invalidDateConditions.push('p.product_id = ?'); invalidDateParams.push(productId);
    }
    if (department) {
      conditions.push('(p.department = ? OR l.department = ?)'); params.push(department, department);
      invalidDateConditions.push('(p.department = ? OR l.department = ?)'); invalidDateParams.push(department, department);
    }
    if (reasonId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM pallet_rejection_items selected_defect
        WHERE selected_defect.pallet_id = p.id AND selected_defect.reason_id = ?
      )`);
      params.push(reasonId);
      invalidDateConditions.push(`EXISTS (
        SELECT 1 FROM pallet_rejection_items selected_defect
        WHERE selected_defect.pallet_id = p.id AND selected_defect.reason_id = ?
      )`);
      invalidDateParams.push(reasonId);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const dateExpr = 'date(p.inspection_date)';
    const totals = this.db.prepare(`
      SELECT COUNT(p.id) AS inspected_records,
             COALESCE(SUM(p.inspected_quantity), 0) AS inspected_samples,
             COALESCE(SUM(p.rejected_quantity), 0) AS rejected_samples,
             MAX(p.updated_at) AS last_updated
      FROM pallets p
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      ${where}
    `).get(...params);
    const invalidDateRecords = this.db.prepare(`
      SELECT COUNT(p.id) AS count
      FROM pallets p
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      WHERE p.inspection_status = 'تم الفحص'
        AND date(p.inspection_date) IS NULL
        ${invalidDateConditions.length ? `AND ${invalidDateConditions.join(' AND ')}` : ''}
    `).get(...invalidDateParams).count;

    const daily = this.db.prepare(`
      SELECT ${dateExpr} AS date,
             COUNT(p.id) AS inspected_records,
             COALESCE(SUM(p.inspected_quantity), 0) AS inspected_samples,
             COALESCE(SUM(p.rejected_quantity), 0) AS rejected_samples
      FROM pallets p
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      ${where}
      GROUP BY ${dateExpr}
      ORDER BY date ASC
    `).all(...params).map(row => ({
      ...row,
      rejection_rate: Number(row.inspected_samples) > 0
        ? Number(((row.rejected_samples / row.inspected_samples) * 100).toFixed(2))
        : null
    }));

    const dailyBreakdown = this.db.prepare(`
      SELECT ${dateExpr} AS date, l.id AS line_id, l.name AS line_name,
             prod.id AS product_id, prod.name AS product_name, prod.code AS product_code,
             COUNT(p.id) AS inspected_records,
             COALESCE(SUM(p.inspected_quantity), 0) AS inspected_samples,
             COALESCE(SUM(p.rejected_quantity), 0) AS rejected_samples
      FROM pallets p
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      ${where}
      GROUP BY ${dateExpr}, l.id, l.name, prod.id, prod.name, prod.code
      ORDER BY date ASC, l.line_number ASC, prod.name COLLATE NOCASE
    `).all(...params);

    const products = this.db.prepare(`
      SELECT prod.id AS product_id, prod.name AS product_name, prod.code AS product_code,
             COUNT(p.id) AS inspected_records,
             COALESCE(SUM(p.inspected_quantity), 0) AS inspected_samples,
             COALESCE(SUM(p.rejected_quantity), 0) AS rejected_samples
      FROM pallets p
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      ${where}
      GROUP BY prod.id, prod.name, prod.code
      ORDER BY prod.name COLLATE NOCASE
    `).all(...params).map(row => ({
      ...row,
      rejection_rate: Number(row.inspected_samples) > 0
        ? Number(((row.rejected_samples / row.inspected_samples) * 100).toFixed(2))
        : null
    }));

    const lineProducts = this.db.prepare(`
      SELECT l.id AS line_id, l.line_number, l.name AS line_name,
             prod.id AS product_id, prod.name AS product_name, prod.code AS product_code,
             COUNT(p.id) AS inspected_records,
             COALESCE(SUM(p.inspected_quantity), 0) AS inspected_samples,
             COALESCE(SUM(p.rejected_quantity), 0) AS rejected_samples
      FROM pallets p
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      ${where}
      GROUP BY l.id, l.line_number, l.name, prod.id, prod.name, prod.code
      ORDER BY l.line_number ASC, prod.name COLLATE NOCASE
    `).all(...params).map(row => ({
      ...row,
      rejection_rate: Number(row.inspected_samples) > 0
        ? Number(((row.rejected_samples / row.inspected_samples) * 100).toFixed(2))
        : null
    }));

    const defects = this.db.prepare(`
      SELECT rr.id AS reason_id, rr.name AS reason_name, rr.category,
             COALESCE(SUM(pri.count), 0) AS occurrences
      FROM pallet_rejection_items pri
      JOIN pallets p ON p.id = pri.pallet_id
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      JOIN rejection_reasons rr ON rr.id = pri.reason_id
      ${where}
      ${reasonId ? 'AND rr.id = ?' : ''}
      GROUP BY rr.id, rr.name, rr.category
      ORDER BY occurrences DESC, rr.name COLLATE NOCASE
    `).all(...(reasonId ? [...params, reasonId] : params));
    const totalDefectOccurrences = defects.reduce((sum, defect) => sum + Number(defect.occurrences || 0), 0);
    defects.forEach(defect => {
      defect.share = totalDefectOccurrences > 0
        ? Number(((defect.occurrences / totalDefectOccurrences) * 100).toFixed(2))
        : null;
    });

    const defectRelations = this.db.prepare(`
      SELECT pri.reason_id, prod.id AS product_id, prod.name AS product_name, prod.code AS product_code,
             l.id AS line_id, l.line_number, l.name AS line_name,
             SUM(pri.count) AS occurrences
      FROM pallet_rejection_items pri
      JOIN pallets p ON p.id = pri.pallet_id
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      ${where}
      GROUP BY pri.reason_id, prod.id, prod.name, prod.code, l.id, l.line_number, l.name
    `).all(...params);

    const productDefects = this.db.prepare(`
      SELECT prod.id AS product_id, pri.reason_id, rr.name AS reason_name, SUM(pri.count) AS occurrences
      FROM pallet_rejection_items pri
      JOIN pallets p ON p.id = pri.pallet_id
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      JOIN rejection_reasons rr ON rr.id = pri.reason_id
      ${where}
      GROUP BY prod.id, pri.reason_id, rr.name
    `).all(...params);

    const minimumSampleSize = 30;
    const selectBest = rows => {
      const eligible = rows.filter(row => Number(row.inspected_samples) >= minimumSampleSize && row.rejection_rate !== null);
      if (!eligible.length) return [];
      const bestRate = Math.min(...eligible.map(row => row.rejection_rate));
      return eligible.filter(row => Math.abs(row.rejection_rate - bestRate) < 0.005);
    };
    const bestLines = selectBest(this.db.prepare(`
      SELECT l.id AS line_id, l.line_number, l.name AS line_name,
             COUNT(p.id) AS inspected_records,
             COALESCE(SUM(p.inspected_quantity), 0) AS inspected_samples,
             COALESCE(SUM(p.rejected_quantity), 0) AS rejected_samples
      FROM pallets p
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      ${where}
      GROUP BY l.id, l.line_number, l.name
    `).all(...params).map(row => ({
      ...row,
      rejection_rate: Number(row.inspected_samples) > 0
        ? Number(((row.rejected_samples / row.inspected_samples) * 100).toFixed(2))
        : null
    })));
    const bestProducts = selectBest(products);

    const bestDefect = defects.length ? defects[0].occurrences : 0;
    const leastDefect = defects.length ? defects[defects.length - 1].occurrences : 0;
    const bestDefects = defects.filter(defect => Number(defect.occurrences) === Number(bestDefect));
    const leastDefects = defects.filter(defect => Number(defect.occurrences) === Number(leastDefect));

    return {
      filters: { date_from: dateFrom, date_to: dateTo, month, line_id: lineId, product_id: productId, reason_id: reasonId },
      totals: {
        inspected_records: Number(totals.inspected_records || 0),
        inspected_samples: Number(totals.inspected_samples || 0),
        rejected_samples: Number(totals.rejected_samples || 0),
        rejection_rate: Number(totals.inspected_samples) > 0
          ? Number(((totals.rejected_samples / totals.inspected_samples) * 100).toFixed(2))
          : null,
        total_defect_occurrences: totalDefectOccurrences,
        last_updated: totals.last_updated,
        invalid_date_records: Number(invalidDateRecords || 0)
      },
      minimum_sample_size: minimumSampleSize,
      best_lines: bestLines,
      best_products: bestProducts,
      most_frequent_defects: bestDefects,
      least_frequent_defects: leastDefects,
      daily,
      daily_breakdown: dailyBreakdown,
      products,
      line_products: lineProducts,
      defects,
      defect_relations: defectRelations,
      product_defects: productDefects
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

  createQuickRejectionReason(name, department, currentUserId, currentUserName) {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) throw new Error('اكتب اسم العيب أولاً.');
    const normalizedDepartment = department === 'all' || department === null || department === undefined ? null : department;
    if (normalizedDepartment !== null && !['home', 'seria'].includes(normalizedDepartment)) {
      throw new Error('قسم العيب غير صالح.');
    }
    const existing = normalizedDepartment === null
      ? this.db.prepare(`
      SELECT id, department FROM rejection_reasons
      WHERE name = ? COLLATE NOCASE AND is_active = 1
      ORDER BY id LIMIT 1
    `).get(normalizedName)
      : this.db.prepare(`
      SELECT id FROM rejection_reasons
      WHERE name = ? COLLATE NOCASE AND (department = ? OR department IS NULL) AND is_active = 1
    `).get(normalizedName, normalizedDepartment);
    if (existing) {
      if (normalizedDepartment === null && existing.department !== null) {
        this.db.prepare('UPDATE rejection_reasons SET department = NULL WHERE id = ?').run(existing.id);
        this.logAudit(currentUserId, currentUserName, 'UPDATE', 'rejection_reasons', existing.id, `مشاركة سبب العيب بين الجودة والهوالك: ${normalizedName}`);
      }
      return this.db.prepare('SELECT * FROM rejection_reasons WHERE id = ?').get(existing.id);
    }

    const codePrefix = `DEF-Q-${Date.now().toString(36).toUpperCase()}`;
    let code = '';
    let suffix = 1;
    while (!code) {
      const candidate = `${codePrefix}-${suffix++}`;
      if (!this.db.prepare('SELECT id FROM rejection_reasons WHERE code = ?').get(candidate)) code = candidate;
    }
    const result = this.db.prepare(`
      INSERT INTO rejection_reasons (code, name, category, is_active, department)
      VALUES (?, ?, 'عام', 1, ?)
    `).run(code, normalizedName, normalizedDepartment);
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'rejection_reasons', result.lastInsertRowid, `إضافة سبب عيب سريع: ${normalizedName}`);
    return this.db.prepare('SELECT * FROM rejection_reasons WHERE id = ?').get(result.lastInsertRowid);
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

  getScrapReports(date = null) {
    const query = date
      ? this.db.prepare('SELECT * FROM scrap_reports WHERE report_date = ? ORDER BY id DESC')
      : this.db.prepare('SELECT * FROM scrap_reports ORDER BY report_date DESC, id DESC');
    const rows = date ? query.all(date) : query.all();
    return rows.map(row => ({
      ...row,
      causes: JSON.parse(row.causes_json),
      periods: JSON.parse(row.periods_json),
      items: JSON.parse(row.items_json || '[]')
    }));
  }

  saveScrapReport(data, id = null) {
    if (!data.report_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.report_date)) {
      throw new Error('تاريخ التقرير غير صالح.');
    }
    if (!Array.isArray(data.causes) || !Array.isArray(data.periods)) {
      throw new Error('بيانات أسباب وفترات التقرير غير صالحة.');
    }
    if (data.report_type && !['hourly', 'manual'].includes(data.report_type)) {
      throw new Error('نوع تقرير الهالك غير صالح.');
    }
    const reportType = data.report_type || 'hourly';
    const items = data.items === undefined ? [] : data.items;
    if (!Array.isArray(items)) throw new Error('بيانات أصناف تقرير الهالك غير صالحة.');
    if (reportType === 'manual') {
      if (!items.length) throw new Error('أضف صنفًا واحدًا على الأقل لتقرير الهالك بدون فترات.');
      for (const item of items) {
        const quantity = Number(item.quantity);
        if (!String(item.line_name || '').trim() || !String(item.product_name || '').trim()
          || !String(item.reason_name || '').trim() || !Number.isSafeInteger(quantity) || quantity < 1) {
          throw new Error('أكمل الخط والمنتج والسبب وأدخل كمية صحيحة لكل صنف.');
        }
      }
    }

    const values = [
      data.report_date,
      String(data.line_name || ''),
      JSON.stringify(data.causes),
      JSON.stringify(data.periods),
      reportType,
      JSON.stringify(items),
      String(data.production_supervisor || ''),
      String(data.quality_supervisor || ''),
      String(data.recommendation || '')
    ];

    if (id) {
      const result = this.db.prepare(`
        UPDATE scrap_reports
        SET report_date = ?, line_name = ?, causes_json = ?, periods_json = ?, report_type = ?, items_json = ?,
            production_supervisor = ?, quality_supervisor = ?, recommendation = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(...values, id);
      if (!result.changes) throw new Error('تقرير الهالك المطلوب غير موجود.');
      return this.getScrapReportsById(id);
    }

    const result = this.db.prepare(`
      INSERT INTO scrap_reports (
        report_date, line_name, causes_json, periods_json, report_type, items_json,
        production_supervisor, quality_supervisor, recommendation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...values);
    return this.getScrapReportsById(result.lastInsertRowid);
  }

  getScrapReportsById(id) {
    const row = this.db.prepare('SELECT * FROM scrap_reports WHERE id = ?').get(id);
    if (!row) return null;
    return {
      ...row,
      causes: JSON.parse(row.causes_json),
      periods: JSON.parse(row.periods_json),
      items: JSON.parse(row.items_json || '[]')
    };
  }

  deleteScrapReport(id) {
    const result = this.db.prepare('DELETE FROM scrap_reports WHERE id = ?').run(id);
    if (!result.changes) throw new Error('تقرير الهالك المطلوب غير موجود.');
    return true;
  }

  getSecondSortHandoverReports(date = null) {
    const rows = date
      ? this.db.prepare('SELECT * FROM second_sort_handover_reports WHERE report_date = ? ORDER BY id DESC').all(date)
      : this.db.prepare('SELECT * FROM second_sort_handover_reports ORDER BY report_date DESC, id DESC').all();
    return rows.map(row => {
      const item = JSON.parse(row.item_json);
      item.image_data = '';
      item.images = [];
      return { ...row, item };
    });
  }

  getSecondSortHandoverReportById(id) {
    const row = this.db.prepare('SELECT * FROM second_sort_handover_reports WHERE id = ?').get(id);
    if (!row) return null;
    const item = JSON.parse(row.item_json);
    // Ensure images array exists (backward compatibility with single image_data)
    if (!Array.isArray(item.images)) {
      item.images = item.image_data ? [item.image_data] : [];
    }
    return { ...row, item };
  }

  saveSecondSortHandoverReport(data, id = null) {
    const parsedDate = Date.parse(`${data.report_date}T00:00:00Z`);
    if (!data.report_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.report_date)
      || Number.isNaN(parsedDate)
      || new Date(parsedDate).toISOString().slice(0, 10) !== data.report_date) {
      throw new Error('تاريخ التقرير غير صالح.');
    }
    const item = data.item;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('بيانات الصنف غير صالحة.');
    }

    // Process images array (supports multiple images up to 5 images, plus legacy image_data)
    let images = [];
    if (Array.isArray(item.images)) {
      images = item.images.map(img => String(img || '').trim()).filter(Boolean);
    } else if (item.image_data) {
      images = [String(item.image_data).trim()];
    }

    if (images.length > 5) {
      throw new Error('يمكنك إضافة حتى 5 صور كحد أقصى.');
    }

    for (const img of images) {
      if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(img) || img.length > 2_500_000) {
        throw new Error('إحدى الصور غير صالحة أو حجمها أكبر من المسموح.');
      }
    }

    let signatures = [];
    if (Array.isArray(item.signatures)) {
      signatures = item.signatures.slice(0, 8).map(signature => ({
        title: String(signature?.title || '').trim().slice(0, 80),
        name: String(signature?.name || '').trim().slice(0, 80)
      })).filter(signature => signature.title || signature.name);
    } else {
      signatures = [
        { title: 'توقيع مشرف الهوالك', name: '' },
        { title: 'توقيع مشرف الفرز الثاني والهالك', name: '' }
      ];
    }

    const cleanItem = {
      product_model: String(item.product_model || '').trim(),
      problem: String(item.problem || '').trim(),
      images: images,
      image_data: images[0] || '', // legacy compatibility
      discount_percent: item.discount_percent === '' || item.discount_percent === null || item.discount_percent === undefined
        ? null
        : Number(item.discount_percent),
      quantity: item.quantity === '' || item.quantity === null || item.quantity === undefined
        ? null
        : Number(item.quantity),
      font_scale: item.font_scale === '' || item.font_scale === null || item.font_scale === undefined
        ? 1
        : Number(item.font_scale),
      approval: String(item.approval || '').trim(),
      signatures
    };
    if (!cleanItem.product_model || !cleanItem.problem || !Number.isSafeInteger(cleanItem.quantity) || cleanItem.quantity < 0) {
      throw new Error('يرجى إدخال اسم الموديل والمشكلة والكمية الصحيحة.');
    }
    if (cleanItem.discount_percent !== null
      && (!Number.isFinite(cleanItem.discount_percent) || cleanItem.discount_percent < 0 || cleanItem.discount_percent > 100)) {
      throw new Error('نسبة الخصم يجب أن تكون بين 0 و100.');
    }
    if (!Number.isFinite(cleanItem.font_scale) || cleanItem.font_scale < 0.8 || cleanItem.font_scale > 1.5) {
      throw new Error('حجم خط التقرير يجب أن يكون بين 80٪ و150٪.');
    }
    const values = [data.report_date, JSON.stringify(cleanItem)];
    if (id) {
      const result = this.db.prepare(`
        UPDATE second_sort_handover_reports
        SET report_date = ?, item_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(...values, id);
      if (!result.changes) throw new Error('تقرير تسليم الفرز الثاني غير موجود.');
      return this.getSecondSortHandoverReportById(id);
    }

    const result = this.db.prepare(`
      INSERT INTO second_sort_handover_reports (report_date, item_json) VALUES (?, ?)
    `).run(...values);
    return this.getSecondSortHandoverReportById(result.lastInsertRowid);
  }

  deleteSecondSortHandoverReport(id) {
    const result = this.db.prepare('DELETE FROM second_sort_handover_reports WHERE id = ?').run(id);
    if (!result.changes) throw new Error('تقرير تسليم الفرز الثاني غير موجود.');
    return true;
  }

  // ==========================================
  // HOURLY SAMPLE SLOTS API
  // ==========================================
  getLineSampleSlots(activeOnly = true) {
    const where = activeOnly ? 'WHERE is_active = 1' : '';
    return this.db.prepare(`
      SELECT id, start_time, end_time, display_order, is_active,
             start_time || '–' || end_time AS slot_name
      FROM line_sample_slots
      ${where}
      ORDER BY start_time ASC, display_order ASC, id ASC
    `).all();
  }

  createLineSampleSlot(data, currentUserId, currentUserName) {
    const startTime = String(data.start_time || '');
    const endTime = String(data.end_time || '');
    const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!validTime(startTime) || !validTime(endTime) || endTime <= startTime) {
      throw new Error('حدد وقت بداية ونهاية صحيحين، ويجب أن تكون النهاية بعد البداية.');
    }
    if (this.db.prepare(`
      SELECT id FROM line_sample_slots
      WHERE is_active = 1 AND start_time = ? AND end_time = ?
    `).get(startTime, endTime)) {
      throw new Error('فترة السحب هذه مضافة بالفعل.');
    }
    if (this.db.prepare(`
      SELECT id FROM line_sample_slots
      WHERE is_active = 1 AND start_time < ? AND end_time > ?
    `).get(endTime, startTime)) {
      throw new Error('فترة السحب تتداخل مع فترة أخرى مضافة.');
    }
    const order = this.db.prepare('SELECT COALESCE(MAX(display_order), 0) AS max_order FROM line_sample_slots WHERE is_active = 1').get().max_order;
    const result = this.db.prepare(`
      INSERT INTO line_sample_slots (start_time, end_time, display_order)
      VALUES (?, ?, ?)
    `).run(startTime, endTime, order + 1);
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'line_sample_slots', result.lastInsertRowid, `إضافة فترة سحب عينات للخطوط: ${startTime}–${endTime}`);
    return this.getLineSampleSlots(false).find(slot => Number(slot.id) === Number(result.lastInsertRowid));
  }

  deleteLineSampleSlot(id, currentUserId, currentUserName) {
    const slot = this.db.prepare('SELECT start_time, end_time FROM line_sample_slots WHERE id = ? AND is_active = 1').get(id);
    if (!slot) throw new Error('فترة السحب غير موجودة.');
    this.db.prepare('UPDATE line_sample_slots SET is_active = 0 WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'line_sample_slots', id, `إيقاف فترة سحب عينات للخطوط: ${slot.start_time}–${slot.end_time}`);
    return true;
  }

  getLineSamplePeriodStatuses(date) {
    const parsedDate = Date.parse(`${date || ''}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')
      || Number.isNaN(parsedDate)
      || new Date(parsedDate).toISOString().slice(0, 10) !== date) {
      throw new Error('تاريخ الملخص غير صالح.');
    }
    return this.db.prepare(`
      SELECT date, slot_id, line_id, is_stopped, no_sample_reason
      FROM line_sample_period_statuses
      WHERE date = ?
    `).all(date);
  }

  saveLineSamplePeriodStatus(data, currentUserId, currentUserName) {
    if (!data || typeof data !== 'object') throw new Error('بيانات حالة الخط غير صالحة.');
    const date = String(data.date || '');
    const parsedDate = Date.parse(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
      || Number.isNaN(parsedDate)
      || new Date(parsedDate).toISOString().slice(0, 10) !== date) {
      throw new Error('تاريخ الملخص غير صالح.');
    }
    const slotId = Number(data.slot_id);
    const lineId = Number(data.line_id);
    if (!Number.isSafeInteger(slotId) || slotId < 1 || !Number.isSafeInteger(lineId) || lineId < 1) {
      throw new Error('حدد فترة وخط إنتاج صحيحين.');
    }
    if (![true, false, 0, 1, '0', '1'].includes(data.is_stopped)) {
      throw new Error('حدد حالة الخط: يعمل أو متوقف.');
    }
    const isStopped = data.is_stopped === true || data.is_stopped === 1 || data.is_stopped === '1' ? 1 : 0;
    const reason = String(data.no_sample_reason || '').trim();
    if (reason.length > 500) throw new Error('سبب عدم السحب يجب ألا يتجاوز 500 حرف.');
    if (!this.db.prepare('SELECT id FROM production_lines WHERE id = ?').get(lineId)) {
      throw new Error('خط الإنتاج المحدد غير موجود.');
    }
    if (!this.db.prepare('SELECT id FROM line_sample_slots WHERE id = ?').get(slotId)) {
      throw new Error('فترة السحب المحددة غير موجودة.');
    }
    const hasPull = this.db.prepare(`
      SELECT 1 FROM line_sample_pulls
      WHERE date = ? AND slot_id = ? AND line_id = ?
      LIMIT 1
    `).get(date, slotId, lineId);
    if (!hasPull && !reason) throw new Error('اكتب سبب عدم السحب لهذا الخط والفترة.');

    this.db.prepare(`
      INSERT INTO line_sample_period_statuses (date, slot_id, line_id, is_stopped, no_sample_reason, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(date, slot_id, line_id) DO UPDATE SET
        is_stopped = excluded.is_stopped,
        no_sample_reason = excluded.no_sample_reason,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).run(date, slotId, lineId, isStopped, reason, currentUserId || null);
    this.logAudit(
      currentUserId,
      currentUserName,
      'UPDATE',
      'line_sample_period_statuses',
      lineId,
      `تسجيل حالة الخط لفترة سحب ${slotId}: ${isStopped ? 'متوقف' : 'يعمل'}${reason ? `، سبب عدم السحب: ${reason}` : ''}`
    );
    return this.db.prepare(`
      SELECT date, slot_id, line_id, is_stopped, no_sample_reason
      FROM line_sample_period_statuses
      WHERE date = ? AND slot_id = ? AND line_id = ?
    `).get(date, slotId, lineId);
  }

  getHourlySlots(department = null) {
    let sql = 'SELECT * FROM hourly_sample_slots WHERE is_active = 1';
    const params = [];
    if (department && department !== 'all') {
      sql += ' AND (department = ? OR department = "all")';
      params.push(department);
    }
    sql += ' ORDER BY display_order ASC, start_time ASC';
    return this.db.prepare(sql).all(...params);
  }

  createHourlySlot(data, currentUserId, currentUserName) {
    const maxOrder = this.db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM hourly_sample_slots').get().m;
    const stmt = this.db.prepare(`
      INSERT INTO hourly_sample_slots (slot_name, start_time, end_time, display_order, department, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      data.slot_name,
      data.start_time,
      data.end_time,
      data.display_order ? parseInt(data.display_order, 10) : maxOrder + 1,
      data.department || 'all',
      data.is_active ?? 1
    );
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'hourly_sample_slots', res.lastInsertRowid, `إضافة فترة سحب عينات بالساعة: ${data.slot_name}`);
    return this.db.prepare('SELECT * FROM hourly_sample_slots WHERE id = ?').get(res.lastInsertRowid);
  }

  updateHourlySlot(id, data, currentUserId, currentUserName) {
    const stmt = this.db.prepare(`
      UPDATE hourly_sample_slots
      SET slot_name = ?, start_time = ?, end_time = ?, display_order = ?, department = ?, is_active = ?
      WHERE id = ?
    `);
    stmt.run(
      data.slot_name,
      data.start_time,
      data.end_time,
      parseInt(data.display_order || 1, 10),
      data.department || 'all',
      data.is_active ?? 1,
      id
    );
    this.logAudit(currentUserId, currentUserName, 'UPDATE', 'hourly_sample_slots', id, `تعديل فترة سحب عينات: ${data.slot_name}`);
    return this.db.prepare('SELECT * FROM hourly_sample_slots WHERE id = ?').get(id);
  }

  deleteHourlySlot(id, currentUserId, currentUserName) {
    this.db.prepare('DELETE FROM hourly_sample_slots WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'hourly_sample_slots', id, `حذف فترة سحب عينات رقم: ${id}`);
    return true;
  }

  getInspectionStations() {
    return this.db.prepare(`
      SELECT s.*, i.name AS inspector_name
      FROM inspection_stations s
      LEFT JOIN quality_inspectors i ON i.id = s.default_inspector_id
      WHERE s.is_active = 1
      ORDER BY s.id ASC
    `).all();
  }

  createInspectionStation(name, inspectorId, currentUserId, currentUserName) {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) throw new Error('اسم محطة الفحص مطلوب.');
    const parsedInspectorId = Number(inspectorId);
    if (!Number.isInteger(parsedInspectorId) || parsedInspectorId < 1) {
      throw new Error('اختر المراقب المسؤول عن محطة الفحص.');
    }
    const inspector = this.db.prepare('SELECT id, name FROM quality_inspectors WHERE id = ? AND is_active = 1').get(parsedInspectorId);
    if (!inspector) throw new Error('المراقب المحدد غير متاح. حدّث الصفحة ثم حاول مرة أخرى.');
    if (this.db.prepare('SELECT id FROM inspection_stations WHERE name = ? AND is_active = 1').get(normalizedName)) {
      throw new Error('اسم محطة الفحص مسجل بالفعل.');
    }
    const result = this.db.prepare('INSERT INTO inspection_stations (name, default_inspector_id) VALUES (?, ?)').run(normalizedName, parsedInspectorId);
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'inspection_stations', result.lastInsertRowid, `إضافة محطة فحص: ${normalizedName}، المراقب: ${inspector.name}`);
    return this.getInspectionStations().find(station => Number(station.id) === Number(result.lastInsertRowid));
  }

  updateInspectionStation(id, inspectorId, currentUserId, currentUserName) {
    const stationId = Number(id);
    const parsedInspectorId = Number(inspectorId);
    const station = this.db.prepare('SELECT id, name FROM inspection_stations WHERE id = ? AND is_active = 1').get(stationId);
    if (!station) throw new Error('محطة الفحص غير موجودة.');
    if (!Number.isInteger(parsedInspectorId) || parsedInspectorId < 1) {
      throw new Error('اختر المراقب المسؤول عن محطة الفحص.');
    }
    const inspector = this.db.prepare('SELECT id, name FROM quality_inspectors WHERE id = ? AND is_active = 1').get(parsedInspectorId);
    if (!inspector) throw new Error('المراقب المحدد غير متاح. حدّث الصفحة ثم حاول مرة أخرى.');
    this.db.prepare('UPDATE inspection_stations SET default_inspector_id = ? WHERE id = ?').run(parsedInspectorId, stationId);
    this.logAudit(currentUserId, currentUserName, 'UPDATE', 'inspection_stations', stationId, `تعديل مراقب محطة الفحص ${station.name}: ${inspector.name}`);
    return this.getInspectionStations().find(item => Number(item.id) === stationId);
  }

  deleteInspectionStation(id, currentUserId, currentUserName) {
    const station = this.db.prepare('SELECT name FROM inspection_stations WHERE id = ? AND is_active = 1').get(id);
    if (!station) throw new Error('محطة الفحص غير موجودة.');
    this.db.prepare('UPDATE inspection_stations SET is_active = 0 WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'inspection_stations', id, `إيقاف محطة فحص: ${station.name}`);
    return true;
  }

  getLineSamplePulls(filters = {}) {
    let sql = `
      SELECT p.*, l.line_number, l.name AS line_name, prod.name AS product_name,
             s.name AS station_name, i.name AS inspector_name,
             ai.name AS additional_inspector_name,
             COALESCE(slot.start_time || '–' || slot.end_time, p.start_time || '–' || p.end_time) AS slot_name,
             (SELECT COALESCE(SUM(d.count), 0) FROM line_sample_pull_defects d WHERE d.pull_id = p.id) AS total_defect_count
      FROM line_sample_pulls p
      JOIN production_lines l ON l.id = p.line_id
      JOIN products prod ON prod.id = p.product_id
      JOIN inspection_stations s ON s.id = p.station_id
      JOIN quality_inspectors i ON i.id = p.inspector_id
      LEFT JOIN quality_inspectors ai ON ai.id = p.additional_inspector_id
      LEFT JOIN line_sample_slots slot ON slot.id = p.slot_id
      WHERE 1 = 1
    `;
    const params = [];
    if (filters.date) { sql += ' AND p.date = ?'; params.push(filters.date); }
    if (filters.slot_id) { sql += ' AND p.slot_id = ?'; params.push(Number.parseInt(filters.slot_id, 10)); }
    if (filters.line_id) { sql += ' AND p.line_id = ?'; params.push(Number.parseInt(filters.line_id, 10)); }
    if (filters.status) { sql += ' AND p.status = ?'; params.push(filters.status); }
    if (filters.department && filters.department !== 'all') {
      sql += ' AND l.department = ?';
      params.push(filters.department);
    }
    sql += ' ORDER BY p.date DESC, p.start_time DESC, p.id DESC';
    const pulls = this.db.prepare(sql).all(...params);
    const getDefects = this.db.prepare(`
      SELECT d.reason_id, r.name AS reason_name, d.count, d.notes
      FROM line_sample_pull_defects d
      JOIN rejection_reasons r ON r.id = d.reason_id
      WHERE d.pull_id = ?
      ORDER BY d.id ASC
    `);
    return pulls.map(pull => ({ ...pull, defects: getDefects.all(pull.id) }));
  }

  validateAdditionalPullInspector(data, primaryInspectorId, totalSamples) {
    const rawInspectorId = data.additional_inspector_id;
    const rawSampleCount = data.additional_sample_count;
    const inspectorId = rawInspectorId == null || rawInspectorId === '' ? null : Number(rawInspectorId);
    const sampleCount = rawSampleCount == null || rawSampleCount === '' ? 0 : Number(rawSampleCount);
    if (inspectorId === null && sampleCount === 0) {
      return { inspectorId: null, sampleCount: 0 };
    }
    if (!Number.isInteger(inspectorId) || inspectorId < 1) {
      throw new Error('اختر المراقب الإضافي أو اترك عدد عيناته صفرًا.');
    }
    if (inspectorId === Number(primaryInspectorId)) {
      throw new Error('يجب اختيار مراقب إضافي مختلف عن المراقب الأساسي.');
    }
    if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > totalSamples) {
      throw new Error('عدد عينات المراقب الإضافي يجب أن يكون من 1 إلى إجمالي عينات السحبة.');
    }
    const inspector = this.db.prepare('SELECT id FROM quality_inspectors WHERE id = ? AND is_active = 1').get(inspectorId);
    if (!inspector) throw new Error('المراقب الإضافي غير متاح. حدّث الصفحة ثم حاول مرة أخرى.');
    return { inspectorId, sampleCount };
  }

  createLineSamplePull(data, currentUserId, currentUserName) {
    const isPositiveId = value => Number.isInteger(Number(value)) && Number(value) > 0;
    const parsedDate = data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
      ? new Date(`${data.date}T00:00:00.000Z`)
      : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== data.date) {
      throw new Error('تاريخ السحب غير صالح.');
    }
    if (![data.slot_id, data.line_id, data.product_id, data.station_id, data.inspector_id].every(isPositiveId)) {
      throw new Error('يرجى اختيار فترة السحب والخط والمنتج ومحطة الفحص والمراقب.');
    }
    const sampleCount = Number(data.sample_count);
    if (!Number.isInteger(sampleCount) || sampleCount < 1) throw new Error('عدد العينات يجب أن يكون عددًا صحيحًا أكبر من صفر.');
    const additional = this.validateAdditionalPullInspector(data, data.inspector_id, sampleCount);

    const slot = this.db.prepare('SELECT id, start_time, end_time FROM line_sample_slots WHERE id = ? AND is_active = 1').get(Number(data.slot_id));
    const station = this.db.prepare('SELECT id FROM inspection_stations WHERE id = ? AND is_active = 1').get(Number(data.station_id));
    const inspector = this.db.prepare('SELECT id FROM quality_inspectors WHERE id = ? AND is_active = 1').get(Number(data.inspector_id));
    const line = this.db.prepare('SELECT id, department FROM production_lines WHERE id = ?').get(Number(data.line_id));
    const product = this.db.prepare('SELECT id, department FROM products WHERE id = ?').get(Number(data.product_id));
    if (!slot || !station || !inspector || !line || !product) throw new Error('أحد الاختيارات لم يعد متاحًا. حدّث الصفحة ثم حاول مرة أخرى.');
    if (line.department && product.department && line.department !== product.department) {
      throw new Error('المنتج المختار لا يتبع قسم الخط المحدد.');
    }

    const result = this.db.prepare(`
      INSERT INTO line_sample_pulls (
        date, start_time, end_time, slot_id, line_id, product_id, station_id,
        inspector_id, additional_inspector_id, sample_count, additional_sample_count, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      data.date, slot.start_time, slot.end_time, Number(data.slot_id), Number(data.line_id),
      Number(data.product_id), Number(data.station_id), Number(data.inspector_id),
      additional.inspectorId, sampleCount, additional.sampleCount, currentUserId || null
    );
    this.logAudit(currentUserId, currentUserName, 'CREATE', 'line_sample_pulls', result.lastInsertRowid, `تسجيل سحبة خط رقم ${result.lastInsertRowid} (${sampleCount} عينة)`);
    return this.getLineSamplePulls({}).find(pull => Number(pull.id) === Number(result.lastInsertRowid));
  }

  completeLineSamplePull(id, defects, palletRejected, currentUserId, currentUserName) {
    if (!Array.isArray(defects)) throw new Error('بيانات العيوب غير صالحة.');
    if (![true, false, 0, 1, '0', '1'].includes(palletRejected)) {
      throw new Error('حدد ما إذا كانت البالتة مرفوضة أم مقبولة.');
    }
    const pull = this.db.prepare('SELECT id, status FROM line_sample_pulls WHERE id = ?').get(id);
    if (!pull) throw new Error('سحبة العينات غير موجودة.');
    if (pull.status === 'completed') throw new Error('تم إنهاء فحص هذه السحبة بالفعل.');
    const rejected = palletRejected === true || palletRejected === 1 || palletRejected === '1';

    const insertDefect = this.db.prepare(`
      INSERT INTO line_sample_pull_defects (pull_id, reason_id, count, notes)
      VALUES (?, ?, ?, ?)
    `);
    const updatePull = this.db.prepare(`
      UPDATE line_sample_pulls
      SET status = 'completed', defect_count = ?, pallet_rejected = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `);
    const totalDefects = defects.reduce((sum, defect) => sum + Number(defect.count || 0), 0);

    this.db.exec('BEGIN');
    try {
      const update = updatePull.run(totalDefects, Number(rejected), id);
      if (!update.changes) throw new Error('تم إنهاء فحص هذه السحبة بالفعل.');
      for (const defect of defects) {
        const reasonId = Number(defect.reason_id);
        const count = Number(defect.count);
        if (!Number.isInteger(reasonId) || reasonId < 1 || !Number.isInteger(count) || count < 1) {
          throw new Error('سبب العيب وعدده غير صالحين.');
        }
        const reason = this.db.prepare('SELECT id FROM rejection_reasons WHERE id = ? AND is_active = 1').get(reasonId);
        if (!reason) throw new Error('أحد أسباب العيوب لم يعد متاحًا. حدّث الصفحة ثم حاول مرة أخرى.');
        insertDefect.run(id, reasonId, count, String(defect.notes || '').trim() || null);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    this.logAudit(currentUserId, currentUserName, 'COMPLETE', 'line_sample_pulls', id, `إنهاء فحص سحبة عينات (${totalDefects} عيب، البالتة ${rejected ? 'مرفوضة' : 'مقبولة'})`);
    return this.getLineSamplePulls({}).find(item => Number(item.id) === Number(id));
  }

  updateLineSamplePull(id, data, currentUserId, currentUserName) {
    const pullId = Number(id);
    const existing = this.db.prepare('SELECT id, status FROM line_sample_pulls WHERE id = ?').get(pullId);
    if (!existing) throw new Error('سحبة العينات غير موجودة.');

    const isPositiveId = value => Number.isInteger(Number(value)) && Number(value) > 0;
    const parsedDate = data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
      ? new Date(`${data.date}T00:00:00.000Z`)
      : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== data.date) {
      throw new Error('تاريخ السحب غير صالح.');
    }
    if (![data.slot_id, data.line_id, data.product_id, data.station_id, data.inspector_id].every(isPositiveId)) {
      throw new Error('يرجى اختيار فترة السحب والخط والمنتج ومحطة الفحص والمراقب.');
    }
    const sampleCount = Number(data.sample_count);
    if (!Number.isInteger(sampleCount) || sampleCount < 1) throw new Error('عدد العينات يجب أن يكون عددًا صحيحًا أكبر من صفر.');
    const additional = this.validateAdditionalPullInspector(data, data.inspector_id, sampleCount);

    const slot = this.db.prepare('SELECT id, start_time, end_time FROM line_sample_slots WHERE id = ? AND is_active = 1').get(Number(data.slot_id));
    const station = this.db.prepare('SELECT id FROM inspection_stations WHERE id = ? AND is_active = 1').get(Number(data.station_id));
    const inspector = this.db.prepare('SELECT id FROM quality_inspectors WHERE id = ? AND is_active = 1').get(Number(data.inspector_id));
    const line = this.db.prepare('SELECT id, department FROM production_lines WHERE id = ?').get(Number(data.line_id));
    const product = this.db.prepare('SELECT id, department FROM products WHERE id = ?').get(Number(data.product_id));
    if (!slot || !station || !inspector || !line || !product) {
      throw new Error('أحد الاختيارات لم يعد متاحًا. حدّث الصفحة ثم حاول مرة أخرى.');
    }
    if (line.department && product.department && line.department !== product.department) {
      throw new Error('المنتج المختار لا يتبع قسم الخط المحدد.');
    }

    const defects = data.defects === undefined ? [] : data.defects;
    if (!Array.isArray(defects)) throw new Error('بيانات العيوب غير صالحة.');
    if (data.pallet_rejected !== undefined && ![true, false, 0, 1, '0', '1'].includes(data.pallet_rejected)) {
      throw new Error('حالة رفض البالتة غير صالحة.');
    }
    const palletRejected = data.pallet_rejected === undefined
      ? null
      : Number(data.pallet_rejected === true || data.pallet_rejected === 1 || data.pallet_rejected === '1');
    const normalizedDefects = defects.filter(defect => defect.reason_id !== '' && defect.reason_id != null);
    if (existing.status !== 'completed' && normalizedDefects.length) {
      throw new Error('لا يمكن تسجيل العيوب قبل إنهاء فحص السحبة.');
    }
    const totalDefects = normalizedDefects.reduce((sum, defect) => sum + Number(defect.count || 0), 0);
    for (const defect of normalizedDefects) {
      const reasonId = Number(defect.reason_id);
      const count = Number(defect.count);
      if (!Number.isInteger(reasonId) || reasonId < 1 || !Number.isInteger(count) || count < 1) {
        throw new Error('سبب العيب وعدده غير صالحين.');
      }
      if (!this.db.prepare('SELECT id FROM rejection_reasons WHERE id = ? AND is_active = 1').get(reasonId)) {
        throw new Error('أحد أسباب العيوب لم يعد متاحًا. حدّث الصفحة ثم حاول مرة أخرى.');
      }
    }

    const updatePull = this.db.prepare(`
      UPDATE line_sample_pulls
      SET date = ?, start_time = ?, end_time = ?, slot_id = ?, line_id = ?,
          product_id = ?, station_id = ?, inspector_id = ?, additional_inspector_id = ?,
          sample_count = ?, additional_sample_count = ?,
          defect_count = ?, pallet_rejected = COALESCE(?, pallet_rejected)
      WHERE id = ?
    `);
    const insertDefect = this.db.prepare(`
      INSERT INTO line_sample_pull_defects (pull_id, reason_id, count, notes)
      VALUES (?, ?, ?, ?)
    `);

    this.db.exec('BEGIN');
    try {
      updatePull.run(
        data.date, slot.start_time, slot.end_time, Number(data.slot_id), Number(data.line_id),
        Number(data.product_id), Number(data.station_id), Number(data.inspector_id),
        additional.inspectorId, sampleCount, additional.sampleCount, totalDefects, palletRejected, pullId
      );
      this.db.prepare('DELETE FROM line_sample_pull_defects WHERE pull_id = ?').run(pullId);
      normalizedDefects.forEach(defect => {
        insertDefect.run(pullId, Number(defect.reason_id), Number(defect.count), String(defect.notes || '').trim() || null);
      });
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    this.logAudit(currentUserId, currentUserName, 'UPDATE', 'line_sample_pulls', pullId, `تعديل سحبة عينات رقم ${pullId}`);
    return this.getLineSamplePulls({}).find(pull => Number(pull.id) === pullId);
  }

  deleteLineSamplePull(id, currentUserId, currentUserName) {
    const pull = this.db.prepare('SELECT id FROM line_sample_pulls WHERE id = ?').get(id);
    if (!pull) throw new Error('سحبة العينات غير موجودة.');
    this.db.prepare('DELETE FROM line_sample_pulls WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'line_sample_pulls', id, `حذف سحبة عينات رقم ${id}`);
    return true;
  }

  // ==========================================
  // HOURLY SAMPLES INSPECTION API
  // ==========================================
  getHourlySamples(filters = {}) {
    let sql = `
      SELECT h.*,
             l.line_number, l.name as line_name, l.supervisor_name,
             prod.name as product_name, prod.code as product_code, prod.unit as product_unit,
             s.name as shift_name,
             slot.slot_name, slot.start_time, slot.end_time,
             i.name as inspector_name,
             u.full_name as created_by_name,
             CASE
               WHEN h.sample_count > 0 THEN ROUND((CAST(h.defect_count AS FLOAT) / h.sample_count) * 100, 2)
               ELSE 0.0
             END as defect_rate
      FROM hourly_samples h
      JOIN production_lines l ON h.line_id = l.id
      JOIN products prod ON h.product_id = prod.id
      JOIN shifts s ON h.shift_id = s.id
      JOIN hourly_sample_slots slot ON h.slot_id = slot.id
      LEFT JOIN quality_inspectors i ON h.inspector_id = i.id
      LEFT JOIN users u ON h.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.date) { sql += ' AND h.date = ?'; params.push(filters.date); }
    if (filters.date_from) { sql += ' AND h.date >= ?'; params.push(filters.date_from); }
    if (filters.date_to) { sql += ' AND h.date <= ?'; params.push(filters.date_to); }
    if (filters.slot_id) { sql += ' AND h.slot_id = ?'; params.push(parseInt(filters.slot_id, 10)); }
    if (filters.line_id) { sql += ' AND h.line_id = ?'; params.push(parseInt(filters.line_id, 10)); }
    if (filters.product_id) { sql += ' AND h.product_id = ?'; params.push(parseInt(filters.product_id, 10)); }
    if (filters.shift_id) { sql += ' AND h.shift_id = ?'; params.push(parseInt(filters.shift_id, 10)); }
    if (filters.department && filters.department !== 'all') {
      sql += ' AND (h.department = ? OR l.department = ?)';
      params.push(filters.department, filters.department);
    }
    sql += ' ORDER BY h.date DESC, slot.display_order DESC, h.id DESC';

    const samples = this.db.prepare(sql).all(...params);

    return samples.map(s => {
      const defects = this.db.prepare(`
        SELECT d.reason_id, rr.name as reason_name, d.count, d.notes
        FROM hourly_sample_defects d
        JOIN rejection_reasons rr ON d.reason_id = rr.id
        WHERE d.hourly_sample_id = ?
      `).all(s.id);
      const summary = defects.map(d => `${d.reason_name} (${d.count})`).join('، ');
      return {
        ...s,
        defects_breakdown: defects,
        defects_summary: summary || (s.defect_count > 0 ? `${s.defect_count} عيب مسجل` : 'لا توجد عيوب')
      };
    });
  }

  getHourlySampleById(id) {
    const s = this.db.prepare(`
      SELECT h.*,
             l.line_number, l.name as line_name,
             prod.name as product_name, prod.code as product_code,
             s.name as shift_name, slot.slot_name, i.name as inspector_name
      FROM hourly_samples h
      JOIN production_lines l ON h.line_id = l.id
      JOIN products prod ON h.product_id = prod.id
      JOIN shifts s ON h.shift_id = s.id
      JOIN hourly_sample_slots slot ON h.slot_id = slot.id
      LEFT JOIN quality_inspectors i ON h.inspector_id = i.id
      WHERE h.id = ?
    `).get(id);
    if (!s) return null;
    const defects = this.db.prepare(`
      SELECT d.*, rr.name as reason_name
      FROM hourly_sample_defects d
      JOIN rejection_reasons rr ON d.reason_id = rr.id
      WHERE d.hourly_sample_id = ?
    `).all(id);
    return { ...s, defects_breakdown: defects };
  }

  saveHourlySample(data, currentUserId, currentUserName) {
    const date = data.date || new Date().toISOString().slice(0, 10);
    const sampleCount = parseInt(data.sample_count || 0, 10);
    const defectCount = parseInt(data.defect_count || 0, 10);
    const decision = data.decision || (defectCount === 0 ? 'مقبول' : 'تحت الملاحظة');

    const line = this.getLineById(data.line_id);
    const department = data.department || (line ? line.department : 'home');

    let sampleId = data.id ? parseInt(data.id, 10) : null;

    if (sampleId) {
      this.db.prepare(`
        UPDATE hourly_samples
        SET date = ?, slot_id = ?, line_id = ?, product_id = ?, shift_id = ?,
            inspector_id = ?, sample_count = ?, defect_count = ?, decision = ?,
            notes = ?, department = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        date,
        parseInt(data.slot_id, 10),
        parseInt(data.line_id, 10),
        parseInt(data.product_id, 10),
        parseInt(data.shift_id, 10),
        data.inspector_id ? parseInt(data.inspector_id, 10) : null,
        sampleCount,
        defectCount,
        decision,
        data.notes || null,
        department,
        sampleId
      );
      this.db.prepare('DELETE FROM hourly_sample_defects WHERE hourly_sample_id = ?').run(sampleId);
    } else {
      const res = this.db.prepare(`
        INSERT INTO hourly_samples (
          date, slot_id, line_id, product_id, shift_id, inspector_id,
          sample_count, defect_count, decision, notes, department, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        date,
        parseInt(data.slot_id, 10),
        parseInt(data.line_id, 10),
        parseInt(data.product_id, 10),
        parseInt(data.shift_id, 10),
        data.inspector_id ? parseInt(data.inspector_id, 10) : null,
        sampleCount,
        defectCount,
        decision,
        data.notes || null,
        department,
        currentUserId || null
      );
      sampleId = res.lastInsertRowid;
    }

    if (Array.isArray(data.defects)) {
      const insertDefect = this.db.prepare(`
        INSERT INTO hourly_sample_defects (hourly_sample_id, reason_id, count, notes)
        VALUES (?, ?, ?, ?)
      `);
      for (const d of data.defects) {
        if (d.reason_id && parseInt(d.count || 0, 10) > 0) {
          insertDefect.run(sampleId, parseInt(d.reason_id, 10), parseInt(d.count, 10), d.notes || null);
        }
      }
    }

    this.logAudit(currentUserId, currentUserName, sampleId ? 'UPDATE' : 'CREATE', 'hourly_samples', sampleId, `تسجيل فحص عينة ساعة (${sampleCount} عينة، ${defectCount} عيوب)`);
    return this.getHourlySampleById(sampleId);
  }

  deleteHourlySample(id, currentUserId, currentUserName) {
    this.db.prepare('DELETE FROM hourly_samples WHERE id = ?').run(id);
    this.logAudit(currentUserId, currentUserName, 'DELETE', 'hourly_samples', id, `حذف فحص عينة ساعة رقم ${id}`);
    return true;
  }

  // ==========================================
  // DAILY PRODUCTION ENTRY (END OF DAY ACTUAL PRODUCTION)
  // ==========================================
  getDailyLineProduction(filters = {}) {
    let sql = `
      SELECT dp.*,
             l.line_number, l.name as line_name, l.supervisor_name,
             prod.name as product_name, prod.code as product_code, prod.unit as product_unit,
             s.name as shift_name,
             u.full_name as entered_by_name
      FROM daily_line_production dp
      JOIN production_lines l ON dp.line_id = l.id
      JOIN products prod ON dp.product_id = prod.id
      LEFT JOIN shifts s ON dp.shift_id = s.id
      LEFT JOIN users u ON dp.entered_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.date) { sql += ' AND dp.date = ?'; params.push(filters.date); }
    if (filters.line_id) { sql += ' AND dp.line_id = ?'; params.push(parseInt(filters.line_id, 10)); }
    if (filters.product_id) { sql += ' AND dp.product_id = ?'; params.push(parseInt(filters.product_id, 10)); }
    if (filters.department && filters.department !== 'all') {
      sql += ' AND (dp.department = ? OR l.department = ?)';
      params.push(filters.department, filters.department);
    }
    sql += ' ORDER BY dp.date DESC, l.line_number ASC';
    return this.db.prepare(sql).all(...params);
  }

  saveDailyLineProduction(data, currentUserId, currentUserName) {
    const date = data.date || new Date().toISOString().slice(0, 10);
    const lineId = parseInt(data.line_id, 10);
    const productId = parseInt(data.product_id, 10);
    const shiftId = data.shift_id ? parseInt(data.shift_id, 10) : null;
    const qty = parseInt(data.total_produced_qty || 0, 10);

    const line = this.getLineById(lineId);
    const department = data.department || (line ? line.department : 'home');

    const stmt = this.db.prepare(`
      INSERT INTO daily_line_production (date, line_id, product_id, shift_id, total_produced_qty, notes, department, entered_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(date, line_id, product_id, shift_id) DO UPDATE SET
        total_produced_qty = excluded.total_produced_qty,
        notes = excluded.notes,
        department = excluded.department,
        entered_by = excluded.entered_by,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(date, lineId, productId, shiftId, qty, data.notes || null, department, currentUserId || null);
    this.logAudit(currentUserId, currentUserName, 'SAVE_PROD', 'daily_line_production', lineId, `تسجيل إجمالي إنتاج اليوم: ${qty} وحدة على خط ${line?.line_number || lineId}`);
    return this.getDailyLineProduction({ date, line_id: lineId, product_id: productId })[0];
  }

  // ==========================================
  // FLOWCHART & SYSTEM-WIDE DEEP ANALYTICS
  // ==========================================
  getFlowchartMetrics(filters = {}) {
    let wherePallets = 'WHERE 1=1';
    let whereHourly = 'WHERE 1=1';
    const paramsPallets = [];
    const paramsHourly = [];

    const dateFrom = filters.date_from || (filters.date ? filters.date : null);
    const dateTo = filters.date_to || (filters.date ? filters.date : null);

    if (dateFrom) {
      wherePallets += ' AND p.date >= ?'; paramsPallets.push(dateFrom);
      whereHourly += ' AND h.date >= ?'; paramsHourly.push(dateFrom);
    }
    if (dateTo) {
      wherePallets += ' AND p.date <= ?'; paramsPallets.push(dateTo);
      whereHourly += ' AND h.date <= ?'; paramsHourly.push(dateTo);
    }
    if (filters.line_id) {
      wherePallets += ' AND p.line_id = ?'; paramsPallets.push(parseInt(filters.line_id, 10));
      whereHourly += ' AND h.line_id = ?'; paramsHourly.push(parseInt(filters.line_id, 10));
    }
    if (filters.product_id) {
      wherePallets += ' AND p.product_id = ?'; paramsPallets.push(parseInt(filters.product_id, 10));
      whereHourly += ' AND h.product_id = ?'; paramsHourly.push(parseInt(filters.product_id, 10));
    }
    if (filters.shift_id) {
      wherePallets += ' AND p.shift_id = ?'; paramsPallets.push(parseInt(filters.shift_id, 10));
      whereHourly += ' AND h.shift_id = ?'; paramsHourly.push(parseInt(filters.shift_id, 10));
    }
    if (filters.department && filters.department !== 'all') {
      wherePallets += ' AND (p.department = ? OR l.department = ?)'; paramsPallets.push(filters.department, filters.department);
      whereHourly += ' AND (h.department = ? OR l.department = ?)'; paramsHourly.push(filters.department, filters.department);
    }

    // 1. Pipeline Stages Aggregate:
    const palletProd = this.db.prepare(`
      SELECT
        COALESCE(SUM(p.quantity_on_pallet), 0) as total_units_produced,
        COUNT(p.id) as total_pallets,
        COALESCE(SUM(p.inspected_quantity), 0) as total_samples_inspected,
        COALESCE(SUM(p.rejected_quantity), 0) as total_defects,
        COALESCE(SUM(CASE WHEN p.pallet_decision = 'مقبول' THEN p.quantity_on_pallet ELSE 0 END), 0) as accepted_units,
        COALESCE(SUM(CASE WHEN p.pallet_decision = 'مرفوض' THEN p.quantity_on_pallet ELSE 0 END), 0) as rejected_units,
        COALESCE(SUM(CASE WHEN p.pallet_decision = 'مقبول' THEN 1 ELSE 0 END), 0) as accepted_pallets,
        COALESCE(SUM(CASE WHEN p.pallet_decision = 'مرفوض' THEN 1 ELSE 0 END), 0) as rejected_pallets
      FROM pallets p
      JOIN production_lines l ON p.line_id = l.id
      ${wherePallets}
    `).get(...paramsPallets);

    const hourlyStats = this.db.prepare(`
      SELECT
        COUNT(h.id) as total_hourly_pulls,
        COALESCE(SUM(h.sample_count), 0) as total_hourly_samples,
        COALESCE(SUM(h.defect_count), 0) as total_hourly_defects,
        COALESCE(SUM(CASE WHEN h.decision = 'مقبول' THEN 1 ELSE 0 END), 0) as accepted_pulls,
        COALESCE(SUM(CASE WHEN h.decision = 'مرفوض' THEN 1 ELSE 0 END), 0) as rejected_pulls
      FROM hourly_samples h
      JOIN production_lines l ON h.line_id = l.id
      ${whereHourly}
    `).get(...paramsHourly);

    const dailyProdStats = this.db.prepare(`
      SELECT COALESCE(SUM(dp.total_produced_qty), 0) as total_daily_entered
      FROM daily_line_production dp
      WHERE 1=1 ${dateFrom ? 'AND dp.date >= ?' : ''} ${dateTo ? 'AND dp.date <= ?' : ''}
    `).get(...[dateFrom, dateTo].filter(Boolean));

    const totalProducedUnits = (palletProd?.total_units_produced || 0) + (dailyProdStats?.total_daily_entered || 0);
    const totalSamplesInspected = (palletProd?.total_samples_inspected || 0) + (hourlyStats?.total_hourly_samples || 0);
    const totalDefects = (palletProd?.total_defects || 0) + (hourlyStats?.total_hourly_defects || 0);
    const totalConformingSamples = Math.max(0, totalSamplesInspected - totalDefects);
    const overallDefectRate = totalSamplesInspected > 0 ? parseFloat(((totalDefects / totalSamplesInspected) * 100).toFixed(2)) : 0.0;
    const overallAcceptRate = parseFloat((100 - overallDefectRate).toFixed(2));

    // 2. Line by Line Comparison:
    const lines = this.getAllLines(filters.department, true);
    const lineStats = lines.map(line => {
      const pStats = this.db.prepare(`
        SELECT
          COALESCE(SUM(p.quantity_on_pallet), 0) as produced,
          COALESCE(SUM(p.inspected_quantity), 0) as inspected,
          COALESCE(SUM(p.rejected_quantity), 0) as defects,
          COALESCE(SUM(CASE WHEN p.pallet_decision = 'مقبول' THEN 1 ELSE 0 END), 0) as acc_pallets,
          COALESCE(SUM(CASE WHEN p.pallet_decision = 'مرفوض' THEN 1 ELSE 0 END), 0) as rej_pallets,
          COUNT(p.id) as pallets_count,
          GROUP_CONCAT(DISTINCT prod.name) as products_names
        FROM pallets p
        JOIN products prod ON p.product_id = prod.id
        WHERE p.line_id = ? ${dateFrom ? 'AND p.date >= ?' : ''} ${dateTo ? 'AND p.date <= ?' : ''}
      `).get(...[line.id, dateFrom, dateTo].filter(v => v !== null && v !== undefined));

      const hStats = this.db.prepare(`
        SELECT
          COALESCE(SUM(sample_count), 0) as samples,
          COALESCE(SUM(defect_count), 0) as defects,
          GROUP_CONCAT(DISTINCT prod.name) as products_names
        FROM hourly_samples h
        JOIN products prod ON h.product_id = prod.id
        WHERE h.line_id = ? ${dateFrom ? 'AND h.date >= ?' : ''} ${dateTo ? 'AND h.date <= ?' : ''}
      `).get(...[line.id, dateFrom, dateTo].filter(v => v !== null && v !== undefined));

      const totalLineInspected = (pStats?.inspected || 0) + (hStats?.samples || 0);
      const totalLineDefects = (pStats?.defects || 0) + (hStats?.defects || 0);
      const lineDefectRate = totalLineInspected > 0
        ? parseFloat(((totalLineDefects / totalLineInspected) * 100).toFixed(2))
        : 0.0;
      const lineAcceptRate = parseFloat((100 - lineDefectRate).toFixed(2));

      const topReason = this.db.prepare(`
        SELECT rr.name, SUM(pri.count) as c
        FROM pallet_rejection_items pri
        JOIN pallets p ON pri.pallet_id = p.id
        JOIN rejection_reasons rr ON pri.reason_id = rr.id
        WHERE p.line_id = ? ${dateFrom ? 'AND p.date >= ?' : ''} ${dateTo ? 'AND p.date <= ?' : ''}
        GROUP BY rr.id
        ORDER BY c DESC LIMIT 1
      `).get(...[line.id, dateFrom, dateTo].filter(v => v !== null && v !== undefined));

      const allProds = [pStats?.products_names, hStats?.products_names, line.current_product_name]
        .filter(Boolean)
        .join('، ');

      return {
        line_id: line.id,
        line_number: line.line_number,
        line_name: line.name,
        supervisor_name: line.supervisor_name,
        product_name: allProds || 'غير محدد',
        total_produced: (pStats?.produced || 0),
        total_inspected: totalLineInspected,
        total_defects: totalLineDefects,
        defect_rate: lineDefectRate,
        accept_rate: lineAcceptRate,
        pallets_count: pStats?.pallets_count || 0,
        accepted_pallets: pStats?.acc_pallets || 0,
        rejected_pallets: pStats?.rej_pallets || 0,
        top_defect_reason: topReason ? `${topReason.name} (${topReason.c})` : 'لا توجد عيوب',
        has_activity: totalLineInspected > 0 || (pStats?.produced || 0) > 0
      };
    });

    const activeLines = lineStats.filter(l => l.has_activity);
    let bestLine = null;
    let worstLine = null;

    if (activeLines.length > 0) {
      const sortedForBest = [...activeLines].sort((a, b) => a.defect_rate - b.defect_rate || b.total_inspected - a.total_inspected);
      bestLine = sortedForBest[0];

      const sortedForWorst = [...activeLines].sort((a, b) => b.defect_rate - a.defect_rate || b.total_defects - a.total_defects);
      worstLine = sortedForWorst[0];
    } else if (lineStats.length > 0) {
      bestLine = lineStats[0];
      worstLine = lineStats[lineStats.length - 1];
    }

    const pareto = this.db.prepare(`
      SELECT rr.name as reason_name, SUM(pri.count) as defect_count
      FROM pallet_rejection_items pri
      JOIN pallets p ON pri.pallet_id = p.id
      JOIN rejection_reasons rr ON pri.reason_id = rr.id
      JOIN production_lines l ON p.line_id = l.id
      ${wherePallets}
      GROUP BY rr.id
      ORDER BY defect_count DESC
      LIMIT 10
    `).all(...paramsPallets);

    const shiftComparison = this.db.prepare(`
      SELECT s.id as shift_id, s.name as shift_name,
             COALESCE(SUM(p.quantity_on_pallet), 0) as total_produced,
             COALESCE(SUM(p.inspected_quantity), 0) as inspected,
             COALESCE(SUM(p.rejected_quantity), 0) as defects,
             CASE
               WHEN SUM(p.inspected_quantity) > 0 THEN ROUND((CAST(SUM(p.rejected_quantity) AS FLOAT) / SUM(p.inspected_quantity)) * 100, 2)
               ELSE 0.0
             END as defect_rate
      FROM shifts s
      LEFT JOIN pallets p ON s.id = p.shift_id ${dateFrom ? 'AND p.date >= ?' : ''} ${dateTo ? 'AND p.date <= ?' : ''}
      GROUP BY s.id
      ORDER BY s.id ASC
    `).all(...[dateFrom, dateTo].filter(Boolean));

    return {
      pipeline_stages: {
        stage1_production: {
          label: 'وارد الإنتاج من الخطوط',
          total_units: totalProducedUnits,
          pallets_count: palletProd?.total_pallets || 0,
          description: 'إجمالي الكميات الواردة من خطوط التجميع'
        },
        stage2_inspection: {
          label: 'سحب وفحص العينات (AQL + بالساعة)',
          total_samples: totalSamplesInspected,
          aql_samples: palletProd?.total_samples_inspected || 0,
          hourly_samples: hourlyStats?.total_hourly_samples || 0,
          hourly_pulls: hourlyStats?.total_hourly_pulls || 0,
          description: 'العينات الإحصائية المسحوبة للفحص والاختبار'
        },
        stage3_defects: {
          label: 'تحليل العيوب والمطابقة',
          conforming_samples: totalConformingSamples,
          defective_samples: totalDefects,
          overall_defect_rate: overallDefectRate,
          overall_accept_rate: overallAcceptRate,
          description: 'نسب التوافق الفني وكشف العيوب المصنعية'
        },
        stage4_decision: {
          label: 'قرار الاعتماد النهائي',
          accepted_units: palletProd?.accepted_units || 0,
          rejected_units: palletProd?.rejected_units || 0,
          accepted_pallets: palletProd?.accepted_pallets || 0,
          rejected_pallets: palletProd?.rejected_pallets || 0,
          description: 'البلتات والوحدات المعتمدة للمستودع مقابل المحجوزة'
        }
      },
      best_line: bestLine,
      worst_line: worstLine,
      line_rankings: lineStats.sort((a, b) => a.defect_rate - b.defect_rate),
      pareto_defects: pareto,
      shift_comparison: shiftComparison
    };
  }
}

module.exports = new QualityDB();
