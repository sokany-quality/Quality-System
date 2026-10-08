// El Maghraby Home Appliances - Quality Management System Client Application

const App = {
  currentUser: null,
  metadata: {
    lines: [],
    products: [],
    inspectors: [],
    rejectionReasons: [],
    taskTypes: [],
    shifts: [],
    supervisors: [],
    aqlPlans: [],
    users: [],
    roles: []
  },
  activeTab: 'dashboard',

  async init() {
    this.setupEventListeners();
    await this.loadBootstrapData();
    this.setupUserSwitcher();
    this.switchTab('dashboard');
  },

  setupEventListeners() {
    // Default dates to today
    const today = new Date().toISOString().slice(0, 10);
    const dateInputs = [
      'pallets-filter-date', 'summary-date-from', 'summary-date-to',
      'report-date-from', 'report-date-to', 'assignments-date',
      'rec-date', 'insp-date', 'daily-breakdown-date', 'as-date',
      'adv-date-from', 'adv-date-to'
    ];
    dateInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value) el.value = today;
    });
  },

  // Sidebar Collapse / Expand Toggle
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const chevron = document.getElementById('sidebar-chevron-icon');
    if (!sidebar) return;

    sidebar.classList.toggle('collapsed');
    if (chevron) {
      if (sidebar.classList.contains('collapsed')) {
        chevron.className = 'fa-solid fa-chevron-left';
      } else {
        chevron.className = 'fa-solid fa-chevron-right';
      }
    }
  },

  async loadBootstrapData() {
    try {
      const res = await this.apiGet('/api/bootstrap');
      if (res.success) {
        this.metadata = res.data;
        this.populateDropdowns();
      }
    } catch (err) {
      this.toast('فشل في تحميل بيانات النظام الأولية', 'error');
    }
  },

  populateDropdowns() {
    // 1. Lines
    const lineSelects = ['dash-filter-line', 'pallets-filter-line', 'report-filter-line', 'adv-line', 'rec-line', 'as-line', 'prod-line'];
    lineSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = !['rec-line', 'as-line', 'prod-line'].includes(id);
      let html = isFilter ? '<option value="">جميع الخطوط</option>' : '<option value="">اختر خط التجميع...</option>';
      this.metadata.lines.forEach(l => {
        html += `<option value="${l.id}">خط ${l.line_number} - ${l.name}</option>`;
      });
      el.innerHTML = html;
    });

    // 2. Products
    const prodSelects = ['adv-product', 'rec-product', 'l-product'];
    prodSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = id === 'adv-product';
      let html = isFilter ? '<option value="">جميع الأجهزة</option>' : '<option value="">اختر الجهاز المنزلي...</option>';
      this.metadata.products.forEach(p => {
        html += `<option value="${p.id}">${p.name} (${p.code})</option>`;
      });
      el.innerHTML = html;
    });

    // 3. Shifts
    const shiftSelects = ['dash-filter-shift', 'summary-filter-shift', 'assignments-shift', 'adv-shift', 'rec-shift', 'as-shift'];
    shiftSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = !['rec-shift', 'as-shift'].includes(id);
      let html = isFilter ? '<option value="">جميع الورديات</option>' : '';
      this.metadata.shifts.forEach(s => {
        html += `<option value="${s.id}">${s.name}</option>`;
      });
      el.innerHTML = html;
    });

    // 4. Inspectors
    const inspSelects = ['rec-inspector', 'as-inspector', 'adv-inspector'];
    inspSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = id === 'adv-inspector';
      let html = isFilter ? '<option value="">جميع المراقبين</option>' : '<option value="">اختر مراقب الجودة...</option>';
      this.metadata.inspectors.forEach(i => {
        html += `<option value="${i.id}">${i.name} (${i.code})</option>`;
      });
      el.innerHTML = html;
    });

    // 5. Tasks
    const taskSelect = document.getElementById('as-task');
    if (taskSelect) {
      let html = '';
      this.metadata.taskTypes.forEach(t => {
        html += `<option value="${t.id}" data-code="${t.code}" data-requires-line="${t.requires_line}">${t.name}</option>`;
      });
      taskSelect.innerHTML = html;
    }
  },

  setupUserSwitcher() {
    const switcher = document.getElementById('user-switcher');
    if (!switcher || !this.metadata.users.length) return;

    switcher.innerHTML = this.metadata.users.map(u => `
      <option value="${u.id}">${u.full_name} [${u.role_name}]</option>
    `).join('');

    this.currentUser = this.metadata.users[0];
    this.updateUserRoleBadge();

    switcher.addEventListener('change', (e) => {
      const selected = this.metadata.users.find(u => u.id === parseInt(e.target.value, 10));
      if (selected) {
        this.currentUser = selected;
        this.updateUserRoleBadge();
        this.toast(`تم التبديل إلى: ${selected.full_name} (${selected.role_name})`, 'info');
      }
    });
  },

  updateUserRoleBadge() {
    const badge = document.getElementById('role-badge');
    if (!badge || !this.currentUser) return;
    badge.textContent = this.currentUser.role_name;
  },

  switchTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.className = 'nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm text-[#c8102e] bg-red-50 border border-red-200 shadow-2xs transition';
        const icon = btn.querySelector('i');
        if (icon) icon.className = icon.className.replace('text-slate-500', 'text-[#c8102e]');
      } else {
        btn.className = 'nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition';
        const icon = btn.querySelector('i');
        if (icon) icon.className = icon.className.replace('text-[#c8102e]', 'text-slate-500');
      }
    });

    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.remove('hidden');

    switch (tabId) {
      case 'dashboard': DashboardModule.load(); break;
      case 'pallets': PalletModule.load(); break;
      case 'daily-breakdown': DailyBreakdownModule.load(); break;
      case 'line-summary': SummaryModule.load(); break;
      case 'aql-plans': AqlModule.load(); break;
      case 'lines': LinesModule.load(); break;
      case 'products': ProductsModule.load(); break;
      case 'inspectors': InspectorsModule.load(); break;
      case 'reports': ReportsModule.init(); break;
      case 'search': SearchModule.init(); break;
      case 'settings': SettingsModule.init(); break;
      case 'audit': AuditModule.load(); break;
    }
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon} text-lg"></i>
      <span class="font-bold">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  async request(url, options = {}) {
    const headers = options.headers || {};
    if (this.currentUser) {
      headers['x-user-id'] = this.currentUser.id;
      headers['x-user-name'] = encodeURIComponent(this.currentUser.full_name);
      headers['x-user-role'] = this.currentUser.role_code;
    }
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    options.headers = headers;

    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'حدث خطأ في معالجة الطلب');
    return data;
  },

  apiGet(url) { return this.request(url, { method: 'GET' }); },
  apiPost(url, body) { return this.request(url, { method: 'POST', body }); },
  apiPut(url, body) { return this.request(url, { method: 'PUT', body }); },
  apiPatch(url, body) { return this.request(url, { method: 'PATCH', body }); },
  apiDelete(url) { return this.request(url, { method: 'DELETE' }); },

  confirm(message, onConfirm) {
    const modal = document.getElementById('modal-confirm');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('btn-confirm-ok');
    const cancelBtn = document.getElementById('btn-confirm-cancel');

    msgEl.textContent = message;
    modal.classList.remove('hidden');

    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    okBtn.onclick = () => { cleanup(); onConfirm(); };
    cancelBtn.onclick = cleanup;
  }
};

// ============================================================================
// 1. DASHBOARD MODULE
// ============================================================================
const DashboardModule = {
  charts: {},

  handlePresetChange(val) {
    const customDiv = document.getElementById('dash-custom-dates');
    if (val === 'custom') customDiv.classList.remove('hidden');
    else { customDiv.classList.add('hidden'); this.load(); }
  },

  async load() {
    try {
      const preset = document.getElementById('dash-filter-preset').value;
      const lineId = document.getElementById('dash-filter-line').value;
      const shiftId = document.getElementById('dash-filter-shift').value;
      let dateFrom = '', dateTo = '';
      const today = new Date().toISOString().slice(0, 10);

      if (preset === 'today') { dateFrom = today; dateTo = today; }
      else if (preset === 'yesterday') {
        const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        dateFrom = yest; dateTo = yest;
      } else if (preset === 'last7') {
        dateFrom = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        dateTo = today;
      } else if (preset === 'this_month') {
        dateFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
        dateTo = today;
      } else if (preset === 'custom') {
        dateFrom = document.getElementById('dash-date-from').value;
        dateTo = document.getElementById('dash-date-to').value;
      }

      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (lineId) params.append('line_id', lineId);
      if (shiftId) params.append('shift_id', shiftId);

      const res = await App.apiGet(`/api/dashboard?${params.toString()}`);
      if (!res.success) return;

      const data = res.data;
      const t = data.totals;

      document.getElementById('stat-produced').textContent = Number(t.total_produced).toLocaleString('ar-EG');
      document.getElementById('stat-produced-sub').textContent = `${t.total_pallets} بالتة مستلمة`;

      document.getElementById('stat-waiting-pallets').textContent = Number(t.waiting_pallets).toLocaleString('ar-EG');
      document.getElementById('stat-waiting-qty').textContent = `${Number(t.waiting_qty).toLocaleString('ar-EG')} جهاز في الانتظار`;

      document.getElementById('stat-inspected').textContent = Number(t.total_inspected).toLocaleString('ar-EG');
      document.getElementById('stat-inspected-pallets').textContent = `${t.completed_pallets} بالتة تم فحصها`;

      document.getElementById('stat-accepted-pallets').textContent = Number(t.accepted_pallets).toLocaleString('ar-EG');
      document.getElementById('stat-rejected-pallets').textContent = Number(t.rejected_pallets).toLocaleString('ar-EG');
      document.getElementById('stat-rejection-rate').textContent = `${t.avg_rejection_rate}%`;

      this.renderCharts(data);
      this.renderLinesTable(data.line_comparison);
    } catch (err) {
      App.toast('تعذر تحميل بيانات لوحة التحكم: ' + err.message, 'error');
    }
  },

  renderCharts(data) {
    // 1. Lines comparison
    const ctx1 = document.getElementById('chart-lines-comparison');
    if (ctx1) {
      if (this.charts.lines) this.charts.lines.destroy();
      const lines = data.line_comparison;
      this.charts.lines = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: lines.map(l => `خط ${l.line_number}`),
          datasets: [
            { label: 'الكمية المستلمة', data: lines.map(l => l.total_produced), backgroundColor: '#3b82f6', borderRadius: 6 },
            { label: 'في انتظار الفحص', data: lines.map(l => l.waiting_pallets * 50), backgroundColor: '#f59e0b', borderRadius: 6 },
            { label: 'عينات فحص AQL', data: lines.map(l => l.total_inspected), backgroundColor: '#6366f1', borderRadius: 6 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { family: 'Cairo' } } } }
        }
      });
    }

    // 2. Top reasons
    const ctx2 = document.getElementById('chart-top-reasons');
    if (ctx2) {
      if (this.charts.reasons) this.charts.reasons.destroy();
      let reasons = data.top_reasons;
      if (!reasons.length) reasons = [{ name: 'لا توجد عيوب مسجلة', total_count: 1 }];
      this.charts.reasons = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: reasons.map(r => r.name),
          datasets: [{
            data: reasons.map(r => r.total_count),
            backgroundColor: ['#c8102e', '#f97316', '#eab308', '#06b6d4', '#8b5cf6', '#64748b']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { family: 'Cairo', size: 10 } } } }
        }
      });
    }
  },

  renderLinesTable(lines) {
    const tbody = document.getElementById('dash-lines-tbody');
    if (!tbody) return;

    tbody.innerHTML = lines.map(l => `
      <tr>
        <td class="font-bold text-[#c8102e]">خط ${l.line_number} (${l.line_name})</td>
        <td class="font-semibold">${l.supervisor_name}</td>
        <td><span class="text-xs text-slate-600">مكلف آلياً</span></td>
        <td class="font-bold">${l.total_produced} جهاز</td>
        <td class="font-bold text-amber-700">${l.waiting_pallets} بالتة</td>
        <td class="font-bold text-indigo-700">${l.completed_pallets} بالتة</td>
        <td class="font-bold text-emerald-700">${l.accepted_pallets}</td>
        <td class="font-bold text-red-700">${l.rejected_pallets}</td>
        <td><span class="px-2 py-0.5 rounded-full text-xs font-bold ${l.rejection_rate > 3 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}">${l.rejection_rate}%</span></td>
        <td><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">يعمل</span></td>
      </tr>
    `).join('');
  }
};

// ============================================================================
// 2. PALLETS WORKFLOW (استلام وفحص البلتات طبقاً لـ AQL)
// ============================================================================
const PalletModule = {
  currentPallets: [],

  async load() {
    try {
      const date = document.getElementById('pallets-filter-date').value;
      const status = document.getElementById('pallets-filter-status').value;
      const lineId = document.getElementById('pallets-filter-line').value;
      const decision = document.getElementById('pallets-filter-decision').value;
      const search = document.getElementById('pallets-search-input').value;

      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (status) params.append('inspection_status', status);
      if (lineId) params.append('line_id', lineId);
      if (decision) params.append('pallet_decision', decision);
      if (search) params.append('search', search);

      const res = await App.apiGet(`/api/pallets?${params.toString()}`);
      if (!res.success) return;

      this.currentPallets = res.data;
      this.renderTable(this.currentPallets);
    } catch (err) {
      App.toast('تعذر تحميل البلتات: ' + err.message, 'error');
    }
  },

  handleSearch(val) {
    const term = val.toLowerCase();
    const filtered = this.currentPallets.filter(p => (
      p.pallet_number.toString().includes(term) ||
      (p.product_name && p.product_name.toLowerCase().includes(term)) ||
      (p.inspector_name && p.inspector_name.toLowerCase().includes(term))
    ));
    this.renderTable(filtered);
  },

  renderTable(pallets) {
    const tbody = document.getElementById('pallets-tbody');
    const emptyEl = document.getElementById('pallets-empty');
    if (!tbody) return;

    if (!pallets.length) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    tbody.innerHTML = pallets.map(p => {
      // Status badge
      let statusBadge = '';
      if (p.inspection_status === 'في انتظار الفحص') {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold badge-status-waiting">⏳ في الانتظار</span>`;
      } else if (p.inspection_status === 'جاري الفحص') {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold badge-status-inprogress animate-pulse">⏱️ جاري الفحص</span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold badge-status-completed">✓ تم الفحص</span>`;
      }

      // Compact Time chips
      let timeChips = `<span class="time-chip time-chip-received" title="وقت الاستلام">🕒 ${p.received_time || '—'}</span>`;
      if (p.inspection_started_at) {
        timeChips += ` <span class="time-chip time-chip-started" title="بدء الفحص">⏱️ ${p.inspection_started_at}</span>`;
      }
      if (p.inspection_completed_at) {
        timeChips += ` <span class="time-chip time-chip-completed" title="إنهاء الفحص">🏁 ${p.inspection_completed_at}</span>`;
      }

      // Decision badge
      let decBadge = 'badge-pending';
      if (p.pallet_decision === 'مقبول') decBadge = 'badge-accepted';
      if (p.pallet_decision === 'مرفوض') decBadge = 'badge-rejected';

      const isWaiting = p.inspection_status === 'في انتظار الفحص';
      const isInProgress = p.inspection_status === 'جاري الفحص';

      return `
        <tr>
          <td>
            <div class="font-bold text-slate-800 text-xs">${p.date}</div>
            <div class="mt-1">${timeChips}</div>
          </td>
          <td class="font-extrabold text-[#c8102e] whitespace-nowrap">خط ${p.line_number}</td>
          <td class="font-black text-slate-900 bg-red-50/50 text-center rounded text-sm">#${p.pallet_number}</td>
          <td class="font-bold text-slate-800 text-xs">${p.product_name}</td>
          <td class="font-extrabold text-blue-700">${p.quantity_on_pallet} جهاز</td>
          <td>${statusBadge}</td>
          <td class="font-bold text-indigo-700 text-center">${p.sample_size_required || 20}</td>
          <td class="font-bold text-center">${p.inspected_quantity || 0}</td>
          <td class="font-extrabold text-red-600 text-center">${p.rejected_quantity || 0}</td>
          <td class="text-xs text-slate-600 text-center">≥ ${p.reject_limit || 1}</td>
          <td>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold ${decBadge}">
              ${p.pallet_decision}
            </span>
            ${p.decision_mode && p.decision_mode !== 'auto' ? `
              <span class="block text-[9px] text-slate-400 font-bold">(يدوي)</span>
            ` : ''}
          </td>
          <td class="text-xs font-semibold text-slate-700">${p.inspector_name || 'غير محدد'}</td>
          <td class="text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1">
              ${isWaiting ? `
                <button onclick="PalletModule.startInspection(${p.id})" title="بدء الفحص الآن" class="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition">
                  <i class="fa-solid fa-play ml-0.5"></i> بدء الفحص
                </button>
              ` : ''}

              <button onclick="PalletModule.openInspectModal(${p.id})" title="تسجيل نتائج فحص العينات والقرار" class="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition">
                <i class="fa-solid fa-microscope ml-0.5"></i> فحص البالتة
              </button>

              <!-- Quick Decision Override Buttons -->
              <button onclick="PalletModule.overrideDecision(${p.id}, 'manual_accept')" title="قبول فوري للبالتة" class="text-emerald-700 hover:bg-emerald-100 p-1 rounded font-bold text-xs">
                ✓
              </button>
              <button onclick="PalletModule.overrideDecision(${p.id}, 'manual_reject')" title="رفض فوري للبالتة" class="text-red-700 hover:bg-red-100 p-1 rounded font-bold text-xs">
                ✕
              </button>
              <button onclick="PalletModule.delete(${p.id}, ${p.pallet_number}, ${p.line_number})" title="حذف" class="text-slate-400 hover:text-red-700 p-1">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // STAGE 1: RECEIVE MODAL
  openReceiveModal() {
    const modal = document.getElementById('modal-receive-pallet');
    const form = document.getElementById('receive-pallet-form');
    form.reset();

    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);
    document.getElementById('rec-date').value = today;
    document.getElementById('rec-time').value = nowTime;
    document.getElementById('rec-qty').value = 120;

    this.handleReceiveLineChange();
    this.updateReceiveAqlCard(120);

    modal.classList.remove('hidden');
  },

  closeReceiveModal() {
    document.getElementById('modal-receive-pallet').classList.add('hidden');
  },

  handleReceiveLineChange() {
    const lineId = document.getElementById('rec-line').value;
    if (!lineId) return;

    const line = App.metadata.lines.find(l => l.id === parseInt(lineId, 10));
    if (line && line.current_product_id) {
      document.getElementById('rec-product').value = line.current_product_id;
    }

    this.handleReceiveContextChange();

    // Suggest next pallet number
    const date = document.getElementById('rec-date').value;
    const sameDay = this.currentPallets.filter(p => p.line_id === parseInt(lineId, 10) && p.date === date);
    let max = 0;
    sameDay.forEach(p => { if (p.pallet_number > max) max = p.pallet_number; });
    document.getElementById('rec-pallet-number').value = max + 1;
  },

  async handleReceiveContextChange() {
    const lineId = document.getElementById('rec-line').value;
    const date = document.getElementById('rec-date').value;
    const shiftId = document.getElementById('rec-shift').value;
    if (!lineId || !date) return;

    try {
      const res = await App.apiGet(`/api/assignments/line-inspector?line_id=${lineId}&date=${date}&shift_id=${shiftId}`);
      if (res.success && res.data) {
        document.getElementById('rec-inspector').value = res.data.id;
      }
    } catch (e) {}
  },

  // Live AQL Lookup for Receive Modal
  async updateReceiveAqlCard(qty) {
    const q = parseInt(qty || 0, 10);
    if (q <= 0) return;

    try {
      const res = await App.apiGet(`/api/aql-plans/lookup?quantity=${q}`);
      if (res.success && res.data) {
        const p = res.data;
        document.getElementById('rec-sample-size').textContent = `${p.sample_size} جهاز`;
        document.getElementById('rec-ac-limit').textContent = `≤ ${p.accept_limit} عيوب`;
        document.getElementById('rec-re-limit').textContent = `≥ ${p.reject_limit} عيوب`;
        document.getElementById('rec-note-sample').textContent = p.sample_size;
        document.getElementById('rec-note-reject').textContent = p.reject_limit;
        document.getElementById('rec-aql-range-label').textContent = `${p.batch_min} - ${p.batch_max} جهاز`;
      }
    } catch (e) {}
  },

  async submitReceive() {
    const payload = {
      date: document.getElementById('rec-date').value,
      received_time: document.getElementById('rec-time').value,
      shift_id: document.getElementById('rec-shift').value,
      line_id: document.getElementById('rec-line').value,
      pallet_number: document.getElementById('rec-pallet-number').value,
      quantity_on_pallet: document.getElementById('rec-qty').value,
      product_id: document.getElementById('rec-product').value,
      inspector_id: document.getElementById('rec-inspector').value || null,
      inspection_status: document.getElementById('rec-status').value,
      notes: document.getElementById('rec-notes').value
    };

    try {
      const res = await App.apiPost('/api/pallets/receive', payload);
      if (res.success) {
        App.toast(res.message, 'success');
        this.closeReceiveModal();
        await this.load();
        DashboardModule.load();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  // STAGE 2: INSPECT MODAL
  currentInspectingPallet: null,

  openInspectModal(palletId) {
    const pallet = this.currentPallets.find(p => p.id === palletId);
    if (!pallet) return;
    this.currentInspectingPallet = pallet;

    const modal = document.getElementById('modal-inspect-pallet');
    const form = document.getElementById('inspect-pallet-form');
    form.reset();
    document.getElementById('insp-reasons-rows').innerHTML = '';

    document.getElementById('insp-pallet-id').value = pallet.id;
    document.getElementById('insp-header-pallet').textContent = `#${pallet.pallet_number} (${pallet.line_name})`;
    document.getElementById('insp-header-product').textContent = pallet.product_name;
    document.getElementById('insp-header-qty').textContent = `${pallet.quantity_on_pallet} جهاز`;
    document.getElementById('insp-header-aql').textContent = `عينة: ${pallet.sample_size_required || 20} | Ac: ${pallet.max_allowed_defects || 2} | Re: ${pallet.reject_limit || 3}`;

    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);

    document.getElementById('insp-date').value = pallet.inspection_date || today;
    document.getElementById('insp-start-time').value = pallet.inspection_started_at || nowTime;
    document.getElementById('insp-end-time').value = pallet.inspection_completed_at || nowTime;

    document.getElementById('insp-samples-qty').value = pallet.inspected_quantity || pallet.sample_size_required || 20;
    document.getElementById('insp-defects-qty').value = pallet.rejected_quantity || 0;
    document.getElementById('insp-status-select').value = pallet.inspection_status === 'تم الفحص' ? 'تم الفحص' : 'تم الفحص';
    document.getElementById('insp-notes').value = pallet.notes || '';

    // Decision mode
    this.setDecisionMode(pallet.decision_mode || 'auto');

    // Load existing defect rows
    if (pallet.rejection_items && pallet.rejection_items.length) {
      pallet.rejection_items.forEach(item => {
        this.addInspectReasonRow(item.reason_id, item.count, item.notes);
      });
    }

    this.calculateLiveInspectionDecision();
    modal.classList.remove('hidden');
  },

  closeInspectModal() {
    document.getElementById('modal-inspect-pallet').classList.add('hidden');
  },

  setDecisionMode(mode) {
    document.getElementById('insp-decision-mode').value = mode;

    const autoBtn = document.getElementById('btn-mode-auto');
    const accBtn = document.getElementById('btn-mode-accept');
    const rejBtn = document.getElementById('btn-mode-reject');

    autoBtn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-100 text-slate-700 hover:bg-red-100 transition';
    accBtn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-100 text-slate-700 hover:bg-emerald-100 transition';
    rejBtn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-100 text-slate-700 hover:bg-red-100 transition';

    if (mode === 'auto') {
      autoBtn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs bg-red-100 text-[#c8102e] border border-red-300';
    } else if (mode === 'manual_accept') {
      accBtn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300';
    } else if (mode === 'manual_reject') {
      rejBtn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs bg-red-100 text-red-800 border border-red-300';
    }

    this.calculateLiveInspectionDecision();
  },

  calculateLiveInspectionDecision() {
    if (!this.currentInspectingPallet) return;

    const pallet = this.currentInspectingPallet;
    const mode = document.getElementById('insp-decision-mode').value;
    const defects = parseInt(document.getElementById('insp-defects-qty').value || 0, 10);
    const ac = pallet.max_allowed_defects ?? 2;
    const re = pallet.reject_limit ?? 3;

    const badge = document.getElementById('insp-live-decision-badge');
    const exp = document.getElementById('insp-calc-explanation');

    if (mode === 'manual_accept') {
      badge.textContent = 'مقبول (يدوي) ✓';
      badge.className = 'px-3.5 py-1.5 rounded-full text-xs font-extrabold badge-accepted';
      exp.textContent = 'تم اعتماد القبول يدوياً بتجاوز معيار AQL';
      return;
    }
    if (mode === 'manual_reject') {
      badge.textContent = 'مرفوض (يدوي) ✕';
      badge.className = 'px-3.5 py-1.5 rounded-full text-xs font-extrabold badge-rejected';
      exp.textContent = 'تم اعتماد الرفض يدوياً بقرار المراقب';
      return;
    }

    // Auto AQL Decision
    if (defects >= re) {
      badge.textContent = 'مرفوض ✕';
      badge.className = 'px-3.5 py-1.5 rounded-full text-xs font-extrabold badge-rejected';
      exp.textContent = `العيوب (${defects}) ≥ حد الرفض (${re}) ← البالتة مرفوضة طبقاً لـ AQL`;
    } else if (defects <= ac) {
      badge.textContent = 'مقبول ✓';
      badge.className = 'px-3.5 py-1.5 rounded-full text-xs font-extrabold badge-accepted';
      exp.textContent = `العيوب (${defects}) ≤ حد القبول المسموح (${ac}) ← البالتة مقبولة طبقاً لـ AQL`;
    } else {
      badge.textContent = 'مرفوض ✕';
      badge.className = 'px-3.5 py-1.5 rounded-full text-xs font-extrabold badge-rejected';
      exp.textContent = `تجاوزت الحد المسموح به للقبول (${ac})`;
    }
  },

  addInspectReasonRow(reasonId = null, count = 1, notes = '') {
    const container = document.getElementById('insp-reasons-rows');
    const rowId = 'insp-reason-' + Date.now() + Math.random().toString(36).substr(2, 4);

    let options = '<option value="">اختر عيب الجهاز المنزلي...</option>';
    App.metadata.rejectionReasons.forEach(r => {
      const sel = r.id === parseInt(reasonId, 10) ? 'selected' : '';
      options += `<option value="${r.id}" ${sel}>${r.name} (${r.category})</option>`;
    });

    const div = document.createElement('div');
    div.id = rowId;
    div.className = 'flex items-center gap-2 bg-white p-2 rounded-xl border border-red-200 text-xs';
    div.innerHTML = `
      <select class="inspect-reason-select flex-1 bg-slate-50 border rounded-lg px-2 py-1 font-semibold">${options}</select>
      <input type="number" min="1" value="${count || 1}" class="inspect-reason-count w-16 bg-slate-50 border rounded-lg px-2 py-1 font-bold text-red-700">
      <input type="text" value="${notes || ''}" placeholder="ملاحظة..." class="inspect-reason-notes flex-1 bg-slate-50 border rounded-lg px-2 py-1">
      <button type="button" onclick="document.getElementById('${rowId}').remove()" class="text-red-500 hover:text-red-700 p-1"><i class="fa-solid fa-minus-circle"></i></button>
    `;
    container.appendChild(div);
  },

  async submitInspection() {
    const id = document.getElementById('insp-pallet-id').value;

    const reasonRows = document.querySelectorAll('#insp-reasons-rows > div');
    const rejectionItems = [];
    reasonRows.forEach(row => {
      const select = row.querySelector('.inspect-reason-select');
      const countInput = row.querySelector('.inspect-reason-count');
      const noteInput = row.querySelector('.inspect-reason-notes');
      if (select && select.value) {
        rejectionItems.push({
          reason_id: select.value,
          count: parseInt(countInput.value || 0, 10),
          notes: noteInput.value
        });
      }
    });

    const payload = {
      inspection_status: document.getElementById('insp-status-select').value,
      inspection_date: document.getElementById('insp-date').value,
      inspection_started_at: document.getElementById('insp-start-time').value,
      inspection_completed_at: document.getElementById('insp-end-time').value,
      inspected_quantity: document.getElementById('insp-samples-qty').value,
      rejected_quantity: document.getElementById('insp-defects-qty').value,
      decision_mode: document.getElementById('insp-decision-mode').value,
      notes: document.getElementById('insp-notes').value,
      rejection_items: rejectionItems
    };

    try {
      const res = await App.apiPost(`/api/pallets/${id}/inspect`, payload);
      if (res.success) {
        App.toast(res.message, 'success');
        this.closeInspectModal();
        await this.load();
        DashboardModule.load();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  // One-click start inspection
  async startInspection(id) {
    try {
      const res = await App.apiPatch(`/api/pallets/${id}/status`, { status: 'جاري الفحص' });
      if (res.success) {
        App.toast(res.message, 'info');
        await this.load();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  // One-click decision override
  async overrideDecision(id, mode) {
    try {
      const res = await App.apiPatch(`/api/pallets/${id}/override-decision`, { mode });
      if (res.success) {
        App.toast(res.message, 'success');
        await this.load();
        DashboardModule.load();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  delete(id, palletNum, lineNum) {
    App.confirm(`هل أنت متأكد من حذف البالتة رقم #${palletNum} (خط ${lineNum})؟`, async () => {
      try {
        const res = await App.apiDelete(`/api/pallets/${id}`);
        if (res.success) {
          App.toast(res.message, 'success');
          await this.load();
          DashboardModule.load();
        }
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },

  exportExcel() {
    if (!this.currentPallets.length) return App.toast('لا توجد بيانات للتصدير', 'warning');
    const data = this.currentPallets.map(p => ({
      'تاريخ الاستلام': p.date,
      'وقت الاستلام': p.received_time,
      'الوردية': p.shift_name,
      'خط التجميع': p.line_name,
      'رقم البالتة': p.pallet_number,
      'اسم الجهاز': p.product_name,
      'حجم البالتة': p.quantity_on_pallet,
      'حالة الفحص': p.inspection_status,
      'بدء الفحص': p.inspection_started_at || '—',
      'إنهاء الفحص': p.inspection_completed_at || '—',
      'عينة AQL المقررة': p.sample_size_required,
      'العينات المفحوصة': p.inspected_quantity,
      'العيوب المكتشفة': p.rejected_quantity,
      'حد الرفض Re': p.reject_limit,
      'قرار البالتة': p.pallet_decision,
      'نمط القرار': p.decision_mode === 'auto' ? 'تلقائي AQL' : 'يدوي',
      'مراقب الجودة': p.inspector_name || '—',
      'تفاصيل العيوب': p.rejection_summary || ''
    }));
    ExportsManager.exportToExcel(data, 'سجل_بلتات_المغربي');
  }
};

// ============================================================================
// 3. DAILY PRODUCTION & WAITING BREAKDOWN MODULE
// ============================================================================
const DailyBreakdownModule = {
  currentData: [],

  async load() {
    const date = document.getElementById('daily-breakdown-date').value;
    try {
      const res = await App.apiGet(`/api/daily-products-summary?date=${date}`);
      if (res.success) {
        this.currentData = res.data;
        this.render(date);
      }
    } catch (err) {
      App.toast('تعذر تحميل تقرير الأجهزة: ' + err.message, 'error');
    }
  },

  render(date) {
    const tbody = document.getElementById('daily-breakdown-tbody');
    const tfoot = document.getElementById('daily-breakdown-tfoot');
    const badge = document.getElementById('daily-breakdown-badge');
    if (!tbody) return;

    if (badge) badge.textContent = `تاريخ التقرير: ${date}`;

    let totalPallets = 0, totalProduced = 0, totalInspected = 0, totalWaiting = 0;
    let totalSamples = 0, totalDefects = 0, totalAcc = 0, totalRej = 0;

    tbody.innerHTML = this.currentData.map(d => {
      totalPallets += d.total_pallets;
      totalProduced += d.total_produced_qty;
      totalInspected += d.inspected_pallet_qty;
      totalWaiting += d.waiting_pallet_qty;
      totalSamples += d.total_inspected_samples;
      totalDefects += d.total_defects;
      totalAcc += d.accepted_pallets;
      totalRej += d.rejected_pallets;

      return `
        <tr>
          <td class="font-extrabold text-[#c8102e]">${d.product_code}</td>
          <td class="font-bold text-slate-900">${d.product_name}</td>
          <td class="font-semibold text-slate-700">${d.line_name || '—'}</td>
          <td class="font-bold text-center">${d.total_pallets} بالتة</td>
          <td class="font-black text-slate-900">${Number(d.total_produced_qty).toLocaleString('ar-EG')} جهاز</td>
          <td class="font-bold text-indigo-700">${Number(d.inspected_pallet_qty).toLocaleString('ar-EG')} جهاز</td>
          <td class="font-bold text-amber-700">${Number(d.waiting_pallet_qty).toLocaleString('ar-EG')} جهاز (${d.waiting_pallets_count} بالتة)</td>
          <td class="font-semibold text-center">${d.total_inspected_samples}</td>
          <td class="font-bold text-red-600 text-center">${d.total_defects}</td>
          <td class="font-bold text-emerald-700 text-center">${d.accepted_pallets}</td>
          <td class="font-bold text-red-700 text-center">${d.rejected_pallets}</td>
          <td><span class="px-2 py-0.5 rounded text-xs font-bold ${d.rejection_rate > 3 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}">${d.rejection_rate}%</span></td>
        </tr>
      `;
    }).join('');

    tfoot.innerHTML = `
      <tr>
        <td colspan="3" class="text-right py-3 px-3">الإجمالي العام لمصنع الأجهزة:</td>
        <td class="text-center">${totalPallets} بالتة</td>
        <td class="font-extrabold">${Number(totalProduced).toLocaleString('ar-EG')} جهاز</td>
        <td class="font-extrabold text-indigo-700">${Number(totalInspected).toLocaleString('ar-EG')} جهاز</td>
        <td class="font-extrabold text-amber-700">${Number(totalWaiting).toLocaleString('ar-EG')} جهاز</td>
        <td class="text-center">${totalSamples}</td>
        <td class="text-center text-red-700">${totalDefects}</td>
        <td class="text-center text-emerald-700">${totalAcc}</td>
        <td class="text-center text-red-700">${totalRej}</td>
        <td>—</td>
      </tr>
    `;
  },

  print() {
    ExportsManager.printReport('daily-breakdown-print-container', 'تقرير الإنتاج والمفحوص وقيد الانتظار للأجهزة المنزلية');
  }
};

// ============================================================================
// 4. AQL PLANS MODULE
// ============================================================================
const AqlModule = {
  plans: [],

  async load() {
    try {
      const res = await App.apiGet('/api/aql-plans');
      if (res.success) {
        this.plans = res.data;
        this.render();
      }
    } catch (err) {
      App.toast('تعذر تحميل خطط AQL: ' + err.message, 'error');
    }
  },

  render() {
    const tbody = document.getElementById('aql-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.plans.map(p => `
      <tr>
        <td class="font-bold text-slate-800">${p.batch_min} جهاز</td>
        <td class="font-bold text-slate-800">${p.batch_max} جهاز</td>
        <td class="font-extrabold text-indigo-700 text-center">${p.sample_size} عينة</td>
        <td class="font-bold text-emerald-700 text-center">≤ ${p.accept_limit} عيوب</td>
        <td class="font-bold text-red-700 text-center">≥ ${p.reject_limit} عيوب</td>
        <td class="text-xs font-semibold text-slate-700">${p.aql_level}</td>
        <td class="text-xs text-slate-500">${p.notes || '—'}</td>
        <td class="text-center">
          <button onclick="AqlModule.openModal(${p.id})" class="text-blue-600 hover:text-blue-800 p-1"><i class="fa-solid fa-pen"></i></button>
          <button onclick="AqlModule.delete(${p.id})" class="text-red-600 hover:text-red-800 p-1"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  openModal(id = null) {
    const modal = document.getElementById('modal-aql');
    const form = document.getElementById('aql-form');
    form.reset();
    document.getElementById('aql-id').value = '';

    if (id) {
      document.getElementById('modal-aql-title').textContent = 'تعديل نطاق فحص AQL';
      const p = this.plans.find(x => x.id === id);
      if (p) {
        document.getElementById('aql-id').value = p.id;
        document.getElementById('aql-min').value = p.batch_min;
        document.getElementById('aql-max').value = p.batch_max;
        document.getElementById('aql-samples').value = p.sample_size;
        document.getElementById('aql-ac').value = p.accept_limit;
        document.getElementById('aql-re').value = p.reject_limit;
        document.getElementById('aql-notes').value = p.notes || '';
      }
    } else {
      document.getElementById('modal-aql-title').textContent = 'إضافة نطاق فحص AQL جديد';
    }

    modal.classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-aql').classList.add('hidden');
  },

  async save() {
    const id = document.getElementById('aql-id').value;
    const payload = {
      batch_min: document.getElementById('aql-min').value,
      batch_max: document.getElementById('aql-max').value,
      sample_size: document.getElementById('aql-samples').value,
      accept_limit: document.getElementById('aql-ac').value,
      reject_limit: document.getElementById('aql-re').value,
      notes: document.getElementById('aql-notes').value
    };

    try {
      let res;
      if (id) res = await App.apiPut(`/api/aql-plans/${id}`, payload);
      else res = await App.apiPost('/api/aql-plans', payload);

      if (res.success) {
        App.toast(res.message, 'success');
        this.closeModal();
        await this.load();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  delete(id) {
    App.confirm('هل أنت متأكد من حذف نطاق AQL هذا؟', async () => {
      try {
        const res = await App.apiDelete(`/api/aql-plans/${id}`);
        if (res.success) {
          App.toast(res.message, 'success');
          await this.load();
        }
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  }
};

// ============================================================================
// 5. LINES MODULE
// ============================================================================
const LinesModule = {
  async load() {
    try {
      const res = await App.apiGet('/api/lines');
      if (res.success) {
        App.metadata.lines = res.data;
        this.render(res.data);
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  render(lines) {
    const container = document.getElementById('lines-cards-container');
    if (!container) return;

    container.innerHTML = lines.map(l => `
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm stat-card flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-black px-3 py-1 rounded-lg bg-red-100 text-[#c8102e]">خط رقم ${l.line_number}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${l.status === 'نشط' ? 'badge-accepted' : 'badge-rejected'}">${l.status}</span>
          </div>
          <h3 class="font-extrabold text-slate-900 text-base mb-1">${l.name}</h3>
          <div class="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t">
            <div class="flex justify-between"><span>مشرف الخط:</span><span class="font-bold text-slate-900">${l.supervisor_name}</span></div>
            <div class="flex justify-between"><span>الجهاز المشغل:</span><span class="font-bold text-indigo-700">${l.current_product_name || 'غير محدد'}</span></div>
            <div class="flex justify-between"><span>إجمالي البلتات:</span><span class="font-bold">${l.pallets_count} بالتة</span></div>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-4 mt-4 border-t">
          <button onclick="LinesModule.openModal(${l.id})" class="text-blue-600 font-bold text-xs"><i class="fa-solid fa-pen ml-1"></i>تعديل</button>
          <button onclick="LinesModule.delete(${l.id}, '${l.name}')" class="text-red-600 font-bold text-xs"><i class="fa-solid fa-trash ml-1"></i>حذف</button>
        </div>
      </div>
    `).join('');
  },

  openModal(id = null) {
    const modal = document.getElementById('modal-line');
    const form = document.getElementById('line-form');
    form.reset();
    document.getElementById('line-id').value = '';

    if (id) {
      document.getElementById('modal-line-title').textContent = 'تعديل خط الإنتاج';
      const line = App.metadata.lines.find(l => l.id === id);
      if (line) {
        document.getElementById('line-id').value = line.id;
        document.getElementById('l-number').value = line.line_number;
        document.getElementById('l-name').value = line.name;
        document.getElementById('l-supervisor').value = line.supervisor_name;
        document.getElementById('l-product').value = line.current_product_id || '';
        document.getElementById('l-status').value = line.status;
      }
    } else {
      document.getElementById('modal-line-title').textContent = 'إضافة خط إنتاج جديد';
      const max = App.metadata.lines.reduce((m, l) => l.line_number > m ? l.line_number : m, 0);
      document.getElementById('l-number').value = max + 1;
    }
    modal.classList.remove('hidden');
  },

  closeModal() { document.getElementById('modal-line').classList.add('hidden'); },

  async save() {
    const id = document.getElementById('line-id').value;
    const payload = {
      line_number: document.getElementById('l-number').value,
      name: document.getElementById('l-name').value,
      supervisor_name: document.getElementById('l-supervisor').value,
      current_product_id: document.getElementById('l-product').value || null,
      status: document.getElementById('l-status').value
    };

    try {
      let res;
      if (id) res = await App.apiPut(`/api/lines/${id}`, payload);
      else res = await App.apiPost('/api/lines', payload);

      if (res.success) {
        App.toast(res.message, 'success');
        this.closeModal();
        await this.load();
        App.populateDropdowns();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  delete(id, name) {
    App.confirm(`هل أنت متأكد من حذف ${name}؟`, async () => {
      try {
        const res = await App.apiDelete(`/api/lines/${id}`);
        if (res.success) {
          App.toast(res.message, 'success');
          await this.load();
          App.populateDropdowns();
        }
      } catch (err) { App.toast(err.message, 'error'); }
    });
  }
};

// ============================================================================
// 6. PRODUCTS MODULE
// ============================================================================
const ProductsModule = {
  async load() {
    try {
      const res = await App.apiGet('/api/products');
      if (res.success) {
        App.metadata.products = res.data;
        this.render(res.data);
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  render(products) {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    tbody.innerHTML = products.map(p => `
      <tr>
        <td class="font-extrabold text-[#c8102e]">${p.code}</td>
        <td class="font-bold text-slate-900">${p.name}</td>
        <td class="text-xs text-slate-600 max-w-xs">${p.specifications || '—'}</td>
        <td class="font-semibold">${p.weight || '—'}</td>
        <td><span class="text-xs bg-slate-100 px-2 py-0.5 rounded font-bold">${p.unit}</span></td>
        <td class="font-bold text-indigo-700">${p.default_line_name ? `خط ${p.default_line_number}` : '—'}</td>
        <td class="text-xs text-slate-500">${p.extra_info || '—'}</td>
        <td><span class="px-2 py-0.5 rounded text-[11px] font-bold ${p.is_active ? 'badge-accepted' : 'badge-rejected'}">${p.is_active ? 'نشط' : 'معطل'}</span></td>
        <td class="text-center">
          <button onclick="ProductsModule.openModal(${p.id})" class="text-blue-600 p-1"><i class="fa-solid fa-pen"></i></button>
          <button onclick="ProductsModule.delete(${p.id}, '${p.name}')" class="text-red-600 p-1"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  openModal(id = null) {
    const modal = document.getElementById('modal-product');
    const form = document.getElementById('product-form');
    form.reset();
    document.getElementById('prod-id').value = '';

    if (id) {
      document.getElementById('modal-product-title').textContent = 'تعديل الجهاز المنزلي';
      const prod = App.metadata.products.find(p => p.id === id);
      if (prod) {
        document.getElementById('prod-id').value = prod.id;
        document.getElementById('prod-code').value = prod.code;
        document.getElementById('prod-name').value = prod.name;
        document.getElementById('prod-specs').value = prod.specifications || '';
        document.getElementById('prod-weight').value = prod.weight || '';
        document.getElementById('prod-line').value = prod.default_line_id || '';
      }
    } else {
      document.getElementById('modal-product-title').textContent = 'إضافة جهاز منزلي جديد';
    }
    modal.classList.remove('hidden');
  },

  closeModal() { document.getElementById('modal-product').classList.add('hidden'); },

  async save() {
    const id = document.getElementById('prod-id').value;
    const payload = {
      code: document.getElementById('prod-code').value,
      name: document.getElementById('prod-name').value,
      specifications: document.getElementById('prod-specs').value,
      weight: document.getElementById('prod-weight').value,
      unit: 'جهاز',
      default_line_id: document.getElementById('prod-line').value || null
    };

    try {
      let res;
      if (id) res = await App.apiPut(`/api/products/${id}`, payload);
      else res = await App.apiPost('/api/products', payload);

      if (res.success) {
        App.toast(res.message, 'success');
        this.closeModal();
        await this.load();
        App.populateDropdowns();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  delete(id, name) {
    App.confirm(`هل أنت متأكد من حذف ${name}؟`, async () => {
      try {
        const res = await App.apiDelete(`/api/products/${id}`);
        if (res.success) {
          App.toast(res.message, 'success');
          await this.load();
          App.populateDropdowns();
        }
      } catch (err) { App.toast(err.message, 'error'); }
    });
  }
};

// ============================================================================
// 7. INSPECTORS & ASSIGNMENTS MODULE
// ============================================================================
const InspectorsModule = {
  currentSubTab: 'assignments',

  switchSubTab(tab) {
    this.currentSubTab = tab;
    const btnA = document.getElementById('subtab-btn-assignments');
    const btnD = document.getElementById('subtab-btn-directory');
    const paneA = document.getElementById('inspectors-subtab-assignments');
    const paneD = document.getElementById('inspectors-subtab-directory');
    const btnArea = document.getElementById('inspector-action-btn-container');

    if (tab === 'assignments') {
      btnA.className = 'pb-2 font-bold text-sm text-[#c8102e] border-b-2 border-[#c8102e] transition';
      btnD.className = 'pb-2 font-bold text-sm text-slate-500 hover:text-slate-800 transition';
      paneA.classList.remove('hidden');
      paneD.classList.add('hidden');
      btnArea.innerHTML = `<button onclick="InspectorsModule.openAssignmentModal()" class="bg-[#c8102e] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl">+ تسجيل تكليف يومي</button>`;
      this.loadAssignments();
    } else {
      btnD.className = 'pb-2 font-bold text-sm text-[#c8102e] border-b-2 border-[#c8102e] transition';
      btnA.className = 'pb-2 font-bold text-sm text-slate-500 hover:text-slate-800 transition';
      paneD.classList.remove('hidden');
      paneA.classList.add('hidden');
      btnArea.innerHTML = `<button onclick="InspectorsModule.openInspectorModal()" class="bg-[#c8102e] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl">+ إضافة مراقب جودة</button>`;
      this.loadInspectors();
    }
  },

  async load() { this.switchSubTab(this.currentSubTab); },

  async loadAssignments() {
    const date = document.getElementById('assignments-date').value;
    const shift = document.getElementById('assignments-shift').value;
    try {
      const res = await App.apiGet(`/api/assignments?date=${date}&shift_id=${shift}`);
      if (res.success) this.renderAssignments(res.data);
    } catch (err) { App.toast(err.message, 'error'); }
  },

  renderAssignments(items) {
    const tbody = document.getElementById('assignments-tbody');
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">لا توجد تكليفات مسجلة في هذا التاريخ</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(a => `
      <tr>
        <td class="font-bold text-slate-700">${a.inspector_code}</td>
        <td class="font-bold text-slate-900">${a.inspector_name}</td>
        <td><span class="text-xs bg-slate-100 px-2 py-0.5 rounded font-bold">${a.shift_name}</span></td>
        <td><span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-[#c8102e] border border-red-200">${a.task_name}</span></td>
        <td class="font-bold text-indigo-700">${a.line_number ? `خط ${a.line_number} (${a.line_name})` : '—'}</td>
        <td class="text-xs">${a.supervisor_name || '—'}</td>
        <td class="text-xs text-slate-500">${a.notes || '—'}</td>
        <td class="text-center"><button onclick="InspectorsModule.deleteAssignment(${a.id})" class="text-red-600 p-1"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('');
  },

  async loadInspectors() {
    try {
      const res = await App.apiGet('/api/inspectors');
      if (res.success) {
        App.metadata.inspectors = res.data;
        const tbody = document.getElementById('inspectors-tbody');
        tbody.innerHTML = res.data.map(i => `
          <tr>
            <td class="font-extrabold text-[#c8102e]">${i.code}</td>
            <td class="font-bold">${i.name}</td>
            <td>${i.phone || '—'}</td>
            <td class="text-xs text-slate-600">${i.notes || '—'}</td>
            <td><span class="px-2 py-0.5 rounded text-xs font-bold badge-accepted">نشط</span></td>
            <td class="text-center">
              <button onclick="InspectorsModule.openInspectorModal(${i.id})" class="text-blue-600 p-1"><i class="fa-solid fa-pen"></i></button>
              <button onclick="InspectorsModule.deleteInspector(${i.id}, '${i.name}')" class="text-red-600 p-1"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  openAssignmentModal() {
    const modal = document.getElementById('modal-assignment');
    document.getElementById('assignment-form').reset();
    document.getElementById('as-date').value = new Date().toISOString().slice(0, 10);
    this.handleTaskChange(document.getElementById('as-task').value);
    modal.classList.remove('hidden');
  },

  closeAssignmentModal() { document.getElementById('modal-assignment').classList.add('hidden'); },

  handleTaskChange(val) {
    const select = document.getElementById('as-task');
    const opt = select.options[select.selectedIndex];
    const req = opt && opt.getAttribute('data-requires-line') === '1';
    const box = document.getElementById('as-line-container');
    if (req) box.classList.remove('hidden');
    else box.classList.add('hidden');
  },

  async saveAssignment() {
    const select = document.getElementById('as-task');
    const opt = select.options[select.selectedIndex];
    const req = opt && opt.getAttribute('data-requires-line') === '1';

    const payload = {
      date: document.getElementById('as-date').value,
      shift_id: document.getElementById('as-shift').value,
      inspector_id: document.getElementById('as-inspector').value,
      task_type_id: document.getElementById('as-task').value,
      line_id: req ? document.getElementById('as-line').value : null
    };

    try {
      const res = await App.apiPost('/api/assignments', payload);
      if (res.success) {
        App.toast(res.message, 'success');
        this.closeAssignmentModal();
        await this.loadAssignments();
        SummaryModule.load();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  deleteAssignment(id) {
    App.confirm('هل أنت متأكد من حذف التكليف؟', async () => {
      try {
        const res = await App.apiDelete(`/api/assignments/${id}`);
        if (res.success) {
          App.toast(res.message, 'success');
          await this.loadAssignments();
          SummaryModule.load();
        }
      } catch (err) { App.toast(err.message, 'error'); }
    });
  },

  openInspectorModal(id = null) {
    const modal = document.getElementById('modal-inspector');
    document.getElementById('inspector-form').reset();
    document.getElementById('insp-id').value = '';
    if (id) {
      document.getElementById('modal-inspector-title').textContent = 'تعديل مراقب الجودة';
      const insp = App.metadata.inspectors.find(x => x.id === id);
      if (insp) {
        document.getElementById('insp-id').value = insp.id;
        document.getElementById('insp-code').value = insp.code;
        document.getElementById('insp-name').value = insp.name;
        document.getElementById('insp-phone').value = insp.phone || '';
      }
    } else {
      document.getElementById('modal-inspector-title').textContent = 'إضافة مراقب جودة جديد';
      document.getElementById('insp-code').value = `QC-0${App.metadata.inspectors.length + 1}`;
    }
    modal.classList.remove('hidden');
  },

  closeInspectorModal() { document.getElementById('modal-inspector').classList.add('hidden'); },

  async saveInspector() {
    const id = document.getElementById('insp-id').value;
    const payload = {
      code: document.getElementById('insp-code').value,
      name: document.getElementById('insp-name').value,
      phone: document.getElementById('insp-phone').value,
      notes: document.getElementById('insp-notes').value
    };
    try {
      let res;
      if (id) res = await App.apiPut(`/api/inspectors/${id}`, payload);
      else res = await App.apiPost('/api/inspectors', payload);

      if (res.success) {
        App.toast(res.message, 'success');
        this.closeInspectorModal();
        await this.loadInspectors();
        App.populateDropdowns();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  deleteInspector(id, name) {
    App.confirm(`هل أنت متأكد من حذف المراقب: ${name}؟`, async () => {
      try {
        const res = await App.apiDelete(`/api/inspectors/${id}`);
        if (res.success) {
          App.toast(res.message, 'success');
          await this.loadInspectors();
          App.populateDropdowns();
        }
      } catch (err) { App.toast(err.message, 'error'); }
    });
  }
};

// ============================================================================
// 8. LINE QUALITY SUMMARY MODULE
// ============================================================================
const SummaryModule = {
  currentSummary: [],

  async load() {
    const dateFrom = document.getElementById('summary-date-from').value;
    const dateTo = document.getElementById('summary-date-to').value;
    const shift = document.getElementById('summary-filter-shift').value;

    try {
      const res = await App.apiGet(`/api/summary?date_from=${dateFrom}&date_to=${dateTo}&shift_id=${shift}`);
      if (res.success) {
        this.currentSummary = res.data;
        this.render();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  render() {
    const tbody = document.getElementById('summary-tbody');
    const tfoot = document.getElementById('summary-tfoot');
    if (!tbody) return;

    let grandProduced = 0, grandInspected = 0, grandRejected = 0, grandAccepted = 0;
    let grandAccPallets = 0, grandRejPallets = 0;

    tbody.innerHTML = this.currentSummary.map(s => {
      grandProduced += s.total_produced;
      grandInspected += s.total_inspected;
      grandRejected += s.total_rejected;
      grandAccepted += s.total_accepted;
      grandAccPallets += s.accepted_pallets;
      grandRejPallets += s.rejected_pallets;

      return `
        <tr>
          <td class="font-extrabold text-[#c8102e]">خط ${s.line_number} (${s.line_name})</td>
          <td class="font-semibold">${s.supervisor_name}</td>
          <td class="font-bold text-emerald-800">${s.inspector_name}</td>
          <td class="font-medium">${s.products_produced}</td>
          <td class="font-extrabold">${Number(s.total_produced).toLocaleString('ar-EG')} جهاز</td>
          <td class="font-bold text-indigo-700">${Number(s.total_inspected).toLocaleString('ar-EG')}</td>
          <td class="font-bold text-red-700">${Number(s.total_rejected).toLocaleString('ar-EG')}</td>
          <td class="font-bold text-emerald-700">${Number(s.total_accepted).toLocaleString('ar-EG')}</td>
          <td><span class="px-2 py-0.5 rounded text-xs font-bold ${s.rejection_rate > 3 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}">${s.rejection_rate}%</span></td>
          <td class="text-xs text-slate-600 max-w-xs truncate" title="${s.aggregated_reasons}">${s.aggregated_reasons}</td>
          <td class="font-bold text-emerald-700 text-center">${s.accepted_pallets}</td>
          <td class="font-bold text-red-700 text-center">${s.rejected_pallets}</td>
        </tr>
      `;
    }).join('');

    const grandRate = grandInspected > 0 ? ((grandRejected / grandInspected) * 100).toFixed(2) : '0.00';

    tfoot.innerHTML = `
      <tr>
        <td colspan="4" class="text-right py-3 px-3">الإجمالي العام لخطوط تجميع المغربي:</td>
        <td class="font-black">${Number(grandProduced).toLocaleString('ar-EG')} جهاز</td>
        <td class="font-black text-indigo-700">${Number(grandInspected).toLocaleString('ar-EG')}</td>
        <td class="font-black text-red-700">${Number(grandRejected).toLocaleString('ar-EG')}</td>
        <td class="font-black text-emerald-700">${Number(grandAccepted).toLocaleString('ar-EG')}</td>
        <td class="font-black text-amber-700">${grandRate}%</td>
        <td>—</td>
        <td class="font-black text-emerald-700 text-center">${grandAccPallets}</td>
        <td class="font-black text-red-700 text-center">${grandRejPallets}</td>
      </tr>
    `;
  },

  exportExcel() {
    ExportsManager.exportToExcel(this.currentSummary, 'ملخص_جودة_خطوط_المغربي');
  },

  printReport() {
    ExportsManager.printReport('summary-print-container', 'ملخص الجودة ومطابقة AQL حسب خط التجميع');
  }
};

// ============================================================================
// 9. REPORTS MODULE
// ============================================================================
const ReportsModule = {
  currentData: [],
  availableColumns: [],

  init() {
    this.handleTypeChange(document.getElementById('report-type').value);
    this.generate();
  },

  handleTypeChange(type) {
    const container = document.getElementById('report-columns-checkboxes');
    if (!container) return;

    const schemas = {
      daily: [
        { id: 'line_number', label: 'رقم الخط' },
        { id: 'line_name', label: 'اسم الخط' },
        { id: 'supervisor_name', label: 'مشرف الخط' },
        { id: 'inspector_name', label: 'مراقب الجودة' },
        { id: 'products_produced', label: 'الجهاز المنزلي' },
        { id: 'total_produced', label: 'الكمية المنتجة' },
        { id: 'total_inspected', label: 'كمية فحص AQL' },
        { id: 'total_rejected', label: 'الكمية المرفوضة' },
        { id: 'rejection_rate', label: 'نسبة الرفض %' },
        { id: 'accepted_pallets', label: 'بلتات مقبولة' },
        { id: 'rejected_pallets', label: 'بلتات مرفوضة' }
      ],
      product_daily_breakdown: [
        { id: 'product_code', label: 'كود الجهاز' },
        { id: 'product_name', label: 'اسم الجهاز' },
        { id: 'total_pallets', label: 'إجمالي البلتات' },
        { id: 'total_produced_qty', label: 'إجمالي الإنتاج' },
        { id: 'inspected_pallet_qty', label: 'المفحوص' },
        { id: 'waiting_pallet_qty', label: 'في الانتظار' },
        { id: 'accepted_pallets', label: 'مقبول' },
        { id: 'rejected_pallets', label: 'مرفوض' },
        { id: 'rejection_rate', label: 'نسبة الرفض %' }
      ],
      waiting_pallets: [
        { id: 'date', label: 'تاريخ الاستلام' },
        { id: 'received_time', label: 'وقت الاستلام' },
        { id: 'line_number', label: 'رقم الخط' },
        { id: 'pallet_number', label: 'رقم البالتة' },
        { id: 'product_name', label: 'الجهاز' },
        { id: 'quantity_on_pallet', label: 'الكمية' },
        { id: 'sample_size_required', label: 'عينة AQL المقررة' },
        { id: 'inspector_name', label: 'المراقب' }
      ],
      rejected_pallets: [
        { id: 'date', label: 'التاريخ' },
        { id: 'line_number', label: 'رقم الخط' },
        { id: 'pallet_number', label: 'رقم البالتة' },
        { id: 'product_name', label: 'الجهاز' },
        { id: 'quantity_on_pallet', label: 'الكمية' },
        { id: 'rejected_quantity', label: 'العيوب' },
        { id: 'rejection_summary', label: 'أسباب الرفض التفصيلية' },
        { id: 'inspector_name', label: 'المراقب' }
      ]
    };

    const schema = schemas[type] || schemas.daily;
    this.availableColumns = schema;

    container.innerHTML = schema.map(col => `
      <label class="inline-flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border">
        <input type="checkbox" value="${col.id}" checked class="report-col-chk accent-red-600 rounded">
        <span>${col.label}</span>
      </label>
    `).join('');
  },

  toggleAllColumns(check) {
    document.querySelectorAll('.report-col-chk').forEach(c => c.checked = check);
  },

  getSelectedColumnIds() {
    return Array.from(document.querySelectorAll('.report-col-chk:checked')).map(c => c.value);
  },

  async generate() {
    const type = document.getElementById('report-type').value;
    const dateFrom = document.getElementById('report-date-from').value;
    const dateTo = document.getElementById('report-date-to').value;
    const lineId = document.getElementById('report-filter-line').value;

    try {
      const res = await App.apiGet(`/api/reports?type=${type}&date_from=${dateFrom}&date_to=${dateTo}&line_id=${lineId}`);
      if (res.success) {
        this.currentData = res.data;
        this.renderPreview();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  renderPreview() {
    const thead = document.getElementById('report-preview-thead');
    const tbody = document.getElementById('report-preview-tbody');
    const countEl = document.getElementById('report-records-count');
    if (!thead || !tbody) return;

    const selIds = this.getSelectedColumnIds();
    const cols = this.availableColumns.filter(c => selIds.includes(c.id));

    countEl.textContent = `${this.currentData.length} سجل`;
    thead.innerHTML = `<tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr>`;

    if (!this.currentData.length) {
      tbody.innerHTML = `<tr><td colspan="${cols.length}" class="text-center py-6 text-slate-400">لا توجد بيانات مطابقة</td></tr>`;
      return;
    }

    tbody.innerHTML = this.currentData.map(row => `
      <tr>${cols.map(c => {
        let val = row[c.id];
        if (val === null || val === undefined) val = '—';
        if (c.id === 'rejection_rate') val = `${val}%`;
        return `<td>${val}</td>`;
      }).join('')}</tr>
    `).join('');
  },

  getExportDataset() {
    const selIds = this.getSelectedColumnIds();
    const cols = this.availableColumns.filter(c => selIds.includes(c.id));
    return this.currentData.map(row => {
      const formatted = {};
      cols.forEach(c => {
        let val = row[c.id];
        if (val === null || val === undefined) val = '';
        if (c.id === 'rejection_rate') val = `${val}%`;
        formatted[c.label] = val;
      });
      return formatted;
    });
  },

  exportExcel() {
    ExportsManager.exportToExcel(this.getExportDataset(), 'تقرير_المغربي_المعتمد');
  },

  exportCSV() {
    ExportsManager.exportToCSV(this.getExportDataset(), 'تقرير_المغربي_المعتمد');
  },

  print() {
    const sel = document.getElementById('report-type');
    const title = sel.options[sel.selectedIndex].text;
    ExportsManager.printReport('report-preview-container', title);
  }
};

// ============================================================================
// 10. SEARCH & SAVED FILTERS MODULE
// ============================================================================
const SearchModule = {
  savedFilters: [],

  async init() {
    try {
      const res = await App.apiGet('/api/saved-filters?type=pallets');
      if (res.success) {
        this.savedFilters = res.data;
        this.renderSaved();
      }
    } catch (e) {}
  },

  renderSaved() {
    const list = document.getElementById('saved-filters-list');
    if (!list) return;

    if (!this.savedFilters.length) {
      list.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center">لا توجد فلاتر محفوظة</p>`;
      return;
    }

    list.innerHTML = this.savedFilters.map(f => `
      <div class="flex items-center justify-between p-2 rounded-xl border bg-slate-50 text-xs">
        <button onclick="SearchModule.applyFilter(${f.id})" class="text-right font-bold text-slate-800 hover:text-red-700 flex-1 truncate">
          <i class="fa-solid fa-bookmark text-amber-500 ml-1"></i> ${f.name}
        </button>
        <button onclick="SearchModule.deleteFilter(${f.id})" class="text-slate-400 hover:text-red-600 p-1"><i class="fa-solid fa-trash"></i></button>
      </div>
    `).join('');
  },

  async execute() {
    const dateFrom = document.getElementById('adv-date-from').value;
    const dateTo = document.getElementById('adv-date-to').value;
    const lineId = document.getElementById('adv-line').value;
    const prodId = document.getElementById('adv-product').value;
    const palletNum = document.getElementById('adv-pallet-number').value;
    const shift = document.getElementById('adv-shift').value;
    const status = document.getElementById('adv-status').value;
    const dec = document.getElementById('adv-decision').value;

    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (lineId) params.append('line_id', lineId);
    if (prodId) params.append('product_id', prodId);
    if (palletNum) params.append('pallet_number', palletNum);
    if (shift) params.append('shift_id', shift);
    if (status) params.append('inspection_status', status);
    if (dec) params.append('pallet_decision', dec);

    try {
      const res = await App.apiGet(`/api/pallets?${params.toString()}`);
      if (res.success) {
        const tbody = document.getElementById('search-results-tbody');
        document.getElementById('search-results-count').textContent = `${res.data.length} نتيجة`;
        tbody.innerHTML = res.data.map(p => `
          <tr>
            <td>${p.date} (${p.received_time || '—'})</td>
            <td class="font-bold text-[#c8102e]">خط ${p.line_number}</td>
            <td class="font-black">#${p.pallet_number}</td>
            <td class="font-bold">${p.product_name}</td>
            <td class="font-bold">${p.quantity_on_pallet} جهاز</td>
            <td><span class="px-2 py-0.5 rounded text-xs font-bold ${p.inspection_status === 'تم الفحص' ? 'badge-accepted' : 'badge-status-waiting'}">${p.inspection_status}</span></td>
            <td>${p.inspected_quantity}</td>
            <td class="font-bold text-red-600">${p.rejected_quantity}</td>
            <td><span class="px-2 py-0.5 rounded text-xs font-bold ${p.pallet_decision === 'مقبول' ? 'badge-accepted' : 'badge-rejected'}">${p.pallet_decision}</span></td>
            <td class="text-xs">${p.inspector_name || '—'}</td>
            <td class="text-center">
              <button onclick="App.switchTab('pallets'); PalletModule.openInspectModal(${p.id});" class="text-indigo-600 font-bold text-xs">عرض / فحص</button>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  reset() {
    document.getElementById('adv-search-form').reset();
    document.getElementById('search-results-tbody').innerHTML = '';
  },

  openSaveFilterModal() { document.getElementById('modal-save-filter').classList.remove('hidden'); },
  closeSaveFilterModal() { document.getElementById('modal-save-filter').classList.add('hidden'); },

  async saveCurrentFilter() {
    const name = document.getElementById('save-filter-name').value;
    if (!name) return App.toast('يرجى كتابة اسم للفلتر', 'warning');

    const criteria = {
      date_from: document.getElementById('adv-date-from').value,
      date_to: document.getElementById('adv-date-to').value,
      line_id: document.getElementById('adv-line').value,
      product_id: document.getElementById('adv-product').value,
      status: document.getElementById('adv-status').value
    };

    try {
      const res = await App.apiPost('/api/saved-filters', { name, filter_type: 'pallets', criteria });
      if (res.success) {
        App.toast(res.message, 'success');
        this.closeSaveFilterModal();
        await this.init();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  applyFilter(id) {
    const f = this.savedFilters.find(x => x.id === id);
    if (!f) return;
    const c = JSON.parse(f.criteria_json);
    if (c.date_from) document.getElementById('adv-date-from').value = c.date_from;
    if (c.date_to) document.getElementById('adv-date-to').value = c.date_to;
    if (c.line_id) document.getElementById('adv-line').value = c.line_id;
    if (c.product_id) document.getElementById('adv-product').value = c.product_id;
    this.execute();
    App.toast(`تم تطبيق فلتر: ${f.name}`, 'info');
  },

  async deleteFilter(id) {
    try {
      const res = await App.apiDelete(`/api/saved-filters/${id}`);
      if (res.success) {
        App.toast(res.message, 'success');
        await this.init();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  }
};

// ============================================================================
// 11. SETTINGS & LOOKUPS MODULE
// ============================================================================
const SettingsModule = {
  currentSubTab: 'reasons',

  init() { this.switchSubTab(this.currentSubTab); },

  switchSubTab(tab) {
    this.currentSubTab = tab;
    ['reasons', 'tasks', 'shifts', 'supervisors', 'users'].forEach(t => {
      const btn = document.getElementById(`set-tab-${t}`);
      const pane = document.getElementById(`set-pane-${t}`);
      if (btn && pane) {
        if (t === tab) {
          btn.className = 'py-3 px-2 font-bold text-xs text-[#c8102e] border-b-2 border-[#c8102e] whitespace-nowrap';
          pane.classList.remove('hidden');
        } else {
          btn.className = 'py-3 px-2 font-bold text-xs text-slate-500 whitespace-nowrap';
          pane.classList.add('hidden');
        }
      }
    });

    if (tab === 'reasons') this.loadReasons();
    else if (tab === 'tasks') this.loadTasks();
    else if (tab === 'shifts') this.loadShifts();
    else if (tab === 'supervisors') this.loadSupervisors();
    else if (tab === 'users') this.loadUsers();
  },

  async loadReasons() {
    try {
      const res = await App.apiGet('/api/settings/rejection-reasons');
      if (res.success) {
        App.metadata.rejectionReasons = res.data;
        document.getElementById('settings-reasons-tbody').innerHTML = res.data.map(r => `
          <tr>
            <td class="font-bold text-[#c8102e]">${r.code}</td>
            <td class="font-bold">${r.name}</td>
            <td><span class="text-xs bg-slate-100 px-2 py-0.5 rounded font-bold">${r.category}</span></td>
            <td class="text-center"><button onclick="SettingsModule.deleteReason(${r.id})" class="text-red-600 p-1"><i class="fa-solid fa-trash"></i></button></td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  },

  openReasonModal() {
    this.openModal('إضافة عيب للأجهزة المنزلية', `
      <form onsubmit="event.preventDefault(); SettingsModule.saveReason();" class="space-y-3 text-xs">
        <div><label class="block font-bold mb-1">كود العيب:</label><input type="text" id="sr-code" required placeholder="DEF-10" class="w-full bg-slate-50 border rounded-xl px-3 py-2 font-bold"></div>
        <div><label class="block font-bold mb-1">بيان العيب:</label><input type="text" id="sr-name" required placeholder="كسر في ذراع الهاند بلندر" class="w-full bg-slate-50 border rounded-xl px-3 py-2 font-bold"></div>
        <div><label class="block font-bold mb-1">التصنيف:</label><input type="text" id="sr-category" placeholder="ميكانيكا / كهرباء / مظهر" class="w-full bg-slate-50 border rounded-xl px-3 py-2"></div>
        <div class="flex justify-end gap-2 pt-3 border-t">
          <button type="button" onclick="SettingsModule.closeModal()" class="px-3 py-1.5 text-slate-600">إلغاء</button>
          <button type="submit" class="bg-[#c8102e] text-white font-bold px-4 py-2 rounded-xl">حفظ</button>
        </div>
      </form>
    `);
  },

  async saveReason() {
    const payload = {
      code: document.getElementById('sr-code').value,
      name: document.getElementById('sr-name').value,
      category: document.getElementById('sr-category').value
    };
    try {
      const res = await App.apiPost('/api/settings/rejection-reasons', payload);
      if (res.success) {
        App.toast(res.message, 'success');
        this.closeModal();
        await this.loadReasons();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  async deleteReason(id) {
    try {
      const res = await App.apiDelete(`/api/settings/rejection-reasons/${id}`);
      if (res.success) {
        App.toast(res.message, 'success');
        await this.loadReasons();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  async loadTasks() {
    try {
      const res = await App.apiGet('/api/bootstrap');
      if (res.success) {
        document.getElementById('settings-tasks-tbody').innerHTML = res.data.taskTypes.map(t => `
          <tr>
            <td class="font-bold">${t.code}</td>
            <td class="font-bold">${t.name}</td>
            <td><span class="px-2 py-0.5 rounded text-xs font-bold ${t.requires_line ? 'bg-red-100 text-[#c8102e]' : 'bg-slate-100'}">${t.requires_line ? 'نعم (يلزم خط)' : 'لا'}</span></td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  },

  async loadShifts() {
    try {
      const res = await App.apiGet('/api/bootstrap');
      if (res.success) {
        document.getElementById('settings-shifts-tbody').innerHTML = res.data.shifts.map(s => `
          <tr>
            <td class="font-bold">${s.code}</td>
            <td class="font-bold">${s.name}</td>
            <td>${s.start_time}</td>
            <td>${s.end_time}</td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  },

  async loadSupervisors() {
    try {
      const res = await App.apiGet('/api/settings/supervisors');
      if (res.success) {
        document.getElementById('settings-supervisors-tbody').innerHTML = res.data.map(s => `
          <tr>
            <td class="font-bold">${s.name}</td>
            <td>${s.phone || '—'}</td>
            <td class="text-xs text-slate-500">${s.notes || '—'}</td>
            <td class="text-center"><button onclick="SettingsModule.deleteSupervisor(${s.id})" class="text-red-600 p-1"><i class="fa-solid fa-trash"></i></button></td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  },

  openSupervisorModal() {
    this.openModal('إضافة مشرف إنتاج', `
      <form onsubmit="event.preventDefault(); SettingsModule.saveSupervisor();" class="space-y-3 text-xs">
        <div><label class="block font-bold mb-1">اسم المشرف:</label><input type="text" id="ssup-name" required class="w-full bg-slate-50 border rounded-xl px-3 py-2 font-bold"></div>
        <div><label class="block font-bold mb-1">الهاتف:</label><input type="text" id="ssup-phone" class="w-full bg-slate-50 border rounded-xl px-3 py-2"></div>
        <div class="flex justify-end gap-2 pt-3 border-t">
          <button type="button" onclick="SettingsModule.closeModal()" class="px-3 py-1.5 text-slate-600">إلغاء</button>
          <button type="submit" class="bg-[#c8102e] text-white font-bold px-4 py-2 rounded-xl">حفظ</button>
        </div>
      </form>
    `);
  },

  async saveSupervisor() {
    const payload = {
      name: document.getElementById('ssup-name').value,
      phone: document.getElementById('ssup-phone').value
    };
    try {
      const res = await App.apiPost('/api/settings/supervisors', payload);
      if (res.success) {
        App.toast(res.message, 'success');
        this.closeModal();
        await this.loadSupervisors();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  async deleteSupervisor(id) {
    try {
      const res = await App.apiDelete(`/api/settings/supervisors/${id}`);
      if (res.success) {
        App.toast(res.message, 'success');
        await this.loadSupervisors();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  async loadUsers() {
    try {
      const res = await App.apiGet('/api/users');
      if (res.success) {
        document.getElementById('settings-users-tbody').innerHTML = res.data.map(u => `
          <tr>
            <td class="font-bold">${u.username}</td>
            <td class="font-bold">${u.full_name}</td>
            <td><span class="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-[#c8102e]">${u.role_name}</span></td>
            <td class="text-xs">${u.created_at || '—'}</td>
            <td class="text-center"><button onclick="SettingsModule.deleteUser(${u.id})" class="text-red-600 p-1"><i class="fa-solid fa-trash"></i></button></td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  },

  openUserModal() {
    const rolesHtml = App.metadata.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    this.openModal('إضافة مستخدم جديد', `
      <form onsubmit="event.preventDefault(); SettingsModule.saveUser();" class="space-y-3 text-xs">
        <div><label class="block font-bold mb-1">اسم الدخول:</label><input type="text" id="su-username" required class="w-full bg-slate-50 border rounded-xl px-3 py-2 font-bold"></div>
        <div><label class="block font-bold mb-1">الاسم الكامل:</label><input type="text" id="su-fullname" required class="w-full bg-slate-50 border rounded-xl px-3 py-2 font-bold"></div>
        <div><label class="block font-bold mb-1">كلمة المرور:</label><input type="password" id="su-password" required value="123456" class="w-full bg-slate-50 border rounded-xl px-3 py-2"></div>
        <div><label class="block font-bold mb-1">الدور والصلاحية:</label><select id="su-role" class="w-full bg-slate-50 border rounded-xl px-3 py-2 font-bold">${rolesHtml}</select></div>
        <div class="flex justify-end gap-2 pt-3 border-t">
          <button type="button" onclick="SettingsModule.closeModal()" class="px-3 py-1.5 text-slate-600">إلغاء</button>
          <button type="submit" class="bg-[#c8102e] text-white font-bold px-4 py-2 rounded-xl">إنشاء</button>
        </div>
      </form>
    `);
  },

  async saveUser() {
    const payload = {
      username: document.getElementById('su-username').value,
      full_name: document.getElementById('su-fullname').value,
      password: document.getElementById('su-password').value,
      role_id: document.getElementById('su-role').value
    };
    try {
      const res = await App.apiPost('/api/users', payload);
      if (res.success) {
        App.toast(res.message, 'success');
        this.closeModal();
        await this.loadUsers();
        App.setupUserSwitcher();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  async deleteUser(id) {
    try {
      const res = await App.apiDelete(`/api/users/${id}`);
      if (res.success) {
        App.toast(res.message, 'success');
        await this.loadUsers();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  openModal(title, body) {
    document.getElementById('modal-generic-title').textContent = title;
    document.getElementById('modal-generic-body').innerHTML = body;
    document.getElementById('modal-generic').classList.remove('hidden');
  },
  closeModal() { document.getElementById('modal-generic').classList.add('hidden'); }
};

// ============================================================================
// 12. AUDIT LOGS MODULE
// ============================================================================
const AuditModule = {
  async load() {
    try {
      const res = await App.apiGet('/api/audit-logs');
      if (res.success) {
        document.getElementById('audit-tbody').innerHTML = res.data.map(l => `
          <tr>
            <td class="text-xs text-slate-500 whitespace-nowrap">${l.created_at}</td>
            <td class="font-bold text-xs">${l.user_name || 'النظام'}</td>
            <td><span class="px-2 py-0.5 rounded text-[11px] font-bold ${l.action === 'CREATE' ? 'badge-accepted' : 'bg-slate-100'}">${l.action}</span></td>
            <td class="font-mono text-xs">${l.entity_name}</td>
            <td class="text-xs font-semibold">${l.summary}</td>
            <td class="text-[11px] text-slate-400 font-mono truncate max-w-xs" title="${l.details_json || ''}">${l.details_json || '—'}</td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
