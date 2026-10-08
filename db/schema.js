const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'quality_system.db');

function getDatabase() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

function initializeDatabase() {
  const db = getDatabase();

  // Create tables
  db.exec(`
    -- Roles table
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL
    );

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Shifts table
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      is_active INTEGER DEFAULT 1
    );

    -- Supervisors table
    CREATE TABLE IF NOT EXISTS supervisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      phone TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Daily task types for quality inspectors
    CREATE TABLE IF NOT EXISTS daily_task_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      requires_line INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- Products table (Home Appliances)
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      specifications TEXT,
      weight TEXT,
      unit TEXT DEFAULT 'جهاز',
      default_line_id INTEGER,
      extra_info TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Production lines table
    CREATE TABLE IF NOT EXISTS production_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      supervisor_name TEXT NOT NULL,
      current_product_id INTEGER REFERENCES products(id),
      status TEXT DEFAULT 'نشط',
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Quality inspectors table
    CREATE TABLE IF NOT EXISTS quality_inspectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Inspector daily assignments table
    CREATE TABLE IF NOT EXISTS inspector_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      inspector_id INTEGER NOT NULL REFERENCES quality_inspectors(id),
      task_type_id INTEGER NOT NULL REFERENCES daily_task_types(id),
      line_id INTEGER REFERENCES production_lines(id),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (date, shift_id, inspector_id)
    );

    -- AQL Sampling Plans table (المستوى العام الثاني - General Inspection Level II)
    CREATE TABLE IF NOT EXISTS aql_sampling_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_min INTEGER NOT NULL,
      batch_max INTEGER NOT NULL,
      sample_size INTEGER NOT NULL,
      accept_limit INTEGER NOT NULL DEFAULT 1,
      reject_limit INTEGER NOT NULL DEFAULT 2,
      aql_level TEXT DEFAULT 'المستوى العام الثاني (Level II)',
      notes TEXT,
      is_active INTEGER DEFAULT 1
    );

    -- Rejection reasons table (Home appliances specific)
    CREATE TABLE IF NOT EXISTS rejection_reasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'عام',
      is_active INTEGER DEFAULT 1
    );

    -- Pallets table (records pallet receipt, status, time tracking, & AQL inspection)
    CREATE TABLE IF NOT EXISTS pallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,                     -- تاريخ الاستلام (YYYY-MM-DD)
      received_time TEXT NOT NULL,            -- وقت الاستلام (HH:MM)
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      line_id INTEGER NOT NULL REFERENCES production_lines(id),
      pallet_number INTEGER NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_on_pallet INTEGER NOT NULL CHECK (quantity_on_pallet >= 0),
      
      -- Two-stage lifecycle: في انتظار الفحص / جاري الفحص / تم الفحص
      inspection_status TEXT DEFAULT 'في انتظار الفحص',
      inspection_date TEXT,                   -- تاريخ الفحص الفعلي (قد يختلف عن تاريخ الاستلام)
      inspection_started_at TEXT,             -- وقت بدء الفحص (HH:MM أو YYYY-MM-DD HH:MM)
      inspection_completed_at TEXT,           -- وقت إنهاء الفحص (HH:MM أو YYYY-MM-DD HH:MM)
      
      -- AQL Rules fields
      sample_size_required INTEGER DEFAULT 0, -- حجم العينة المطلوب سحبه من جدول AQL
      max_allowed_defects INTEGER DEFAULT 0,  -- أقصى عدد عيوب مسموح به للقبول (Ac)
      reject_limit INTEGER DEFAULT 1,         -- حد الرفض (Re)
      
      -- Inspection Quantities
      inspected_quantity INTEGER DEFAULT 0 CHECK (inspected_quantity >= 0),
      rejected_quantity INTEGER DEFAULT 0 CHECK (rejected_quantity >= 0),
      
      -- Decision & Override Mode
      pallet_decision TEXT DEFAULT 'قيد الفحص', -- 'مقبول', 'مرفوض', 'قيد الفحص'
      decision_mode TEXT DEFAULT 'auto',        -- 'auto' (حسب AQL) أو 'manual_accept' أو 'manual_reject'
      
      inspector_id INTEGER REFERENCES quality_inspectors(id),
      notes TEXT,
      custom_fields_json TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      -- Unique constraint per line & date
      UNIQUE (line_id, pallet_number, date)
    );

    -- Pallet rejection defect details
    CREATE TABLE IF NOT EXISTS pallet_rejection_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pallet_id INTEGER NOT NULL REFERENCES pallets(id) ON DELETE CASCADE,
      reason_id INTEGER NOT NULL REFERENCES rejection_reasons(id),
      count INTEGER DEFAULT 0,
      notes TEXT
    );

    -- Custom fields definition
    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_entity TEXT NOT NULL,
      field_key TEXT NOT NULL,
      field_label TEXT NOT NULL,
      field_type TEXT NOT NULL,
      options_json TEXT,
      is_required INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- Saved filters
    CREATE TABLE IF NOT EXISTS saved_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filter_type TEXT NOT NULL,
      criteria_json TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      user_name TEXT,
      action TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      entity_id INTEGER,
      summary TEXT NOT NULL,
      details_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_pallets_date ON pallets(date);
    CREATE INDEX IF NOT EXISTS idx_pallets_status ON pallets(inspection_status);
    CREATE INDEX IF NOT EXISTS idx_pallets_line ON pallets(line_id);
    CREATE INDEX IF NOT EXISTS idx_pallets_decision ON pallets(pallet_decision);
    CREATE INDEX IF NOT EXISTS idx_aql_range ON aql_sampling_plans(batch_min, batch_max);
  `);

  seedInitialData(db);

  return db;
}

function seedInitialData(db) {
  const rolesCount = db.prepare('SELECT COUNT(*) as count FROM roles').get().count;
  if (rolesCount > 0) return;

  console.log('Seeding initial data for El Maghraby Home Appliances Quality System...');

  // 1. Roles
  const insertRole = db.prepare('INSERT INTO roles (code, name, description, permissions) VALUES (?, ?, ?, ?)');
  insertRole.run('admin', 'مدير النظام', 'صلاحيات كاملة لإدارة النظام والإعدادات والمستخدمين', JSON.stringify(['all']));
  insertRole.run('supervisor', 'مشرف الجودة', 'إدخال وتعديل ومراجعة تقارير الجودة والخطوط', JSON.stringify(['view', 'inspect', 'manage_lines', 'manage_products', 'manage_assignments', 'manage_pallets', 'export_reports']));
  insertRole.run('inspector', 'مراقب الجودة', 'إدخال بيانات الفحص والبلتات اليومية', JSON.stringify(['view', 'inspect', 'manage_pallets']));
  insertRole.run('viewer', 'مستخدم قراءة فقط', 'مشاهدة لوحة التحكم والتقارير بدون تعديل', JSON.stringify(['view']));

  // 2. Users
  const insertUser = db.prepare('INSERT INTO users (username, full_name, password, role_id) VALUES (?, ?, ?, ?)');
  insertUser.run('admin', 'م. أحمد المغربي (مدير الجودة العام)', 'admin123', 1);
  insertUser.run('supervisor', 'م. حسام الدين (مشرف جودة المصنع)', 'super123', 2);
  insertUser.run('inspector1', 'محمود فتحي (مراقب جودة التجميع)', 'insp123', 3);
  insertUser.run('viewer', 'أ. سمير خليل (إدارة الإنتاج - متابعة)', 'view123', 4);

  // 3. Shifts
  const insertShift = db.prepare('INSERT INTO shifts (code, name, start_time, end_time) VALUES (?, ?, ?, ?)');
  insertShift.run('shift_1', 'الوردية الأولى (صباحية)', '08:00', '16:00');
  insertShift.run('shift_2', 'الوردية الثانية (مسائية)', '16:00', '00:00');
  insertShift.run('shift_3', 'الوردية الثالثة (ليلية)', '00:00', '08:00');

  // 4. Daily Task Types
  const insertTask = db.prepare('INSERT INTO daily_task_types (code, name, requires_line) VALUES (?, ?, ?)');
  insertTask.run('ON_LINE', 'على خط إنتاج - مراقب', 1);
  insertTask.run('LAB', 'مراقب في المعمل الكهربائي', 0);
  insertTask.run('ABSENT', 'غائب', 0);
  insertTask.run('LEAVE', 'إجازة', 0);
  insertTask.run('TRAINING', 'تدريب', 0);
  insertTask.run('OTHER', 'مهمة أخرى', 0);

  // 5. Supervisors (مشرفو خطوط إنتاج الأجهزة المنزلية)
  const insertSup = db.prepare('INSERT INTO supervisors (name, phone, notes) VALUES (?, ?, ?)');
  insertSup.run('م. إبراهيم رضوان', '01012345671', 'مشرف خط تجميع الخلاطات المنزلية');
  insertSup.run('م. ماجد عبد السلام', '01012345672', 'مشرف خط تجميع الكبات والمفارم');
  insertSup.run('م. وليد الشناوي', '01012345673', 'مشرف خط مضارب البيض والعجانات');
  insertSup.run('م. عماد الجوهري', '01012345674', 'مشرف خط الهاند بلندر والمحضرات');

  // 6. Products (أجهزة منزلية - شركة المغربي)
  const insertProduct = db.prepare('INSERT INTO products (code, name, specifications, weight, unit, default_line_id, extra_info) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertProduct.run('MG-BL500', 'خلاط منزلي المغربي 1.5 لتر 500 وات مع مطحنة', 'دورق غير قابل للكسر، موتور نحاس نقي، 4 أسلحة ستانلس، 2 سرعة + نبضات', '2.4 كجم', 'جهاز', 1, 'مطابق للمواصفة القياسية المصرية ES 289');
  insertProduct.run('MG-CH400', 'كبة لحوم وخضروات المغربي 2 لتر 400 وات', 'وعاء ستانلس ستيل 304، شفرات رباعية حادة، تروس معدنية متينة', '1.8 كجم', 'جهاز', 2, 'نظام أمان مزدوج للغطاء');
  insertProduct.run('MG-HB800', 'هاند بلندر المغربي تيربو 800 وات متعدد الوظائف', 'ذراع ستانلس ضد الصدأ، مضرب خفق، قطاعة صغيرة 500 مل، كوب مدرج', '1.2 كجم', 'جهاز', 4, 'موتور صامت منخفض الاهتزاز');
  insertProduct.run('MG-MX350', 'مضرب بيض كهربائي 5 سرعات مع عجانة ستانلس', 'موتور 350 وات، سرعتان تيربو، مضارب خفق وخطافات عجن كروم', '1.5 كجم', 'جهاز', 3, 'زر إخراج المضارب السريع');
  insertProduct.run('MG-FP1000', 'محضر طعام كيتشن ماستر المغربي 1000 وات 28 وظيفة', 'وعاء تحضير 3.2 لتر، دورق خلاط 1.5 لتر، أقراص بشر وتقطيع متنوعة', '4.6 كجم', 'جهاز', 4, 'حماية من الحمل الزائد');
  insertProduct.run('MG-MG1500', 'مفرمة لحوم كهربائية المغربي 1500 وات تروس معدنية', 'جسم معدني متين، 3 أقراص فرم أحجام مختلفة، ملحق سجق وكبيبة', '3.8 كجم', 'جهاز', 2, 'وظيفة الدوران العكسي Reverse');

  // 7. Production Lines
  const insertLine = db.prepare('INSERT INTO production_lines (line_number, name, supervisor_name, current_product_id, status, notes) VALUES (?, ?, ?, ?, ?, ?)');
  insertLine.run(1, 'خط تجميع واختبار الخلاطات المنزلية', 'م. إبراهيم رضوان', 1, 'نشط', 'طاقة 120 بالته/أسبوع - اختبار كهربائي 100%');
  insertLine.run(2, 'خط تجميع الكبات ومفارم اللحوم', 'م. ماجد عبد السلام', 2, 'نشط', 'طاقة 100 بالته/أسبوع - اختبار عزم وميكانيكا');
  insertLine.run(3, 'خط تجميع مضارب البيض والعجانات', 'م. وليد الشناوي', 4, 'نشط', 'طاقة 80 بالته/أسبوع');
  insertLine.run(4, 'خط الهاند بلندر والمحضرات المتكاملة', 'م. عماد الجوهري', 3, 'نشط', 'طاقة 90 بالته/أسبوع');

  // 8. Quality Inspectors
  const insertInsp = db.prepare('INSERT INTO quality_inspectors (code, name, phone, notes) VALUES (?, ?, ?, ?)');
  insertInsp.run('QC-01', 'محمود فتحي الديب', '01123456781', 'أخصائي جودة تجميع ميكانيكي وكهربائي');
  insertInsp.run('QC-02', 'أحمد كمال العوضي', '01123456782', 'مراقب جودة اختبارات الأمان والعزل');
  insertInsp.run('QC-03', 'ياسر عبد المنعم', '01123456783', 'فاحص جودة المظهر والتغليف النهائي');
  insertInsp.run('QC-04', 'رامي صبحي توفيق', '01123456784', 'فني معمل قياسات الجودة والتحمل');

  // 9. Standard AQL Sampling Plan (ISO 2859-1 Level II / المستوى العام الثاني)
  const insertAql = db.prepare(`
    INSERT INTO aql_sampling_plans (batch_min, batch_max, sample_size, accept_limit, reject_limit, aql_level, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAql.run(2, 8, 2, 0, 1, 'المستوى العام الثاني (Level II)', 'حجم كمية صغيرة جداً');
  insertAql.run(9, 15, 3, 0, 1, 'المستوى العام الثاني (Level II)', 'حجم كمية صغيرة');
  insertAql.run(16, 25, 5, 0, 1, 'المستوى العام الثاني (Level II)', 'حجم كمية متوسطة');
  insertAql.run(26, 50, 8, 1, 2, 'المستوى العام الثاني (Level II)', 'فحص عادي');
  insertAql.run(51, 90, 13, 1, 2, 'المستوى العام الثاني (Level II)', 'فحص عادي');
  insertAql.run(91, 150, 20, 2, 3, 'المستوى العام الثاني (Level II)', 'مثال: من 100 إلى 150 نسحب 20 عينة، تقبل عند 2 وترفض عند 3 عيوب');
  insertAql.run(151, 280, 32, 2, 3, 'المستوى العام الثاني (Level II)', 'فحص قياسي');
  insertAql.run(281, 500, 50, 3, 4, 'المستوى العام الثاني (Level II)', 'فحص قياسي للبلتات المتوسطة');
  insertAql.run(501, 1200, 80, 5, 6, 'المستوى العام الثاني (Level II)', 'بلتات التصدير والتوزيع الكبيرة');
  insertAql.run(1201, 3200, 125, 7, 8, 'المستوى العام الثاني (Level II)', 'دفعة تشغيل كبيرة');
  insertAql.run(3201, 10000, 200, 10, 11, 'المستوى العام الثاني (Level II)', 'دفعة إنتاج ضخمة');

  // 10. Rejection Reasons (Specific to Home Appliances Factory)
  const insertReason = db.prepare('INSERT INTO rejection_reasons (code, name, category) VALUES (?, ?, ?)');
  insertReason.run('DEF-01', 'شرخ أو خدش في دورق الخلاط أو وعاء الكبة', 'مظهر وخامات بلاستيكية');
  insertReason.run('DEF-02', 'فشل اختبار العزل الكهربائي أو التأريض (Hi-Pot)', 'أمان واختبارات كهربائية');
  insertReason.run('DEF-03', 'صوت غير طبيعي أو خشونة واهتزاز زائد في الموتور', 'أداء محرك وميكانيكا');
  insertReason.run('DEF-04', 'عيب في مفتاح الأمان Micro-switch أو عدم إحكام الغلق', 'أمان وتشغيل');
  insertReason.run('DEF-05', 'رايش أو عدم حدة في شفرات السكاكين', 'شفرات وقواطع ستانلس');
  insertReason.run('DEF-06', 'خلل في درجات مفتاح السرعات أو زر النبضات Pulse', 'لوحة تحكم ومفاتيح');
  insertReason.run('DEF-07', 'تلف في كابل الكهرباء أو عدم إحكام جلبه الكابل', 'توصيلات كهربائية');
  insertReason.run('DEF-08', 'عدم وضوح طباعة الشعار أو ملصق المواصفات الفنية', 'طباعة وتوسيم');
  insertReason.run('DEF-09', 'تلف كرتونة التعبئة الخارجية أو فقدان الفوم الداخلي', 'تغليف وحماية');

  // 11. Inspector Assignments
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const insertAssign = db.prepare('INSERT INTO inspector_assignments (date, shift_id, inspector_id, task_type_id, line_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertAssign.run(today, 1, 1, 1, 1, 'مكلف بمراقبة جودة خط الخلاطات', 1);
  insertAssign.run(today, 1, 2, 1, 2, 'مكلف بمراقبة جودة خط الكبات', 1);
  insertAssign.run(today, 1, 3, 1, 3, 'مكلف بمراقبة جودة خط العجانات', 1);
  insertAssign.run(today, 1, 4, 2, null, 'فحوصات معمل العزل الكهربائي', 1);

  // 12. Sample Pallets with multi-status workflow (Received today vs yesterday, inspected vs waiting)
  const insertPallet = db.prepare(`
    INSERT INTO pallets (
      date, received_time, shift_id, line_id, pallet_number, product_id,
      quantity_on_pallet, inspection_status, inspection_date, inspection_started_at, inspection_completed_at,
      sample_size_required, max_allowed_defects, reject_limit,
      inspected_quantity, rejected_quantity, pallet_decision, decision_mode,
      inspector_id, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO pallet_rejection_items (pallet_id, reason_id, count, notes) VALUES (?, ?, ?, ?)
  `);

  // Pallet 1 (Line 1): Completed & Accepted (120 units -> AQL says sample 20, max defects 2, reject at 3. Inspected 20, 1 defect found -> Accepted!)
  let p1 = insertPallet.run(
    today, '08:30', 1, 1, 1, 1,
    120, 'تم الفحص', today, '08:45', '09:15',
    20, 2, 3,
    20, 1, 'مقبول', 'auto',
    1, 'البلتة مقبولة طبقاً لـ AQL (1 عيب من أصل 2 مسموح)', 1
  );
  insertItem.run(p1.lastInsertRowid, 1, 1, 'خدش بسيط غير نافذ في دورق واحد');

  // Pallet 2 (Line 1): Completed & Rejected (120 units -> sample 20, Ac=2, Re=3. Inspected 20, 4 defects found >= 3 -> Rejected!)
  let p2 = insertPallet.run(
    today, '09:20', 1, 1, 2, 1,
    120, 'تم الفحص', today, '09:35', '10:10',
    20, 2, 3,
    20, 4, 'مرفوض', 'auto',
    1, 'البلتة مرفوضة لتجاوز حد العيوب (4 عيوب والحد المسموح 2)', 1
  );
  insertItem.run(p2.lastInsertRowid, 2, 2, 'فشل اختبار العزل الكهربائي في جهازين');
  insertItem.run(p2.lastInsertRowid, 3, 2, 'اهتزاز وصوت خشونة في موتور جهازين');

  // Pallet 3 (Line 1): Being Inspected Right Now (جاري الفحص)
  insertPallet.run(
    today, '10:30', 1, 1, 3, 1,
    140, 'جاري الفحص', today, '10:40', null,
    20, 2, 3,
    0, 0, 'قيد الفحص', 'auto',
    1, 'المراقب يقوم حالياً بسحب واختبار العينات', 1
  );

  // Pallet 4 (Line 1): Received today, Waiting for Inspection (في انتظار الفحص)
  insertPallet.run(
    today, '11:15', 1, 1, 4, 1,
    120, 'في انتظار الفحص', null, null, null,
    20, 2, 3,
    0, 0, 'قيد الفحص', 'auto',
    1, 'تم استلام البالتة وتوريدها لمنطقة فحص الجودة', 1
  );

  // Pallet 5 (Line 2): Received today, Waiting for Inspection (في انتظار الفحص)
  insertPallet.run(
    today, '09:00', 1, 2, 1, 2,
    100, 'في انتظار الفحص', null, null, null,
    20, 2, 3,
    0, 0, 'قيد الفحص', 'auto',
    2, 'بالتة كبات في انتظار بدء الفحص', 1
  );

  // Pallet 6 (Line 2): Received yesterday, but Inspected Today! (demonstrates multi-day inspection!)
  let p6 = insertPallet.run(
    yesterday, '15:30', 2, 2, 2, 2,
    150, 'تم الفحص', today, '08:15', '09:00',
    20, 2, 3,
    20, 0, 'مقبول', 'auto',
    2, 'تم استلامها أمس وفحصها صباح اليوم، سليمة تماماً', 1
  );

  // 13. Audit log
  db.prepare(`
    INSERT INTO audit_logs (user_id, user_name, action, entity_name, entity_id, summary)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(1, 'م. أحمد المغربي', 'INIT', 'system', 0, 'تهيئة نظام جودة مصنع المغربي للأجهزة المنزلية بجدول AQL المستوى الثاني');

  console.log('Database initialized successfully with AQL Level II plans & El Maghraby appliances data.');
}

module.exports = {
  getDatabase,
  initializeDatabase,
  DB_PATH
};
