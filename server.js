const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/index');
const { initializeDatabase } = require('./db/schema');

// Ensure DB is initialized
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
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
    const lines = db.getAllLines();
    const products = db.getAllProducts();
    const inspectors = db.getAllInspectors();
    const rejectionReasons = db.getAllRejectionReasons();
    const taskTypes = db.getAllTaskTypes();
    const shifts = db.getAllShifts();
    const supervisors = db.getAllSupervisors();
    const aqlPlans = db.getAllAqlPlans();
    const roles = db.getAllRoles();
    const users = db.getAllUsers();

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
        users
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
    res.json({ success: true, data: db.getAllLines() });
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
    db.deleteLine(req.params.id, user.id, user.name);
    res.json({ success: true, message: 'تم حذف خط الإنتاج بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// PRODUCTS API
// ==========================================
app.get('/api/products', (req, res) => {
  try {
    res.json({ success: true, data: db.getAllProducts() });
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

app.get('/api/reports', (req, res) => {
  try {
    const reportType = req.query.type || 'daily';
    res.json({ success: true, data: db.generateReport(reportType, req.query), reportType });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// SAVED FILTERS API
// ==========================================
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
