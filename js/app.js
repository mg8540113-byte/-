/**
 * App - לוגיקה ראשית של האפליקציה
 * מערכת ניהול שוברים
 */

const App = {
    /**
     * אתחול האפליקציה
     */
    init() {
        // ניווט לדשבורד
        router.navigate('dashboard');

        // הגדרת חיפוש
        this.setupSearch();

        // הגדרת לחיצה על לוגו
        this.setupLogoClick();

        console.log('מערכת ניהול שוברים נטענה בהצלחה! 🎫');
    },

    setupLogoClick() {
        const logo = document.querySelector('.logo');
        if (logo) {
            logo.style.cursor = 'pointer';
            logo.addEventListener('click', () => {
                router.navigate('dashboard');
            });
        }
    },

    // ==================== חיפוש ====================

    setupSearch() {
        const searchInput = document.getElementById('globalSearch');
        const searchResults = document.getElementById('searchResults');

        const debouncedSearch = Utils.debounce((query) => {
            if (query.length < 2) {
                searchResults.classList.add('hidden');
                return;
            }

            const results = dataManager.search(query);

            if (results.length === 0) {
                searchResults.innerHTML = '<div class="search-result-item text-muted">לא נמצאו תוצאות</div>';
            } else {
                searchResults.innerHTML = results.map(r => `
                    <div class="search-result-item" onclick="App.navigateToSearchResult(${JSON.stringify(r).replace(/"/g, '&quot;')})">
                        <div>${r.name}</div>
                        <div class="search-result-type">${r.typeLabel}${r.subtitle ? ' - ' + r.subtitle : ''}</div>
                    </div>
                `).join('');
            }

            searchResults.classList.remove('hidden');
        }, 300);

        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value.trim());
        });

        searchInput.addEventListener('focus', (e) => {
            if (e.target.value.length >= 2) {
                debouncedSearch(e.target.value.trim());
            }
        });

        // סגירת תוצאות בלחיצה מחוץ
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                searchResults.classList.add('hidden');
            }
        });
    },

    navigateToSearchResult(result) {
        document.getElementById('globalSearch').value = '';
        document.getElementById('searchResults').classList.add('hidden');

        if (result.type === 'institution') {
            router.navigate('institution', { id: result.path.institutionId });
        } else if (result.type === 'group' || result.type === 'person') {
            router.navigate('group', {
                institutionId: result.path.institutionId,
                groupId: result.path.groupId
            });
        }
    },

    // ==================== מודלים ====================

    openModal(title, content) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalContent').innerHTML = content;
        document.getElementById('modalContainer').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('modalContainer').classList.add('hidden');
    },

    // ==================== מוסדות ====================

    showAddInstitutionModal() {
        const content = `
            <form onsubmit="App.addInstitution(event)">
                <div class="form-group">
                    <label class="form-label">שם המוסד</label>
                    <input type="text" id="institutionName" class="form-input" required autofocus>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal()">ביטול</button>
                    <button type="submit" class="btn btn-primary">הוסף מוסד</button>
                </div>
            </form>
        `;
        this.openModal('הוספת מוסד חדש', content);
    },

    addInstitution(event) {
        event.preventDefault();
        const name = document.getElementById('institutionName').value.trim();

        if (!name) {
            Utils.showToast('יש להזין שם מוסד', 'error');
            return;
        }

        dataManager.addInstitution(name);
        this.closeModal();
        router.refresh();
        Utils.showToast(`המוסד "${name}" נוסף בהצלחה`);
    },

    showEditInstitutionModal(id) {
        const institution = dataManager.getInstitution(id);
        if (!institution) return;

        const content = `
            <form onsubmit="App.updateInstitution(event, '${id}')">
                <div class="form-group">
                    <label class="form-label">שם המוסד</label>
                    <input type="text" id="institutionName" class="form-input" value="${institution.name}" required autofocus>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal()">ביטול</button>
                    <button type="submit" class="btn btn-primary">שמור</button>
                </div>
            </form>
        `;
        this.openModal('עריכת מוסד', content);
    },

    updateInstitution(event, id) {
        event.preventDefault();
        const name = document.getElementById('institutionName').value.trim();

        if (!name) {
            Utils.showToast('יש להזין שם מוסד', 'error');
            return;
        }

        dataManager.updateInstitution(id, { name });
        this.closeModal();
        router.refresh();
        Utils.showToast('המוסד עודכן בהצלחה');
    },

    confirmDeleteInstitution(id) {
        const institution = dataManager.getInstitution(id);
        if (!institution) return;

        const content = `
            <div class="alert alert-warning">
                <strong>⚠️ אזהרה:</strong> פעולה זו תמחק את המוסד "${institution.name}" כולל כל הקבוצות והתלושים שלו.
                <br>פעולה זו אינה הפיכה!
            </div>
            <div class="form-actions">
                <button class="btn btn-ghost" onclick="closeModal()">ביטול</button>
                <button class="btn btn-danger" onclick="App.deleteInstitution('${id}')">מחק מוסד</button>
            </div>
        `;
        this.openModal('מחיקת מוסד', content);
    },

    deleteInstitution(id) {
        const institution = dataManager.getInstitution(id);
        const name = institution?.name || '';

        dataManager.deleteInstitution(id);
        this.closeModal();
        router.navigate('dashboard');
        Utils.showToast(`המוסד "${name}" נמחק`);
    },

    // ==================== קבוצות ====================

    showAddGroupModal(institutionId) {
        const content = `
            <form onsubmit="App.addGroup(event, '${institutionId}')">
                <div class="form-group">
                    <label class="form-label">שם הקבוצה</label>
                    <input type="text" id="groupName" class="form-input" required autofocus>
                </div>
                <div class="form-group">
                    <label class="form-label">אחוז סבסוד מוסד</label>
                    <input type="number" id="institutionSubsidy" class="form-input" min="0" max="100" value="0" required>
                    <div class="form-hint">כמה אחוז המוסד מוסיף על מה שהלקוח משלם</div>
                </div>
                <div class="form-group">
                    <label class="form-label">אחוז סבסוד מנהל (שלך)</label>
                    <input type="number" id="adminSubsidy" class="form-input" min="0" max="100" value="0" required>
                    <div class="form-hint">כמה אחוז אתה מסבסד על מה שהלקוח משלם</div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal()">ביטול</button>
                    <button type="submit" class="btn btn-primary">הוסף קבוצה</button>
                </div>
            </form>
        `;
        this.openModal('הוספת קבוצה חדשה', content);
    },

    addGroup(event, institutionId) {
        event.preventDefault();
        const name = document.getElementById('groupName').value.trim();
        const institutionSubsidy = document.getElementById('institutionSubsidy').value;
        const adminSubsidy = document.getElementById('adminSubsidy').value;

        if (!name) {
            Utils.showToast('יש להזין שם קבוצה', 'error');
            return;
        }

        dataManager.addGroup(institutionId, name, institutionSubsidy, adminSubsidy);
        this.closeModal();
        router.refresh();
        Utils.showToast(`הקבוצה "${name}" נוספה בהצלחה`);
    },

    showEditGroupModal(institutionId, groupId) {
        const group = dataManager.getGroup(institutionId, groupId);
        if (!group) return;

        const content = `
            <form onsubmit="App.updateGroup(event, '${institutionId}', '${groupId}')">
                <div class="form-group">
                    <label class="form-label">שם הקבוצה</label>
                    <input type="text" id="groupName" class="form-input" value="${group.name}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">אחוז סבסוד מוסד</label>
                    <input type="number" id="institutionSubsidy" class="form-input" min="0" max="100" value="${group.institutionSubsidyPercent}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">אחוז סבסוד מנהל (שלך)</label>
                    <input type="number" id="adminSubsidy" class="form-input" min="0" max="100" value="${group.adminSubsidyPercent}" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal()">ביטול</button>
                    <button type="submit" class="btn btn-primary">שמור</button>
                </div>
            </form>
        `;
        this.openModal('עריכת קבוצה', content);
    },

    updateGroup(event, institutionId, groupId) {
        event.preventDefault();
        const name = document.getElementById('groupName').value.trim();
        const institutionSubsidyPercent = Number(document.getElementById('institutionSubsidy').value);
        const adminSubsidyPercent = Number(document.getElementById('adminSubsidy').value);

        dataManager.updateGroup(institutionId, groupId, {
            name,
            institutionSubsidyPercent,
            adminSubsidyPercent
        });
        this.closeModal();
        router.refresh();
        Utils.showToast('הקבוצה עודכנה בהצלחה');
    },

    confirmDeleteGroup(institutionId, groupId) {
        const group = dataManager.getGroup(institutionId, groupId);
        if (!group) return;

        const content = `
            <div class="alert alert-warning">
                <strong>⚠️ אזהרה:</strong> פעולה זו תמחק את הקבוצה "${group.name}" כולל כל התלושים שלה.
                <br>פעולה זו אינה הפיכה!
            </div>
            <div class="form-actions">
                <button class="btn btn-ghost" onclick="closeModal()">ביטול</button>
                <button class="btn btn-danger" onclick="App.deleteGroup('${institutionId}', '${groupId}')">מחק קבוצה</button>
            </div>
        `;
        this.openModal('מחיקת קבוצה', content);
    },

    deleteGroup(institutionId, groupId) {
        const group = dataManager.getGroup(institutionId, groupId);
        const name = group?.name || '';

        dataManager.deleteGroup(institutionId, groupId);
        this.closeModal();
        router.navigate('institution', { id: institutionId });
        Utils.showToast(`הקבוצה "${name}" נמחקה`);
    },

    confirmDeleteAllVouchers(institutionId, groupId) {
        const group = dataManager.getGroup(institutionId, groupId);
        if (!group) return;

        const content = `
            <div class="alert alert-warning">
                <strong>⚠️ אזהרה:</strong> פעולה זו תמחק את כל התלושים (${group.vouchers.length}) מהקבוצה "${group.name}".
                <br>פעולה זו אינה הפיכה!
            </div>
            <div class="form-actions">
                <button class="btn btn-ghost" onclick="closeModal()">ביטול</button>
                <button class="btn btn-danger" onclick="App.deleteAllVouchers('${institutionId}', '${groupId}')">מחק את כל התלושים</button>
            </div>
        `;
        this.openModal('מחיקת כל התלושים', content);
    },

    deleteAllVouchers(institutionId, groupId) {
        dataManager.deleteAllVouchersFromGroup(institutionId, groupId);
        this.closeModal();
        router.refresh();
        Utils.showToast('כל התלושים נמחקו');
    },

    // ==================== תלושים ====================

    deleteVoucher(institutionId, groupId, voucherId) {
        if (confirm('האם למחוק את התלוש?')) {
            dataManager.deleteVoucher(institutionId, groupId, voucherId);
            router.refresh();
            Utils.showToast('התלוש נמחק');
        }
    },

    // ==================== העלאת Excel ====================

    showUploadExcelModal(institutionId, groupId) {
        const content = `
            <form id="excelUploadForm">
                <div class="form-group">
                    <label class="form-label">בחר קובץ Excel</label>
                    <input type="file" id="excelFile" class="form-input" accept=".xlsx,.xls" required>
                </div>
                
                <div id="columnSelection" class="hidden">
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: var(--spacing-sm); cursor: pointer;">
                            <input type="checkbox" id="hasHeaders" checked>
                            <span>שורה ראשונה היא כותרות</span>
                        </label>
                        <div class="form-hint">אם הקובץ מתחיל ישר בנתונים (ללא שורת כותרות), בטל את הסימון</div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">עמודת שמות</label>
                        <select id="nameColumn" class="form-select" required></select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">עמודת סכומים</label>
                        <select id="amountColumn" class="form-select" required></select>
                    </div>
                    
                    <hr style="margin: var(--spacing-lg) 0;">
                    
                    <h3 style="margin-bottom: var(--spacing-md);">חלוקת תלושים</h3>
                    <div class="form-hint mb-md">הזן אחוז לכל סוג תלוש. הסכום חייב להיות 100%.</div>
                    
                    <div class="form-group">
                        <label class="form-label">תלוש 50₪</label>
                        <input type="number" id="dist50" class="form-input" min="0" max="100" value="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">תלוש 100₪</label>
                        <input type="number" id="dist100" class="form-input" min="0" max="100" value="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">תלוש 200₪</label>
                        <input type="number" id="dist200" class="form-input" min="0" max="100" value="0">
                    </div>
                    
                    <div id="distributionTotal" class="form-hint">סה"כ: 0%</div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal()">ביטול</button>
                    <button type="submit" class="btn btn-primary" id="createVouchersBtn" disabled>צור תלושים</button>
                </div>
            </form>
            
            <script>
                App.setupExcelUploadHandlers('${institutionId}', '${groupId}');
            </script>
        `;
        this.openModal('העלאת קובץ Excel', content);

        // הוספת event listeners אחרי שהמודל נפתח
        setTimeout(() => this.setupExcelUploadHandlers(institutionId, groupId), 100);
    },

    setupExcelUploadHandlers(institutionId, groupId) {
        const fileInput = document.getElementById('excelFile');
        const columnSelection = document.getElementById('columnSelection');
        const createBtn = document.getElementById('createVouchersBtn');
        const form = document.getElementById('excelUploadForm');

        let excelData = null;

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                // בדיקה אם XLSX קיים
                if (typeof XLSX === 'undefined') {
                    Utils.showToast('טוען ספריית Excel...', 'warning');
                    await this.loadXLSXLibrary();
                }

                const result = await Utils.readExcelFile(file);
                excelData = result;

                // מילוי רשימות העמודות
                const nameSelect = document.getElementById('nameColumn');
                const amountSelect = document.getElementById('amountColumn');

                nameSelect.innerHTML = result.headers.map((h, i) =>
                    `<option value="${i}">${h || `עמודה ${i + 1}`}</option>`
                ).join('');

                amountSelect.innerHTML = result.headers.map((h, i) =>
                    `<option value="${i}">${h || `עמודה ${i + 1}`}</option>`
                ).join('');

                // בחירת ברירת מחדל לעמודה שנייה אם קיימת
                if (result.headers.length > 1) {
                    amountSelect.value = '1';
                }

                columnSelection.classList.remove('hidden');
                createBtn.disabled = false;

                Utils.showToast(`נקראו ${result.rows.length} שורות מהקובץ`);
            } catch (error) {
                console.error('Error reading Excel:', error);
                Utils.showToast('שגיאה בקריאת הקובץ', 'error');
            }
        });

        // עדכון סה"כ חלוקה
        ['dist50', 'dist100', 'dist200'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => {
                    const total = Number(document.getElementById('dist50').value || 0) +
                        Number(document.getElementById('dist100').value || 0) +
                        Number(document.getElementById('dist200').value || 0);
                    const totalDiv = document.getElementById('distributionTotal');
                    totalDiv.textContent = `סה"כ: ${total}%`;
                    totalDiv.style.color = total === 100 ? 'green' : 'red';
                });
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const nameColIndex = Number(document.getElementById('nameColumn').value);
            const amountColIndex = Number(document.getElementById('amountColumn').value);
            const hasHeaders = document.getElementById('hasHeaders').checked;

            const distribution = {
                50: Number(document.getElementById('dist50').value || 0),
                100: Number(document.getElementById('dist100').value || 0),
                200: Number(document.getElementById('dist200').value || 0)
            };

            const total = distribution[50] + distribution[100] + distribution[200];
            if (total !== 100) {
                Utils.showToast('סה"כ האחוזים חייב להיות 100%', 'error');
                return;
            }

            // בחירת שורות הנתונים - אם אין כותרות, גם השורה הראשונה היא נתונים
            let dataRows = excelData.rows;
            if (!hasHeaders) {
                // אם אין כותרות, צריך להוסיף את "שורת הכותרות" (שהיא בעצם נתונים) לרשימת הנתונים
                dataRows = [excelData.headers, ...excelData.rows];
            }

            console.log('נתונים לעיבוד:', dataRows);
            console.log('יש כותרות:', hasHeaders);

            // המרת נתוני האקסל לפורמט הנדרש
            const data = dataRows
                .filter(row => row[nameColIndex] && row[amountColIndex])
                .map(row => ({
                    name: String(row[nameColIndex]),
                    amount: Number(row[amountColIndex])
                }));

            console.log('נתונים מפורסרים:', data);

            if (data.length === 0) {
                Utils.showToast('לא נמצאו נתונים תקינים בקובץ', 'error');
                return;
            }

            const result = dataManager.addVouchersFromExcel(institutionId, groupId, data, distribution);

            this.closeModal();
            router.refresh();

            if (result.warnings.length > 0) {
                Utils.showToast(`נוצרו ${result.created} תלושים עם ${result.warnings.length} אזהרות`, 'warning');
            } else {
                Utils.showToast(`נוצרו ${result.created} תלושים בהצלחה`);
            }
        });
    },

    async loadXLSXLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    // ==================== הדפסה ====================

    printSingleVoucher(institutionId, groupId, voucherId) {
        const institution = dataManager.getInstitution(institutionId);
        const voucher = dataManager.getVoucher(institutionId, groupId, voucherId);

        if (!institution || !voucher) {
            Utils.showToast('שגיאה בטעינת התלוש', 'error');
            return;
        }

        this.openPrintWindow([{ ...voucher, institutionName: institution.name }]);
    },

    printGroupVouchers(institutionId, groupId) {
        const institution = dataManager.getInstitution(institutionId);
        const group = dataManager.getGroup(institutionId, groupId);

        if (!institution || !group || group.vouchers.length === 0) {
            Utils.showToast('אין תלושים להדפסה', 'warning');
            return;
        }

        const vouchers = group.vouchers.map(v => ({
            ...v,
            institutionName: institution.name
        }));

        this.openPrintWindow(vouchers);
    },

    openPrintWindow(vouchers) {
        const printWindow = window.open('', '_blank');

        const vouchersHTML = vouchers.map(v => `
            <div class="voucher">
                <div class="voucher-header">🎫 שובר הנחה</div>
                <div class="voucher-barcode">
                    <svg class="barcode" id="barcode-${v.barcode}"></svg>
                    <div class="barcode-number">${v.barcode}</div>
                </div>
                <div class="voucher-details">
                    <div class="voucher-row">שם: <strong>${v.ownerName}</strong></div>
                    <div class="voucher-row">סך: <strong>${Utils.formatCurrency(v.faceValue)}</strong></div>
                    <div class="voucher-row">מוסד: ${v.institutionName}</div>
                </div>
            </div>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="he" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>הדפסת שוברים</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: Arial, sans-serif; padding: 10mm; }
                    
                    .vouchers-container {
                        display: flex;
                        flex-direction: column;
                        gap: 5mm;
                    }
                    
                    .voucher {
                        border: 2px solid #333;
                        border-radius: 8px;
                        padding: 8mm;
                        height: 50mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        page-break-inside: avoid;
                        background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
                    }
                    
                    .voucher-header {
                        font-size: 18px;
                        font-weight: bold;
                        text-align: center;
                        color: #333;
                    }
                    
                    .voucher-barcode {
                        text-align: center;
                    }
                    
                    .voucher-barcode svg {
                        height: 30px;
                    }
                    
                    .barcode-number {
                        font-family: monospace;
                        font-size: 12px;
                        letter-spacing: 2px;
                    }
                    
                    .voucher-details {
                        display: flex;
                        justify-content: space-between;
                        font-size: 12px;
                    }
                    
                    .voucher-row {
                        flex: 1;
                    }
                    
                    @media print {
                        body { padding: 0; }
                        .voucher { margin-bottom: 2mm; }
                    }
                </style>
            </head>
            <body>
                <div class="vouchers-container">
                    ${vouchersHTML}
                </div>
                <script>
                    document.querySelectorAll('.barcode').forEach(svg => {
                        const barcode = svg.id.replace('barcode-', '');
                        JsBarcode(svg, barcode, {
                            format: 'CODE128',
                            width: 2,
                            height: 30,
                            displayValue: false
                        });
                    });
                    setTimeout(() => window.print(), 500);
                <\/script>
            </body>
            </html>
        `);

        printWindow.document.close();
    }
};

// פונקציות גלובליות
function closeModal() {
    App.closeModal();
}

// הפעלת האפליקציה בטעינה
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
