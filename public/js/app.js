// El Maghraby Home Appliances - Quality Management System Client Application

const App = {
  currentDepartment: 'home',
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
    roles: [],
    hourlySlots: []
  },
  activeTab: 'dashboard',
  currentSystem: 'quality',

  async init() {
    this.setupEventListeners();
    await this.loadBootstrapData();
    this.setupUserSwitcher();
    await ScrapReportModule.init();
    await SecondSortHandoverModule.init();
    this.switchTab('dashboard');
  },

  switchSystem(systemId) {
    const systems = {
      quality: {
        title: 'نظام إدارة ومتابعة جودة الإنتاج - المغربي للأجهزة المنزلية'
      },
      scrap: {
        title: 'نظام إدارة الهوالك - المغربي للأجهزة المنزلية'
      },
      incoming: {
        title: 'نظام إدارة الوارد - المغربي للأجهزة المنزلية'
      }
    };
    if (!Object.prototype.hasOwnProperty.call(systems, systemId)) {
      throw new RangeError(`Unknown system: ${systemId}`);
    }

    this.currentSystem = systemId;
    Object.keys(systems).forEach(id => {
      const system = document.getElementById(`${id}-system`);
      const button = document.getElementById(`system-btn-${id}`);
      if (!system || !button) {
        throw new Error(`System switcher markup is incomplete for "${id}".`);
      }

      const isActive = id === systemId;
      system.classList.toggle('hidden', !isActive);
      if (id !== 'quality') system.classList.toggle('flex', isActive);

      button.setAttribute('aria-pressed', String(isActive));
      button.className = isActive
        ? 'px-4 py-2 rounded-xl bg-white text-slate-900 text-xs sm:text-sm font-bold flex items-center gap-2 transition'
        : 'px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs sm:text-sm font-bold flex items-center gap-2 transition';
    });
    document.title = systems[systemId].title;
    if (systemId === 'scrap' && typeof ScrapReportModule !== 'undefined') {
      ScrapReportModule.refreshSharedData().catch(error => this.toast(`تعذر تحديث قوائم الهوالك المشتركة: ${error.message}`, 'error'));
    }
  },

  setDepartment(dept) {
    this.currentDepartment = dept;
    ['home', 'seria', 'all'].forEach(d => {
      const btn = document.getElementById(`dept-btn-${d}`);
      if (btn) {
        if (d === dept) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });
    const flowDept = document.getElementById('flow-filter-dept');
    if (flowDept) flowDept.value = dept;

    this.populateDropdowns();
    this.switchTab(this.activeTab);
    const names = { home: 'الأجهزة المنزلية', seria: 'قسم السريا', all: 'المصنع بالكامل' };
    this.toast(`تم التبديل إلى: ${names[dept] || dept}`, 'info');
  },

  setupEventListeners() {
    // Default dates to today
    const today = new Date().toISOString().slice(0, 10);
    const dateInputs = [
      'pallets-filter-date', 'summary-date-from', 'summary-date-to',
      'report-date-from', 'report-date-to', 'assignments-date',
      'rec-date', 'insp-date', 'daily-breakdown-date', 'as-date',
      'adv-date-from', 'adv-date-to', 'hourly-filter-date',
      'hourly-date', 'daily-prod-date', 'flow-filter-from', 'flow-filter-to',
      'line-sample-date', 'line-samples-filter-date', 'line-sample-summary-date'
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
    const dept = this.currentDepartment;
    const filterByDept = (item) => !dept || dept === 'all' || item.department === dept || !item.department;
    const allLines = this.metadata.lines || [];
    const allProducts = this.metadata.products || [];
    const activeLines = allLines.filter(filterByDept);
    const activeProducts = allProducts.filter(filterByDept);

    // 1. Lines
    const lineSelects = [
      'dash-filter-line', 'quality-filter-line', 'pallets-filter-line', 'report-filter-line', 'adv-line',
      'rec-line', 'as-line', 'prod-line', 'hourly-filter-line', 'hourly-line',
      'daily-prod-line', 'flow-filter-line'
    ];
    lineSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = !['rec-line', 'as-line', 'prod-line', 'hourly-line', 'daily-prod-line'].includes(id);
      const selected = el.value;
      let html = isFilter ? '<option value="">جميع الخطوط</option>' : '<option value="">اختر خط التجميع...</option>';
      activeLines.forEach(l => {
        const departmentName = l.department === 'seria' ? 'السريا' : 'الأجهزة المنزلية';
        const departmentLabel = ['rec-line', 'hourly-line', 'daily-prod-line', 'prod-line'].includes(id) ? ` (${departmentName})` : '';
        html += `<option value="${l.id}">${this.escapeHtml(l.name)}${departmentLabel}</option>`;
      });
      el.innerHTML = html;
      if (selected && [...el.options].some(option => option.value === selected)) el.value = selected;
    });

    // 2. Products
    const prodSelects = [
      'quality-filter-product', 'adv-product', 'rec-product', 'l-product', 'hourly-filter-product',
      'hourly-product', 'daily-prod-product', 'flow-filter-product'
    ];
    prodSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = ['quality-filter-product', 'adv-product', 'hourly-filter-product', 'flow-filter-product'].includes(id);
      const selected = el.value;
      let html = isFilter ? '<option value="">جميع المنتجات</option>' : '<option value="">اختر المنتج...</option>';
      activeProducts.forEach(p => {
        html += `<option value="${p.id}">${this.escapeHtml(p.name)} (${this.escapeHtml(p.code)})</option>`;
      });
      el.innerHTML = html;
      if (selected && [...el.options].some(option => option.value === selected)) el.value = selected;
    });

    const reasonSelect = document.getElementById('quality-filter-reason');
    if (reasonSelect) {
      const selected = reasonSelect.value;
      reasonSelect.innerHTML = '<option value="">جميع العيوب</option>' + (this.metadata.rejectionReasons || [])
        .filter(filterByDept)
        .map(reason => `<option value="${reason.id}">${this.escapeHtml(reason.name)}</option>`)
        .join('');
      if (selected && [...reasonSelect.options].some(option => option.value === selected)) reasonSelect.value = selected;
    }

    // 3. Shifts
    const shiftSelects = [
      'dash-filter-shift', 'summary-filter-shift', 'assignments-shift',
      'adv-shift', 'rec-shift', 'as-shift', 'hourly-filter-shift',
      'hourly-shift', 'daily-prod-shift'
    ];
    shiftSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = !['rec-shift', 'as-shift', 'hourly-shift', 'daily-prod-shift'].includes(id);
      let html = isFilter ? '<option value="">جميع الورديات</option>' : '';
      (this.metadata.shifts || []).forEach(s => {
        html += `<option value="${s.id}">${s.name}</option>`;
      });
      el.innerHTML = html;
    });

    // 4. Hourly Slots
    const slotSelect = document.getElementById('hourly-slot');
    if (slotSelect && this.metadata.hourlySlots) {
      slotSelect.innerHTML = this.metadata.hourlySlots.map(s => `
        <option value="${s.id}">${s.slot_name} (${s.start_time} - ${s.end_time})</option>
      `).join('');
    }

    // 5. Inspectors
    const inspSelects = ['rec-inspector', 'as-inspector', 'adv-inspector', 'hourly-inspector'];
    inspSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = id === 'adv-inspector';
      let html = isFilter ? '<option value="">جميع المراقبين</option>' : '<option value="">اختر مراقب الجودة...</option>';
      (this.metadata.inspectors || []).forEach(i => {
        html += `<option value="${i.id}">${i.name} (${i.code})</option>`;
      });
      el.innerHTML = html;
    });

    // 6. Tasks
    const taskSelect = document.getElementById('as-task');
    if (taskSelect && this.metadata.taskTypes) {
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

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
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
      case 'hourly-samples': HourlyModule.load(); break;
      case 'line-samples': LineSamplesModule.load(); break;
      case 'line-sample-summary': LineSampleSummaryModule.load(); break;
      case 'daily-breakdown': DailyBreakdownModule.load(); break;
      case 'line-summary': SummaryModule.load(); break;
      case 'flowchart': FlowchartModule.load(); break;
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
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      const isApiRequest = url.startsWith('/api/');
      if (isApiRequest) {
        throw new Error(`الخادم أعاد استجابة غير متوقعة (${response.status}) بدل بيانات JSON. أوقف الخادم الحالي ثم أعد تشغيل النظام من مجلد المشروع لتفعيل واجهة API الجديدة.`);
      }
      throw new Error(`استجابة غير صالحة من الخادم (${response.status}).`);
    }
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
  data: null,
  requestVersion: 0,

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  },

  number(value) {
    return Number(value || 0).toLocaleString('ar-EG');
  },

  rate(value) {
    return value === null || value === undefined ? 'غير متاحة' : `${Number(value).toLocaleString('ar-EG')}%`;
  },

  async load() {
    const requestVersion = ++this.requestVersion;
    try {
      const params = new URLSearchParams();
      const filterMap = {
        month: 'quality-filter-month',
        date_from: 'quality-filter-from',
        date_to: 'quality-filter-to',
        line_id: 'quality-filter-line',
        product_id: 'quality-filter-product',
        reason_id: 'quality-filter-reason'
      };
      Object.entries(filterMap).forEach(([key, id]) => {
        const value = document.getElementById(id)?.value;
        if (value) params.set(key, value);
      });
      params.set('department', App.currentDepartment || 'all');
      const response = await App.apiGet(`/api/quality-dashboard?${params.toString()}`);
      if (requestVersion !== this.requestVersion) return;
      if (!response.success) throw new Error(response.error || 'تعذر تحميل التحليلات.');
      this.data = response.data;
      this.render();
    } catch (err) {
      if (requestVersion !== this.requestVersion) return;
      App.toast('تعذر تحميل بيانات لوحة التحكم: ' + err.message, 'error');
    }
  },

  resetFilters() {
    ['quality-filter-month', 'quality-filter-from', 'quality-filter-to', 'quality-filter-line', 'quality-filter-product', 'quality-filter-reason']
      .forEach(id => { document.getElementById(id).value = ''; });
    this.load();
  },

  render() {
    const data = this.data;
    if (!data) return;
    document.getElementById('quality-day-detail').textContent = 'اختر نقطة لعرض تفاصيل اليوم.';
    document.getElementById('quality-product-detail').textContent = 'اختر منتجًا من المخطط لعرض الخطوط والعيوب المسجلة.';
    document.getElementById('quality-defect-detail').textContent = 'اختر عيبًا لعرض المنتجات والخطوط المرتبطة.';
    this.renderKpis();
    this.renderDailyChart();
    this.renderProductChart();
    this.renderDefectChart();
    this.renderParetoChart();
    this.renderHeatmap();
    this.renderComparisonTable();
    const updated = document.getElementById('quality-last-updated');
    updated.textContent = data.totals.last_updated
      ? `آخر تحديث للبيانات: ${this.escape(data.totals.last_updated)}`
      : 'لا توجد سجلات فحص مكتملة ضمن الفلاتر الحالية';
    if (data.totals.invalid_date_records) {
      updated.textContent += ` · تم استبعاد ${this.number(data.totals.invalid_date_records)} سجل بتاريخ غير صالح`;
    }
  },

  renderKpis() {
    const data = this.data;
    const totals = data.totals;
    const set = (id, value) => { document.getElementById(id).textContent = value; };
    set('quality-total-inspected', this.number(totals.inspected_samples));
    set('quality-total-rejected', this.number(totals.rejected_samples));
    set('quality-total-rate', this.rate(totals.rejection_rate));
    set('quality-total-defects', this.number(totals.total_defect_occurrences));

    const showBest = (items, prefix, labelKey) => {
      const title = document.getElementById(`quality-best-${prefix}`);
      const detail = document.getElementById(`quality-best-${prefix}-detail`);
      const rule = document.getElementById(`quality-best-${prefix}-rule`);
      rule.textContent = `يشترط ${this.number(data.minimum_sample_size)} عينة على الأقل.`;
      if (!items.length) {
        title.textContent = 'لا توجد بيانات كافية';
        detail.textContent = 'لا يوجد خط أو منتج مستوفٍ للحد الأدنى للعينة.';
        return;
      }
      title.textContent = items.map(item => item[labelKey]).join(' / ');
      detail.textContent = `نسبة العيوب: ${this.rate(items[0].rejection_rate)} · المفحوص: ${this.number(items[0].inspected_samples)} عينة · العيوب: ${this.number(items[0].rejected_samples)} عيب`;
      if (items.length > 1) title.textContent += ' (تعادل)';
    };
    showBest(data.best_lines, 'line', 'line_name');
    showBest(data.best_products, 'product', 'product_name');
    if (data.best_products.length) {
      const codes = [...new Set(data.best_products.map(item => item.product_code).filter(Boolean))];
      document.getElementById('quality-best-product').textContent =
        `${data.best_products.map(item => item.product_name).join(' / ')}${codes.length ? ` (${codes.join(' / ')})` : ''}${data.best_products.length > 1 ? ' (تعادل)' : ''}`;
    }
    const showDefectKpi = (items, nameId, detailId) => {
      document.getElementById(nameId).textContent = items.length
        ? `${items.map(item => item.reason_name).join(' / ')}${items.length > 1 ? ' (تعادل)' : ''}`
        : 'لا توجد عيوب مسجلة';
      document.getElementById(detailId).textContent = items.length
        ? `${this.number(items[0].occurrences)} ظهور · ${this.rate(items[0].share)} من إجمالي مرات العيوب`
        : 'لا تتوفر بيانات ضمن الفلاتر الحالية.';
    };
    showDefectKpi(data.most_frequent_defects, 'quality-most-defect', 'quality-most-defect-detail');
    showDefectKpi(data.least_frequent_defects, 'quality-least-defect', 'quality-least-defect-detail');
  },

  prepareChart(canvasId, key, hasData, emptyMessage) {
    const canvas = document.getElementById(canvasId);
    canvas.parentElement.style.height = '';
    if (this.charts[key]) {
      this.charts[key].destroy();
      this.charts[key] = null;
    }
    let note = canvas.parentElement.querySelector('.quality-chart-empty');
    if (!hasData) {
      canvas.style.display = 'none';
      if (!note) {
        note = document.createElement('p');
        note.className = 'quality-chart-empty flex h-full items-center justify-center text-sm text-slate-400';
        canvas.parentElement.appendChild(note);
      }
      note.textContent = emptyMessage;
      return null;
    }
    canvas.style.display = '';
    if (note) note.remove();
    return canvas;
  },

  renderDailyChart() {
    const totals = this.data.totals;
    const hasData = Number(totals.inspected_samples) > 0;
    const canvas = this.prepareChart('quality-daily-chart', 'daily', hasData, 'لا توجد عينات ضمن الفلاتر المحددة.');
    if (!canvas) return;
    document.getElementById('quality-day-detail').innerHTML =
      `إجمالي المفحوص: <span class="text-indigo-600 font-extrabold text-sm">${this.number(totals.inspected_samples)}</span> عينة &nbsp;|&nbsp; 
       إجمالي العيوب: <span class="text-red-600 font-extrabold text-sm">${this.number(totals.rejected_samples)}</span> عيب &nbsp;|&nbsp; 
       نسبة العيوب: <span class="text-amber-600 font-extrabold text-sm">${this.rate(totals.rejection_rate)}</span>`;

    const maxVal = Math.max(Number(totals.inspected_samples) || 0, Number(totals.rejected_samples) || 0);

    // Custom inline plugin to draw bold labels above columns directly on canvas
    // Guarantees labels always show regardless of external CDN scripts
    const alwaysVisibleDataLabelsPlugin = {
      id: 'alwaysVisibleDataLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, datasetIndex) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          if (!meta || meta.hidden) return;

          meta.data.forEach((element, index) => {
            const rawVal = dataset.data[index];
            const numVal = Number(rawVal || 0);
            
            let labelText = `${numVal.toLocaleString('en-US')} عينة`;
            if (index === 1 && totals.inspected_samples > 0) {
              const pct = ((numVal / totals.inspected_samples) * 100).toFixed(1);
              labelText = `${numVal.toLocaleString('en-US')} عيب (${pct}%)`;
            }

            const { x, y } = element.tooltipPosition();
            const bgFill = index === 0 ? '#4f46e5' : '#dc2626';

            ctx.save();
            ctx.font = 'bold 13px Cairo, Tajawal, Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textWidth = ctx.measureText(labelText).width;
            const padX = 12;
            const padY = 6;
            const boxWidth = textWidth + padX * 2;
            const boxHeight = 26;
            const boxX = x - boxWidth / 2;
            const boxY = Math.max(8, y - boxHeight - 8);

            // Draw shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 2;

            // Draw pill background
            ctx.fillStyle = bgFill;
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
            } else {
              ctx.rect(boxX, boxY, boxWidth, boxHeight);
            }
            ctx.fill();

            // Clear shadow for text
            ctx.shadowColor = 'transparent';

            // Draw text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(labelText, x, boxY + boxHeight / 2);
            ctx.restore();
          });
        });
      }
    };

    this.charts.daily = new Chart(canvas, {
      type: 'bar',
      plugins: [alwaysVisibleDataLabelsPlugin],
      data: {
        labels: ['إجمالي العينات المفحوصة (كافة الخطوط والبلتات)', 'إجمالي العيوب المكتشفة (كافة السحبات)'],
        datasets: [
          {
            label: 'العدد',
            data: [totals.inspected_samples, totals.rejected_samples],
            backgroundColor: ['#4f46e5', '#dc2626'],
            borderRadius: 12,
            barThickness: 80,
            maxBarThickness: 110
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 48,
            bottom: 12,
            left: 20,
            right: 20
          }
        },
        plugins: {
          legend: { display: false },
          datalabels: { display: false }, // Avoid duplicate if ChartDataLabels is loaded
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { family: 'Cairo', size: 13, weight: 'bold' },
            bodyFont: { family: 'Cairo', size: 12 },
            callbacks: {
              label: context => ` ${this.number(context.raw)} ${context.dataIndex === 0 ? 'عينة مفحوصة' : 'عيب مرصود'}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: maxVal > 0 ? maxVal * 1.25 : 10,
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'Cairo', size: 12, weight: 'bold' },
              precision: 0
            },
            title: {
              display: true,
              text: 'العدد الإجمالي',
              font: { family: 'Cairo', size: 13, weight: 'bold' }
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'Cairo', size: 13, weight: 'bold' },
              color: '#0f172a'
            }
          }
        }
      }
    });
  },

  renderProductChart() {
    const rows = [...this.data.products];
    const sort = document.getElementById('quality-product-sort').value;
    const sortValue = row => row.rejection_rate === null ? -1 : Number(row.rejection_rate);
    rows.sort((a, b) => {
      if (sort === 'rejected') return b.rejected_samples - a.rejected_samples;
      if (sort === 'rate') return sortValue(b) - sortValue(a);
      if (sort === 'inspected') return b.inspected_samples - a.inspected_samples;
      return (sortValue(a) < 0 ? Number.POSITIVE_INFINITY : sortValue(a)) - (sortValue(b) < 0 ? Number.POSITIVE_INFINITY : sortValue(b));
    });
    const canvas = this.prepareChart('quality-product-chart', 'products', rows.length, 'لا توجد منتجات مفحوصة ضمن الفلاتر.');
    if (!canvas) return;
    canvas.parentElement.style.height = `${Math.max(288, rows.length * 26)}px`;
    this.charts.products = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(row => `${row.product_name} (${row.product_code})`),
        datasets: [
          { label: 'إجمالي العينات', data: rows.map(row => row.inspected_samples), backgroundColor: '#4f46e5', borderRadius: 5 },
          { label: 'إجمالي العيوب المكتشفة', data: rows.map(row => row.rejected_samples), backgroundColor: '#dc2626', borderRadius: 5 }
        ]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        onClick: (event, elements) => { if (elements.length) this.showProductDetails(rows[elements[0].index]); },
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Cairo' } } },
          tooltip: { callbacks: { afterLabel: context => {
            const row = rows[context.dataIndex];
            return [`نسبة العيوب: ${this.rate(row.rejection_rate)}`, `مرات الفحص: ${this.number(row.completed_pulls)}`];
          } } }
        },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  },

  showProductDetails(product) {
    const lines = this.data.line_products.filter(row => row.product_id === product.product_id);
    const defects = this.data.product_defects.filter(row => row.product_id === product.product_id)
      .sort((a, b) => b.occurrences - a.occurrences);
    const lineHtml = lines.length
      ? lines.map(line => `${this.escape(line.line_name)}: ${this.number(line.inspected_samples)} عينة، ${this.number(line.rejected_samples)} عينة ضمن سحبات مرفوضة (${this.rate(line.rejection_rate)})`).join('<br>')
      : 'لا توجد خطوط مسجلة لهذا المنتج ضمن الفلاتر.';
    const defectHtml = defects.length
      ? defects.map(defect => `${this.escape(defect.reason_name)} (${this.number(defect.occurrences)})`).join('، ')
      : 'لا توجد عيوب مسجلة لهذا المنتج ضمن الفلاتر.';
    document.getElementById('quality-product-detail').innerHTML =
      `<strong>${this.escape(product.product_name)} (${this.escape(product.product_code)})</strong><br>${lineHtml}<br><span class="font-bold">العيوب المسجلة:</span> ${defectHtml}`;
  },

  renderDefectChart() {
    const query = document.getElementById('quality-defect-search').value.trim().toLocaleLowerCase();
    const direction = document.getElementById('quality-defect-sort').value;
    const limitSelect = document.getElementById('quality-defect-limit');
    const limitVal = limitSelect ? limitSelect.value : '20';

    let rows = this.data.defects.filter(row => !query || row.reason_name.toLocaleLowerCase().includes(query));
    rows.sort((a, b) => (direction === 'asc' ? 1 : -1) * (a.occurrences - b.occurrences));

    if (limitVal !== 'all' && !query) {
      const n = parseInt(limitVal, 10) || 20;
      rows = rows.slice(0, n);
    }

    const canvas = this.prepareChart('quality-defect-chart', 'defects', rows.length, 'لا توجد عيوب مسجلة ضمن الفلاتر.');
    if (!canvas) return;

    // Fixed height without scroll
    canvas.parentElement.style.height = '430px';

    const maxVal = rows.length ? Math.max(...rows.map(r => Number(r.occurrences || 0))) : 0;

    // Custom Canvas Plugin to draw number pills directly above vertical bars
    const defectNumbersPlugin = {
      id: 'defectNumbersPlugin',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, datasetIndex) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          if (!meta || meta.hidden) return;

          meta.data.forEach((element, index) => {
            const rawVal = dataset.data[index];
            const numVal = Number(rawVal || 0);
            if (numVal <= 0) return;

            const labelText = numVal.toLocaleString('en-US');
            const { x, y } = element.tooltipPosition();

            ctx.save();
            ctx.font = 'bold 11px Cairo, Tajawal, Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textWidth = ctx.measureText(labelText).width;
            const padX = 7;
            const boxWidth = Math.max(22, textWidth + padX * 2);
            const boxHeight = 20;
            const boxX = x - boxWidth / 2;
            const boxY = Math.max(6, y - boxHeight - 6);

            // Draw shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 1;

            // Draw pill background
            ctx.fillStyle = '#c8102e';
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
            } else {
              ctx.rect(boxX, boxY, boxWidth, boxHeight);
            }
            ctx.fill();

            // Clear shadow for text
            ctx.shadowColor = 'transparent';

            // Draw text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(labelText, x, boxY + boxHeight / 2);
            ctx.restore();
          });
        });
      }
    };

    this.charts.defects = new Chart(canvas, {
      type: 'bar',
      plugins: [defectNumbersPlugin],
      data: {
        labels: rows.map(row => row.reason_name),
        datasets: [{
          label: 'مرات ظهور العيب',
          data: rows.map(row => row.occurrences),
          backgroundColor: '#c8102e',
          borderRadius: 8,
          maxBarThickness: 45
        }]
      },
      options: {
        indexAxis: 'x', // Vertical bars (أعمدة رأسية واقفة)
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 36,
            bottom: 10,
            left: 10,
            right: 10
          }
        },
        onClick: (event, elements) => {
          if (elements.length) this.showDefectDetails(rows[elements[0].index]);
        },
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { family: 'Cairo', size: 12, weight: 'bold' },
            bodyFont: { family: 'Cairo', size: 11 },
            callbacks: {
              label: context => ` العدد: ${this.number(context.raw)} ظهور`,
              afterLabel: context => ` النسبة من إجمالي العيوب: ${this.rate(rows[context.dataIndex].share)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: maxVal > 0 ? maxVal * 1.25 : 10,
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'Cairo', size: 11 },
              precision: 0
            },
            title: {
              display: true,
              text: 'مرات الظهور',
              font: { family: 'Cairo', size: 12, weight: 'bold' }
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'Cairo', size: 11, weight: 'bold' },
              color: '#1e293b',
              maxRotation: 45,
              minRotation: 25,
              callback: function(val) {
                const label = this.getLabelForValue(val);
                return label.length > 20 ? label.slice(0, 18) + '...' : label;
              }
            }
          }
        }
      }
    });
  },

  showDefectDetails(defect) {
    const relations = this.data.defect_relations.filter(row => row.reason_id === defect.reason_id);
    const products = [...new Map(relations.map(row => [row.product_id, `${row.product_name} (${row.product_code})`])).values()];
    const lines = [...new Map(relations.map(row => [row.line_id, row.line_name])).values()];
    document.getElementById('quality-defect-detail').innerHTML =
      `<strong>${this.escape(defect.reason_name)}</strong> · ${this.number(defect.occurrences)} ظهور (${this.rate(defect.share)} من إجمالي العيوب)<br><span class="font-bold">المنتجات:</span> ${products.length ? products.map(item => this.escape(item)).join('، ') : 'لا توجد'}<br><span class="font-bold">الخطوط:</span> ${lines.length ? lines.map(item => this.escape(item)).join('، ') : 'لا توجد'}`;
  },

  renderParetoChart() {
    const rows = this.data.defects;
    const canvas = this.prepareChart('quality-pareto-chart', 'pareto', rows.length, 'لا توجد بيانات عيوب لبناء باريتو.');
    if (!canvas) return;
    canvas.parentElement.style.height = `${Math.max(288, rows.length * 26)}px`;
    let cumulative = 0;
    const total = rows.reduce((sum, row) => sum + Number(row.occurrences), 0);
    const cumulativeShares = rows.map(row => {
      cumulative += Number(row.occurrences);
      return total > 0 ? Number(((cumulative / total) * 100).toFixed(2)) : 0;
    });
    this.charts.pareto = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(row => row.reason_name),
        datasets: [
          { type: 'bar', label: 'مرات ظهور العيوب', data: rows.map(row => row.occurrences), backgroundColor: '#c8102e', yAxisID: 'count' },
          { type: 'line', label: 'النسبة التراكمية %', data: cumulativeShares, borderColor: '#2563eb', backgroundColor: '#2563eb', pointRadius: 3, yAxisID: 'percent' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Cairo' } } } },
        scales: {
          x: { ticks: { font: { family: 'Cairo', size: 10 } } },
          count: { beginAtZero: true, position: 'right', title: { display: true, text: 'مرات الظهور' } },
          percent: { beginAtZero: true, max: 100, position: 'left', ticks: { callback: value => `${value}%` }, title: { display: true, text: 'تراكمي %' } }
        }
      }
    });
  },

  renderHeatmap() {
    const container = document.getElementById('quality-heatmap');
    const rows = this.data.line_products;
    const products = [...new Map(rows.map(row => [row.product_id, { id: row.product_id, name: row.product_name, code: row.product_code }])).values()];
    const lines = [...new Map(rows.map(row => [row.line_id, { id: row.line_id, name: row.line_name, number: row.line_number }])).values()];
    if (!rows.length) {
      container.innerHTML = '<p class="p-5 text-center text-sm text-slate-400">لا توجد مقارنة متاحة ضمن الفلاتر الحالية.</p>';
      return;
    }
    const byPair = new Map(rows.map(row => [`${row.line_id}:${row.product_id}`, row]));
    container.innerHTML = `<table class="min-w-full border-collapse text-center text-xs"><thead><tr><th class="sticky right-0 bg-slate-100 p-2">الخط / المنتج</th>${products.map(product => `<th class="bg-slate-100 p-2">${this.escape(product.name)}<br><span class="font-normal text-slate-500">${this.escape(product.code)}</span></th>`).join('')}</tr></thead><tbody>${lines.map(line => `<tr><th class="sticky right-0 whitespace-nowrap border-b bg-white p-2 text-right">${this.escape(line.name)}</th>${products.map(product => {
      const item = byPair.get(`${line.id}:${product.id}`);
      if (!item) return '<td class="border-b p-2 text-slate-300">—</td>';
      const rate = item.rejection_rate;
      const color = rate === null ? 'bg-slate-100 text-slate-500' : rate >= 10 ? 'bg-red-200 text-red-900' : rate >= 5 ? 'bg-orange-100 text-orange-900' : rate > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900';
      return `<td title="${this.number(item.inspected_samples)} عينة مفحوصة، ${this.number(item.rejected_samples)} عيب مسجل" class="border-b p-2"><span class="inline-block min-w-16 rounded-lg px-2 py-1 font-bold ${color}">${this.rate(rate)}</span><span class="mt-1 block text-[10px] text-slate-500">ن=${this.number(item.inspected_samples)} عينة</span></td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
  },

  getSortedComparisonRows() {
    const search = document.getElementById('quality-comparison-search').value.trim().toLocaleLowerCase();
    const sort = document.getElementById('quality-comparison-sort').value;
    const rows = this.data.line_products.filter(row =>
      !search || [row.line_name, row.product_name, row.product_code].some(value => String(value).toLocaleLowerCase().includes(search))
    );
    const rate = row => row.rejection_rate === null ? -1 : Number(row.rejection_rate);
    rows.sort((a, b) => {
      if (sort === 'rate_asc') return (rate(a) < 0 ? Number.POSITIVE_INFINITY : rate(a)) - (rate(b) < 0 ? Number.POSITIVE_INFINITY : rate(b));
      if (sort === 'inspected_desc') return b.inspected_samples - a.inspected_samples;
      if (sort === 'rejected_desc') return b.rejected_samples - a.rejected_samples;
      return rate(b) - rate(a);
    });
    return rows;
  },

  renderComparisonTable() {
    const rows = this.getSortedComparisonRows();
    const tbody = document.getElementById('quality-comparison-body');
    const tfoot = document.getElementById('quality-comparison-foot');

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-400">لا توجد نتائج مطابقة.</td></tr>';
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    tbody.innerHTML = rows.map(row => `
      <tr>
        <td class="font-bold text-[#c8102e]">${this.escape(row.line_name)}</td>
        <td>${this.escape(row.product_name)}</td>
        <td>${this.escape(row.product_code)}</td>
        <td class="text-center">${this.number(row.completed_pulls)}</td>
        <td class="text-center font-bold text-indigo-700">${this.number(row.inspected_samples)}</td>
        <td class="text-center font-bold text-red-700">${this.number(row.rejected_samples)}</td>
        <td class="text-center font-bold">${this.rate(row.rejection_rate)}</td>
      </tr>`).join('');

    // Calculate totals for all columns
    const totalPulls = rows.reduce((sum, r) => sum + Number(r.completed_pulls || 0), 0);
    const totalInspected = rows.reduce((sum, r) => sum + Number(r.inspected_samples || 0), 0);
    const totalDefects = rows.reduce((sum, r) => sum + Number(r.rejected_samples || 0), 0);
    const totalRate = totalInspected > 0 ? ((totalDefects / totalInspected) * 100).toFixed(2) : null;

    if (tfoot) {
      tfoot.innerHTML = `
        <tr class="bg-slate-200/80 text-slate-900 border-t-2 border-slate-400 text-sm">
          <td colspan="3" class="p-3 text-right font-black text-slate-900">
            <i class="fa-solid fa-calculator ml-1.5 text-indigo-700"></i>الإجمالي العام (${rows.length} بند):
          </td>
          <td class="text-center font-black text-slate-900">${this.number(totalPulls)}</td>
          <td class="text-center font-black text-indigo-800 text-base">${this.number(totalInspected)}</td>
          <td class="text-center font-black text-red-700 text-base">${this.number(totalDefects)}</td>
          <td class="text-center font-black text-amber-800 text-base">${this.rate(totalRate)}</td>
        </tr>
      `;
    }
  },

  exportComparison() {
    const rows = this.getSortedComparisonRows();
    if (!rows.length) return App.toast('لا توجد بيانات لتصديرها.', 'warning');
    const cell = value => {
      const text = String(value ?? '');
      return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
    };

    const totalPulls = rows.reduce((sum, r) => sum + Number(r.completed_pulls || 0), 0);
    const totalInspected = rows.reduce((sum, r) => sum + Number(r.inspected_samples || 0), 0);
    const totalDefects = rows.reduce((sum, r) => sum + Number(r.rejected_samples || 0), 0);
    const totalRate = totalInspected > 0 ? ((totalDefects / totalInspected) * 100).toFixed(2) : '';

    const lines = [
      ['خط الإنتاج', 'اسم المنتج', 'كود المنتج', 'مرات الفحص', 'إجمالي العينات المفحوصة', 'إجمالي العيوب المكتشفة', 'نسبة العيوب %'],
      ...rows.map(row => [row.line_name, row.product_name, row.product_code, row.completed_pulls, row.inspected_samples, row.rejected_samples, row.rejection_rate ?? '']),
      ['الإجمالي العام', '', '', totalPulls, totalInspected, totalDefects, totalRate ? `${totalRate}%` : '']
    ];
    const blob = new Blob([`\uFEFF${lines.map(line => line.map(cell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'quality-line-product-comparison.csv';
    link.click();
    const objectUrl = link.href;
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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
      if (App.currentDepartment && App.currentDepartment !== 'all') {
        params.append('department', App.currentDepartment);
      }

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
          <td class="font-extrabold text-[#c8102e] whitespace-nowrap">${p.line_name}</td>
          <td class="font-bold text-slate-800 text-xs">${p.product_name}</td>
          <td class="font-black text-slate-900 bg-red-50/50 text-center rounded text-sm">#${p.pallet_number}</td>
          <td>
            <div class="font-bold text-slate-800 text-xs">${p.date}</div>
            <div class="mt-1">${timeChips}</div>
          </td>
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
              <button onclick="PalletModule.delete(${p.id}, ${p.pallet_number})" title="حذف" class="text-slate-400 hover:text-red-700 p-1">
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

  delete(id, palletNum) {
    const lineName = this.currentPallets.find(pallet => pallet.id === id)?.line_name || '—';
    App.confirm(`هل أنت متأكد من حذف البالتة رقم #${palletNum} (${lineName})؟`, async () => {
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
      'اسم الخط': p.line_name,
      'اسم المنتج': p.product_name,
      'رقم البالتة': p.pallet_number,
      'تاريخ الاستلام': p.date,
      'وقت الاستلام': p.received_time,
      'الوردية': p.shift_name,
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
  allLines: [],

  async load() {
    try {
      const res = await App.apiGet('/api/lines?include_archived=true');
      if (res.success) {
        this.allLines = res.data;
        App.metadata.lines = res.data.filter(line => !line.is_archived);
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
            <span class="text-xs font-black px-3 py-1 rounded-lg ${l.is_archived ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-[#c8102e]'}">${l.is_archived ? 'خط مؤرشف' : 'خط إنتاج'}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${l.is_archived ? 'bg-slate-100 text-slate-600' : l.status === 'نشط' ? 'badge-accepted' : 'badge-rejected'}">${l.is_archived ? 'مؤرشف' : l.status}</span>
          </div>
          <h3 class="font-extrabold text-slate-900 text-base mb-1">${l.name}</h3>
          <div class="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t">
            <div class="flex justify-between"><span>مشرف الخط:</span><span class="font-bold text-slate-900">${l.supervisor_name}</span></div>
            <div class="flex justify-between"><span>الجهاز المشغل:</span><span class="font-bold text-indigo-700">${l.current_product_name || 'غير محدد'}</span></div>
            <div class="flex justify-between"><span>إجمالي البلتات:</span><span class="font-bold">${l.pallets_count} بالتة</span></div>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-4 mt-4 border-t">
          ${l.is_archived
            ? `<button onclick="LinesModule.restore(${l.id})" class="text-emerald-600 font-bold text-xs"><i class="fa-solid fa-rotate-left ml-1"></i>استعادة الخط</button>`
            : `<button onclick="LinesModule.openModal(${l.id})" class="text-blue-600 font-bold text-xs"><i class="fa-solid fa-pen ml-1"></i>تعديل</button>
              <button onclick="LinesModule.delete(${l.id}, '${l.name}')" class="text-red-600 font-bold text-xs"><i class="fa-solid fa-box-archive ml-1"></i>حذف</button>`}
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
        const deptEl = document.getElementById('l-department');
        if (deptEl) deptEl.value = line.department || 'home';
      }
    } else {
      document.getElementById('modal-line-title').textContent = 'إضافة خط إنتاج جديد';
      const max = this.allLines.reduce((m, l) => l.line_number > m ? l.line_number : m, 0);
      document.getElementById('l-number').value = max + 1;
      const deptEl = document.getElementById('l-department');
      if (deptEl) deptEl.value = App.currentDepartment === 'seria' ? 'seria' : 'home';
    }
    modal.classList.remove('hidden');
  },

  closeModal() { document.getElementById('modal-line').classList.add('hidden'); },

  async save() {
    const id = document.getElementById('line-id').value;
    const deptEl = document.getElementById('l-department');
    const payload = {
      line_number: document.getElementById('l-number').value,
      name: document.getElementById('l-name').value,
      supervisor_name: document.getElementById('l-supervisor').value,
      current_product_id: document.getElementById('l-product').value || null,
      status: document.getElementById('l-status').value,
      department: deptEl ? deptEl.value : 'home'
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
    App.confirm(`هل تريد حذف ${name}؟ سيتم إخفاء الخط من الاختيارات الجديدة مع الاحتفاظ بكل البلتات والسجلات المرتبطة به، ويمكن استعادته لاحقاً.`, async () => {
      try {
        const res = await App.apiDelete(`/api/lines/${id}`);
        if (res.success) {
          App.toast(res.message, 'success');
          await this.load();
          App.populateDropdowns();
        }
      } catch (err) { App.toast(err.message, 'error'); }
    });
  },

  restore(id) {
    App.confirm('هل تريد استعادة هذا الخط وإظهاره مرة أخرى ضمن الاختيارات الجديدة؟', async () => {
      try {
        const res = await App.apiPost(`/api/lines/${id}/restore`, {});
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
        <td class="font-bold text-indigo-700">${p.default_line_name || '—'}</td>
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
        const deptEl = document.getElementById('prod-department');
        if (deptEl) deptEl.value = prod.department || 'home';
      }
    } else {
      document.getElementById('modal-product-title').textContent = 'إضافة جهاز / منتج جديد';
      const deptEl = document.getElementById('prod-department');
      if (deptEl) deptEl.value = App.currentDepartment === 'seria' ? 'seria' : 'home';
    }
    modal.classList.remove('hidden');
  },

  closeModal() { document.getElementById('modal-product').classList.add('hidden'); },

  async save() {
    const id = document.getElementById('prod-id').value;
    const deptEl = document.getElementById('prod-department');
    const payload = {
      code: document.getElementById('prod-code').value,
      name: document.getElementById('prod-name').value,
      specifications: document.getElementById('prod-specs').value,
      weight: document.getElementById('prod-weight').value,
      unit: 'جهاز',
      default_line_id: document.getElementById('prod-line').value || null,
      department: deptEl ? deptEl.value : 'home'
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
        <td class="font-bold text-indigo-700">${a.line_name || '—'}</td>
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
    const dept = (App.currentDepartment && App.currentDepartment !== 'all') ? App.currentDepartment : '';

    try {
      const url = `/api/summary?date_from=${dateFrom}&date_to=${dateTo}&shift_id=${shift}${dept ? `&department=${dept}` : ''}`;
      const res = await App.apiGet(url);
      if (res.success) {
        this.currentSummary = res.data;
        this.updateDayLabel(dateFrom, dateTo);
        this.render();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  updateDayLabel(dateFrom, dateTo) {
    const dayLabel = document.getElementById('summary-day-text');
    if (!dayLabel) return;
    const dObj = new Date(dateFrom);
    const daysAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = isNaN(dObj.getDay()) ? '' : daysAr[dObj.getDay()];
    if (dateFrom === dateTo) {
      dayLabel.textContent = `يوم التقرير: ${dayName} (${dateFrom})`;
    } else {
      dayLabel.textContent = `فترة التقرير: من ${dateFrom} إلى ${dateTo}`;
    }
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

      let reasonsHtml = '';
      if (s.reasons_breakdown && s.reasons_breakdown.length > 0) {
        reasonsHtml = `<div class="flex flex-wrap gap-1">${s.reasons_breakdown.map(r => `<span class="reason-badge">${r.reason_name} (${r.count})</span>`).join('')}</div>`;
      } else if (s.aggregated_reasons && s.aggregated_reasons.trim() && s.aggregated_reasons !== '—') {
        const parts = s.aggregated_reasons.split(/[,،]/).map(p => p.trim()).filter(Boolean);
        reasonsHtml = `<div class="flex flex-wrap gap-1">${parts.map(p => `<span class="reason-badge">${p}</span>`).join('')}</div>`;
      } else {
        reasonsHtml = '<span class="text-xs text-slate-400">لا توجد عيوب مسجلة</span>';
      }

      return `
        <tr>
          <td class="font-black text-[#c8102e] whitespace-nowrap">${s.line_name}</td>
          <td class="font-bold text-slate-900">${s.products_produced || '—'}</td>
          <td class="font-semibold">${s.supervisor_name || '—'}</td>
          <td class="font-bold text-emerald-800">${s.inspector_name || '—'}</td>
          <td class="font-extrabold">${Number(s.total_produced).toLocaleString('ar-EG')} جهاز</td>
          <td class="font-bold text-indigo-700">${Number(s.total_inspected).toLocaleString('ar-EG')}</td>
          <td class="font-bold text-red-700">${Number(s.total_rejected).toLocaleString('ar-EG')}</td>
          <td class="font-bold text-emerald-700">${Number(s.total_accepted).toLocaleString('ar-EG')}</td>
          <td><span class="px-2 py-0.5 rounded text-xs font-bold ${s.rejection_rate > 3 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}">${s.rejection_rate}%</span></td>
          <td class="text-xs" style="min-width: 260px;">${reasonsHtml}</td>
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

  toggleScreenshotMode() {
    const container = document.getElementById('summary-print-container');
    const btn = document.getElementById('summary-screenshot-btn');
    if (!container) return;

    container.classList.toggle('screenshot-mode');
    const isMode = container.classList.contains('screenshot-mode');

    if (btn) {
      btn.innerHTML = isMode
        ? '<i class="fa-solid fa-compress"></i> إلغاء وضع الشاشة'
        : '<i class="fa-solid fa-camera"></i> وضع لقطة الشاشة (صفحة واحدة)';
    }

    if (isMode) {
      App.toast('تم تفعيل وضع لقطة الشاشة (صفحة واحدة متكاملة) - يمكنك أخذ لقطة الشاشة الآن', 'success');
    } else {
      App.toast('تمت العودة للوضع الطبيعي', 'info');
    }
  },

  exportExcel() {
    if (!this.currentSummary.length) return App.toast('لا توجد بيانات للتصدير', 'warning');
    const data = this.currentSummary.map(s => ({
      'اسم الخط': s.line_name,
      'اسم المنتج': s.products_produced || '—',
      'مشرف الخط': s.supervisor_name || '—',
      'مراقب الجودة': s.inspector_name || '—',
      'إجمالي الإنتاج': s.total_produced,
      'كمية الفحص AQL': s.total_inspected,
      'الكمية المرفوضة': s.total_rejected,
      'الكمية المقبولة': s.total_accepted,
      'نسبة الرفض %': s.rejection_rate + '%',
      'أسباب الرفض بالتفصيل الكامل': s.aggregated_reasons || 'لا توجد عيوب',
      'بلتات مقبولة': s.accepted_pallets,
      'بلتات مرفوضة': s.rejected_pallets
    }));
    ExportsManager.exportToExcel(data, 'ملخص_جودة_خطوط_المغربي');
  },

  printReport() {
    ExportsManager.printReport('summary-print-container', 'ملخص الجودة ومطابقة AQL حسب خط التجميع');
  }
};

const LineSampleSummaryModule = {
  pulls: [],
  slots: [],
  periodStatuses: new Map(),

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  },

  async load() {
    const dateInput = document.getElementById('line-sample-summary-date');
    if (!dateInput) return;
    if (!dateInput.value) {
      const now = new Date();
      dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    const params = new URLSearchParams({ date: dateInput.value });
    if (App.currentDepartment && App.currentDepartment !== 'all') {
      params.set('department', App.currentDepartment);
    }

    try {
      const [pullsResponse, slotsResponse, statusesResponse] = await Promise.all([
        App.apiGet(`/api/line-sample-pulls?${params.toString()}`),
        App.apiGet('/api/line-sample-slots'),
        App.apiGet(`/api/line-sample-period-statuses?date=${encodeURIComponent(dateInput.value)}`)
      ]);
      this.pulls = pullsResponse.data || [];
      this.slots = slotsResponse.data || [];
      this.periodStatuses = new Map((statusesResponse.data || []).map(status => [
        `${status.slot_id}:${status.line_id}`,
        status
      ]));
      this.render();
    } catch (error) {
      App.toast(`تعذر تحميل ملخص سحب عينات الخطوط: ${error.message}`, 'error');
    }
  },

  buildReport() {
    const department = App.currentDepartment;
    const lines = (App.metadata.lines || [])
      .filter(line => !department || department === 'all' || !line.department || line.department === department)
      .sort((a, b) => Number(a.line_number) - Number(b.line_number));
    const periods = new Map();
    this.slots.forEach(slot => {
      periods.set(String(slot.id), {
        key: String(slot.id),
        slotId: Number(slot.id),
        label: slot.slot_name || `${slot.start_time}–${slot.end_time}`,
        startTime: slot.start_time || ''
      });
    });

    const pullPeriodKeys = new Map();
    this.pulls.forEach(pull => {
      const matchedSlot = this.slots.find(slot => String(slot.id) === String(pull.slot_id))
        || this.slots.find(slot => slot.start_time === pull.start_time && slot.end_time === pull.end_time);
      const key = matchedSlot
        ? matchedSlot.key || String(matchedSlot.id)
        : pull.slot_id
          ? `slot-${pull.slot_id}`
          : `time-${pull.start_time || ''}-${pull.end_time || ''}`;
      if (!periods.has(key)) {
        periods.set(key, {
          key,
          slotId: matchedSlot ? Number(matchedSlot.id) : Number.isSafeInteger(Number(pull.slot_id)) ? Number(pull.slot_id) : null,
          label: pull.slot_name || `${pull.start_time || ''}–${pull.end_time || ''}`,
          startTime: pull.start_time || ''
        });
      }
      pullPeriodKeys.set(pull.id, key);
    });

    const createStats = () => ({
      pulls: 0,
      samples: 0,
      defects: 0,
      acceptedPallets: 0,
      rejectedPallets: 0,
      pending: 0,
      undecidedPallets: 0,
      reasons: new Map(),
      notes: new Set(),
      products: new Set(),
      stations: new Set(),
      inspectors: new Map()
    });
    const allLineStats = new Map(lines.map(line => [String(line.id), createStats()]));
    const periodStats = new Map(Array.from(periods.keys(), key => [
      key,
      new Map(lines.map(line => [String(line.id), createStats()]))
    ]));

    this.pulls.forEach(pull => {
      const lineKey = String(pull.line_id);
      const summary = allLineStats.get(lineKey);
      const byPeriod = periodStats.get(pullPeriodKeys.get(pull.id))?.get(lineKey);
      if (!summary || !byPeriod) return;
      const sampleCount = Number(pull.sample_count) || 0;
      const defectCount = Number(pull.total_defect_count)
        || (pull.defects || []).reduce((sum, defect) => sum + (Number(defect.count) || 0), 0);
      [summary, byPeriod].forEach(stats => {
        stats.pulls += 1;
        stats.samples += sampleCount;
        stats.defects += defectCount;
        if (pull.status !== 'completed') {
          stats.pending += 1;
          stats.undecidedPallets += 1;
        } else if (Number(pull.pallet_rejected) === 1) {
          stats.rejectedPallets += 1;
        } else if (Number(pull.pallet_rejected) === 0) {
          stats.acceptedPallets += 1;
        } else {
          stats.undecidedPallets += 1;
        }
        if (pull.product_name) stats.products.add(pull.product_name);
        if (pull.station_name) stats.stations.add(pull.station_name);
        const extraSamples = Number(pull.additional_sample_count) || 0;
        const primarySamples = sampleCount - extraSamples;
        if (pull.inspector_name && primarySamples > 0) {
          const name = pull.inspector_name.trim();
          stats.inspectors.set(name, (stats.inspectors.get(name) || 0) + primarySamples);
        }
        if (pull.additional_inspector_name && extraSamples > 0) {
          const name = pull.additional_inspector_name.trim();
          stats.inspectors.set(name, (stats.inspectors.get(name) || 0) + extraSamples);
        }
        (pull.defects || []).forEach(defect => {
          const name = defect.reason_name || 'عيب غير محدد';
          stats.reasons.set(name, (stats.reasons.get(name) || 0) + (Number(defect.count) || 0));
          if (defect.notes && String(defect.notes).trim()) stats.notes.add(String(defect.notes).trim());
        });
      });
    });

    return {
      lines,
      allLineStats,
      periods: Array.from(periods.values()).sort((a, b) => a.startTime.localeCompare(b.startTime)),
      periodStats
    };
  },

  async savePeriodStatus(slotId, lineId) {
    const date = document.getElementById('line-sample-summary-date')?.value || '';
    const statusSelect = document.getElementById(`line-period-status-${slotId}-${lineId}`);
    const reasonInput = document.getElementById(`line-period-reason-${slotId}-${lineId}`);
    if (!statusSelect) return;
    if (statusSelect.value !== '0' && statusSelect.value !== '1') {
      App.toast('حدد حالة الخط: يعمل أو متوقف.', 'warning');
      statusSelect.focus();
      return;
    }
    const noSampleReason = reasonInput?.value.trim() || '';
    const report = this.buildReport();
    const period = report.periods.find(item => Number(item.slotId) === Number(slotId));
    const stats = period ? report.periodStats.get(period.key)?.get(String(lineId)) : null;
    if (stats && !stats.pulls && !noSampleReason) {
      App.toast('اكتب سبب عدم السحب قبل الحفظ.', 'warning');
      reasonInput?.focus();
      return;
    }
    const saveButton = document.getElementById(`line-period-save-${slotId}-${lineId}`);
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'جارٍ الحفظ...';
    }
    try {
      const response = await App.apiPost('/api/line-sample-period-statuses', {
        date,
        slot_id: Number(slotId),
        line_id: Number(lineId),
        is_stopped: statusSelect.value === '1',
        no_sample_reason: noSampleReason
      });
      this.periodStatuses.set(`${slotId}:${lineId}`, response.data);
      App.toast(response.message || 'تم حفظ حالة الخط وسبب عدم السحب.', 'success');
      this.render();
    } catch (error) {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'حفظ';
      }
      App.toast(`تعذر حفظ حالة الخط: ${error.message}`, 'error');
    }
  },

  formatProblems(stats) {
    const reasons = Array.from(stats.reasons.entries()).sort((a, b) => b[1] - a[1]);
    const problems = reasons.map(([name, count]) => `${name} (${count.toLocaleString('ar-EG')})`);
    if (stats.pending) problems.push(`${stats.pending.toLocaleString('ar-EG')} سحبة بانتظار الفحص`);
    if (stats.notes.size) problems.push(...stats.notes);
    return problems.length ? problems.join('، ') : stats.pulls ? 'لا توجد مشاكل مسجلة' : 'لا توجد سحبات';
  },

  formatPalletStatus(stats, asHtml = true) {
    if (!stats.pulls) return '—';
    const parts = [];
    const format = (label, count) => {
      if (!count) return;
      const value = count > 1 ? `${label} (${count.toLocaleString('ar-EG')})` : label;
      parts.push(asHtml
        ? `<span class="${label === 'مرفوضة' ? 'badge-rejected' : label === 'مقبولة' ? 'badge-accepted' : 'badge-pending'} px-2 py-1 rounded-full font-bold">${value}</span>`
        : value);
    };
    format('مقبولة', stats.acceptedPallets || 0);
    format('مرفوضة', stats.rejectedPallets || 0);
    format('بانتظار الفحص', stats.pending || 0);
    format('غير محددة', stats.undecidedPallets || 0);
    return parts.length ? parts.join(asHtml ? ' ' : '، ') : '—';
  },

  formatProducts(stats) {
    const products = Array.from(stats.products).sort((a, b) => a.localeCompare(b, 'ar'));
    return products.length ? products.map(product => this.escape(product)).join('<br>') : '—';
  },

  formatNames(names) {
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ar'))
      .map(name => this.escape(name)).join('<br>') || '—';
  },

  formatInspectors(inspectors) {
    return Array.from(inspectors.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ar'))
      .map(([name, samples]) => `${this.escape(name)} (${samples.toLocaleString('ar-EG')} عينة)`)
      .join('<br>') || '—';
  },

  async downloadImage(targetId, filename) {
    const target = document.getElementById(targetId);
    if (!target) {
      App.toast('تعذر العثور على الجدول المطلوب تنزيله.', 'error');
      return;
    }
    if (typeof window.html2canvas !== 'function') {
      App.toast('ميزة تنزيل الصور غير متاحة حاليًا. تحقق من اتصال الإنترنت ثم أعد تحميل الصفحة.', 'error');
      return;
    }

    try {
      const canvas = await window.html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: Math.max(2, window.devicePixelRatio || 1),
        useCORS: true,
        ignoreElements: element => element.classList?.contains('export-image-control')
      });
      const link = document.createElement('a');
      const safeFilename = filename.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '_');
      link.download = `${safeFilename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      App.toast('تم تنزيل الجدول كصورة ملونة.', 'success');
    } catch (error) {
      App.toast(`تعذر إنشاء صورة الجدول: ${error.message}`, 'error');
    }
  },

  render() {
    const container = document.getElementById('line-sample-summary-content');
    if (!container) return;
    const report = this.buildReport();
    const date = document.getElementById('line-sample-summary-date')?.value || '—';
    const dateLabel = document.getElementById('line-sample-summary-report-date');
    if (dateLabel) dateLabel.textContent = `تاريخ التقرير: ${date}`;
    const totalSamples = this.pulls.reduce((sum, pull) => sum + (Number(pull.sample_count) || 0), 0);
    const totalDefects = this.pulls.reduce((sum, pull) => sum + (Number(pull.total_defect_count) || 0), 0);

    const lineRows = report.lines.map(line => {
      const stats = report.allLineStats.get(String(line.id));
      const reasonDetails = Array.from(stats.reasons.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<span class="reason-badge">${this.escape(name)} (${count.toLocaleString('ar-EG')})</span>`)
        .join(' ');
      const notes = Array.from(stats.notes)
        .map(note => `<span class="text-slate-600">${this.escape(note)}</span>`)
        .join(' ');
      const details = [
        reasonDetails || (stats.pulls ? '<span class="text-emerald-700 font-semibold">لا توجد مشاكل مسجلة</span>' : '<span class="text-slate-400">لا توجد سحبات</span>'),
        notes,
        stats.pending ? `<span class="text-amber-700 font-bold">بانتظار الفحص: ${stats.pending.toLocaleString('ar-EG')}</span>` : ''
      ].filter(Boolean).join(' ');
      return `<tr class="${stats.rejectedPallets ? 'line-sample-rejected-row' : ''}">
        <td class="font-bold whitespace-nowrap">${this.escape(line.name || `خط ${line.line_number}`)}</td>
        <td class="font-semibold">${this.formatProducts(stats)}</td>
        <td>${this.formatNames(stats.stations)}</td>
        <td>${this.formatInspectors(stats.inspectors)}</td>
        <td class="text-center">${stats.pulls.toLocaleString('ar-EG')}</td>
        <td class="text-center font-extrabold text-indigo-700">${stats.samples.toLocaleString('ar-EG')}</td>
        <td>${this.formatPalletStatus(stats)}</td>
        <td class="text-center font-bold text-red-700">${stats.defects.toLocaleString('ar-EG')}</td>
        <td>${details}</td>
      </tr>`;
    }).join('');
    const lineTotals = report.lines.reduce((total, line) => {
      const stats = report.allLineStats.get(String(line.id));
      total.pulls += stats.pulls;
      total.samples += stats.samples;
      total.defects += stats.defects;
      total.acceptedPallets += stats.acceptedPallets;
      total.rejectedPallets += stats.rejectedPallets;
      total.pending += stats.pending;
      total.undecidedPallets += stats.undecidedPallets;
      return total;
    }, { pulls: 0, samples: 0, defects: 0, acceptedPallets: 0, rejectedPallets: 0, pending: 0, undecidedPallets: 0 });

    const periodTables = report.periods.map((period, periodIndex) => {
      const rows = report.lines.map(line => {
        const stats = report.periodStats.get(period.key)?.get(String(line.id));
        const savedStatus = period.slotId
          ? this.periodStatuses.get(`${period.slotId}:${line.id}`)
          : null;
        const status = stats.pulls
          ? stats.pending
            ? `<span class="text-amber-700 font-bold">بانتظار الفحص (${stats.pending.toLocaleString('ar-EG')})</span>`
            : '<span class="text-emerald-700 font-semibold">تم الفحص</span>'
          : '<span class="text-slate-400">—</span>';
        const problems = Array.from(stats.reasons.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => `<span class="reason-badge">${this.escape(name)} (${count.toLocaleString('ar-EG')})</span>`)
          .join(' ');
        const notes = Array.from(stats.notes).map(note => `<span>${this.escape(note)}</span>`).join(' ');
        const details = problems || notes
          ? `${problems}${notes ? `<div class="mt-1">${notes}</div>` : ''}`
          : stats.pulls
            ? '<span class="text-emerald-700">لا توجد مشاكل</span>'
            : '<span class="text-slate-400">لا توجد سحبات</span>';
        const lineStatusControls = period.slotId
          ? `<div class="line-period-status-controls">
              <select id="line-period-status-${period.slotId}-${line.id}" class="form-input text-xs" aria-label="حالة الخط">
                <option value="" disabled ${savedStatus ? '' : 'selected'}>حدد الحالة</option>
                <option value="0" ${savedStatus && !Number(savedStatus.is_stopped) ? 'selected' : ''}>يعمل</option>
                <option value="1" ${Number(savedStatus?.is_stopped) ? 'selected' : ''}>متوقف</option>
              </select>
              ${stats.pulls ? '' : `<label class="block text-[10px] text-slate-600 mt-1">سبب عدم السحب</label>
                <input id="line-period-reason-${period.slotId}-${line.id}" class="form-input text-xs mt-1" maxlength="500" value="${this.escape(savedStatus?.no_sample_reason || '')}" placeholder="اكتب السبب">`}
              <button id="line-period-save-${period.slotId}-${line.id}" type="button" class="bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-bold px-2 py-1 rounded mt-1" onclick="LineSampleSummaryModule.savePeriodStatus(${period.slotId}, ${line.id})">حفظ</button>
            </div>`
          : `<span class="text-slate-400" title="لا يمكن تعديل الفترات القديمة غير المرتبطة بفترة معرفة">—</span>`;
        return `<tr class="${stats.rejectedPallets ? 'line-sample-rejected-row' : ''}">
          <td class="font-bold whitespace-nowrap">${this.escape(line.name || `خط ${line.line_number}`)}</td>
          <td class="font-semibold">${this.formatProducts(stats)}</td>
          <td>${this.formatNames(stats.stations)}</td>
          <td>${this.formatInspectors(stats.inspectors)}</td>
          <td class="text-center font-extrabold text-indigo-700">${stats.samples.toLocaleString('ar-EG')}</td>
          <td class="text-center">${stats.pulls.toLocaleString('ar-EG')}</td>
          <td>${this.formatPalletStatus(stats)}</td>
          <td>${status}</td>
          <td>${lineStatusControls}</td>
          <td>${!stats.pulls && savedStatus?.no_sample_reason ? this.escape(savedStatus.no_sample_reason) : '<span class="text-slate-400">—</span>'}</td>
          <td>${details}</td>
        </tr>`;
      }).join('');
      const periodTotals = report.lines.reduce((total, line) => {
        const stats = report.periodStats.get(period.key)?.get(String(line.id));
        total.samples += stats.samples;
        total.pulls += stats.pulls;
        total.defects += stats.defects;
        total.acceptedPallets += stats.acceptedPallets;
        total.rejectedPallets += stats.rejectedPallets;
        total.pending += stats.pending;
        total.undecidedPallets += stats.undecidedPallets;
        return total;
      }, { samples: 0, pulls: 0, defects: 0, acceptedPallets: 0, rejectedPallets: 0, pending: 0, undecidedPallets: 0 });
      return `<section id="line-pull-period-${periodIndex}" class="line-pull-period border border-slate-200 rounded-xl overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-1 bg-slate-50 px-3 py-2 border-b border-slate-200">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="font-extrabold text-sm text-blue-800">${this.escape(period.label)}</h4>
            <span class="text-[10px] text-slate-600">عينات ${periodTotals.samples.toLocaleString('ar-EG')} · عيوب ${periodTotals.defects.toLocaleString('ar-EG')}</span>
          </div>
          <button type="button" class="export-image-control bg-indigo-700 hover:bg-indigo-800 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg" onclick="LineSampleSummaryModule.downloadImage('line-pull-period-${periodIndex}', 'ملخص_سحب_العينات_${this.escape(date)}_${this.escape(period.label).replace(/\\s+/g, '_')}')">
            <i class="fa-solid fa-image ml-1"></i>تنزيل صورة
          </button>
        </div>
        <div class="overflow-x-auto"><table class="custom-table text-xs min-w-full">
          <thead><tr><th>الخط</th><th>المنتج</th><th>محطة الفحص</th><th>المراقب</th><th>العينات</th><th>السحبات</th><th>حالة البالتة</th><th>حالة السحب</th><th>حالة الخط</th><th>سبب عدم السحب</th><th>المشاكل المسجلة</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="11" class="text-center text-slate-400">لا توجد خطوط مسجلة</td></tr>`}</tbody>
          <tfoot><tr class="bg-slate-50 font-extrabold"><td colspan="4">إجمالي الفترة</td><td class="text-center text-indigo-700">${periodTotals.samples.toLocaleString('ar-EG')}</td><td class="text-center">${periodTotals.pulls.toLocaleString('ar-EG')} سحبة</td><td>${this.formatPalletStatus(periodTotals)}</td><td colspan="3"></td><td class="text-red-700">العيوب: ${periodTotals.defects.toLocaleString('ar-EG')}</td></tr></tfoot>
        </table></div>
      </section>`;
    }).join('');

    container.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <div class="rounded-xl border border-slate-200 p-3"><span class="block text-[11px] text-slate-500">إجمالي السحبات</span><strong class="text-lg">${this.pulls.length.toLocaleString('ar-EG')}</strong></div>
        <div class="rounded-xl border border-slate-200 p-3"><span class="block text-[11px] text-slate-500">إجمالي العينات</span><strong class="text-lg text-indigo-700">${totalSamples.toLocaleString('ar-EG')}</strong></div>
        <div class="rounded-xl border border-slate-200 p-3"><span class="block text-[11px] text-slate-500">إجمالي المشاكل</span><strong class="text-lg text-red-700">${totalDefects.toLocaleString('ar-EG')}</strong></div>
        <div class="rounded-xl border border-red-200 bg-red-50 p-3"><span class="block text-[11px] text-red-700">حالة البالتة</span><strong class="text-lg text-red-800">${this.formatPalletStatus(lineTotals)}</strong></div>
        <div class="rounded-xl border border-slate-200 p-3"><span class="block text-[11px] text-slate-500">عدد الخطوط</span><strong class="text-lg">${report.lines.length.toLocaleString('ar-EG')}</strong></div>
      </div>
      <section id="line-pull-overview" class="line-pull-overview border border-slate-200 rounded-xl overflow-hidden mb-4">
        <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 border-b border-slate-200">
          <h4 class="font-extrabold text-sm">ملخص كل خط ومشاكله خلال اليوم</h4>
          <button type="button" class="export-image-control bg-indigo-700 hover:bg-indigo-800 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg" onclick="LineSampleSummaryModule.downloadImage('line-pull-overview', 'ملخص_مشاكل_الخطوط_${this.escape(date)}')">
            <i class="fa-solid fa-image ml-1"></i>تنزيل صورة
          </button>
        </div>
        <div class="overflow-x-auto"><table class="custom-table text-xs min-w-full">
          <thead><tr><th>الخط</th><th>المنتج</th><th>محطة الفحص</th><th>المراقب</th><th>السحبات</th><th>العينات</th><th>حالة البالتة</th><th>إجمالي العيوب</th><th>المشاكل المسجلة بدون تفصيل الساعات</th></tr></thead>
          <tbody>${lineRows || `<tr><td colspan="9" class="text-center text-slate-400 py-4">لا توجد خطوط ضمن القسم المحدد</td></tr>`}</tbody>
          <tfoot><tr class="bg-slate-50 font-extrabold"><td colspan="4">الإجمالي</td><td class="text-center">${lineTotals.pulls.toLocaleString('ar-EG')}</td><td class="text-center text-indigo-700">${lineTotals.samples.toLocaleString('ar-EG')}</td><td>${this.formatPalletStatus(lineTotals)}</td><td class="text-center text-red-700">${lineTotals.defects.toLocaleString('ar-EG')}</td><td></td></tr></tfoot>
        </table></div>
      </section>
      <div class="line-pull-period-grid grid grid-cols-1 gap-3">
        ${periodTables || '<p class="text-center text-slate-400 py-4">لا توجد فترات سحب مفعلة.</p>'}
      </div>
    `;
  },

  exportExcel() {
    const report = this.buildReport();
    const date = document.getElementById('line-sample-summary-date')?.value || '';
    const data = [];
    report.periods.forEach(period => {
      report.lines.forEach(line => {
        const stats = report.periodStats.get(period.key)?.get(String(line.id));
        data.push({
          'التاريخ': date,
          'فترة السحب': period.label,
          'الخط': line.name || `خط ${line.line_number}`,
          'المنتج': Array.from(stats.products).join('، ') || '—',
          'محطة الفحص': Array.from(stats.stations).join('، ') || '—',
          'المراقبون / العينات': Array.from(stats.inspectors.entries())
            .map(([name, samples]) => `${name} (${samples})`).join('، ') || '—',
          'عدد السحبات': stats.pulls,
          'عدد العينات': stats.samples,
          'حالة البالتة': this.formatPalletStatus(stats, false),
          'إجمالي العيوب': stats.defects,
          'حالة الخط': this.periodStatuses.has(`${period.slotId}:${line.id}`)
            ? this.periodStatuses.get(`${period.slotId}:${line.id}`).is_stopped ? 'متوقف' : 'يعمل'
            : 'غير محدد',
          'سبب عدم السحب': stats.pulls ? '' : this.periodStatuses.get(`${period.slotId}:${line.id}`)?.no_sample_reason || '',
          'المشاكل / العيوب': this.formatProblems(stats)
        });
      });
    });
    if (!data.length) return App.toast('لا توجد بيانات خطوط للتصدير', 'warning');
    ExportsManager.exportToExcel(data, 'ملخص_سحب_عينات_الخطوط');
  },

  toggleScreenshotMode() {
    const container = document.getElementById('line-sample-summary-print-container');
    const button = document.getElementById('line-sample-summary-screenshot-btn');
    if (!container) return;
    const enabled = container.classList.toggle('screenshot-mode');
    container.classList.toggle('line-pull-summary-screenshot', enabled);
    if (button) {
      button.innerHTML = enabled
        ? '<i class="fa-solid fa-compress ml-1"></i> إلغاء وضع الشاشة'
        : '<i class="fa-solid fa-camera ml-1"></i> وضع لقطة الشاشة (صفحة واحدة)';
    }
    App.toast(enabled ? 'تم تفعيل العرض المكثف لالتقاط الصفحة كاملة.' : 'تمت العودة إلى العرض العادي.', 'info');
  },

  printReport() {
    ExportsManager.printReport('line-sample-summary-print-container', 'ملخص الخطوط حسب سحب عينات الخطوط');
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
        { id: 'line_name', label: 'اسم الخط' },
        { id: 'pallet_number', label: 'رقم البالتة' },
        { id: 'product_name', label: 'الجهاز' },
        { id: 'quantity_on_pallet', label: 'الكمية' },
        { id: 'sample_size_required', label: 'عينة AQL المقررة' },
        { id: 'inspector_name', label: 'المراقب' }
      ],
      rejected_pallets: [
        { id: 'date', label: 'التاريخ' },
        { id: 'line_name', label: 'اسم الخط' },
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
            <td class="font-bold text-[#c8102e]">${p.line_name}</td>
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

// ============================================================================
// 13. HOURLY SAMPLES MODULE (استلام عينات بالساعة)
// ============================================================================
const HourlyModule = {
  currentSamples: [],
  currentDailyProd: [],
  currentSlots: [],

  async load() {
    const date = document.getElementById('hourly-filter-date')?.value || '';
    const lineId = document.getElementById('hourly-filter-line')?.value || '';
    const productId = document.getElementById('hourly-filter-product')?.value || '';
    const shiftId = document.getElementById('hourly-filter-shift')?.value || '';
    const dept = (App.currentDepartment && App.currentDepartment !== 'all') ? App.currentDepartment : '';

    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (lineId) params.append('line_id', lineId);
    if (productId) params.append('product_id', productId);
    if (shiftId) params.append('shift_id', shiftId);
    if (dept) params.append('department', dept);

    try {
      const [samplesRes, prodRes] = await Promise.all([
        App.apiGet(`/api/hourly-samples?${params.toString()}`),
        App.apiGet(`/api/daily-production?${params.toString()}`)
      ]);

      if (samplesRes.success) {
        this.currentSamples = samplesRes.data;
        this.renderSamples();
        this.updateKPIs();
      }
      if (prodRes.success) {
        this.currentDailyProd = prodRes.data;
        this.renderDailyProd();
      }
    } catch (err) {
      App.toast('تعذر تحميل بيانات عينات الساعة: ' + err.message, 'error');
    }
  },

  updateKPIs() {
    const s = this.currentSamples;
    const totalPulls = s.length;
    const totalSamples = s.reduce((sum, r) => sum + (r.sample_count || 0), 0);
    const totalDefects = s.reduce((sum, r) => sum + (r.defect_count || 0), 0);
    const rate = totalSamples > 0 ? ((totalDefects / totalSamples) * 100).toFixed(1) : '0.0';

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('hourly-kpi-pulls', totalPulls);
    set('hourly-kpi-samples', totalSamples);
    set('hourly-kpi-defects', totalDefects);
    set('hourly-kpi-rate', rate + '%');

    const badge = document.getElementById('hourly-count-badge');
    if (badge) badge.textContent = `${totalPulls} سحبة`;
  },

  renderSamples() {
    const tbody = document.getElementById('hourly-samples-tbody');
    if (!tbody) return;

    if (!this.currentSamples.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center py-8 text-slate-400">لا توجد سحبات مسجلة لهذا التاريخ / الفلتر</td></tr>`;
      this.renderInspectorHourlySummary();
      return;
    }

    tbody.innerHTML = this.currentSamples.map((s, index) => {
      const rate = s.sample_count > 0 ? ((s.defect_count / s.sample_count) * 100).toFixed(1) : '0.0';
      const decClass = s.decision === 'مقبول' ? 'badge-accepted' : 'badge-rejected';
      const startsNewHour = index > 0
        && String(s.slot_id) !== String(this.currentSamples[index - 1].slot_id);
      const defectsBreakdown = s.defects_breakdown || s.defects || [];
      const defBreakdown = defectsBreakdown.length > 0
        ? `<div class="flex flex-wrap gap-1">${defectsBreakdown.map(d => `<span class="reason-badge text-[10px]">${d.reason_name}: ${d.count}</span>`).join('')}</div>`
        : '<span class="text-slate-400 text-xs">لا توجد عيوب</span>';

      return `
        <tr class="${startsNewHour ? 'hourly-sample-hour-divider' : ''}">
          <td class="font-extrabold text-[#c8102e] whitespace-nowrap">${s.line_name || '—'}</td>
          <td class="font-bold text-slate-900">${s.product_name || '—'}</td>
          <td class="font-bold text-blue-700 text-xs whitespace-nowrap">${s.slot_name || '—'}<br><span class="text-[10px] text-slate-400">${s.start_time || ''}–${s.end_time || ''}</span></td>
          <td class="text-xs">${s.shift_name || '—'}</td>
          <td class="font-bold text-indigo-700 text-center">${s.sample_count || 0}</td>
          <td class="font-bold text-red-700 text-center">${s.defect_count || 0}</td>
          <td class="text-center"><span class="px-1.5 py-0.5 rounded text-[11px] font-bold ${parseFloat(rate) > 5 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}">${rate}%</span></td>
          <td><span class="px-2 py-0.5 rounded-full text-xs font-bold ${decClass}">${s.decision || '—'}</span></td>
          <td class="text-xs">${defBreakdown}</td>
          <td class="text-xs text-slate-700">${s.inspector_name || '—'}</td>
          <td class="text-center whitespace-nowrap">
            <button onclick="HourlyModule.openEditModal(${s.id})" class="text-blue-600 p-1 hover:text-blue-800" title="تعديل"><i class="fa-solid fa-pen text-xs"></i></button>
            <button onclick="HourlyModule.deleteSample(${s.id})" class="text-red-600 p-1 hover:text-red-800" title="حذف"><i class="fa-solid fa-trash text-xs"></i></button>
          </td>
        </tr>
      `;
    }).join('');
    this.renderInspectorHourlySummary();
  },

  renderInspectorHourlySummary() {
    const container = document.getElementById('hourly-inspector-summary');
    if (!container) return;

    if (!this.currentSamples.length) {
      container.innerHTML = '';
      return;
    }

    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
    const hours = new Map();
    this.currentSamples.forEach(sample => {
      const hourKey = sample.slot_id || `${sample.slot_name || 'غير محدد'}|${sample.start_time || ''}|${sample.end_time || ''}`;
      if (!hours.has(hourKey)) {
        hours.set(hourKey, {
          name: sample.slot_name || 'فترة غير محددة',
          start: sample.start_time || '',
          end: sample.end_time || '',
          inspectors: new Map()
        });
      }

      const hour = hours.get(hourKey);
      const inspectorName = sample.inspector_name || 'غير محدد';
      if (!hour.inspectors.has(inspectorName)) hour.inspectors.set(inspectorName, new Map());
      const products = hour.inspectors.get(inspectorName);
      const productName = sample.product_name || 'غير محدد';
      if (!products.has(productName)) {
        products.set(productName, { sampleCount: 0, defectCount: 0, problems: [] });
      }

      const product = products.get(productName);
      product.sampleCount += Number(sample.sample_count) || 0;
      product.defectCount += Number(sample.defect_count) || 0;
      const defects = sample.defects_breakdown || sample.defects || [];
      defects.forEach(defect => {
        const reason = defect.reason_name || 'عيب غير محدد';
        const count = Number(defect.count) || 0;
        const notes = defect.notes ? ` - ${defect.notes}` : '';
        product.problems.push(`${productName}: ${reason} (${count})${notes}`);
      });
    });

    container.innerHTML = Array.from(hours.values()).map(hour => {
      const inspectorRows = Array.from(hour.inspectors.entries()).map(([inspectorName, products]) => {
        const inspectorTotal = Array.from(products.values()).reduce((sum, product) => sum + product.sampleCount, 0);
        return Array.from(products.entries()).map(([productName, product]) => `
          <tr>
            <td class="font-bold text-slate-900">${escapeHtml(inspectorName)}</td>
            <td class="font-semibold">${escapeHtml(productName)}</td>
            <td class="text-center font-extrabold text-indigo-700">${product.sampleCount}</td>
            <td class="text-center font-bold text-indigo-950">${inspectorTotal}</td>
            <td class="text-center font-bold text-red-700">${product.defectCount}</td>
            <td class="text-xs">${product.problems.length
              ? product.problems.map(problem => `<div class="text-red-800">${escapeHtml(problem)}</div>`).join('')
              : '<span class="text-slate-400">لا توجد مشاكل مسجلة</span>'}</td>
          </tr>
        `).join('');
      }).join('');

      return `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-4 bg-indigo-50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-bold text-sm text-indigo-950">ملخص فحص المراقبين - ${escapeHtml(hour.name)}</h3>
            <span class="text-xs font-semibold text-indigo-800">${escapeHtml(hour.start)}${hour.end ? `–${escapeHtml(hour.end)}` : ''}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="custom-table text-sm">
              <thead><tr>
                <th>المراقب</th>
                <th>اسم المنتج</th>
                <th>عينات المنتج</th>
                <th>إجمالي عينات المراقب في الساعة</th>
                <th>العيوب</th>
                <th>المشاكل حسب المنتج</th>
              </tr></thead>
              <tbody>${inspectorRows}</tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  },

  renderDailyProd() {
    const box = document.getElementById('daily-prod-box');
    const tbody = document.getElementById('daily-prod-tbody');
    if (!tbody) return;

    if (!this.currentDailyProd.length) {
      if (box) box.classList.add('hidden');
      return;
    }

    if (box) box.classList.remove('hidden');

    tbody.innerHTML = this.currentDailyProd.map(d => {
      const hourlyDefects = this.currentSamples
        .filter(s => s.line_id === d.line_id && s.product_id === d.product_id)
        .reduce((sum, s) => sum + (s.defect_count || 0), 0);
      const hourlySamples = this.currentSamples
        .filter(s => s.line_id === d.line_id && s.product_id === d.product_id)
        .reduce((sum, s) => sum + (s.sample_count || 0), 0);
      const qualRate = d.total_produced_qty > 0
        ? (((d.total_produced_qty - hourlyDefects) / d.total_produced_qty) * 100).toFixed(1) + '%'
        : '—';

      return `
        <tr>
          <td class="font-extrabold text-[#c8102e] whitespace-nowrap">${d.line_name || '—'}</td>
          <td class="font-bold text-slate-900">${d.product_name || '—'}</td>
          <td>${d.shift_name || '—'}</td>
          <td class="font-black text-indigo-900 text-center">${Number(d.total_produced_qty).toLocaleString('ar-EG')} جهاز</td>
          <td class="text-center text-indigo-700">${hourlySamples}</td>
          <td class="text-center text-red-700">${hourlyDefects}</td>
          <td class="text-center"><span class="px-2 py-0.5 rounded font-bold text-xs bg-emerald-100 text-emerald-800">${qualRate}</span></td>
          <td class="text-xs text-slate-500">${d.entered_by_name || 'النظام'}</td>
        </tr>
      `;
    }).join('');
  },

  openAddModal(sampleId = null) {
    const modal = document.getElementById('modal-hourly-sample');
    const form = document.getElementById('hourly-sample-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('hourly-sample-id').value = '';
    document.getElementById('hourly-date').value = new Date().toISOString().slice(0, 10);

    // Populate hourly slot dropdown from metadata
    const slotSel = document.getElementById('hourly-slot');
    if (slotSel && App.metadata.hourlySlots) {
      slotSel.innerHTML = App.metadata.hourlySlots.map(s => `<option value="${s.id}">${s.slot_name} (${s.start_time}–${s.end_time})</option>`).join('');
    }

    // Populate lines, products, shifts, inspectors
    App.populateDropdowns();

    // Clear defect rows
    document.getElementById('hourly-defects-rows').innerHTML = '';

    modal.classList.remove('hidden');
    document.getElementById('modal-hourly-title').textContent = sampleId ? 'تعديل سحبة عينة بالساعة' : 'سجّل سحب عينة جديد بالساعة';
  },

  openEditModal(id) {
    this.openAddModal(id);
    // Load sample data for edit
    App.apiGet(`/api/hourly-samples/${id}`).then(res => {
      if (!res.success || !res.data) {
        throw new Error(res.error || 'تعذر تحميل بيانات سحبة العينة');
      }
      const s = res.data;
      document.getElementById('hourly-sample-id').value = s.id;
      document.getElementById('hourly-date').value = s.date;
      if (document.getElementById('hourly-slot')) document.getElementById('hourly-slot').value = s.slot_id;
      if (document.getElementById('hourly-line')) document.getElementById('hourly-line').value = s.line_id;
      if (document.getElementById('hourly-product')) document.getElementById('hourly-product').value = s.product_id;
      if (document.getElementById('hourly-shift')) document.getElementById('hourly-shift').value = s.shift_id;
      if (document.getElementById('hourly-inspector') && s.inspector_id) document.getElementById('hourly-inspector').value = s.inspector_id;
      document.getElementById('hourly-sample-qty').value = s.sample_count;
      document.getElementById('hourly-defects-qty').value = s.defect_count;
      document.getElementById('hourly-decision').value = s.decision || 'مقبول';
      if (document.getElementById('hourly-notes')) document.getElementById('hourly-notes').value = s.notes || '';

      // Load defect rows
      const container = document.getElementById('hourly-defects-rows');
      container.innerHTML = '';
      const defectsBreakdown = s.defects_breakdown || s.defects || [];
      defectsBreakdown.forEach(d => this.addDefectRow(d.reason_id, d.count));
    }).catch(err => App.toast(err.message, 'error'));
  },

  closeAddModal() {
    document.getElementById('modal-hourly-sample')?.classList.add('hidden');
  },

  handleLineChange(lineId) {
    if (!lineId) return;
    const line = App.metadata.lines.find(l => l.id === parseInt(lineId, 10));
    if (line && line.current_product_id) {
      const sel = document.getElementById('hourly-product');
      if (sel) sel.value = line.current_product_id;
    }
  },

  calculateDecision() {
    const samples = parseInt(document.getElementById('hourly-sample-qty')?.value || '0', 10);
    const defects = parseInt(document.getElementById('hourly-defects-qty')?.value || '0', 10);
    const decSel = document.getElementById('hourly-decision');
    if (!decSel) return;
    const rate = samples > 0 ? (defects / samples) * 100 : 0;
    decSel.value = rate > 5 ? 'مرفوض' : 'مقبول';
  },

  addDefectRow(reasonId = null, count = 1) {
    const container = document.getElementById('hourly-defects-rows');
    if (!container) return;

    const reasons = App.metadata.rejectionReasons || [];
    const reasonsHtml = reasons.map(r => `<option value="${r.id}" ${r.id == reasonId ? 'selected' : ''}>${r.name}</option>`).join('');
    const rowId = Date.now();

    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 hourly-defect-row';
    div.dataset.rowId = rowId;
    div.innerHTML = `
      <select class="flex-1 bg-white border border-red-200 rounded-xl px-2 py-1 text-xs font-bold hourly-defect-reason">
        <option value="">اختر سبب العيب...</option>
        ${reasonsHtml}
      </select>
      <input type="number" min="1" value="${count}" placeholder="العدد" class="w-16 bg-white border border-red-200 rounded-xl px-2 py-1 text-xs font-bold text-center hourly-defect-count">
      <button type="button" onclick="this.parentElement.remove()" class="text-red-600 hover:text-red-800 p-1"><i class="fa-solid fa-times"></i></button>
    `;
    container.appendChild(div);
  },

  async saveSample() {
    const id = document.getElementById('hourly-sample-id').value;
    const lineId = document.getElementById('hourly-line').value;
    const selectedLine = App.metadata.lines.find(line => line.id === parseInt(lineId, 10));
    const defectRows = document.querySelectorAll('.hourly-defect-row');
    const defects = Array.from(defectRows).map(row => ({
      reason_id: row.querySelector('.hourly-defect-reason')?.value,
      count: parseInt(row.querySelector('.hourly-defect-count')?.value || '1', 10)
    })).filter(d => d.reason_id);

    const payload = {
      id: id || null,
      date: document.getElementById('hourly-date').value,
      slot_id: document.getElementById('hourly-slot').value,
      line_id: lineId,
      product_id: document.getElementById('hourly-product').value,
      shift_id: document.getElementById('hourly-shift').value,
      inspector_id: document.getElementById('hourly-inspector')?.value || null,
      sample_count: parseInt(document.getElementById('hourly-sample-qty').value || '1', 10),
      defect_count: parseInt(document.getElementById('hourly-defects-qty').value || '0', 10),
      decision: document.getElementById('hourly-decision')?.value || 'مقبول',
      notes: document.getElementById('hourly-notes')?.value || '',
      defects,
      department: selectedLine?.department || (App.currentDepartment !== 'all' ? App.currentDepartment : 'home')
    };

    try {
      const res = await App.apiPost('/api/hourly-samples', payload);
      if (res.success) {
        App.toast(res.message || 'تم حفظ سحبة العينة بنجاح', 'success');
        this.closeAddModal();
        await this.load();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  deleteSample(id) {
    App.confirm('هل أنت متأكد من حذف هذه السحبة؟', async () => {
      try {
        const res = await App.apiDelete(`/api/hourly-samples/${id}`);
        if (res.success) {
          App.toast(res.message || 'تم حذف السحبة', 'success');
          await this.load();
        }
      } catch (err) { App.toast(err.message, 'error'); }
    });
  },

  openDailyProdModal() {
    const modal = document.getElementById('modal-daily-production');
    const form = document.getElementById('daily-production-form');
    if (!modal || !form) return;

    form.reset();
    const today = new Date().toISOString().slice(0, 10);
    if (document.getElementById('daily-prod-date')) document.getElementById('daily-prod-date').value = today;

    App.populateDropdowns();
    modal.classList.remove('hidden');
  },

  closeDailyProdModal() {
    document.getElementById('modal-daily-production')?.classList.add('hidden');
  },

  handleDailyProdLineChange(lineId) {
    if (!lineId) return;
    const line = App.metadata.lines.find(l => l.id === parseInt(lineId, 10));
    if (line && line.current_product_id) {
      const sel = document.getElementById('daily-prod-product');
      if (sel) sel.value = line.current_product_id;
    }
  },

  async saveDailyProduction() {
    const payload = {
      date: document.getElementById('daily-prod-date').value,
      line_id: document.getElementById('daily-prod-line').value,
      product_id: document.getElementById('daily-prod-product').value,
      shift_id: document.getElementById('daily-prod-shift').value,
      total_produced_qty: parseInt(document.getElementById('daily-prod-qty').value || '0', 10),
      notes: document.getElementById('daily-prod-notes')?.value || '',
      department: App.currentDepartment !== 'all' ? App.currentDepartment : 'home'
    };

    if (!payload.date || !payload.line_id || !payload.product_id) {
      return App.toast('يرجى تعبئة الحقول المطلوبة (التاريخ والخط والمنتج)', 'warning');
    }

    try {
      const res = await App.apiPost('/api/daily-production', payload);
      if (res.success) {
        App.toast('تم حفظ الإنتاج الفعلي بنجاح', 'success');
        this.closeDailyProdModal();
        await this.load();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  async openSlotsModal() {
    const modal = document.getElementById('modal-hourly-slots');
    if (!modal) return;

    await this.loadSlots();
    modal.classList.remove('hidden');
  },

  closeSlotsModal() {
    document.getElementById('modal-hourly-slots')?.classList.add('hidden');
  },

  async loadSlots() {
    try {
      const res = await App.apiGet('/api/hourly-slots');
      if (res.success) {
        this.currentSlots = res.data;
        // Update App metadata so modal dropdowns refresh
        App.metadata.hourlySlots = res.data;
        this.renderSlots();
      }
    } catch (err) { App.toast('تعذر تحميل ساعات السحب', 'error'); }
  },

  renderSlots() {
    const tbody = document.getElementById('slots-tbody');
    if (!tbody) return;

    if (!this.currentSlots.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-slate-400">لا توجد فترات مسجلة</td></tr>`;
      return;
    }

    tbody.innerHTML = this.currentSlots.map(s => `
      <tr>
        <td class="text-center font-bold">${s.display_order}</td>
        <td class="font-bold">${s.slot_name}</td>
        <td class="font-bold text-blue-700">${s.start_time}</td>
        <td class="font-bold text-indigo-700">${s.end_time}</td>
        <td class="text-center">
          <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${s.is_active ? 'badge-accepted' : 'badge-rejected'}">
            ${s.is_active ? 'نشطة' : 'معطلة'}
          </span>
        </td>
        <td class="text-center">
          <button onclick="HourlyModule.toggleSlot(${s.id}, ${s.is_active ? 0 : 1})" class="text-amber-600 p-1 hover:text-amber-800 text-xs" title="${s.is_active ? 'تعطيل' : 'تفعيل'}">
            <i class="fa-solid fa-${s.is_active ? 'eye-slash' : 'eye'}"></i>
          </button>
          <button onclick="HourlyModule.deleteSlot(${s.id})" class="text-red-600 p-1 hover:text-red-800 text-xs" title="حذف">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  },

  async saveSlot() {
    const payload = {
      slot_name: document.getElementById('slot-name')?.value,
      start_time: document.getElementById('slot-start')?.value,
      end_time: document.getElementById('slot-end')?.value,
      display_order: parseInt(document.getElementById('slot-order')?.value || '9', 10),
      department: 'all',
      is_active: 1
    };

    if (!payload.slot_name || !payload.start_time || !payload.end_time) {
      return App.toast('يرجى تعبئة جميع حقول الفترة', 'warning');
    }

    try {
      const res = await App.apiPost('/api/hourly-slots', payload);
      if (res.success) {
        App.toast('تمت إضافة الفترة الزمنية بنجاح', 'success');
        if (document.getElementById('slot-name')) document.getElementById('slot-name').value = '';
        await this.loadSlots();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  async toggleSlot(id, newActive) {
    try {
      const slot = this.currentSlots.find(s => s.id === id);
      if (!slot) return;
      const res = await App.apiPut(`/api/hourly-slots/${id}`, { ...slot, is_active: newActive });
      if (res.success) {
        App.toast(newActive ? 'تم تفعيل الفترة' : 'تم تعطيل الفترة', 'success');
        await this.loadSlots();
      }
    } catch (err) { App.toast(err.message, 'error'); }
  },

  async deleteSlot(id) {
    App.confirm('هل أنت متأكد من حذف هذه الفترة الزمنية؟', async () => {
      try {
        const res = await App.apiDelete(`/api/hourly-slots/${id}`);
        if (res.success) {
          App.toast('تم حذف الفترة', 'success');
          await this.loadSlots();
        }
      } catch (err) { App.toast(err.message, 'error'); }
    });
  },

  exportExcel() {
    if (!this.currentSamples.length) return App.toast('لا توجد بيانات للتصدير', 'warning');
    const data = this.currentSamples.map(s => ({
      'اسم الخط': s.line_name || '—',
      'اسم المنتج': s.product_name || '—',
      'فترة السحب': s.slot_name || '—',
      'من': s.start_time || '—',
      'إلى': s.end_time || '—',
      'التاريخ': s.date,
      'الوردية': s.shift_name || '—',
      'حجم العينة': s.sample_count || 0,
      'العيوب المكتشفة': s.defect_count || 0,
      'نسبة العيوب %': s.sample_count > 0 ? ((s.defect_count / s.sample_count) * 100).toFixed(1) + '%' : '0%',
      'القرار': s.decision || '—',
      'المراقب': s.inspector_name || '—',
      'المشاكل حسب المنتج': (s.defects_breakdown || s.defects || []).map(defect =>
        `${s.product_name || 'منتج غير محدد'}: ${defect.reason_name || 'عيب غير محدد'} (${defect.count || 0})`
      ).join('، ') || (s.defect_count > 0 ? `${s.product_name || 'منتج غير محدد'}: ${s.defect_count} عيب مسجل بدون تفصيل` : 'لا توجد مشاكل'),
      'ملاحظات العيوب': (s.defects_breakdown || s.defects || []).map(defect => defect.notes).filter(Boolean).join('، '),
      'ملاحظات': s.notes || ''
    }));
    ExportsManager.exportToExcel(data, 'سحبات_عينات_الساعة_المغربي');
  }
};

// ============================================================================
// 14. FLOWCHART & DEEP ANALYTICS MODULE
// ============================================================================
const FlowchartModule = {
  charts: {},
  currentData: null,

  async load() {
    const from = document.getElementById('flow-filter-from')?.value || '';
    const to = document.getElementById('flow-filter-to')?.value || '';
    const lineId = document.getElementById('flow-filter-line')?.value || '';
    const productId = document.getElementById('flow-filter-product')?.value || '';
    const dept = document.getElementById('flow-filter-dept')?.value || 'all';

    const params = new URLSearchParams();
    if (from) params.append('date_from', from);
    if (to) params.append('date_to', to);
    if (lineId) params.append('line_id', lineId);
    if (productId) params.append('product_id', productId);
    if (dept && dept !== 'all') params.append('department', dept);

    try {
      const res = await App.apiGet(`/api/flowchart-analytics?${params.toString()}`);
      if (res.success) {
        this.currentData = res.data;
        this.renderSpotlights();
        this.renderFlowchartNodes();
        this.renderCharts();
        this.renderRankingsTable();
      }
    } catch (err) {
      App.toast('تعذر تحميل بيانات التحليل: ' + err.message, 'error');
    }
  },

  handlePresetChange(preset) {
    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    let from = fmt(today), to = fmt(today);

    if (preset === 'yesterday') {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      from = to = fmt(y);
    } else if (preset === 'last7') {
      const d7 = new Date(today); d7.setDate(d7.getDate() - 6);
      from = fmt(d7);
    } else if (preset === 'this_month') {
      from = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (preset === 'all') {
      from = ''; to = '';
    }

    const fromEl = document.getElementById('flow-filter-from');
    const toEl = document.getElementById('flow-filter-to');
    if (fromEl) fromEl.value = from;
    if (toEl) toEl.value = to;
    this.load();
  },

  renderSpotlights() {
    const d = this.currentData;
    if (!d) return;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    if (d.best_line) {
      set('best-line-name', d.best_line.line_name);
      set('best-line-product', `المنتج: ${d.best_line.product_name || '—'}`);
      set('best-line-defect-rate', d.best_line.defect_rate + '%');
      set('best-line-accept-rate', d.best_line.accept_rate + '%');
      set('best-line-acc-pallets', d.best_line.accepted_pallets);
      set('best-line-supervisor', d.best_line.supervisor_name || '—');
    }

    if (d.worst_line) {
      set('worst-line-name', d.worst_line.line_name);
      set('worst-line-product', `المنتج: ${d.worst_line.product_name || '—'}`);
      set('worst-line-defect-rate', d.worst_line.defect_rate + '%');
      set('worst-line-defects-count', d.worst_line.total_defects);
      set('worst-line-rej-pallets', d.worst_line.rejected_pallets);
      set('worst-line-supervisor', d.worst_line.supervisor_name || '—');
      set('worst-line-top-defect', d.worst_line.top_defect || '—');
    }
  },

  renderFlowchartNodes() {
    const d = this.currentData;
    if (!d || !d.pipeline) return;

    const p = d.pipeline;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('flow-node1-units', Number(p.total_produced || 0).toLocaleString('ar-EG'));
    set('flow-node1-desc', `${p.total_pallets || 0} بالتة مستلمة`);
    set('flow-node2-samples', Number((p.total_inspected_samples || 0) + (p.hourly_samples || 0)).toLocaleString('ar-EG'));
    set('flow-node2-desc', `AQL + سحبات الساعة`);
    set('flow-node3-rate', (p.defect_rate || 0) + '%');
    set('flow-node3-desc', `${p.total_defects || 0} عيب مكتشف`);
    set('flow-node4-acc', Number(p.accepted_qty || 0).toLocaleString('ar-EG'));
    set('flow-node4-desc', `${p.accepted_pallets || 0} بالتة مقبولة`);
  },

  renderCharts() {
    const d = this.currentData;
    if (!d) return;

    // Lines Comparison Bar Chart
    const linesCtx = document.getElementById('chart-flow-lines');
    if (linesCtx && d.line_rankings) {
      if (this.charts.lines) { this.charts.lines.destroy(); }
      const sorted = [...d.line_rankings].sort((a, b) => (a.defect_rate || 0) - (b.defect_rate || 0));
      this.charts.lines = new Chart(linesCtx, {
        type: 'bar',
        data: {
          labels: sorted.map(l => l.line_name),
          datasets: [{
            label: 'معدل العيوب %',
            data: sorted.map(l => l.defect_rate || 0),
            backgroundColor: sorted.map(l => l.defect_rate > 5 ? '#ef4444' : l.defect_rate > 2 ? '#f97316' : '#10b981'),
            borderRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => v + '%' } },
            x: { ticks: { font: { family: 'Cairo', size: 10 } } }
          }
        }
      });
    }

    // Pareto Defects Chart
    const paretoCtx = document.getElementById('chart-flow-pareto');
    if (paretoCtx && d.pareto) {
      if (this.charts.pareto) { this.charts.pareto.destroy(); }
      const top = d.pareto.slice(0, 8);
      this.charts.pareto = new Chart(paretoCtx, {
        type: 'bar',
        data: {
          labels: top.map(r => r.reason_name || r.name),
          datasets: [{
            label: 'عدد التكرارات',
            data: top.map(r => r.total_count || r.count),
            backgroundColor: ['#c8102e', '#f97316', '#eab308', '#06b6d4', '#8b5cf6', '#64748b', '#ec4899', '#14b8a6'],
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } }
        }
      });
    }
  },

  renderRankingsTable() {
    const d = this.currentData;
    const tbody = document.getElementById('flow-rankings-tbody');
    if (!tbody || !d || !d.line_rankings) return;

    const sorted = [...d.line_rankings].sort((a, b) => (a.defect_rate || 0) - (b.defect_rate || 0));

    tbody.innerHTML = sorted.map((l, idx) => {
      const rank = idx + 1;
      let rankBadge = `<span class="font-black text-slate-600">${rank}</span>`;
      if (rank === 1) rankBadge = `<span class="font-black text-emerald-600">🥇 ${rank}</span>`;
      else if (rank === 2) rankBadge = `<span class="font-black text-blue-500">🥈 ${rank}</span>`;
      else if (rank === 3) rankBadge = `<span class="font-black text-amber-500">🥉 ${rank}</span>`;
      else if (rank === sorted.length) rankBadge = `<span class="font-black text-red-600">⚠️ ${rank}</span>`;

      const defClass = l.defect_rate > 5 ? 'text-red-700 font-black' : l.defect_rate > 2 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold';
      const rating = l.defect_rate <= 1 ? '🌟 ممتاز' : l.defect_rate <= 3 ? '✅ جيد' : l.defect_rate <= 5 ? '⚠️ متوسط' : '🔴 ضعيف';

      return `
        <tr>
          <td class="text-center">${rankBadge}</td>
          <td class="font-extrabold text-[#c8102e] whitespace-nowrap">${l.line_name}</td>
          <td class="font-bold text-slate-900">${l.product_name || '—'}</td>
          <td class="text-xs">${l.supervisor_name || '—'}</td>
          <td class="font-bold text-center">${Number(l.total_produced || 0).toLocaleString('ar-EG')}</td>
          <td class="font-bold text-center text-indigo-700">${l.total_inspected || 0}</td>
          <td class="font-bold text-center text-red-600">${l.total_defects || 0}</td>
          <td class="text-center"><span class="${defClass} px-2 py-0.5 rounded text-xs">${l.defect_rate || 0}%</span></td>
          <td class="font-bold text-center text-emerald-700">${l.accept_rate || 0}%</td>
          <td class="text-xs text-slate-600">${l.top_defect || '—'}</td>
          <td class="text-center font-bold text-xs">${rating}</td>
        </tr>
      `;
    }).join('');
  },

  exportExcel() {
    const d = this.currentData;
    if (!d || !d.line_rankings || !d.line_rankings.length) {
      return App.toast('لا توجد بيانات للتصدير', 'warning');
    }
    const sorted = [...d.line_rankings].sort((a, b) => (a.defect_rate || 0) - (b.defect_rate || 0));
    const data = sorted.map((l, idx) => ({
      'الرتبة': idx + 1,
      'اسم الخط': l.line_name,
      'اسم المنتج': l.product_name || '—',
      'مشرف الخط': l.supervisor_name || '—',
      'إجمالي الإنتاج': l.total_produced || 0,
      'العينات المفحوصة': l.total_inspected || 0,
      'العيوب المكتشفة': l.total_defects || 0,
      'معدل العيوب %': (l.defect_rate || 0) + '%',
      'نسبة القبول %': (l.accept_rate || 0) + '%',
      'أكثر عيب تكرارًا': l.top_defect || '—'
    }));
    ExportsManager.exportToExcel(data, 'تحليل_جودة_خطوط_المغربي_الشامل');
  }
};

const LineSamplesModule = {
  stations: [],
  slots: [],
  pulls: [],
  dailyPulls: [],
  currentPullId: null,
  currentEditPullId: null,

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  },

  populateOptions() {
    const dept = App.currentDepartment;
    const lines = (App.metadata.lines || []).filter(line => !dept || dept === 'all' || !line.department || line.department === dept);
    const inspectors = (App.metadata.inspectors || []).filter(inspector => inspector.is_active !== 0);

    const lineOptions = lines.map(line => `<option value="${line.id}">${this.escape(line.name)}</option>`).join('');
    const inspectorOptions = inspectors.map(inspector => `<option value="${inspector.id}">${this.escape(inspector.name)}</option>`).join('');
    const lineSelect = document.getElementById('line-sample-line');
    const filterLineSelect = document.getElementById('line-samples-filter-line');
    const productSelect = document.getElementById('line-sample-product');
    const inspectorSelect = document.getElementById('line-sample-inspector');
    const selectedLine = lineSelect?.value || '';
    const selectedFilterLine = filterLineSelect?.value || '';
    const selectedInspector = inspectorSelect?.value || '';
    if (lineSelect) lineSelect.innerHTML = '<option value="">اختر خط الإنتاج...</option>' + lineOptions;
    if (filterLineSelect) filterLineSelect.innerHTML = '<option value="">كل الخطوط</option>' + lineOptions;
    if (lineSelect && lines.some(line => String(line.id) === selectedLine)) lineSelect.value = selectedLine;
    if (filterLineSelect && lines.some(line => String(line.id) === selectedFilterLine)) filterLineSelect.value = selectedFilterLine;
    if (productSelect) productSelect.innerHTML = '<option value="">اختر المنتج...</option>';
    this.populateProductOptions(dept);
    if (inspectorSelect) {
      inspectorSelect.innerHTML = '<option value="">اختر المراقب...</option>' + inspectorOptions;
      if (inspectors.some(inspector => String(inspector.id) === selectedInspector)) inspectorSelect.value = selectedInspector;
    }
    this.populateAdditionalInspectorOptions('line-sample');
    this.renderSlotsSelect();
  },

  populateAdditionalInspectorOptions(prefix) {
    const primarySelect = document.getElementById(`${prefix}-inspector`);
    const additionalSelect = document.getElementById(`${prefix}-additional-inspector`);
    if (!primarySelect || !additionalSelect) return;
    const primaryId = primarySelect.value;
    const selectedId = additionalSelect.value;
    const inspectors = (App.metadata.inspectors || []).filter(inspector =>
      inspector.is_active !== 0 && String(inspector.id) !== String(primaryId)
    );
    additionalSelect.innerHTML = '<option value="">اختر المراقب الإضافي...</option>' + inspectors
      .map(inspector => `<option value="${inspector.id}">${this.escape(inspector.name)}</option>`).join('');
    if (inspectors.some(inspector => String(inspector.id) === selectedId)) additionalSelect.value = selectedId;
    else additionalSelect.value = '';
    this.updatePrimarySampleCount(prefix);
  },

  toggleAdditionalInspector(prefix) {
    const enabled = document.getElementById(`${prefix}-has-additional-inspector`);
    const fields = document.getElementById(`${prefix}-additional-inspector-fields`);
    const select = document.getElementById(`${prefix}-additional-inspector`);
    const quantity = document.getElementById(`${prefix}-additional-quantity`);
    if (!enabled || !fields || !select || !quantity) return;
    fields.classList.toggle('hidden', !enabled.checked);
    select.required = enabled.checked;
    quantity.required = enabled.checked;
    if (!enabled.checked) {
      select.value = '';
      quantity.value = '';
    }
    this.updatePrimarySampleCount(prefix);
  },

  updatePrimarySampleCount(prefix) {
    const total = Number(document.getElementById(`${prefix}-quantity`)?.value) || 0;
    const additional = Number(document.getElementById(`${prefix}-additional-quantity`)?.value) || 0;
    const output = document.getElementById(`${prefix}-primary-sample-count`);
    if (output) output.textContent = String(Math.max(total - additional, 0));
  },

  populateProductOptions(department, selectId = 'line-sample-product') {
    const productSelect = document.getElementById(selectId);
    if (!productSelect) return;
    const products = (App.metadata.products || []).filter(product =>
      !department || department === 'all' || !product.department || product.department === department
    );
    productSelect.innerHTML = '<option value="">اختر المنتج...</option>' + products
      .map(product => `<option value="${product.id}">${this.escape(product.name)} (${this.escape(product.code || '')})</option>`).join('');
  },

  handleLineChange(lineId) {
    const line = (App.metadata.lines || []).find(item => Number(item.id) === Number(lineId));
    const productSelect = document.getElementById('line-sample-product');
    this.populateProductOptions(line?.department || App.currentDepartment);
    if (line?.current_product_id && productSelect) productSelect.value = String(line.current_product_id);
  },

  async load() {
    const dateInput = document.getElementById('line-samples-filter-date');
    const formDate = document.getElementById('line-sample-date');
    const summaryDate = document.getElementById('line-samples-summary-date');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (dateInput && !dateInput.value) dateInput.value = today;
    if (formDate && !formDate.value) formDate.value = today;
    if (summaryDate && !summaryDate.value) summaryDate.value = today;
    this.populateOptions();

    const params = new URLSearchParams();
    if (dateInput?.value) params.set('date', dateInput.value);
    const slotId = document.getElementById('line-samples-filter-slot')?.value;
    const lineId = document.getElementById('line-samples-filter-line')?.value;
    const status = document.getElementById('line-samples-filter-status')?.value;
    if (slotId) params.set('slot_id', slotId);
    if (lineId) params.set('line_id', lineId);
    if (status) params.set('status', status);
    const department = App.currentDepartment && App.currentDepartment !== 'all' ? App.currentDepartment : '';
    if (department) params.set('department', department);
    const summaryParams = new URLSearchParams();
    if (summaryDate?.value) summaryParams.set('date', summaryDate.value);
    if (department) summaryParams.set('department', department);

    try {
      const [pullsResponse, stationsResponse, slotsResponse, summaryResponse] = await Promise.all([
        App.apiGet(`/api/line-sample-pulls?${params.toString()}`),
        App.apiGet('/api/inspection-stations'),
        App.apiGet('/api/line-sample-slots'),
        App.apiGet(`/api/line-sample-pulls?${summaryParams.toString()}`)
      ]);
      this.pulls = pullsResponse.data || [];
      this.stations = stationsResponse.data || [];
      this.slots = slotsResponse.data || [];
      this.dailyPulls = summaryResponse.data || [];
      this.renderStationsSelect();
      this.renderSlotsSelect();
      this.renderPulls();
      this.renderDailySummary();
    } catch (error) {
      App.toast(`تعذر تحميل سحبات الخطوط: ${error.message}`, 'error');
    }
  },

  renderSlotsSelect() {
    const fill = (id, placeholder) => {
      const select = document.getElementById(id);
      if (!select) return;
      const selected = select.value;
      select.innerHTML = `<option value="">${placeholder}</option>` + this.slots
        .map(slot => `<option value="${slot.id}">${this.escape(slot.slot_name)}</option>`).join('');
      if (this.slots.some(slot => String(slot.id) === selected)) select.value = selected;
    };
    fill('line-sample-slot', 'اختر فترة السحب...');
    fill('line-samples-filter-slot', 'كل الفترات');
  },

  renderStationsSelect() {
    const select = document.getElementById('line-sample-station');
    if (!select) return;
    const selected = select.value;
    select.innerHTML = '<option value="">اختر محطة الفحص...</option>' + this.stations
      .map(station => {
        const inspector = station.inspector_name ? ` — ${this.escape(station.inspector_name)}` : '';
        return `<option value="${station.id}">${this.escape(station.name)}${inspector}</option>`;
      }).join('');
    if (this.stations.some(station => String(station.id) === selected)) select.value = selected;
    this.handleStationChange(select.value);
  },

  handleStationChange(stationId) {
    const station = this.stations.find(item => String(item.id) === String(stationId));
    const inspectorSelect = document.getElementById('line-sample-inspector');
    if (!inspectorSelect) return;
    if (station?.default_inspector_id) {
      inspectorSelect.value = String(station.default_inspector_id);
      inspectorSelect.disabled = true;
    } else {
      inspectorSelect.value = '';
      inspectorSelect.disabled = false;
    }
    this.populateAdditionalInspectorOptions('line-sample');
  },

  renderStationInspectorOptions(select, selectedId = '') {
    if (!select) return;
    const inspectors = (App.metadata.inspectors || []).filter(inspector => inspector.is_active !== 0);
    select.innerHTML = '<option value="">اختر المراقب المسؤول...</option>' + inspectors
      .map(inspector => `<option value="${inspector.id}">${this.escape(inspector.name)}</option>`).join('');
    if (inspectors.some(inspector => String(inspector.id) === String(selectedId))) {
      select.value = String(selectedId);
    }
  },

  renderPulls() {
    const tbody = document.getElementById('line-samples-tbody');
    if (!tbody) return;
    if (!this.pulls.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-slate-400">لا توجد سحبات مسجلة لهذا التاريخ / الفلتر</td></tr>';
      return;
    }
    tbody.innerHTML = this.pulls.map((pull, index) => {
      const previousPull = this.pulls[index - 1];
      const startsNewSlot = index > 0 && (
        (pull.slot_id && previousPull.slot_id && String(pull.slot_id) !== String(previousPull.slot_id))
        || (!pull.slot_id || !previousPull.slot_id)
          && `${pull.start_time || ''}-${pull.end_time || ''}` !== `${previousPull.start_time || ''}-${previousPull.end_time || ''}`
      );
      const status = pull.status === 'completed'
        ? Number(pull.pallet_rejected) === 1
          ? '<span class="badge-rejected px-2 py-1 rounded-full font-bold">تم الفحص - البالتة مرفوضة</span>'
          : '<span class="badge-status-completed px-2 py-1 rounded-full">تم الفحص</span>'
        : '<span class="bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-bold">بانتظار الفحص</span>';
      const breakdown = pull.defects?.length
        ? pull.defects.map(defect => `<span class="reason-badge text-[10px]">${this.escape(defect.reason_name)}: ${defect.count}</span>`).join(' ')
        : '<span class="text-slate-400">لا توجد عيوب</span>';
      const action = `<div class="flex flex-wrap gap-1.5">
        ${pull.status === 'pending' ? `<button type="button" onclick="LineSamplesModule.openDefectsModal(${pull.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap">إنهاء الفحص</button>` : ''}
        <button type="button" onclick="LineSamplesModule.openEditModal(${pull.id})" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap"><i class="fa-solid fa-pen ml-1"></i>تعديل</button>
        <button type="button" onclick="LineSamplesModule.deletePull(${pull.id})" class="bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap"><i class="fa-solid fa-trash ml-1"></i>حذف</button>
      </div>`;
      return `<tr class="${startsNewSlot ? 'line-sample-slot-divider' : ''}">
        <td class="whitespace-nowrap">${this.escape(pull.date)}<br><span class="text-blue-700 font-bold">${this.escape(pull.slot_name || `${pull.start_time}–${pull.end_time}`)}</span></td>
        <td class="font-bold">${this.escape(pull.line_name || `خط ${pull.line_number}`)}</td>
        <td>${this.escape(pull.product_name)}</td>
        <td>${this.escape(pull.station_name)}</td>
        <td>
          <span class="font-semibold">${this.escape(pull.inspector_name)} (${(Number(pull.sample_count) - (Number(pull.additional_sample_count) || 0)).toLocaleString('ar-EG')} عينة)</span>
          ${pull.additional_inspector_name ? `<br><span class="text-blue-700">${this.escape(pull.additional_inspector_name)} (${Number(pull.additional_sample_count).toLocaleString('ar-EG')} عينة)</span>` : ''}
        </td>
        <td class="text-center font-bold">${Number(pull.sample_count).toLocaleString('ar-EG')}</td>
        <td>${status}</td>
        <td><div class="flex flex-wrap gap-1">${breakdown}</div></td>
        <td>${action}</td>
      </tr>`;
    }).join('');
  },

  async loadDailySummary() {
    const date = document.getElementById('line-samples-summary-date')?.value;
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (App.currentDepartment && App.currentDepartment !== 'all') params.set('department', App.currentDepartment);
    try {
      const response = await App.apiGet(`/api/line-sample-pulls?${params.toString()}`);
      this.dailyPulls = response.data || [];
      this.renderDailySummary();
    } catch (error) {
      App.toast(`تعذر تحميل إجماليات سحب العينات: ${error.message}`, 'error');
    }
  },

  renderDailySummary() {
    const container = document.getElementById('line-samples-daily-summary');
    if (!container) return;
    const formatPalletStatus = stats => {
      const parts = [];
      if (stats.acceptedPallets) parts.push(`مقبولة${stats.acceptedPallets > 1 ? ` (${stats.acceptedPallets.toLocaleString('ar-EG')})` : ''}`);
      if (stats.rejectedPallets) parts.push(`مرفوضة${stats.rejectedPallets > 1 ? ` (${stats.rejectedPallets.toLocaleString('ar-EG')})` : ''}`);
      if (stats.pendingPallets) parts.push(`بانتظار الفحص${stats.pendingPallets > 1 ? ` (${stats.pendingPallets.toLocaleString('ar-EG')})` : ''}`);
      if (stats.undecidedPallets) parts.push(`غير محددة${stats.undecidedPallets > 1 ? ` (${stats.undecidedPallets.toLocaleString('ar-EG')})` : ''}`);
      return parts.join(' / ') || '—';
    };
    const palletStatusForPull = pull => pull.status !== 'completed'
      ? 'pendingPallets'
      : Number(pull.pallet_rejected) === 1
        ? 'rejectedPallets'
        : Number(pull.pallet_rejected) === 0
          ? 'acceptedPallets'
          : 'undecidedPallets';
    const hourlyGroups = new Map();
    this.dailyPulls.forEach(pull => {
      const startTime = pull.start_time || '';
      const endTime = pull.end_time || '';
      const key = `${startTime}-${endTime}`;
      const hour = hourlyGroups.get(key) || {
        startTime,
        endTime,
        label: pull.slot_name || `${startTime}–${endTime}`,
        pulls: 0,
        samples: 0,
        defects: 0,
        acceptedPallets: 0,
        rejectedPallets: 0,
        pendingPallets: 0,
        undecidedPallets: 0,
        inspectors: new Map()
      };
      hour.pulls += 1;
      hour.samples += Number(pull.sample_count) || 0;
      hour.defects += Number(pull.total_defect_count) || 0;
      hour[palletStatusForPull(pull)] += 1;

      const totalSamples = Number(pull.sample_count) || 0;
      const extraSamples = Number(pull.additional_sample_count) || 0;
      const assignments = [
        { name: pull.inspector_name || 'غير محدد', samples: totalSamples - extraSamples, isPrimary: true },
        ...(pull.additional_inspector_name && extraSamples > 0
          ? [{ name: pull.additional_inspector_name, samples: extraSamples, isPrimary: false }]
          : [])
      ].filter(assignment => assignment.samples > 0);
      assignments.forEach(assignment => {
        const inspector = hour.inspectors.get(assignment.name) || {
          name: assignment.name,
          samples: 0,
          defects: 0,
          acceptedPallets: 0,
          rejectedPallets: 0,
          pendingPallets: 0,
          undecidedPallets: 0,
          lines: new Set(),
          stations: new Set(),
          defectReasons: new Map()
        };
        inspector.samples += assignment.samples;
        if (assignment.isPrimary) {
          inspector.defects += Number(pull.total_defect_count) || 0;
          inspector[palletStatusForPull(pull)] += 1;
          (pull.defects || []).forEach(defect => {
            const reason = defect.reason_name || 'عيب غير محدد';
            inspector.defectReasons.set(reason, (inspector.defectReasons.get(reason) || 0) + (Number(defect.count) || 0));
          });
        }
        if (pull.line_name) inspector.lines.add(pull.line_name);
        if (pull.station_name) inspector.stations.add(pull.station_name);
        hour.inspectors.set(assignment.name, inspector);
      });
      hourlyGroups.set(key, hour);
    });
    const hourlyRows = Array.from(hourlyGroups.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const hourlySummary = `<section class="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100">
        <h3 class="font-extrabold text-sm text-slate-800">تفصيل كل ساعة</h3>
        <p class="text-[11px] text-slate-500 mt-1">المراقبون الذين عملوا في كل فترة، وعدد عيناتهم والعيوب التي سجلوها.</p>
      </div>
      ${hourlyRows.length ? `<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
        ${hourlyRows.map(hour => {
          const inspectors = Array.from(hour.inspectors.values()).sort((a, b) => b.samples - a.samples || a.name.localeCompare(b.name, 'ar'));
          return `<div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 border-b">
              <strong class="text-sm text-blue-800">${this.escape(hour.label)}</strong>
              <div class="flex gap-2 text-[11px]">
                <span class="bg-indigo-100 text-indigo-800 font-bold px-2 py-1 rounded-lg">العينات: ${hour.samples.toLocaleString('ar-EG')}</span>
                <span class="bg-red-100 text-red-800 font-bold px-2 py-1 rounded-lg">العيوب: ${hour.defects.toLocaleString('ar-EG')}</span>
                <span class="bg-red-100 text-red-800 font-bold px-2 py-1 rounded-lg">حالة البالتة: ${formatPalletStatus(hour)}</span>
              </div>
            </div>
            <div class="overflow-x-auto"><table class="custom-table text-xs min-w-full">
              <thead><tr><th>المراقب</th><th>الخط / المحطة</th><th>العينات</th><th>حالة البالتة</th><th>العيوب المسجلة</th></tr></thead>
              <tbody>${inspectors.map(inspector => {
                const defects = Array.from(inspector.defectReasons.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => `${this.escape(name)}: ${count.toLocaleString('ar-EG')}`);
                const context = [...inspector.lines, ...inspector.stations].join(' / ') || '—';
                return `<tr class="${inspector.rejectedPallets ? 'line-sample-rejected-row' : ''}">
                  <td class="font-bold whitespace-nowrap">${this.escape(inspector.name)}</td>
                  <td class="text-slate-600">${this.escape(context)}</td>
                  <td class="text-center font-extrabold text-indigo-700">${inspector.samples.toLocaleString('ar-EG')}</td>
                  <td>${formatPalletStatus(inspector)}</td>
                  <td>${inspector.defects
                    ? `<div class="flex flex-wrap gap-1">${defects.map(defect => `<span class="reason-badge text-[10px]">${defect}</span>`).join(' ')}</div>`
                    : '<span class="text-slate-400">لا توجد عيوب</span>'}</td>
                </tr>`;
              }).join('')}</tbody>
              <tfoot><tr class="bg-slate-50 font-extrabold"><td colspan="2">إجمالي الفترة (${hour.pulls.toLocaleString('ar-EG')} سحبة)</td><td class="text-center text-indigo-700">${hour.samples.toLocaleString('ar-EG')}</td><td>حالة البالتة: ${formatPalletStatus(hour)}</td><td class="text-red-700">إجمالي العيوب: ${hour.defects.toLocaleString('ar-EG')}</td></tr></tfoot>
            </table></div>
          </div>`;
        }).join('')}
      </div>` : '<p class="text-center text-slate-400 text-xs py-6">لا توجد سحبات مسجلة في هذا اليوم.</p>'}
    </section>`;
    const buildGroups = (key, label, itemLabel) => {
      const groups = new Map();
      this.dailyPulls.forEach(pull => {
        const sampleCount = Number(pull.sample_count) || 0;
        const extraSamples = Number(pull.additional_sample_count) || 0;
        const assignments = key === 'inspector_name'
          ? [
            { name: pull.inspector_name || '—', samples: sampleCount - extraSamples, defects: Number(pull.total_defect_count) || 0, ...{ [palletStatusForPull(pull)]: 1 } },
            ...(pull.additional_inspector_name && extraSamples > 0
              ? [{ name: pull.additional_inspector_name, samples: extraSamples, defects: 0 }]
              : [])
          ].filter(assignment => assignment.samples > 0)
          : [{ name: pull[key] || '—', samples: sampleCount, defects: Number(pull.total_defect_count) || 0, ...{ [palletStatusForPull(pull)]: 1 } }];
        assignments.forEach(assignment => {
          const current = groups.get(assignment.name) || { name: assignment.name, pulls: 0, samples: 0, defects: 0, acceptedPallets: 0, rejectedPallets: 0, pendingPallets: 0, undecidedPallets: 0 };
          current.pulls += 1;
          current.samples += assignment.samples;
          current.defects += assignment.defects;
          ['acceptedPallets', 'rejectedPallets', 'pendingPallets', 'undecidedPallets'].forEach(status => {
            current[status] += assignment[status] || 0;
          });
          groups.set(assignment.name, current);
        });
      });
      const rows = Array.from(groups.values()).sort((a, b) => b.samples - a.samples || a.name.localeCompare(b.name, 'ar'));
      const totals = rows.reduce((total, row) => ({
        pulls: total.pulls + row.pulls,
        samples: total.samples + row.samples,
        defects: total.defects + row.defects,
        acceptedPallets: total.acceptedPallets + row.acceptedPallets,
        rejectedPallets: total.rejectedPallets + row.rejectedPallets,
        pendingPallets: total.pendingPallets + row.pendingPallets,
        undecidedPallets: total.undecidedPallets + row.undecidedPallets
      }), { pulls: 0, samples: 0, defects: 0, acceptedPallets: 0, rejectedPallets: 0, pendingPallets: 0, undecidedPallets: 0 });
      return `<section class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100">
          <h3 class="font-extrabold text-sm text-slate-800">${label}</h3>
          <p class="text-[11px] text-slate-500 mt-1">إجمالي العينات: ${totals.samples.toLocaleString('ar-EG')} · حالة البالتة: ${formatPalletStatus(totals)}</p>
        </div>
        ${rows.length ? `<div class="overflow-x-auto"><table class="custom-table text-xs min-w-full">
          <thead><tr><th>${itemLabel}</th><th>السحبات</th><th>العينات</th><th>حالة البالتة</th><th>العيوب</th></tr></thead>
          <tbody>${rows.map(row => `<tr class="${key === 'line_name' && row.rejectedPallets ? 'line-sample-rejected-row' : ''}"><td class="font-bold">${this.escape(row.name)}</td><td class="text-center">${row.pulls.toLocaleString('ar-EG')}</td><td class="text-center font-extrabold text-indigo-700">${row.samples.toLocaleString('ar-EG')}</td><td>${formatPalletStatus(row)}</td><td class="text-center text-red-700">${row.defects.toLocaleString('ar-EG')}</td></tr>`).join('')}</tbody>
          <tfoot><tr class="bg-slate-50 font-extrabold"><td>الإجمالي</td><td class="text-center">${totals.pulls.toLocaleString('ar-EG')}</td><td class="text-center text-indigo-700">${totals.samples.toLocaleString('ar-EG')}</td><td>${formatPalletStatus(totals)}</td><td class="text-center text-red-700">${totals.defects.toLocaleString('ar-EG')}</td></tr></tfoot>
        </table></div>` : '<p class="text-center text-slate-400 text-xs py-6">لا توجد سحبات في هذا اليوم.</p>'}
      </section>`;
    };
    const totalSamples = this.dailyPulls.reduce((sum, pull) => sum + (Number(pull.sample_count) || 0), 0);
    const totalDefects = this.dailyPulls.reduce((sum, pull) => sum + (Number(pull.total_defect_count) || 0), 0);
    const totalRejectedPallets = this.dailyPulls.filter(pull => Number(pull.pallet_rejected) === 1).length;
    container.innerHTML = `
      <div class="xl:col-span-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="bg-white rounded-xl border p-3"><span class="block text-[11px] text-slate-500">إجمالي السحبات</span><strong class="text-xl text-slate-900">${this.dailyPulls.length.toLocaleString('ar-EG')}</strong></div>
        <div class="bg-white rounded-xl border p-3"><span class="block text-[11px] text-slate-500">إجمالي العينات</span><strong class="text-xl text-indigo-700">${totalSamples.toLocaleString('ar-EG')}</strong></div>
        <div class="bg-white rounded-xl border p-3"><span class="block text-[11px] text-slate-500">إجمالي العيوب</span><strong class="text-xl text-red-700">${totalDefects.toLocaleString('ar-EG')}</strong></div>
        <div class="bg-red-50 rounded-xl border border-red-200 p-3"><span class="block text-[11px] text-red-700">حالة البالتة</span><strong class="text-sm text-red-800">${formatPalletStatus({ acceptedPallets: this.dailyPulls.filter(pull => palletStatusForPull(pull) === 'acceptedPallets').length, rejectedPallets: totalRejectedPallets, pendingPallets: this.dailyPulls.filter(pull => palletStatusForPull(pull) === 'pendingPallets').length, undecidedPallets: this.dailyPulls.filter(pull => palletStatusForPull(pull) === 'undecidedPallets').length })}</strong></div>
        <div class="bg-white rounded-xl border p-3"><span class="block text-[11px] text-slate-500">تاريخ الملخص</span><strong class="text-sm text-slate-900">${this.escape(document.getElementById('line-samples-summary-date')?.value || '—')}</strong></div>
      </div>
      ${hourlySummary}
      ${buildGroups('inspector_name', 'إجمالي العينات حسب المراقب', 'المراقب')}
      ${buildGroups('station_name', 'إجمالي العينات حسب المحطة', 'المحطة')}
      ${buildGroups('line_name', 'إجمالي العينات حسب الخط', 'الخط')}
    `;
  },

  async createPull() {
    const payload = {
      date: document.getElementById('line-sample-date').value,
      line_id: document.getElementById('line-sample-line').value,
      product_id: document.getElementById('line-sample-product').value,
      station_id: document.getElementById('line-sample-station').value,
      slot_id: document.getElementById('line-sample-slot').value,
      sample_count: document.getElementById('line-sample-quantity').value,
      inspector_id: document.getElementById('line-sample-inspector').value,
      additional_inspector_id: document.getElementById('line-sample-has-additional-inspector').checked
        ? document.getElementById('line-sample-additional-inspector').value
        : '',
      additional_sample_count: document.getElementById('line-sample-has-additional-inspector').checked
        ? document.getElementById('line-sample-additional-quantity').value
        : '0'
    };
    try {
      const response = await App.apiPost('/api/line-sample-pulls', payload);
      App.toast(response.message || 'تم تسجيل السحبة بنجاح.', 'success');
      document.getElementById('line-sample-form').reset();
      this.toggleAdditionalInspector('line-sample');
      const now = new Date();
      document.getElementById('line-sample-date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      await this.load();
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  async openStationsModal() {
    try {
      const response = await App.apiGet('/api/inspection-stations');
      this.stations = response.data || [];
      this.renderStationInspectorOptions(document.getElementById('line-sample-station-inspector'));
      this.renderStationsList();
      document.getElementById('modal-line-sample-stations').classList.remove('hidden');
    } catch (error) {
      App.toast(`تعذر تحميل محطات الفحص: ${error.message}`, 'error');
    }
  },

  closeStationsModal() {
    document.getElementById('modal-line-sample-stations')?.classList.add('hidden');
  },

  async openSlotsModal() {
    try {
      const response = await App.apiGet('/api/line-sample-slots');
      this.slots = response.data || [];
      this.renderSlotsList();
      document.getElementById('modal-line-sample-slots').classList.remove('hidden');
    } catch (error) {
      App.toast(`تعذر تحميل فترات السحب: ${error.message}`, 'error');
    }
  },

  closeSlotsModal() {
    document.getElementById('modal-line-sample-slots')?.classList.add('hidden');
  },

  renderSlotsList() {
    const list = document.getElementById('line-sample-slots-list');
    if (!list) return;
    list.innerHTML = this.slots.length
      ? this.slots.map(slot => `<div class="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2">
          <span class="font-semibold">${this.escape(slot.slot_name)}</span>
          <button type="button" onclick="LineSamplesModule.deleteSlot(${slot.id})" class="text-red-600 hover:text-red-800 text-xs font-bold"><i class="fa-solid fa-trash ml-1"></i>حذف</button>
        </div>`).join('')
      : '<p class="text-center text-slate-400 py-4">لا توجد فترات سحب مضافة.</p>';
  },

  async addSlot() {
    const startTime = document.getElementById('line-sample-slot-start');
    const endTime = document.getElementById('line-sample-slot-end');
    try {
      const response = await App.apiPost('/api/line-sample-slots', {
        start_time: startTime.value,
        end_time: endTime.value
      });
      App.toast(response.message || 'تمت إضافة فترة السحب.', 'success');
      startTime.value = '';
      endTime.value = '';
      await this.openSlotsModal();
      await this.load();
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  deleteSlot(id) {
    const slot = this.slots.find(item => Number(item.id) === Number(id));
    App.confirm(`هل تريد حذف فترة السحب "${slot?.slot_name || ''}"؟ ستظل السحبات السابقة محفوظة.`, async () => {
      try {
        const response = await App.apiDelete(`/api/line-sample-slots/${id}`);
        App.toast(response.message || 'تم حذف الفترة.', 'success');
        await this.openSlotsModal();
        await this.load();
      } catch (error) {
        App.toast(error.message, 'error');
      }
    });
  },

  renderStationsList() {
    const list = document.getElementById('line-sample-stations-list');
    if (!list) return;
    const inspectors = (App.metadata.inspectors || []).filter(inspector => inspector.is_active !== 0);
    list.innerHTML = this.stations.length
      ? this.stations.map(station => `<div class="flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2">
          <span class="font-semibold">${this.escape(station.name)}</span>
          <div class="flex flex-wrap items-center gap-2">
            <select id="line-sample-station-inspector-${station.id}" class="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs">
              <option value="">اختر المراقب المسؤول...</option>
              ${inspectors.map(inspector => `<option value="${inspector.id}" ${String(inspector.id) === String(station.default_inspector_id || '') ? 'selected' : ''}>${this.escape(inspector.name)}</option>`).join('')}
            </select>
            <button type="button" onclick="LineSamplesModule.saveStationInspector(${station.id})" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">حفظ</button>
            <button type="button" onclick="LineSamplesModule.deleteStation(${station.id})" class="text-red-600 hover:text-red-800 text-xs font-bold"><i class="fa-solid fa-trash ml-1"></i>حذف</button>
          </div>
        </div>`).join('')
      : '<p class="text-center text-slate-400 py-4">لا توجد محطات فحص مضافة.</p>';
  },

  async addStation() {
    const input = document.getElementById('line-sample-station-name');
    const name = input.value.trim();
    if (!name) return;
    try {
      const inspectorId = document.getElementById('line-sample-station-inspector').value;
      const response = await App.apiPost('/api/inspection-stations', { name, inspector_id: inspectorId });
      App.toast(response.message || 'تمت إضافة المحطة.', 'success');
      input.value = '';
      document.getElementById('line-sample-station-inspector').value = '';
      await this.openStationsModal();
      await this.load();
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  async saveStationInspector(id) {
    const select = document.getElementById(`line-sample-station-inspector-${id}`);
    if (!select?.value) return App.toast('اختر المراقب المسؤول عن المحطة.', 'warning');
    try {
      const response = await App.apiPut(`/api/inspection-stations/${id}`, { inspector_id: select.value });
      App.toast(response.message || 'تم تحديث المراقب المسؤول عن المحطة.', 'success');
      await this.openStationsModal();
      await this.load();
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  deleteStation(id) {
    const station = this.stations.find(item => Number(item.id) === Number(id));
    App.confirm(`هل تريد حذف محطة الفحص "${station?.name || ''}" من القائمة؟ ستظل السحبات السابقة محفوظة.`, async () => {
      try {
        const response = await App.apiDelete(`/api/inspection-stations/${id}`);
        App.toast(response.message || 'تم حذف المحطة.', 'success');
        await this.openStationsModal();
        await this.load();
      } catch (error) {
        App.toast(error.message, 'error');
      }
    });
  },

  openDefectsModal(id) {
    const pull = this.pulls.find(item => Number(item.id) === Number(id));
    if (!pull || pull.status !== 'pending') return;
    this.currentPullId = Number(id);
    document.getElementById('line-sample-defect-rows').innerHTML = '';
    document.querySelectorAll('input[name="line-sample-pallet-rejected"]').forEach(input => { input.checked = false; });
    this.toggleQuickReasonForm('line-sample-defect-rows', false);
    this.addDefectRow();
    document.getElementById('modal-line-sample-defects').classList.remove('hidden');
  },

  addDefectRow(containerId = 'line-sample-defect-rows', existingDefect = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const reasons = this.getDefectReasons(containerId);
    if (existingDefect && !reasons.some(reason => Number(reason.id) === Number(existingDefect.reason_id))) {
      reasons.push({ id: existingDefect.reason_id, name: existingDefect.reason_name });
      reasons.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }
    const row = document.createElement('div');
    row.className = 'line-sample-defect-row grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_100px_auto] gap-2 items-center';
    row.innerHTML = `<input type="search" oninput="LineSamplesModule.filterDefectReasons(this)" aria-label="البحث عن سبب العيب" placeholder="ابحث عن العيب..." class="line-sample-defect-search bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs">
      <select onchange="LineSamplesModule.handleDefectReasonChange(this)" class="line-sample-defect-reason bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs">
        <option value="">اختر سبب العيب...</option>
        ${reasons.map(reason => `<option value="${reason.id}">${this.escape(reason.name)}</option>`).join('')}
      </select>
      <input type="number" min="1" step="1" value="${existingDefect?.count || 1}" aria-label="عدد العيوب" class="line-sample-defect-count bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs">
      <button type="button" onclick="this.closest('.line-sample-defect-row').remove()" class="text-red-600 hover:text-red-800 px-2 py-1" aria-label="حذف سبب العيب"><i class="fa-solid fa-trash"></i></button>`;
    container.appendChild(row);
    if (existingDefect) row.querySelector('.line-sample-defect-reason').value = String(existingDefect.reason_id);
  },

  getDefectReasons(containerId) {
    const pullId = containerId === 'line-sample-edit-defect-rows' ? this.currentEditPullId : this.currentPullId;
    const pull = this.pulls.find(item => Number(item.id) === Number(pullId));
    const selectedLineId = containerId === 'line-sample-edit-defect-rows'
      ? document.getElementById('line-sample-edit-line')?.value
      : pull?.line_id;
    const line = (App.metadata.lines || []).find(item => Number(item.id) === Number(selectedLineId));
    const department = line?.department || App.currentDepartment;
    return (App.metadata.rejectionReasons || []).filter(reason =>
      reason.is_active !== 0 && (!reason.department || department === 'all' || reason.department === department)
    ).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  },

  filterDefectReasons(input) {
    const query = input.value.trim().toLocaleLowerCase('ar');
    const select = input.closest('.line-sample-defect-row')?.querySelector('.line-sample-defect-reason');
    if (!select) return;
    Array.from(select.options).forEach((option, index) => {
      option.hidden = index > 0 && !option.textContent.toLocaleLowerCase('ar').includes(query);
    });
    if (select.selectedOptions[0]?.hidden) select.value = '';
    if (query) select.size = Math.min(Math.max(Array.from(select.options).filter(option => !option.hidden).length, 2), 8);
    else select.size = 1;
  },

  handleDefectReasonChange(select) {
    select.size = 1;
    const search = select.closest('.line-sample-defect-row')?.querySelector('.line-sample-defect-search');
    if (search) search.value = '';
    Array.from(select.options).forEach(option => { option.hidden = false; });
  },

  toggleQuickReasonForm(containerId, show = null) {
    const panel = document.getElementById(`line-sample-quick-reason-${containerId}`);
    const input = document.getElementById(`line-sample-quick-reason-name-${containerId}`);
    if (!panel || !input) return;
    const shouldShow = show ?? panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldShow);
    if (shouldShow) input.focus();
    else input.value = '';
  },

  async quickAddReason(containerId) {
    const input = document.getElementById(`line-sample-quick-reason-name-${containerId}`);
    const name = input?.value.trim();
    if (!name) return App.toast('اكتب اسم العيب أولاً.', 'warning');
    const pullId = containerId === 'line-sample-edit-defect-rows' ? this.currentEditPullId : this.currentPullId;
    const pull = this.pulls.find(item => Number(item.id) === Number(pullId));
    const lineId = containerId === 'line-sample-edit-defect-rows'
      ? document.getElementById('line-sample-edit-line')?.value
      : pull?.line_id;
    const line = (App.metadata.lines || []).find(item => Number(item.id) === Number(lineId));
    const department = line?.department || (App.currentDepartment === 'seria' ? 'seria' : 'home');
    try {
      const response = await App.apiPost('/api/settings/rejection-reasons/quick', { name, department });
      const reason = response.data;
      if (!reason?.id) throw new Error('تم حفظ العيب لكن تعذر تحميله للاختيار.');
      App.metadata.rejectionReasons = [...(App.metadata.rejectionReasons || []).filter(item => Number(item.id) !== Number(reason.id)), reason];
      document.querySelectorAll(`#${containerId} .line-sample-defect-row`).forEach(row => {
        const select = row.querySelector('.line-sample-defect-reason');
        const selectedId = select.value;
        const reasons = this.getDefectReasons(containerId);
        select.innerHTML = '<option value="">اختر سبب العيب...</option>' + reasons
          .map(item => `<option value="${item.id}">${this.escape(item.name)}</option>`).join('');
        select.value = selectedId;
        const search = row.querySelector('.line-sample-defect-search');
        if (search) this.filterDefectReasons(search);
      });
      let targetRow = Array.from(document.querySelectorAll(`#${containerId} .line-sample-defect-row`))
        .find(row => !row.querySelector('.line-sample-defect-reason').value);
      if (!targetRow) {
        this.addDefectRow(containerId);
        targetRow = document.querySelector(`#${containerId} .line-sample-defect-row:last-child`);
      }
      const targetSelect = targetRow?.querySelector('.line-sample-defect-reason');
      if (targetSelect) {
        targetSelect.value = String(reason.id);
        this.handleDefectReasonChange(targetSelect);
      }
      this.toggleQuickReasonForm(containerId, false);
      App.toast(response.message || 'تمت إضافة سبب العيب واختياره.', 'success');
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  handleEditLineChange(lineId) {
    const line = (App.metadata.lines || []).find(item => Number(item.id) === Number(lineId));
    this.populateProductOptions(line?.department || App.currentDepartment, 'line-sample-edit-product');
  },

  openEditModal(id) {
    const pull = this.pulls.find(item => Number(item.id) === Number(id));
    if (!pull) {
      App.toast('سحبة العينات غير موجودة في السجل الحالي. حدّث القائمة وحاول مرة أخرى.', 'error');
      return;
    }
    this.currentEditPullId = Number(id);
    const lines = (App.metadata.lines || []).filter(line => !App.currentDepartment || App.currentDepartment === 'all' || !line.department || line.department === App.currentDepartment);
    const inspectors = (App.metadata.inspectors || []).filter(inspector => inspector.is_active !== 0);
    const setOptions = (elementId, placeholder, rows, label) => {
      const select = document.getElementById(elementId);
      select.innerHTML = `<option value="">${placeholder}</option>` + rows
        .map(row => `<option value="${row.id}">${this.escape(label(row))}</option>`).join('');
    };
    setOptions('line-sample-edit-line', 'اختر الخط...', lines, line => line.name);
    setOptions('line-sample-edit-station', 'اختر المحطة...', this.stations, station => station.name);
    setOptions('line-sample-edit-slot', 'اختر الفترة...', this.slots, slot => slot.slot_name);
    setOptions('line-sample-edit-inspector', 'اختر المراقب...', inspectors, inspector => inspector.name);
    document.getElementById('line-sample-edit-date').value = pull.date;
    document.getElementById('line-sample-edit-line').value = String(pull.line_id);
    this.handleEditLineChange(pull.line_id);
    document.getElementById('line-sample-edit-product').value = String(pull.product_id);
    document.getElementById('line-sample-edit-station').value = String(pull.station_id);
    document.getElementById('line-sample-edit-slot').value = pull.slot_id ? String(pull.slot_id) : '';
    document.getElementById('line-sample-edit-inspector').value = String(pull.inspector_id);
    document.getElementById('line-sample-edit-quantity').value = String(pull.sample_count);
    this.populateAdditionalInspectorOptions('line-sample-edit');
    document.getElementById('line-sample-edit-has-additional-inspector').checked = Boolean(pull.additional_inspector_id);
    document.getElementById('line-sample-edit-additional-inspector').value = pull.additional_inspector_id
      ? String(pull.additional_inspector_id)
      : '';
    document.getElementById('line-sample-edit-additional-quantity').value = pull.additional_sample_count
      ? String(pull.additional_sample_count)
      : '';
    this.toggleAdditionalInspector('line-sample-edit');

    const isCompleted = pull.status === 'completed';
    document.getElementById('line-sample-edit-status').textContent = isCompleted
      ? 'السحبة مكتملة؛ يمكنك تعديل تفاصيلها والعيوب المسجلة وحالة قبول أو رفض البالتة.'
      : 'السحبة بانتظار الفحص؛ يتم تسجيل العيوب عند إنهاء الفحص.';
    document.getElementById('line-sample-edit-defects-section').classList.toggle('hidden', !isCompleted);
    document.getElementById('line-sample-edit-pallet-rejected').value = pull.pallet_rejected == null
      ? ''
      : String(Number(pull.pallet_rejected));
    const defectRows = document.getElementById('line-sample-edit-defect-rows');
    defectRows.innerHTML = '';
    this.toggleQuickReasonForm('line-sample-edit-defect-rows', false);
    if (isCompleted) {
      (pull.defects || []).forEach(defect => this.addDefectRow('line-sample-edit-defect-rows', defect));
      if (!pull.defects?.length) this.addDefectRow('line-sample-edit-defect-rows');
    }
    document.getElementById('modal-line-sample-edit').classList.remove('hidden');
  },

  closeEditModal() {
    document.getElementById('modal-line-sample-edit')?.classList.add('hidden');
    this.currentEditPullId = null;
  },

  async saveEdit() {
    if (!this.currentEditPullId) return;
    const pull = this.pulls.find(item => Number(item.id) === this.currentEditPullId);
    const palletRejected = document.getElementById('line-sample-edit-pallet-rejected').value;
    if (pull?.status === 'completed' && palletRejected !== '0' && palletRejected !== '1') {
      App.toast('حدد ما إذا كانت البالتة مرفوضة أم مقبولة.', 'warning');
      return;
    }
    const defects = pull?.status === 'completed'
      ? Array.from(document.querySelectorAll('#line-sample-edit-defect-rows .line-sample-defect-row'))
        .map(row => ({
          reason_id: row.querySelector('.line-sample-defect-reason').value,
          count: row.querySelector('.line-sample-defect-count').value
        }))
        .filter(defect => defect.reason_id)
      : [];
    const payload = {
      date: document.getElementById('line-sample-edit-date').value,
      slot_id: document.getElementById('line-sample-edit-slot').value,
      line_id: document.getElementById('line-sample-edit-line').value,
      product_id: document.getElementById('line-sample-edit-product').value,
      station_id: document.getElementById('line-sample-edit-station').value,
      inspector_id: document.getElementById('line-sample-edit-inspector').value,
      sample_count: document.getElementById('line-sample-edit-quantity').value,
      additional_inspector_id: document.getElementById('line-sample-edit-has-additional-inspector').checked
        ? document.getElementById('line-sample-edit-additional-inspector').value
        : '',
      additional_sample_count: document.getElementById('line-sample-edit-has-additional-inspector').checked
        ? document.getElementById('line-sample-edit-additional-quantity').value
        : '0',
      pallet_rejected: pull?.status === 'completed' ? palletRejected : undefined,
      defects
    };
    try {
      const response = await App.apiPut(`/api/line-sample-pulls/${this.currentEditPullId}`, payload);
      App.toast(response.message || 'تم تعديل السحبة بنجاح.', 'success');
      this.closeEditModal();
      await this.load();
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  deletePull(id) {
    const pull = this.pulls.find(item => Number(item.id) === Number(id));
    if (!pull) return;
    App.confirm(`هل تريد حذف سحبة ${pull.slot_name || `${pull.start_time}–${pull.end_time}`} للخط "${pull.line_name}"؟ سيتم حذف العيوب المرتبطة بها.`, async () => {
      try {
        const response = await App.apiDelete(`/api/line-sample-pulls/${id}`);
        App.toast(response.message || 'تم حذف السحبة.', 'success');
        await this.load();
      } catch (error) {
        App.toast(error.message, 'error');
      }
    });
  },

  closeDefectsModal() {
    document.getElementById('modal-line-sample-defects')?.classList.add('hidden');
    this.currentPullId = null;
  },

  async completePull() {
    if (!this.currentPullId) return;
    const palletRejected = document.querySelector('input[name="line-sample-pallet-rejected"]:checked')?.value;
    if (palletRejected === undefined) {
      App.toast('حدد ما إذا كانت البالتة مرفوضة أم مقبولة.', 'warning');
      return;
    }
    const defects = Array.from(document.querySelectorAll('.line-sample-defect-row'))
      .map(row => ({
        reason_id: row.querySelector('.line-sample-defect-reason').value,
        count: row.querySelector('.line-sample-defect-count').value
      }))
      .filter(defect => defect.reason_id);
    try {
      const response = await App.apiPost(`/api/line-sample-pulls/${this.currentPullId}/complete`, { defects, pallet_rejected: palletRejected });
      App.toast(response.message || 'تم إنهاء فحص السحبة.', 'success');
      this.closeDefectsModal();
      await this.load();
    } catch (error) {
      App.toast(error.message, 'error');
    }
  }
};

const ScrapReportModule = {
  storageKey: 'maghraby-scrap-reports',
  reports: [],
  activeReportId: null,
  view: 'reports',
  reportType: 'hourly',
  causes: ['', '', ''],
  periods: [],
  manualItems: [],
  scrapLines: [],
  scrapProducts: [],
  scrapReasons: [],

  escape(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  },

  async init() {
    const report = document.getElementById('scrap-report');
    const dateInput = document.getElementById('scrap-report-date');
    if (!report || !dateInput || !document.getElementById('scrap-reports-list')) {
      throw new Error('Scrap report template markup is incomplete.');
    }

    report.addEventListener('input', event => this.handleInput(event));
    report.addEventListener('change', event => this.handleChange(event));
    try {
      await this.refreshSharedData();
    } catch (error) {
      App.toast(`تعذر تحميل قوائم المنتجات والخطوط والأسباب المشتركة: ${error.message}`, 'error');
    }
    this.renderLineOptions();
    this.resetForm(this.today());
    document.getElementById('scrap-filter-date').value = this.today();
    this.showView('reports');
  },

  async refreshSharedData() {
    if (location.protocol === 'file:') {
      this.scrapLines = App.metadata.lines || [];
      this.scrapProducts = App.metadata.products || [];
      this.scrapReasons = App.metadata.rejectionReasons || [];
      return;
    }
    const [linesResponse, productsResponse, reasonsResponse] = await Promise.all([
      App.apiGet('/api/lines?department=all'),
      App.apiGet('/api/products'),
      App.apiGet('/api/settings/rejection-reasons')
    ]);
    this.scrapLines = linesResponse.data || [];
    this.scrapProducts = (productsResponse.data || []).filter(product => product.is_active !== 0);
    this.scrapReasons = (reasonsResponse.data || []).filter(reason => reason.is_active !== 0);
    App.metadata.products = productsResponse.data || [];
    App.metadata.rejectionReasons = reasonsResponse.data || [];
    if (App.currentSystem === 'quality') App.populateDropdowns();
  },

  renderLineOptions(selectedName = '') {
    const select = document.getElementById('scrap-report-line');
    const options = this.scrapLines.map(line => {
      const name = line.name || `خط ${line.line_number}`;
      return `<option value="${this.escape(name)}" ${name === selectedName ? 'selected' : ''}>${this.escape(line.line_number)} - ${this.escape(name)}</option>`;
    });
    if (selectedName && !this.scrapLines.some(line => line.name === selectedName)) {
      options.unshift(`<option value="${this.escape(selectedName)}" selected>${this.escape(selectedName)}</option>`);
    }
    select.innerHTML = `<option value="">اختر الخط</option>${options.join('')}`;
  },

  getReasonOptions(selectedId = '', selectedName = '') {
    const options = this.scrapReasons.map(reason =>
      `<option value="${Number(reason.id)}" ${Number(reason.id) === Number(selectedId) ? 'selected' : ''}>${this.escape(reason.name)}</option>`
    );
    if (selectedName && !this.scrapReasons.some(reason => reason.name === selectedName)) {
      options.unshift(`<option value="legacy:${this.escape(selectedName)}" selected>${this.escape(selectedName)}</option>`);
    }
    return `<option value="">اختر السبب</option>${options.join('')}`;
  },

  getCauseOptions(selectedName = '') {
    const options = this.scrapReasons.map(reason =>
      `<option value="${this.escape(reason.name)}" ${reason.name === selectedName ? 'selected' : ''}>${this.escape(reason.name)}</option>`
    );
    if (selectedName && !this.scrapReasons.some(reason => reason.name === selectedName)) {
      options.unshift(`<option value="${this.escape(selectedName)}" selected>${this.escape(selectedName)}</option>`);
    }
    return `<option value="">اختر السبب</option>${options.join('')}`;
  },

  getProductOptions(selectedId = '', selectedName = '') {
    const options = this.scrapProducts.map(product =>
      `<option value="${Number(product.id)}" ${Number(product.id) === Number(selectedId) ? 'selected' : ''}>${this.escape(product.name)}</option>`
    );
    if (selectedName && !this.scrapProducts.some(product => product.name === selectedName)) {
      options.unshift(`<option value="legacy:${this.escape(selectedName)}" selected>${this.escape(selectedName)}</option>`);
    }
    return `<option value="">اختر المنتج</option>${options.join('')}`;
  },

  today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  getReadyPeriods() {
    const slots = (App.metadata.hourlySlots || [])
      .filter(slot => slot.start_time && slot.end_time)
      .sort((a, b) => Number(a.display_order) - Number(b.display_order)
        || a.start_time.localeCompare(b.start_time));
    const periods = slots.length
      ? slots.map(slot => ({ start: slot.start_time, end: slot.end_time }))
      : Array.from({ length: 8 }, (_, index) => ({
        start: `${String(index + 8).padStart(2, '0')}:00`,
        end: `${String(index + 9).padStart(2, '0')}:00`
      }));
    return periods.map(period => ({ ...period, product: '', quantities: [0, 0, 0] }));
  },

  async requestReports(date = '') {
    if (location.protocol === 'file:') {
      const reports = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      return date ? reports.filter(report => report.report_date === date) : reports;
    }
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const response = await App.apiGet(`/api/scrap-reports${query}`);
    return response.data;
  },

  async loadReports() {
    const date = document.getElementById('scrap-filter-date').value;
    const list = document.getElementById('scrap-reports-list');
    list.innerHTML = '<div class="bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-500">جارٍ تحميل التقارير...</div>';
    try {
      this.reports = await this.requestReports(date);
      this.renderReports();
    } catch (error) {
      list.innerHTML = '<div class="bg-white p-4 rounded-xl border border-red-200 text-sm text-red-700">تعذر تحميل التقارير. حاول مرة أخرى.</div>';
      App.toast(error.message, 'error');
    }
  },

  async clearDateFilter() {
    document.getElementById('scrap-filter-date').value = '';
    await this.loadReports();
  },

  showView(view) {
    this.view = view;
    document.getElementById('scrap-dashboard-view').classList.toggle('hidden', view !== 'dashboard');
    document.getElementById('scrap-reports-view').classList.toggle('hidden', view !== 'reports' && view !== 'second-sort');
    document.getElementById('scrap-second-sort-view').classList.toggle('hidden', view !== 'second-sort');
    document.getElementById('scrap-reports-list-view').classList.toggle('hidden', view !== 'reports');
    document.getElementById('scrap-report-editor').classList.add('hidden');
    document.getElementById('scrap-nav-dashboard').className = view === 'dashboard'
      ? 'scrap-nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm text-amber-700 bg-amber-50 border border-amber-100 transition'
      : 'scrap-nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-50 transition';
    document.getElementById('scrap-nav-reports').className = view === 'reports'
      ? 'scrap-nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm text-amber-700 bg-amber-50 border border-amber-100 transition'
      : 'scrap-nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-50 transition';
    document.getElementById('scrap-nav-second-sort').className = view === 'second-sort'
      ? 'scrap-nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm text-amber-700 bg-amber-50 border border-amber-100 transition'
      : 'scrap-nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-50 transition';
    if (view === 'reports') this.loadReports();
    if (view === 'dashboard') this.loadDashboard();
    if (view === 'second-sort') SecondSortHandoverModule.loadReports();
  },

  backToReports() {
    this.showView('reports');
  },

  async newReport(reportType = 'hourly') {
    try {
      await this.refreshSharedData();
    } catch (error) {
      App.toast(`تعذر تحديث القوائم المشتركة: ${error.message}`, 'error');
      return;
    }
    const filterDate = document.getElementById('scrap-filter-date').value;
    this.activeReportId = null;
    this.resetForm(filterDate || this.today());
    this.reportType = reportType;
    document.getElementById('scrap-editor-title').textContent = reportType === 'manual'
      ? 'تقرير هالك جديد بدون فترات'
      : 'تقرير هالك ساعي جديد';
    this.toggleEditorType();
    document.getElementById('scrap-reports-list-view').classList.add('hidden');
    document.getElementById('scrap-report-editor').classList.remove('hidden');
    this.view = 'editor';
  },

  async editReport(id) {
    try {
      await this.refreshSharedData();
    } catch (error) {
      App.toast(`تعذر تحديث القوائم المشتركة: ${error.message}`, 'error');
      return;
    }
    let report = this.reports.find(item => Number(item.id) === Number(id));
    if (!report) {
      try {
        const allReports = await this.requestReports();
        report = allReports.find(item => Number(item.id) === Number(id));
      } catch (error) {
        App.toast(error.message, 'error');
        return;
      }
    }
    if (!report) {
      App.toast('التقرير المطلوب غير موجود.', 'error');
      return;
    }
    this.activeReportId = report.id;
    this.reportType = report.report_type || 'hourly';
    this.causes = [...report.causes];
    this.periods = report.periods.map(period => ({
      start: period.start || '',
      end: period.end || '',
      product: period.product || '',
      product_id: period.product_id || this.scrapProducts.find(product => product.name === period.product)?.id || null,
      quantities: this.causes.map((cause, index) => Number(period.quantities[index]) || 0)
    }));
    this.manualItems = (report.items || []).map(item => ({ ...item }));
    document.getElementById('scrap-report-date').value = report.report_date;
    this.renderLineOptions(report.line_name || '');
    document.getElementById('scrap-production-name').value = report.production_supervisor || '';
    document.getElementById('scrap-quality-name').value = report.quality_supervisor || '';
    document.getElementById('scrap-recommendation').value = report.recommendation || '';
    this.updateDay();
    this.render();
    this.renderManualItems();
    this.toggleEditorType();
    document.getElementById('scrap-editor-title').textContent = `تعديل تقرير الهالك - ${report.report_date}`;
    document.getElementById('scrap-reports-list-view').classList.add('hidden');
    document.getElementById('scrap-report-editor').classList.remove('hidden');
    this.view = 'editor';
  },

  async deleteReport(id) {
    if (!window.confirm('هل أنت متأكد من حذف تقرير الهالك؟')) return;
    try {
      if (location.protocol === 'file:') {
        const reports = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        localStorage.setItem(this.storageKey, JSON.stringify(reports.filter(report => Number(report.id) !== Number(id))));
      } else {
        await App.apiDelete(`/api/scrap-reports/${id}`);
      }
      App.toast('تم حذف التقرير بنجاح', 'success');
      await this.loadReports();
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  resetForm(date) {
    this.activeReportId = null;
    this.reportType = 'hourly';
    this.causes = ['', '', ''];
    this.periods = this.getReadyPeriods();
    this.manualItems = [];
    document.getElementById('scrap-report-date').value = date;
    this.renderLineOptions();
    document.getElementById('scrap-production-name').value = '';
    document.getElementById('scrap-quality-name').value = '';
    document.getElementById('scrap-recommendation').value = '';
    this.updateDay();
    this.render();
    this.renderManualItems();
    this.toggleEditorType();
  },

  toggleEditorType() {
    const isManual = this.reportType === 'manual';
    document.getElementById('scrap-hourly-line-field').classList.toggle('hidden', isManual);
    document.getElementById('scrap-hourly-editor').classList.toggle('hidden', isManual);
    document.getElementById('scrap-manual-editor').classList.toggle('hidden', !isManual);
    document.getElementById('scrap-report-analysis').classList.toggle('hidden', isManual);
  },

  addManualItem() {
    this.manualItems.push({ line_id: null, line_name: '', product_id: null, product_name: '', quantity: 0, reason_id: null, reason_name: '' });
    this.renderManualItems();
  },

  removeManualItem(index) {
    this.manualItems.splice(index, 1);
    this.renderManualItems();
  },

  renderManualItems() {
    const body = document.getElementById('scrap-manual-items');
    if (!body) return;
    body.innerHTML = this.manualItems.length ? this.manualItems.map((item, index) => `
      <tr>
        <td class="text-center font-bold">${index + 1}</td>
        <td><select data-manual-index="${index}" data-manual-field="line" class="w-40 bg-white border border-slate-300 rounded-lg px-2 py-1.5"><option value="">اختر الخط</option>${this.scrapLines.map(line => `<option value="${Number(line.id)}" ${Number(line.id) === Number(item.line_id) ? 'selected' : ''}>${this.escape(line.line_number)} - ${this.escape(line.name || `خط ${line.line_number}`)}</option>`).join('')}</select></td>
        <td><select data-manual-index="${index}" data-manual-field="product" class="w-44 bg-white border border-slate-300 rounded-lg px-2 py-1.5">${this.getProductOptions(item.product_id, item.product_name)}</select></td>
        <td><input type="number" min="1" step="1" data-manual-index="${index}" data-manual-field="quantity" value="${Number(item.quantity) || ''}" class="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-center"></td>
        <td><select data-manual-index="${index}" data-manual-field="reason" class="w-44 bg-white border border-slate-300 rounded-lg px-2 py-1.5">${this.getReasonOptions(item.reason_id, item.reason_name)}</select></td>
        <td class="text-center no-print"><button type="button" onclick="ScrapReportModule.removeManualItem(${index})" class="text-red-600 hover:bg-red-50 rounded-lg px-2 py-1" aria-label="حذف الصنف"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="text-center text-slate-400 py-4">أضف صنفًا لبدء تسجيل التقرير.</td></tr>';
  },

  async addSharedProduct() {
    const name = window.prompt('اكتب اسم المنتج لإضافته إلى قائمة المنتجات المشتركة بين الجودة والهوالك:');
    if (!name || !name.trim()) return;
    try {
      if (location.protocol === 'file:') throw new Error('إضافة المنتجات المشتركة تتطلب الاتصال بالخادم.');
      const response = await App.apiPost('/api/scrap/products/quick', { name: name.trim() });
      const product = response.data;
      this.scrapProducts = [...this.scrapProducts.filter(item => Number(item.id) !== Number(product.id)), product];
      if (App.metadata.products) {
        App.metadata.products = [...App.metadata.products.filter(item => Number(item.id) !== Number(product.id)), product];
        App.populateDropdowns();
      }
      this.renderManualItems();
      this.render();
      App.toast('تمت إضافة المنتج لقائمة الجودة والهوالك المشتركة.', 'success');
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  async loadDashboard() {
    const summary = document.getElementById('scrap-analysis-summary');
    try {
      const reports = await this.requestReports();
      const totals = { quantity: 0, causes: new Map(), products: new Map(), lines: new Map() };
      const add = (map, label, quantity) => {
        const name = String(label || 'غير محدد').trim() || 'غير محدد';
        map.set(name, (map.get(name) || 0) + quantity);
      };
      reports.forEach(report => {
        if ((report.report_type || 'hourly') === 'manual') {
          (report.items || []).forEach(item => {
            const quantity = Number(item.quantity) || 0;
            totals.quantity += quantity;
            add(totals.causes, item.reason_name, quantity);
            add(totals.products, item.product_name, quantity);
            add(totals.lines, item.line_name, quantity);
          });
          return;
        }
        (report.periods || []).forEach(period => {
          let periodTotal = 0;
          (report.causes || []).forEach((cause, index) => {
            const quantity = Number(period.quantities?.[index]) || 0;
            periodTotal += quantity;
            if (quantity) add(totals.causes, cause, quantity);
          });
          totals.quantity += periodTotal;
          if (periodTotal) {
            add(totals.products, period.product, periodTotal);
            add(totals.lines, report.line_name, periodTotal);
          }
        });
      });
      summary.innerHTML = [
        ['عدد التقارير', reports.length],
        ['إجمالي كمية الهالك', totals.quantity.toLocaleString('ar-EG')],
        ['عدد المنتجات المسجلة', totals.products.size]
      ].map(([label, value]) => `<div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p class="text-xs text-slate-500">${label}</p><p class="text-xl font-extrabold text-amber-700 mt-1">${value}</p></div>`).join('');
      this.renderAggregateTable('scrap-analysis-causes', totals.causes);
      this.renderAggregateTable('scrap-analysis-products', totals.products);
      this.renderAggregateTable('scrap-analysis-lines', totals.lines);
    } catch (error) {
      summary.innerHTML = `<div class="sm:col-span-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">تعذر تحميل تحليل بيانات الهالك: ${this.escape(error.message)}</div>`;
    }
  },

  renderAggregateTable(elementId, totals) {
    const body = document.getElementById(elementId);
    const rows = [...totals.entries()].sort((left, right) => right[1] - left[1]);
    body.innerHTML = rows.length ? rows.map(([name, quantity]) =>
      `<tr><td>${this.escape(name)}</td><td class="text-center font-bold">${quantity.toLocaleString('ar-EG')}</td></tr>`
    ).join('') : '<tr><td colspan="2" class="text-center text-slate-400">لا توجد بيانات مسجلة.</td></tr>';
  },

  renderReports() {
    const list = document.getElementById('scrap-reports-list');
    if (!this.reports.length) {
      const date = document.getElementById('scrap-filter-date').value;
      list.innerHTML = `<div class="bg-white p-8 rounded-2xl border border-slate-200 text-center"><i class="fa-solid fa-folder-open text-3xl text-slate-300 mb-3"></i><p class="font-bold text-slate-700">لا توجد تقارير${date ? ` بتاريخ ${this.escape(date)}` : ''}.</p><p class="text-xs text-slate-500 mt-1">اضغط «تقرير هالك جديد» لإضافة تقرير.</p></div>`;
      return;
    }
    list.innerHTML = this.reports.map(report => {
      const total = report.report_type === 'manual'
        ? (report.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
        : (report.periods || []).reduce((sum, period) => sum + period.quantities.reduce((rowSum, value) => rowSum + (Number(value) || 0), 0), 0);
      const periodCount = (report.periods || []).filter(period =>
        period.start || period.end || period.product || period.quantities.some(quantity => Number(quantity) > 0)
      ).length;
      const reportLabel = report.report_type === 'manual' ? 'بدون فترات' : `${periodCount} فترات مسجلة`;
      return `
        <article class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-bold text-slate-800">تقرير هالك ${report.report_type === 'manual' ? 'بدون فترات' : 'ساعي'} - ${this.escape(report.line_name || 'عدة خطوط / خط غير محدد')}</h3>
            <p class="text-xs text-slate-500 mt-1">${this.escape(report.report_date)} <span class="mx-1">•</span> ${reportLabel} <span class="mx-1">•</span> إجمالي الهالك ${total.toLocaleString('ar-EG')}</p>
          </div>
          <div class="flex gap-2 no-print">
            <button type="button" onclick="ScrapReportModule.editReport(${Number(report.id)})" class="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs px-3 py-2 rounded-lg"><i class="fa-solid fa-pen ml-1"></i> فتح التقرير</button>
            <button type="button" onclick="ScrapReportModule.deleteReport(${Number(report.id)})" class="bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs px-3 py-2 rounded-lg" aria-label="حذف التقرير"><i class="fa-solid fa-trash"></i></button>
          </div>
        </article>
      `;
    }).join('');
  },

  async saveReport() {
    const reportDate = document.getElementById('scrap-report-date').value;
    if (!reportDate) {
      App.toast('يرجى اختيار تاريخ التقرير.', 'warning');
      return;
    }
    const data = {
      report_date: reportDate,
      report_type: this.reportType,
      line_name: this.reportType === 'hourly' ? document.getElementById('scrap-report-line').value.trim() : '',
      causes: this.causes,
      periods: this.periods,
      items: this.manualItems,
      production_supervisor: document.getElementById('scrap-production-name').value.trim(),
      quality_supervisor: document.getElementById('scrap-quality-name').value.trim(),
      recommendation: document.getElementById('scrap-recommendation').value.trim()
    };
    try {
      if (location.protocol === 'file:') {
        const reports = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        const id = this.activeReportId || Date.now();
        const saved = { ...data, id };
        const index = reports.findIndex(report => Number(report.id) === Number(id));
        if (index === -1) reports.push(saved);
        else reports[index] = saved;
        localStorage.setItem(this.storageKey, JSON.stringify(reports));
      } else if (this.activeReportId) {
        await App.apiPut(`/api/scrap-reports/${this.activeReportId}`, data);
      } else {
        const response = await App.apiPost('/api/scrap-reports', data);
        this.activeReportId = response.data.id;
      }
      document.getElementById('scrap-filter-date').value = reportDate;
      App.toast('تم حفظ تقرير الهالك بنجاح', 'success');
      this.backToReports();
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  async addCause() {
    const name = window.prompt('اكتب اسم سبب الهالك لإضافته إلى قائمة الجودة والهوالك المشتركة:');
    if (!name || !name.trim()) return;
    try {
      let reason;
      if (location.protocol === 'file:') {
        reason = this.scrapReasons.find(item => item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())
          || { id: `local:${Date.now()}`, name: name.trim(), is_active: 1 };
      } else {
        const response = await App.apiPost('/api/settings/rejection-reasons/quick', {
          name: name.trim(),
          department: 'all'
        });
        reason = response.data;
      }
      this.scrapReasons = [...this.scrapReasons.filter(item => Number(item.id) !== Number(reason.id)), reason];
      if (App.metadata.rejectionReasons) {
        App.metadata.rejectionReasons = [...App.metadata.rejectionReasons.filter(item => Number(item.id) !== Number(reason.id)), reason];
        App.populateDropdowns();
      }
      this.causes.push(reason.name);
      this.periods.forEach(period => period.quantities.push(0));
      this.render();
      App.toast('تمت إضافة السبب إلى القائمة المشتركة مع الجودة.', 'success');
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  removeCause(index) {
    if (this.causes.length <= 1) return;
    this.causes.splice(index, 1);
    this.periods.forEach(period => period.quantities.splice(index, 1));
    this.render();
  },

  updateDay() {
    const date = document.getElementById('scrap-report-date').value;
    const dayInput = document.getElementById('scrap-report-day');
    if (!date) {
      dayInput.value = '';
      return;
    }
    dayInput.value = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(new Date(`${date}T12:00:00`));
  },

  handleInput(event) {
    const target = event.target;
    if (target.id === 'scrap-report-date') {
      this.updateDay();
      this.updateAnalysis();
      return;
    }

    if (target.dataset.causeIndex !== undefined) {
      this.causes[Number(target.dataset.causeIndex)] = target.value;
      this.updateAnalysis();
      return;
    }

    if (target.dataset.periodIndex !== undefined) {
      const period = this.periods[Number(target.dataset.periodIndex)];
      const causeIndex = target.dataset.causeQuantity;
      if (causeIndex !== undefined) {
        period.quantities[Number(causeIndex)] = Math.max(0, Number(target.value) || 0);
      }
      this.updateAnalysis();
      return;
    }

    if (target.dataset.manualIndex !== undefined && target.dataset.manualField === 'quantity') {
      this.manualItems[Number(target.dataset.manualIndex)].quantity = Math.max(0, Number(target.value) || 0);
    }
  },

  handleChange(event) {
    const target = event.target;
    if (target.dataset.periodField === 'product') {
      const period = this.periods[Number(target.dataset.periodIndex)];
      const product = this.scrapProducts.find(item => String(item.id) === target.value);
      period.product = product ? product.name : target.value.startsWith('legacy:') ? target.value.slice(7) : '';
      period.product_id = product ? Number(product.id) : null;
      this.updateAnalysis();
      return;
    }

    if (target.dataset.causeIndex !== undefined) {
      this.causes[Number(target.dataset.causeIndex)] = target.value;
      this.updateAnalysis();
      return;
    }

    if (target.dataset.manualIndex === undefined) return;
    const item = this.manualItems[Number(target.dataset.manualIndex)];
    if (target.dataset.manualField === 'line') {
      const line = this.scrapLines.find(candidate => String(candidate.id) === target.value);
      item.line_id = line ? Number(line.id) : null;
      item.line_name = line ? (line.name || `خط ${line.line_number}`) : '';
    } else if (target.dataset.manualField === 'product') {
      const product = this.scrapProducts.find(candidate => String(candidate.id) === target.value);
      item.product_id = product ? Number(product.id) : null;
      item.product_name = product ? product.name : target.value.startsWith('legacy:') ? target.value.slice(7) : '';
    } else if (target.dataset.manualField === 'reason') {
      const reason = this.scrapReasons.find(candidate => String(candidate.id) === target.value);
      item.reason_id = reason ? Number(reason.id) : null;
      item.reason_name = reason ? reason.name : target.value.startsWith('legacy:') ? target.value.slice(7) : '';
    }
  },

  render() {
    const head = document.getElementById('scrap-log-head');
    const body = document.getElementById('scrap-log-body');
    const foot = document.getElementById('scrap-log-foot');
    if (!head || !body || !foot) {
      throw new Error('Scrap report table markup is incomplete.');
    }

    head.innerHTML = `
      <tr>
        <th class="text-center">م</th>
        <th>فترة السحب</th>
        <th>اسم الصنف</th>
        <th class="text-center">إجمالي الهالك</th>
        ${this.causes.map((cause, index) => `
          <th>
            <div class="flex items-center gap-1 min-w-36">
              <select data-cause-index="${index}" aria-label="سبب الهالك ${index + 1}" class="w-full min-w-32 bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold">${this.getCauseOptions(cause)}</select>
              <button type="button" onclick="ScrapReportModule.removeCause(${index})" aria-label="حذف سبب الهالك ${index + 1}" class="text-red-500 hover:bg-red-50 rounded p-1 no-print" ${this.causes.length <= 1 ? 'disabled' : ''}><i class="fa-solid fa-xmark"></i></button>
            </div>
          </th>
        `).join('')}
      </tr>
    `;

    body.innerHTML = this.periods.map((period, periodIndex) => {
      const rowTotal = period.quantities.reduce((sum, quantity) => sum + quantity, 0);
      return `
        <tr>
          <td class="text-center font-bold">${periodIndex + 1}</td>
          <td class="font-bold text-blue-800 whitespace-nowrap">${period.start && period.end
            ? `${this.escape(period.start)}–${this.escape(period.end)}`
            : 'فترة غير محددة'}</td>
          <td><select data-period-index="${periodIndex}" data-period-field="product" aria-label="اسم الصنف للفترة ${periodIndex + 1}" class="w-40 bg-white border border-slate-300 rounded-lg px-2 py-1.5">${this.getProductOptions(period.product_id, period.product)}</select></td>
          <td class="text-center font-extrabold text-amber-700" data-row-total="${periodIndex}">${rowTotal.toLocaleString('ar-EG')}</td>
          ${this.causes.map((cause, causeIndex) => `
            <td><input type="number" min="0" step="1" data-period-index="${periodIndex}" data-cause-quantity="${causeIndex}" value="${period.quantities[causeIndex] || ''}" aria-label="${this.escape(cause || `سبب ${causeIndex + 1}`)} للفترة ${periodIndex + 1}" class="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-center"></td>
          `).join('')}
        </tr>
      `;
    }).join('');

    foot.innerHTML = `
      <tr>
        <td colspan="3" class="text-right">إجمالي الهالك المحسوب</td>
        <td id="scrap-calculated-total" class="text-center font-black text-amber-800">0</td>
        ${this.causes.map((cause, index) => `<td id="scrap-cause-total-${index}" class="text-center">0</td>`).join('')}
      </tr>
    `;
    this.updateAnalysis();
  },

  updateAnalysis() {
    const causeTotals = this.causes.map((cause, causeIndex) =>
      this.periods.reduce((sum, period) => sum + (Number(period.quantities[causeIndex]) || 0), 0)
    );
    const calculatedTotal = causeTotals.reduce((sum, quantity) => sum + quantity, 0);

    this.periods.forEach((period, index) => {
      const totalCell = document.querySelector(`[data-row-total="${index}"]`);
      if (totalCell) totalCell.textContent = period.quantities.reduce((sum, quantity) => sum + quantity, 0).toLocaleString('ar-EG');
    });

    const totalCell = document.getElementById('scrap-calculated-total');
    if (totalCell) totalCell.textContent = calculatedTotal.toLocaleString('ar-EG');
    causeTotals.forEach((total, index) => {
      const cell = document.getElementById(`scrap-cause-total-${index}`);
      if (cell) cell.textContent = total.toLocaleString('ar-EG');
    });

    const paretoBody = document.getElementById('scrap-pareto-body');
    const sortedCauses = this.causes.map((cause, index) => ({
      name: cause.trim() || `سبب ${index + 1} (غير مسمى)`,
      quantity: causeTotals[index],
      hasName: Boolean(cause.trim())
    })).filter(cause => cause.hasName || cause.quantity > 0)
      .sort((left, right) => right.quantity - left.quantity);
    paretoBody.innerHTML = sortedCauses.length ? sortedCauses.map((cause, index) => {
      const percentage = calculatedTotal ? cause.quantity / calculatedTotal * 100 : 0;
      return `
        <tr>
          <td class="text-center font-bold">${index + 1}</td>
          <td>${this.escape(cause.name)}</td>
          <td class="text-center font-bold">${cause.quantity.toLocaleString('ar-EG')}</td>
          <td class="text-center">${percentage.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}٪</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="4" class="text-center text-slate-400">أدخل أسباب الهالك وكمياتها لعرض التحليل.</td></tr>';

    const line = document.getElementById('scrap-report-line').value.trim() || 'غير محدد';
    const date = document.getElementById('scrap-report-date').value || 'غير محدد';
    const dateLabel = date === 'غير محدد'
      ? date
      : new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
    const day = document.getElementById('scrap-report-day').value;
    const topCause = sortedCauses[0];
    const topPercentage = calculatedTotal && topCause ? topCause.quantity / calculatedTotal * 100 : 0;
    document.getElementById('scrap-executive-summary').textContent =
      `في ${day ? `${day} ` : ''}${dateLabel}، بلغ إجمالي الهالك المحسوب ${calculatedTotal.toLocaleString('ar-EG')} قطعة على خط ${line}. ` +
      `${topCause ? `السبب الأعلى تأثيرًا هو ${topCause.name} بكمية ${topCause.quantity.toLocaleString('ar-EG')} (${topPercentage.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}٪).` : 'لم يتم تسجيل أسباب هالك بعد.'}`;
  }
};

const SecondSortHandoverModule = {
  reports: [],
  activeReportId: null,
  photos: [], // Array of base64 data URLs (supports multiple images)
  fontScale: 1,
  signatures: [],
  maxSignatures: 8,
  defaultSignatures() {
    return [
      { title: 'توقيع مشرف الهوالك', name: '' },
      { title: 'توقيع مشرف الفرز الثاني والهالك', name: '' }
    ];
  },
  normalizeSignatures(list) {
    if (!Array.isArray(list)) return this.defaultSignatures();
    return list.slice(0, this.maxSignatures).map(signature => ({
      title: String(signature?.title || '').trim(),
      name: String(signature?.name || '').trim()
    }));
  },

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  },

  async init() {
    const editor = document.getElementById('second-sort-editor');
    if (!editor) throw new Error('Second-sort handover report template markup is incomplete.');
    document.getElementById('second-sort-date').addEventListener('input', () => this.updatePaper());
    ['second-sort-model', 'second-sort-problem', 'second-sort-discount', 'second-sort-quantity', 'second-sort-approval']
      .forEach(id => document.getElementById(id).addEventListener('input', () => this.updatePaper()));
    document.getElementById('second-sort-photo').addEventListener('change', event => this.handlePhotoChange(event));
    document.getElementById('second-sort-filter-date').value = ScrapReportModule.today();
    this.resetForm(ScrapReportModule.today());
    await this.loadReports();
  },

  async loadReports() {
    const date = document.getElementById('second-sort-filter-date').value;
    const list = document.getElementById('second-sort-reports-list');
    list.innerHTML = '<div class="bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-500">جارٍ تحميل التقارير...</div>';
    try {
      const query = date ? `?date=${encodeURIComponent(date)}` : '';
      const response = await App.apiGet(`/api/second-sort-handover-reports${query}`);
      this.reports = response.data || [];
      this.renderReports();
    } catch (error) {
      list.innerHTML = '<div class="bg-white p-4 rounded-xl border border-red-200 text-sm text-red-700">تعذر تحميل التقارير. حاول مرة أخرى.</div>';
      App.toast(error.message, 'error');
    }
  },

  async clearDateFilter() {
    document.getElementById('second-sort-filter-date').value = '';
    await this.loadReports();
  },

  renderReports() {
    const list = document.getElementById('second-sort-reports-list');
    if (!this.reports.length) {
      const date = document.getElementById('second-sort-filter-date').value;
      list.innerHTML = `<div class="bg-white p-8 rounded-2xl border border-slate-200 text-center"><i class="fa-solid fa-folder-open text-3xl text-slate-300 mb-3"></i><p class="font-bold text-slate-700">لا توجد تقارير${date ? ` بتاريخ ${this.escape(date)}` : ''}.</p><p class="text-xs text-slate-500 mt-1">اضغط «تقرير تسليم جديد» لإضافة تقرير.</p></div>`;
      return;
    }
    list.innerHTML = this.reports.map(report => `
      <article class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="font-bold text-slate-800">تسليم الفرز الثاني - ${this.escape(report.item.product_model)}</h3>
          <p class="text-xs text-slate-500 mt-1">${this.escape(report.report_date)} <span class="mx-1">•</span> الكمية: ${Number(report.item.quantity).toLocaleString('ar-EG')} <span class="mx-1">•</span> ${this.escape(report.item.problem)}</p>
        </div>
        <div class="flex gap-2 no-print">
          <button type="button" onclick="SecondSortHandoverModule.edit(${Number(report.id)})" class="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs px-3 py-2 rounded-lg"><i class="fa-solid fa-pen ml-1"></i> فتح التقرير</button>
          <button type="button" onclick="SecondSortHandoverModule.delete(${Number(report.id)})" class="bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs px-3 py-2 rounded-lg" aria-label="حذف التقرير"><i class="fa-solid fa-trash"></i></button>
        </div>
      </article>
    `).join('');
  },

  resetForm(date) {
    this.activeReportId = null;
    this.photos = [];
    this.fontScale = 1;
    document.getElementById('second-sort-date').value = date;
    document.getElementById('second-sort-model').value = '';
    document.getElementById('second-sort-problem').value = '';
    document.getElementById('second-sort-photo').value = '';
    document.getElementById('second-sort-discount').value = '';
    document.getElementById('second-sort-quantity').value = '';
    document.getElementById('second-sort-approval').value = '';
    this.signatures = this.defaultSignatures();
    this.renderSignatureEditor();
    this.updatePhotoPreview();
    this.updatePaper();
  },

  newReport() {
    const date = document.getElementById('second-sort-filter-date').value || ScrapReportModule.today();
    this.resetForm(date);
    document.getElementById('second-sort-editor-title').textContent = 'تقرير تسليم جديد';
    document.getElementById('second-sort-list-view').classList.add('hidden');
    document.getElementById('second-sort-editor').classList.remove('hidden');
  },

  async edit(id) {
    let report;
    try {
      const response = await App.apiGet(`/api/second-sort-handover-reports/${id}`);
      report = response.data;
    } catch (error) {
      App.toast(error.message, 'error');
      return;
    }
    this.activeReportId = report.id;
    if (Array.isArray(report.item.images) && report.item.images.length) {
      this.photos = [...report.item.images];
    } else if (report.item.image_data) {
      this.photos = [report.item.image_data];
    } else {
      this.photos = [];
    }
    document.getElementById('second-sort-date').value = report.report_date;
    document.getElementById('second-sort-model').value = report.item.product_model || '';
    document.getElementById('second-sort-problem').value = report.item.problem || '';
    document.getElementById('second-sort-photo').value = '';
    document.getElementById('second-sort-discount').value = report.item.discount_percent ?? '';
    document.getElementById('second-sort-quantity').value = report.item.quantity ?? '';
    document.getElementById('second-sort-approval').value = report.item.approval || '';
    this.fontScale = Number(report.item.font_scale) || 1;
    this.signatures = this.normalizeSignatures(report.item.signatures);
    this.renderSignatureEditor();
    this.updatePhotoPreview();
    this.updatePaper();
    document.getElementById('second-sort-editor-title').textContent = `تعديل تقرير تسليم الفرز الثاني - ${report.report_date}`;
    document.getElementById('second-sort-list-view').classList.add('hidden');
    document.getElementById('second-sort-editor').classList.remove('hidden');
  },

  backToList() {
    document.getElementById('second-sort-editor').classList.add('hidden');
    document.getElementById('second-sort-list-view').classList.remove('hidden');
    this.loadReports();
  },

  async delete(id) {
    if (!window.confirm('هل أنت متأكد من حذف تقرير تسليم الفرز الثاني؟')) return;
    try {
      await App.apiDelete(`/api/second-sort-handover-reports/${id}`);
      App.toast('تم حذف التقرير بنجاح.', 'success');
      await this.loadReports();
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  async handlePhotoChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (this.photos.length + files.length > 5) {
      App.toast(`يمكنك إضافة حتى 5 صور كحد أقصى (لديك حالياً ${this.photos.length} صور).`, 'warning');
    }

    const availableSlots = 5 - this.photos.length;
    const toProcess = files.slice(0, Math.max(0, availableSlots));

    for (const file of toProcess) {
      if (!file.type.startsWith('image/')) {
        App.toast(`الملف ${file.name} ليس صورة صالحة.`, 'error');
        continue;
      }
      if (file.size > 12 * 1024 * 1024) {
        App.toast(`حجم الصورة ${file.name} كبير. اختر صورة لا تتجاوز 12 ميجابايت.`, 'error');
        continue;
      }

      const objectUrl = URL.createObjectURL(file);
      try {
        const image = await new Promise((resolve, reject) => {
          const element = new Image();
          element.onload = () => resolve(element);
          element.onerror = () => reject(new Error('تعذر قراءة الصورة المحددة.'));
          element.src = objectUrl;
        });
        const scale = Math.min(1, 800 / image.width, 600 / image.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.75);
        this.photos.push(base64);
      } catch (error) {
        App.toast(error.message, 'error');
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }

    event.target.value = '';
    this.updatePhotoPreview();
    this.updatePaper();
  },

  updatePhotoPreview() {
    const wrapper = document.getElementById('second-sort-photo-preview-wrap');
    const container = document.getElementById('second-sort-thumbnails');
    if (!wrapper || !container) return;

    wrapper.classList.toggle('hidden', this.photos.length === 0);
    wrapper.classList.toggle('flex', this.photos.length > 0);

    container.innerHTML = this.photos.map((src, idx) => `
      <div class="relative group inline-block">
        <img src="${src}" alt="صورة ${idx + 1}" class="h-16 w-20 object-contain rounded-lg border border-slate-300 bg-white">
        <button type="button" onclick="SecondSortHandoverModule.removeSinglePhoto(${idx})" class="absolute -top-1.5 -left-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow" title="حذف الصورة">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `).join('');
  },

  removeSinglePhoto(index) {
    this.photos.splice(index, 1);
    this.updatePhotoPreview();
    this.updatePaper();
  },

  clearAllPhotos() {
    this.photos = [];
    document.getElementById('second-sort-photo').value = '';
    this.updatePhotoPreview();
    this.updatePaper();
  },

  itemFromForm() {
    return {
      product_model: document.getElementById('second-sort-model').value.trim(),
      problem: document.getElementById('second-sort-problem').value.trim(),
      images: this.photos,
      image_data: this.photos[0] || '', // legacy fallback
      discount_percent: document.getElementById('second-sort-discount').value,
      quantity: document.getElementById('second-sort-quantity').value,
      approval: document.getElementById('second-sort-approval').value.trim(),
      font_scale: this.fontScale,
      signatures: this.signatures.map(signature => ({
        title: String(signature.title || '').trim(),
        name: String(signature.name || '').trim()
      }))
    };
  },

  renderSignatureEditor() {
    const editor = document.getElementById('second-sort-signatures-editor');
    if (!editor) return;
    if (!this.signatures.length) {
      editor.innerHTML = '<p class="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-3">لا توجد توقيعات على الورقة حالياً. اضغط «إضافة توقيع» لإضافة مربع جديد.</p>';
      return;
    }
    editor.innerHTML = this.signatures.map((signature, index) => `
      <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end bg-slate-50 border border-slate-200 rounded-xl p-3">
        <label class="block text-xs font-bold text-slate-600">عنوان التوقيع
          <input type="text" maxlength="80" value="${this.escape(signature.title)}" oninput="SecondSortHandoverModule.updateSignature(${index}, 'title', this.value)" class="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2" placeholder="مثال: توقيع مشرف الجودة">
        </label>
        <label class="block text-xs font-bold text-slate-600">الاسم (اختياري)
          <input type="text" maxlength="80" value="${this.escape(signature.name)}" oninput="SecondSortHandoverModule.updateSignature(${index}, 'name', this.value)" class="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2" placeholder="يُترك فارغًا للتوقيع اليدوي">
        </label>
        <button type="button" onclick="SecondSortHandoverModule.removeSignature(${index})" class="h-10 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs" aria-label="حذف التوقيع">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `).join('');
  },

  addSignature() {
    if (this.signatures.length >= this.maxSignatures) {
      App.toast(`يمكنك إضافة حتى ${this.maxSignatures} توقيعات على الورقة.`, 'warning');
      return;
    }
    this.signatures.push({ title: 'توقيع', name: '' });
    this.renderSignatureEditor();
    this.updatePaper();
  },

  removeSignature(index) {
    this.signatures.splice(index, 1);
    this.renderSignatureEditor();
    this.updatePaper();
  },

  updateSignature(index, field, value) {
    if (!this.signatures[index]) return;
    this.signatures[index][field] = value;
    this.updatePaper();
  },

  changeFontSize(direction) {
    this.fontScale = Math.max(0.8, Math.min(1.5, Math.round((this.fontScale + direction * 0.1) * 10) / 10));
    this.updatePaper();
  },

  updatePaper() {
    const item = this.itemFromForm();
    const paper = document.getElementById('second-sort-paper');
    paper.style.setProperty('--second-sort-base-font-size', `${this.fontScale * 10}pt`);
    document.getElementById('second-sort-font-size').textContent = `${Math.round(this.fontScale * 100).toLocaleString('ar-EG')}٪`;
    document.getElementById('second-sort-paper-date').textContent = document.getElementById('second-sort-date').value || '—';
    document.getElementById('second-sort-paper-model').textContent = item.product_model || '';
    document.getElementById('second-sort-paper-problem').textContent = item.problem || '';
    document.getElementById('second-sort-paper-discount').textContent = item.discount_percent === '' ? '' : `${item.discount_percent}٪`;
    document.getElementById('second-sort-paper-quantity').textContent = item.quantity;
    document.getElementById('second-sort-paper-approval').textContent = item.approval;

    const signaturesContainer = document.getElementById('second-sort-paper-signatures');
    if (signaturesContainer) {
      signaturesContainer.dataset.count = String(this.signatures.length);
      signaturesContainer.innerHTML = this.signatures.map(signature => `
        <div>
          <strong>${this.escape(signature.title || 'توقيع')}</strong>
          <span>${this.escape(signature.name)}</span>
        </div>
      `).join('');
    }
    
    // Update photos on printable paper
    const photosContainer = document.getElementById('second-sort-paper-photos');
    if (photosContainer) {
      const count = this.photos.length;
      photosContainer.className = `second-sort-paper-photos-container ${count > 0 ? `count-${count}` : ''}`;
      photosContainer.innerHTML = this.photos.map((src, i) => `
        <img src="${src}" alt="صورة ${i + 1}" class="second-sort-photo-item">
      `).join('');
    }
  },

  async save() {
    const data = {
      report_date: document.getElementById('second-sort-date').value,
      item: this.itemFromForm()
    };
    if (!data.report_date || !data.item.product_model || !data.item.problem || data.item.quantity === '') {
      App.toast('يرجى إدخال التاريخ واسم الموديل والمشكلة والكمية.', 'warning');
      return;
    }
    const quantity = Number(data.item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      App.toast('الكمية يجب أن تكون عددًا صحيحًا غير سالب.', 'warning');
      return;
    }
    if (data.item.discount_percent !== '') {
      const discount = Number(data.item.discount_percent);
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
        App.toast('نسبة الخصم يجب أن تكون بين 0 و100.', 'warning');
        return;
      }
    }
    try {
      if (this.activeReportId) {
        await App.apiPut(`/api/second-sort-handover-reports/${this.activeReportId}`, data);
      } else {
        const response = await App.apiPost('/api/second-sort-handover-reports', data);
        this.activeReportId = response.data.id;
      }
      document.getElementById('second-sort-filter-date').value = data.report_date;
      App.toast('تم حفظ تقرير تسليم الفرز الثاني.', 'success');
      this.backToList();
    } catch (error) {
      App.toast(error.message, 'error');
    }
  },

  print() {
    this.updatePaper();
    document.body.classList.add('second-sort-printing');
    window.addEventListener('afterprint', () => document.body.classList.remove('second-sort-printing'), { once: true });
    window.print();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
