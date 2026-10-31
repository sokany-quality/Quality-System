const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/index');
const { initializeDatabase } = require('./db/schema');

// Ensure DB is initialized
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;
const INCOMING_BULK_DELETE_PASSWORD = '2553';

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Extract current user from request headers
function getCurrentUser(req) {
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : 1;
  const userName = req.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name']) : 'م. أحمد المغربي (مدير الجودة)';
  const userRole = req.headers['x-user-role'] || 'admin';
  return { id: userId, name: userName, role: userRole };
}

// Middleware: Role permission guard helper
function requirePermission(...allowedRoles) {
  return (req, res, next) => {
    const user = getCurrentUser(req);
    if (user.role === 'admin' || allowedRoles.includes(user.role)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: `عفواً، حسابك ذو صلاحية (${user.role}) ليس لديه إذن لتنفيذ هذا الإجراء.`
    });
  };
}

// ==========================================
// BOOTSTRAP API (Loads all metadata in one call)
// ==========================================
app.get('/api/bootstrap', (req, res) => {
  try {
    const department = req.query.department || null;
    const lines = db.getAllLines(department);
    const products = db.getAllProducts(department);
    const inspectors = db.getAllInspectors();
    const rejectionReasons = db.getAllRejectionReasons();
    const taskTypes = db.getAllTaskTypes();
    const shifts = db.getAllShifts();
    const supervisors = db.getAllSupervisors();
    const aqlPlans = db.getAllAqlPlans();
    const roles = db.getAllRoles();
    const users = db.getAllUsers();
    const hourlySlots = db.getHourlySlots(department);

    res.json({
      success: true,
      data: {
        lines,
        products,
        inspectors,
        rejectionReasons,
        taskTypes,
        shifts,
        supervisors,
        aqlPlans,
        roles,
        users,
        hourlySlots
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// AQL SAMPLING PLANS API
// ==========================================
app.get('/api/aql-plans', (req, res) => {
  try {
    res.json({ success: true, data: db.getAllAqlPlans() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/aql-plans/lookup', (req, res) => {
  try {
    const qty = parseInt(req.query.quantity || '0', 10);
    const plan = db.getAqlPlanForBatch(qty);
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/aql-plans', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const plan = db.createAqlPlan(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: plan, message: 'تمت إضافة نطاق فحص AQL بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/aql-plans/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const plan = db.updateAqlPlan(req.params.id, req.body, user.id, user.name);
    res.json({ success: true, data: plan, message: 'تم تحديث نطاق فحص AQL بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/aql-plans/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteAqlPlan(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف نطاق فحص AQL' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// PRODUCTION LINES API
// ==========================================
app.get('/api/lines', (req, res) => {
  try {
    const includeArchived = req.query.include_archived === 'true';
    res.json({ success: true, data: db.getAllLines(req.query.department, includeArchived) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/lines', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const line = db.createLine(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: line, message: 'تمت إضافة خط الإنتاج بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/lines/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const line = db.updateLine(req.params.id, req.body, user.id, user.name);
    res.json({ success: true, data: line, message: 'تم تحديث خط الإنتاج بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/lines/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.archiveLine(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تمت أرشفة الخط وإخفاؤه من الاختيارات الجديدة مع الاحتفاظ بسجلاته' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/lines/:id/restore', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.restoreLine(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تمت استعادة خط الإنتاج بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// PRODUCTS API
// ==========================================
app.get('/api/products', (req, res) => {
  try {
    res.json({ success: true, data: db.getAllProducts(req.query.department) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const prod = db.createProduct(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: prod, message: 'تمت إضافة المنتج بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/scrap/products/quick', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const product = db.createQuickProduct(req.body.name, null, user.id, user.name);
    res.status(201).json({ success: true, data: product, message: 'تمت إضافة المنتج إلى قائمة الجودة والهوالك.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/products/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const prod = db.updateProduct(req.params.id, req.body, user.id, user.name);
    res.json({ success: true, data: prod, message: 'تم تحديث المنتج بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/products/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteProduct(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// QUALITY INSPECTORS & ASSIGNMENTS API
// ==========================================
app.get('/api/inspectors', (req, res) => {
  try {
    res.json({ success: true, data: db.getAllInspectors() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/inspectors', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const insp = db.createInspector(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: insp, message: 'تمت إضافة مراقب الجودة بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/inspectors/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const insp = db.updateInspector(req.params.id, req.body, user.id, user.name);
    res.json({ success: true, data: insp, message: 'تم تحديث مراقب الجودة بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/inspectors/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteInspector(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف مراقب الجودة بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/assignments', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const shiftId = req.query.shift_id ? parseInt(req.query.shift_id, 10) : null;
    res.json({ success: true, data: db.getAssignments(date, shiftId) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/assignments', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const item = db.saveAssignment(req.body, user.id, user.name);
    res.json({ success: true, data: item, message: 'تم حفظ تكليف المراقب بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/assignments/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteAssignment(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف التكليف بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/assignments/line-inspector', (req, res) => {
  try {
    const lineId = parseInt(req.query.line_id, 10);
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const shiftId = req.query.shift_id ? parseInt(req.query.shift_id, 10) : null;
    if (!lineId) return res.json({ success: true, data: null });
    const inspector = db.getLineInspectorForDate(lineId, date, shiftId);
    res.json({ success: true, data: inspector || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// PALLETS & TWO-STAGE WORKFLOW API
// ==========================================
app.get('/api/pallets', (req, res) => {
  try {
    const pallets = db.getPallets(req.query);
    res.json({ success: true, data: pallets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/pallets/:id', (req, res) => {
  try {
    const pallet = db.getPalletById(req.params.id);
    if (!pallet) return res.status(404).json({ success: false, error: 'البالتة غير موجودة' });
    res.json({ success: true, data: pallet });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// STAGE 1: استلام البالتة وتوليد عينة AQL
app.post('/api/pallets/receive', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const pallet = db.receivePallet(req.body, user.id, user.name);
    res.status(201).json({
      success: true,
      data: pallet,
      message: `تم استلام البالتة رقم #${pallet.pallet_number} بنجاح في انتظار الفحص (حجم العينة المطلوب: ${pallet.sample_size_required}، حد القبول: ${pallet.max_allowed_defects}، حد الرفض: ${pallet.reject_limit})`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Alias for general create
app.post('/api/pallets', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const pallet = db.receivePallet(req.body, user.id, user.name);
    res.status(201).json({
      success: true,
      data: pallet,
      message: `تم تسجيل البالتة رقم #${pallet.pallet_number} بنجاح`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// STAGE 2: فحص البالتة وتسجيل العيوب والقرار
app.post('/api/pallets/:id/inspect', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const pallet = db.inspectPallet(req.params.id, req.body, user.id, user.name);
    res.json({
      success: true,
      data: pallet,
      message: `تم اعتماد فحص البالتة رقم #${pallet.pallet_number} (القرار: ${pallet.pallet_decision} ${pallet.decision_mode === 'auto' ? 'تلقائي AQL' : 'يدوي'})`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Quick Status transition (e.g. "بدء الفحص الآن" / "إعادة للانتظار")
app.patch('/api/pallets/:id/status', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const pallet = db.updatePalletStatus(req.params.id, req.body.status, user.id, user.name);
    res.json({
      success: true,
      data: pallet,
      message: `تم تحديث حالة البالتة #${pallet.pallet_number} إلى: ${pallet.inspection_status}`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Quick Manual Override (زر قبول يدوي / زر رفض يدوي)
app.patch('/api/pallets/:id/override-decision', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const pallet = db.overrideDecision(req.params.id, req.body.mode, user.id, user.name);
    res.json({
      success: true,
      data: pallet,
      message: `تم تعديل قرار البالتة #${pallet.pallet_number} إلى: ${pallet.pallet_decision}`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/pallets/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deletePallet(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف البالتة بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// INCOMING CARTON AND PLASTIC RECEIPTS API
// ==========================================
app.get('/api/incoming/carton-receipts', (req, res) => {
  try {
    res.json({
      success: true,
      data: db.getCartonReceipts(req.query),
      summary: db.getCartonReceiptSummary(req.query),
      supplier_analysis: db.getCartonReceiptSupplierAnalysis(req.query)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/incoming/companies', (req, res) => {
  try {
    res.json({ success: true, data: db.getCartonSuppliers() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/incoming/companies', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const company = db.createCartonSupplier(req.body.name, user.id, user.name);
    res.status(201).json({ success: true, data: company, message: 'تم حفظ الشركة في القائمة' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/incoming/companies/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deactivateCartonSupplier(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف الشركة من قائمة الاختيار مع الاحتفاظ بسجلاتها' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/incoming/carton-receipts', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const receipt = db.createCartonReceipt(req.body, user.id, user.name);
    res.status(201).json({
      success: true,
      data: receipt,
      message: 'تم تسجيل إذن استلام الكراتين بنجاح'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/incoming/carton-receipts/:id', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const receipt = db.updateCartonReceipt(req.params.id, req.body, user.id, user.name);
    res.json({ success: true, data: receipt, message: 'تم تعديل إذن الاستلام بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/incoming/carton-receipts/:id', (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteCartonReceipt(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف إذن الاستلام بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/incoming/carton-receipts/import', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const result = db.importCartonReceipts(req.body.rows, user.id, user.name);
    res.status(201).json({
      success: true,
      data: result,
      message: `تم استيراد ${result.imported_count} إذن استلام كراتين بنجاح`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/incoming/carton-receipts/delete-all', (req, res) => {
  if (req.body?.password !== INCOMING_BULK_DELETE_PASSWORD) {
    return res.status(403).json({ success: false, error: 'كلمة المرور غير صحيحة.' });
  }
  try {
    const user = getCurrentUser(req);
    const result = db.deleteAllCartonReceipts(user.id, user.name);
    res.json({
      success: true,
      data: result,
      message: `تم حذف ${result.deleted_count} إذن استلام كراتين بنجاح`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/incoming/plastic-receipts', (req, res) => {
  try {
    res.json({
      success: true,
      data: db.getPlasticReceipts(req.query),
      summary: db.getPlasticReceiptSummary(req.query),
      supplier_analysis: db.getPlasticReceiptSupplierAnalysis(req.query)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/incoming/plastic-suppliers', (req, res) => {
  try {
    res.json({ success: true, data: db.getPlasticSuppliers() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/incoming/plastic-suppliers', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    res.status(201).json({ success: true, data: db.createPlasticSupplier(req.body.name, user.id, user.name) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/incoming/plastic-suppliers/:id', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    res.json({
      success: true,
      data: db.updatePlasticSupplier(req.params.id, req.body.name, user.id, user.name),
      message: 'تم تعديل اسم المورد بنجاح'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/incoming/plastic-suppliers/:id', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const supplier = db.deactivatePlasticSupplier(req.params.id, user.id, user.name);
    res.json({ success: true, data: supplier, message: 'تم حذف المورد من القائمة، وسجلاته السابقة محفوظة' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/incoming/plastic-items', (req, res) => {
  try {
    res.json({ success: true, data: db.getPlasticItems() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/incoming/plastic-items', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    res.status(201).json({ success: true, data: db.createPlasticItem(req.body.name, user.id, user.name) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/incoming/plastic-items/:id', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    res.json({
      success: true,
      data: db.updatePlasticItem(req.params.id, req.body.name, user.id, user.name),
      message: 'تم تعديل اسم الصنف بنجاح'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/incoming/plastic-items/:id', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const item = db.deactivatePlasticItem(req.params.id, user.id, user.name);
    res.json({ success: true, data: item, message: 'تم حذف الصنف من القائمة، وسجلات الاستلام السابقة محفوظة' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/incoming/plastic-rejection-reasons', (req, res) => {
  try {
    res.json({ success: true, data: db.getPlasticRejectionReasons() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/incoming/plastic-rejection-reasons', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    res.status(201).json({ success: true, data: db.createPlasticRejectionReason(req.body.name, user.id, user.name) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/incoming/plastic-rejection-reasons/:id', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    res.json({
      success: true,
      data: db.updatePlasticRejectionReason(req.params.id, req.body.name, user.id, user.name),
      message: 'تم تعديل سبب الرفض بنجاح'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/incoming/plastic-rejection-reasons/:id', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const reason = db.deactivatePlasticRejectionReason(req.params.id, user.id, user.name);
    res.json({ success: true, data: reason, message: 'تم حذف السبب من القائمة، وسجلات الفحص السابقة محفوظة' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/incoming/plastic-receipts', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const receipt = db.savePlasticReceipt(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: receipt, message: 'تم تسجيل استلام البلاستيك بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/incoming/plastic-receipts/:id', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const receipt = db.savePlasticReceipt(req.body, user.id, user.name, req.params.id);
    res.json({ success: true, data: receipt, message: 'تم تعديل سجل استلام البلاستيك بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/incoming/plastic-receipts/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deletePlasticReceipt(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف سجل البلاستيك بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/incoming/plastic-receipts/import', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const result = db.importPlasticReceipts(req.body.rows, user.id, user.name);
    res.status(201).json({ success: true, data: result, message: `تم استيراد ${result.imported_count} سجل بلاستيك بنجاح` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/incoming/plastic-receipts/delete-all', requirePermission('supervisor'), (req, res) => {
  if (req.body?.password !== INCOMING_BULK_DELETE_PASSWORD) {
    return res.status(403).json({ success: false, error: 'كلمة المرور غير صحيحة.' });
  }
  try {
    const user = getCurrentUser(req);
    const result = db.deleteAllPlasticReceipts(user.id, user.name);
    res.json({ success: true, data: result, message: `تم حذف ${result.deleted_count} سجل بلاستيك بنجاح` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// SUMMARY & REPORTS API
// ==========================================
app.get('/api/summary', (req, res) => {
  try {
    res.json({ success: true, data: db.getLineQualitySummary(req.query) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Daily Products Production Breakdown (الإنتاج والمفحوص وفي الانتظار حسب المنتج)
app.get('/api/daily-products-summary', (req, res) => {
  try {
    res.json({ success: true, data: db.getDailyProductsSummary(req.query) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/dashboard', (req, res) => {
  try {
    res.json({ success: true, data: db.getDashboardMetrics(req.query) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/quality-dashboard', (req, res) => {
  try {
    res.json({ success: true, data: db.getLineSampleDashboardMetrics(req.query) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/reports', (req, res) => {
  try {
    const reportType = req.query.type || 'daily';
    res.json({ success: true, data: db.generateReport(reportType, req.query), reportType });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// HOURLY SAMPLE SLOTS API
// ==========================================
app.get('/api/hourly-slots', (req, res) => {
  try {
    res.json({ success: true, data: db.getHourlySlots(req.query.department) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/hourly-slots', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const slot = db.createHourlySlot(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: slot, message: 'تمت إضافة فترة فحص الساعة بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/hourly-slots/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const slot = db.updateHourlySlot(req.params.id, req.body, user.id, user.name);
    res.json({ success: true, data: slot, message: 'تم تحديث فترة فحص الساعة بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/hourly-slots/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteHourlySlot(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف فترة فحص الساعة' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// LINE SAMPLE PULLS API
// ==========================================
app.get('/api/line-sample-slots', (req, res) => {
  try {
    res.json({ success: true, data: db.getLineSampleSlots() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/line-sample-slots', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const slot = db.createLineSampleSlot(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: slot, message: 'تمت إضافة فترة السحب بنجاح.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/line-sample-slots/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteLineSampleSlot(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف فترة السحب من الفترات المتاحة.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/line-sample-period-statuses', (req, res) => {
  try {
    res.json({ success: true, data: db.getLineSamplePeriodStatuses(req.query.date) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/line-sample-period-statuses', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const status = db.saveLineSamplePeriodStatus(req.body, user.id, user.name);
    res.json({ success: true, data: status, message: 'تم حفظ حالة الخط وسبب عدم السحب.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/inspection-stations', (req, res) => {
  try {
    res.json({ success: true, data: db.getInspectionStations() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/inspection-stations', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const station = db.createInspectionStation(req.body.name, req.body.inspector_id, user.id, user.name);
    res.status(201).json({ success: true, data: station, message: 'تمت إضافة محطة الفحص بنجاح.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/inspection-stations/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const station = db.updateInspectionStation(req.params.id, req.body.inspector_id, user.id, user.name);
    res.json({ success: true, data: station, message: 'تم تحديث المراقب المسؤول عن المحطة.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/inspection-stations/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteInspectionStation(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف محطة الفحص من قائمة المحطات.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/line-sample-pulls', (req, res) => {
  try {
    res.json({ success: true, data: db.getLineSamplePulls(req.query) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/line-sample-pulls', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const pull = db.createLineSamplePull(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: pull, message: 'تم تسجيل سحبة العينات بنجاح.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/line-sample-pulls/:id', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const pull = db.updateLineSamplePull(req.params.id, req.body, user.id, user.name);
    res.json({ success: true, data: pull, message: 'تم تعديل سحبة العينات بنجاح.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/line-sample-pulls/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteLineSamplePull(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف سحبة العينات بنجاح.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/line-sample-pulls/:id/complete', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const pull = db.completeLineSamplePull(req.params.id, req.body.defects, req.body.pallet_rejected, user.id, user.name);
    res.json({ success: true, data: pull, message: 'تم إنهاء فحص السحبة وتسجيل العيوب بنجاح.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// HOURLY SAMPLES INSPECTION API
// ==========================================
app.get('/api/hourly-samples', (req, res) => {
  try {
    res.json({ success: true, data: db.getHourlySamples(req.query) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/hourly-samples/:id', (req, res) => {
  try {
    const item = db.getHourlySampleById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'سجل فحص الساعة غير موجود' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/hourly-samples', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const item = db.saveHourlySample(req.body, user.id, user.name);
    res.status(201).json({
      success: true,
      data: item,
      message: `تم حفظ فحص عينة الساعة بنجاح (${item.sample_count} عينة، ${item.defect_count} عيوب)`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/hourly-samples/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteHourlySample(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف فحص عينة الساعة بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// DAILY END-OF-DAY PRODUCTION API
// ==========================================
app.get('/api/daily-production', (req, res) => {
  try {
    res.json({ success: true, data: db.getDailyLineProduction(req.query) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/daily-production', requirePermission('supervisor', 'inspector'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const item = db.saveDailyLineProduction(req.body, user.id, user.name);
    res.status(201).json({
      success: true,
      data: item,
      message: `تم تسجيل إجمالي إنتاج اليوم بنجاح (${item.total_produced_qty} وحدة)`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// FLOWCHART & SYSTEM DEEP ANALYTICS API
// ==========================================
app.get('/api/flowchart-analytics', (req, res) => {
  try {
    res.json({ success: true, data: db.getFlowchartMetrics(req.query) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// SAVED FILTERS API
// ==========================================
app.get('/api/scrap-reports', (req, res) => {
  try {
    res.json({ success: true, data: db.getScrapReports(req.query.date || null) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/scrap-reports', (req, res) => {
  try {
    const report = db.saveScrapReport(req.body);
    res.status(201).json({ success: true, data: report, message: 'تم حفظ تقرير الهالك' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/scrap-reports/:id', (req, res) => {
  try {
    const report = db.saveScrapReport(req.body, req.params.id);
    res.json({ success: true, data: report, message: 'تم تحديث تقرير الهالك' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/scrap-reports/:id', (req, res) => {
  try {
    db.deleteScrapReport(req.params.id);
    res.json({ success: true, message: 'تم حذف تقرير الهالك' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/scrap-reasons', (req, res) => {
  try {
    res.json({ success: true, data: db.getScrapReasons() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/scrap-reasons', (req, res) => {
  try {
    const reason = db.createScrapReason(req.body.name);
    res.status(201).json({ success: true, data: reason, message: 'تمت إضافة سبب الهالك.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/scrap-reasons/:id', (req, res) => {
  try {
    const reason = db.updateScrapReason(req.params.id, req.body.name);
    res.json({ success: true, data: reason, message: 'تم تعديل سبب الهالك.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/scrap-reasons/:id', (req, res) => {
  try {
    db.deleteScrapReason(req.params.id);
    res.json({ success: true, message: 'تم حذف سبب الهالك.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/second-sort-handover-reports', (req, res) => {
  try {
    res.json({ success: true, data: db.getSecondSortHandoverReports(req.query.date || null) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/second-sort-handover-reports/:id', (req, res) => {
  try {
    const report = db.getSecondSortHandoverReportById(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: 'تقرير تسليم الفرز الثاني غير موجود.' });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/second-sort-handover-reports', (req, res) => {
  try {
    const report = db.saveSecondSortHandoverReport(req.body);
    res.status(201).json({ success: true, data: report, message: 'تم حفظ تقرير تسليم الفرز الثاني.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/second-sort-handover-reports/:id', (req, res) => {
  try {
    const report = db.saveSecondSortHandoverReport(req.body, req.params.id);
    res.json({ success: true, data: report, message: 'تم تحديث تقرير تسليم الفرز الثاني.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/second-sort-handover-reports/:id', (req, res) => {
  try {
    db.deleteSecondSortHandoverReport(req.params.id);
    res.json({ success: true, message: 'تم حذف تقرير تسليم الفرز الثاني.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/second-sort-reasons', (req, res) => {
  try {
    res.json({ success: true, data: db.getSecondSortReasons() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/second-sort-reasons', (req, res) => {
  try {
    const reason = db.createSecondSortReason(req.body.name);
    res.status(201).json({ success: true, data: reason, message: 'تمت إضافة سبب الفرز الثاني.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/second-sort-returns', (req, res) => {
  try {
    res.json({ success: true, data: db.getSecondSortReturnReports(req.query.date || null) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/second-sort-returns/:id', (req, res) => {
  try {
    const report = db.getSecondSortReturnReportById(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: 'تقرير إرجاع الفرز غير موجود.' });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/second-sort-returns', (req, res) => {
  try {
    const report = db.saveSecondSortReturnReport(req.body);
    res.status(201).json({ success: true, data: report, message: 'تم حفظ تقرير إرجاع الفرز.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/second-sort-returns/:id', (req, res) => {
  try {
    const report = db.saveSecondSortReturnReport(req.body, req.params.id);
    res.json({ success: true, data: report, message: 'تم تحديث تقرير إرجاع الفرز.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/second-sort-returns/:id', (req, res) => {
  try {
    db.deleteSecondSortReturnReport(req.params.id);
    res.json({ success: true, message: 'تم حذف تقرير إرجاع الفرز.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/saved-filters', (req, res) => {
  try {
    res.json({ success: true, data: db.getSavedFilters(req.query.type) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/saved-filters', (req, res) => {
  try {
    const user = getCurrentUser(req);
    const filter = db.createSavedFilter(req.body, user.id);
    res.status(201).json({ success: true, data: filter, message: 'تم حفظ الفلتر بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/saved-filters/:id', (req, res) => {
  try {
    db.deleteSavedFilter(req.params.id);
    res.json({ success: true, message: 'تم حذف الفلتر المحفوظ' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// SETTINGS LOOKUPS API
// ==========================================
app.get('/api/settings/rejection-reasons', (req, res) => {
  try {
    res.json({ success: true, data: db.getAllRejectionReasons() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/rejection-reasons', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const item = db.createRejectionReason(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: item, message: 'تمت إضافة سبب الرفض بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/rejection-reasons/quick', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const item = db.createQuickRejectionReason(req.body.name, req.body.department, user.id, user.name);
    res.status(201).json({ success: true, data: item, message: 'تمت إضافة سبب العيب إلى القائمة.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/settings/rejection-reasons/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteRejectionReason(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف سبب الرفض' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/settings/supervisors', (req, res) => {
  try {
    res.json({ success: true, data: db.getAllSupervisors() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/supervisors', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const item = db.createSupervisor(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: item, message: 'تمت إضافة المشرف بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/settings/supervisors/:id', requirePermission('supervisor'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteSupervisor(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف المشرف' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Users & Roles
app.get('/api/users', (req, res) => {
  try {
    res.json({ success: true, data: db.getAllUsers() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', requirePermission('admin'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const item = db.createUser(req.body, user.id, user.name);
    res.status(201).json({ success: true, data: item, message: 'تم إنشاء المستخدم بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/users/:id', requirePermission('admin'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    const item = db.updateUser(req.params.id, req.body, user.id, user.name);
    res.json({ success: true, data: item, message: 'تم تحديث بيانات المستخدم' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/users/:id', requirePermission('admin'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    db.deleteUser(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف المستخدم' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/roles', (req, res) => {
  try {
    res.json({ success: true, data: db.getAllRoles() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Audit Logs
app.get('/api/audit-logs', (req, res) => {
  try {
    res.json({ success: true, data: db.getAuditLogs(parseInt(req.query.limit || '100', 10)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `واجهة API غير موجودة: ${req.method} ${req.originalUrl}` });
});

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`نظام إدارة الجودة - مصنع المغربي للأجهزة المنزلية`);
  console.log(`يعمل الآن على: http://localhost:${PORT}`);
  console.log(`جدول خطط الفحص AQL المستوى الثاني مفعل تلقائياً`);
  console.log(`=======================================================`);
});
