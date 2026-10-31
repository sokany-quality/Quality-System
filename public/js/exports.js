// Exports Utility Module: Excel (xlsx), CSV (UTF-8 BOM), and Official El Maghraby Letterhead Reports

const ExportsManager = {
  exportToExcel(data, fileName = 'تقرير_الجودة_المغربي', sheetName = 'بيانات_الجودة') {
    if (!data || data.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير');
      return;
    }

    try {
      if (typeof XLSX === 'undefined') {
        alert('مكتبة SheetJS غير محملة');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      if (!worksheet['!views']) worksheet['!views'] = [];
      worksheet['!views'].push({ rightToLeft: true });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
      alert('حدث خطأ أثناء تصدير ملف الإكسيل: ' + err.message);
    }
  },

  exportToCSV(data, fileName = 'بيانات_الجودة_المغربي') {
    if (!data || data.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير');
      return;
    }

    try {
      const headers = Object.keys(data[0]);
      let csvContent = '\uFEFF'; // UTF-8 BOM

      csvContent += headers.map(h => `"${(h || '').toString().replace(/"/g, '""')}"`).join(',') + '\r\n';

      data.forEach(row => {
        const line = headers.map(h => {
          let val = row[h];
          if (val === null || val === undefined) val = '';
          return `"${val.toString().replace(/"/g, '""')}"`;
        }).join(',');
        csvContent += line + '\r\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('CSV Export Error:', err);
      alert('حدث خطأ أثناء تصدير ملف CSV: ' + err.message);
    }
  },

  // Print with El Maghraby Official Letterhead (from uploaded image)
  printReport(containerId, title = 'تقرير فحص ومتابعة جودة الإنتاج') {
    const element = document.getElementById(containerId);
    if (!element) {
      window.print();
      return;
    }

    const printWindow = window.open('', '', 'height=850,width=1100');
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>${title} - شركة المغربي للأجهزة المنزلية</title>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap">
          <style>
            * { font-family: 'Cairo', sans-serif; box-sizing: border-box; }
            body { padding: 25px 35px; color: #1e293b; direction: rtl; margin: 0; background: #fff; }
            
            /* Official El Maghraby Letterhead Header */
            .letterhead-header {
              border-bottom: 3px solid #c8102e;
              padding-bottom: 12px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .brand-logo-area {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .brand-symbol {
              width: 44px;
              height: 44px;
              background-color: #c8102e;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
              font-weight: 800;
              border-radius: 8px;
            }
            .brand-title {
              font-size: 20px;
              font-weight: 800;
              color: #c8102e;
              margin: 0;
              line-height: 1.1;
            }
            .brand-subtitle {
              font-size: 11px;
              font-weight: 600;
              color: #475569;
              margin-top: 2px;
              letter-spacing: 0.5px;
            }
            .report-meta {
              text-align: left;
              font-size: 11px;
              color: #64748b;
              line-height: 1.5;
            }

            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10.5pt; }
            th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: right; }
            th { background-color: #f8fafc; font-weight: 700; color: #334155; }
            .badge-accepted { color: #15803d; font-weight: bold; }
            .badge-rejected { color: #b91c1c; font-weight: bold; }

            /* Official El Maghraby Letterhead Footer */
            .letterhead-footer {
              margin-top: 35px;
              border-top: 2px solid #e2e8f0;
              padding-top: 14px;
              font-size: 9.5pt;
              color: #475569;
              display: flex;
              justify-content: space-between;
              align-items: center;
              line-height: 1.4;
            }
            .footer-brand {
              color: #c8102e;
              font-weight: 800;
              font-size: 11pt;
            }
            .footer-contact {
              color: #c8102e;
              font-weight: 600;
            }
            .signatures-box {
              display: flex;
              justify-content: space-between;
              margin-top: 30px;
              padding: 0 20px;
              font-size: 11pt;
              font-weight: bold;
              color: #334155;
            }
            @media print {
              button { display: none; }
              body { padding: 10mm 15mm; }
            }
          </style>
        </head>
        <body>
          <div class="letterhead-header">
            <div class="brand-logo-area">
              <div class="brand-symbol">م</div>
              <div>
                <h1 class="brand-title">المغربي <span style="font-size: 14px; font-weight: 600; color: #1e293b;">EL MAGHRABY</span></h1>
                <div class="brand-subtitle">للأجهزة المنزلية | إدارة ومتابعة جودة الإنتاج</div>
              </div>
            </div>
            <div class="report-meta">
              <div style="font-weight: bold; color: #1e293b; font-size: 13px;">${title}</div>
              <div>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</div>
              <div>وقت الطباعة: ${new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          ${element.innerHTML}

          <div class="signatures-box">
            <div>فاحص ومراقب الجودة: ............................</div>
            <div>مشرف الجودة: ............................</div>
            <div>مدير إدارة الجودة: ............................</div>
          </div>

          <div class="letterhead-footer">
            <div>
              <span class="footer-brand">المغربي EL MAGHRABY</span><br>
              <span class="footer-contact">info@elmaghraby.com | www.elmaghraby.com</span>
            </div>
            <div style="text-align: center;">
              <span>Tel. 0554411556</span><br>
              <span>Fax. 0554411557</span>
            </div>
            <div style="text-align: left;">
              <span>الشرقية - مدينة العاشر من رمضان</span><br>
              <span>المنطقة الصناعية A5 - قطعة رقم 210</span>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }
};

window.ExportsManager = ExportsManager;
