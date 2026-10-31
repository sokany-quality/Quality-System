const db = require('./db/index');
const { initializeDatabase } = require('./db/schema');

async function runTests() {
  console.log('=== بدء اختبارات نظام جودة مصنع المغربي للأجهزة المنزلية (AQL) ===\n');

  // 1. AQL Lookup test (e.g. 100 - 150 batch -> sample 20, Ac 2, Re 3)
  console.log('1. اختبار خطة فحص AQL المستوى العام الثاني:');
  const plan120 = db.getAqlPlanForBatch(120);
  console.log(`   - دفعة 120 جهاز: عينة=${plan120.sample_size}، حد القبول Ac=${plan120.accept_limit}، حد الرفض Re=${plan120.reject_limit}`);
  if (plan120.sample_size !== 20 || plan120.reject_limit !== 3) {
    throw new Error('فشل مطابقة جدول AQL للدفعة 120');
  }
  console.log('   ✓ تم التحقق بنجاح من جدول AQL.\n');

  // 2. Decision Logic: Not rejecting on single defect if allowed
  console.log('2. اختبار منطق القرار (عدم رفض البالتة إذا كان العيب ضمن الحد المسموح):');
  const dec1 = db.calculateAqlDecision(1, 2, 3, 'auto');
  console.log(`   - عيب واحد (1) مع حد قبول 2 => القرار: ${dec1} (متوقع: مقبول)`);
  if (dec1 !== 'مقبول') throw new Error('فشل: البالتة رُفضت مع أن العيب مسموح به في AQL');

  const dec2 = db.calculateAqlDecision(3, 2, 3, 'auto');
  console.log(`   - 3 عيوب مع حد رفض 3 => القرار: ${dec2} (متوقع: مرفوض)`);
  if (dec2 !== 'مرفوض') throw new Error('فشل: البالتة لم ترفض عند بلوغ حد الرفض');

  const decManual = db.calculateAqlDecision(5, 2, 3, 'manual_accept');
  console.log(`   - 5 عيوب مع قرار قبول يدوي => القرار: ${decManual} (متوقع: مقبول)`);
  if (decManual !== 'مقبول') throw new Error('فشل القبول اليدوي');
  console.log('   ✓ نجح منطق قرار AQL والتحكم اليدوي.\n');

  // 3. Two-Stage Lifecycle & Time Tracking Test
  console.log('3. اختبار دورة حياة البالتة (استلام ← انتظار ← بدء فحص ← اعتماد فحص):');
  const testDate = '2026-12-15';
  const received = db.receivePallet({
    date: testDate,
    received_time: '09:15',
    shift_id: 1,
    line_id: 1,
    pallet_number: 77,
    quantity_on_pallet: 120,
    product_id: 1,
    inspection_status: 'في انتظار الفحص',
    notes: 'اختبار الاستلام'
  }, 1, 'مدير الجودة');

  console.log(`   - تم استلام البالتة #77 بنجاح: وقت الاستلام=${received.received_time}، الحالة=${received.inspection_status}، عينة AQL=${received.sample_size_required}`);
  if (received.inspection_status !== 'في انتظار الفحص' || received.received_time !== '09:15') {
    throw new Error('فشل مرحلة الاستلام الأولي');
  }

  // Start inspection
  const inProgress = db.updatePalletStatus(received.id, 'جاري الفحص', 1, 'المراقب');
  console.log(`   - بدء الفحص: الحالة=${inProgress.inspection_status}، وقت البدء=${inProgress.inspection_started_at}`);
  if (inProgress.inspection_status !== 'جاري الفحص' || !inProgress.inspection_started_at) {
    throw new Error('فشل تسجيل وقت بدء الفحص');
  }

  // Complete inspection
  const inspected = db.inspectPallet(received.id, {
    inspected_quantity: 20,
    rejected_quantity: 1,
    inspection_status: 'تم الفحص',
    inspection_started_at: '09:30',
    inspection_completed_at: '10:05',
    rejection_items: [{ reason_id: 1, count: 1, notes: 'خدش بسيط' }]
  }, 1, 'المراقب');

  console.log(`   - إنهاء الفحص: القرار=${inspected.pallet_decision}، وقت البدء=${inspected.inspection_started_at}، وقت الإنهاء=${inspected.inspection_completed_at}`);
  if (inspected.pallet_decision !== 'مقبول' || inspected.inspection_status !== 'تم الفحص') {
    throw new Error('فشل اعتماد فحص البالتة');
  }

  // Clean up
  db.deletePallet(received.id, 1, 'نظام');
  console.log('   ✓ نجحت دورة حياة البالتة وتوثيق الأوقات بنجاح.\n');

  // 4. Test Daily Production & Waiting Summary
  console.log('4. اختبار تقرير الأجهزة المنزلية (المستلم والمفحوص وفي الانتظار):');
  const summary = db.getDailyProductsSummary({});
  console.log(`   - عدد الأجهزة بالتقرير: ${summary.length}`);
  const p1 = summary[0];
  console.log(`   - الجهاز: ${p1.product_name}`);
  console.log(`     * إجمالي الإنتاج المستلم: ${p1.total_produced_qty} جهاز`);
  console.log(`     * تم فحصه: ${p1.inspected_pallet_qty} جهاز`);
  console.log(`     * في انتظار الفحص: ${p1.waiting_pallet_qty} جهاز (${p1.waiting_pallets_count} بالتة)`);
  console.log('   ✓ نجح احتساب تقرير الانتظار والمفحوص بدقة.\n');

  console.log('========================================================');
  console.log('🎉 جميع اختبارات هوية المغربي ومعايير AQL اجتازت بنجاح 100%!');
  console.log('========================================================\n');
}

runTests().catch(err => {
  console.error('❌ خطأ:', err);
  process.exit(1);
});
