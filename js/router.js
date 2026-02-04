/**
 * Router - ניהול ניווט
 * מערכת ניהול שוברים
 */

class Router {
    constructor() {
        this.routes = {
            'dashboard': this.renderDashboard.bind(this),
            'institution': this.renderInstitution.bind(this),
            'group': this.renderGroup.bind(this)
        };
        this.currentRoute = null;
        this.currentParams = {};
    }

    /**
     * ניווט לנתיב מסוים
     */
    navigate(route, params = {}) {
        this.currentRoute = route;
        this.currentParams = params;

        const renderFunction = this.routes[route];
        if (renderFunction) {
            renderFunction(params);
        } else {
            console.error('Route not found:', route);
            this.navigate('dashboard');
        }
    }

    /**
     * רענון העמוד הנוכחי
     */
    refresh() {
        if (this.currentRoute) {
            this.navigate(this.currentRoute, this.currentParams);
        }
    }

    // ==================== Dashboard ====================

    renderDashboard() {
        const stats = dataManager.getGlobalStats();
        const institutions = dataManager.getAllInstitutions();

        const html = `
            <!-- KPI Cards -->
            <div class="kpi-container">
                <div class="kpi-card">
                    <div class="kpi-value">${Utils.formatCurrency(stats.totalFaceValue)}</div>
                    <div class="kpi-label">שווי שוק כולל</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-value">${Utils.formatCurrency(stats.totalInstitutionDebt)}</div>
                    <div class="kpi-label">סך חוב מוסדות</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-value">${Utils.formatCurrency(stats.totalAdminSubsidy)}</div>
                    <div class="kpi-label">סך סבסוד שלנו</div>
                </div>
            </div>

            <!-- Institutions Grid -->
            <h2 style="margin-bottom: var(--spacing-lg);">מוסדות</h2>
            ${institutions.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state-icon">🏛️</div>
                    <div class="empty-state-title">אין מוסדות עדיין</div>
                    <p>לחץ על + להוספת מוסד ראשון</p>
                </div>
            ` : `
                <div class="cards-grid">
                    ${institutions.map(inst => this.renderInstitutionCard(inst)).join('')}
                </div>
            `}
        `;

        document.getElementById('mainContent').innerHTML = html;
        this.showFab(() => App.showAddInstitutionModal());
        this.setupExportButton(() => {
            const content = dataManager.exportAllData();
            Utils.exportToTXT(content, 'דוח_מלא.txt');
            Utils.showToast('הנתונים יוצאו בהצלחה');
        });
    }

    renderInstitutionCard(institution) {
        const stats = dataManager.getInstitutionStats(institution.id);

        return `
            <div class="card" onclick="router.navigate('institution', { id: '${institution.id}' })" style="cursor: pointer;">
                <div class="card-header">
                    <h3 class="card-title">🏛️ ${institution.name}</h3>
                    <div class="dropdown">
                        <button class="btn btn-icon btn-ghost" onclick="event.stopPropagation(); toggleDropdown(this)">⋮</button>
                        <div class="dropdown-menu">
                            <div class="dropdown-item" onclick="event.stopPropagation(); App.showEditInstitutionModal('${institution.id}')">
                                ✏️ עריכה
                            </div>
                            <div class="dropdown-item danger" onclick="event.stopPropagation(); App.confirmDeleteInstitution('${institution.id}')">
                                🗑️ מחיקה
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="page-stats" style="flex-direction: column; gap: var(--spacing-xs);">
                        <div class="page-stat">
                            <span>שווי תלושים:</span>
                            <span class="page-stat-value">${Utils.formatCurrency(stats.totalFaceValue)}</span>
                        </div>
                        <div class="page-stat">
                            <span>חוב:</span>
                            <span class="page-stat-value">${Utils.formatCurrency(stats.totalDebt)}</span>
                        </div>
                        <div class="page-stat">
                            <span>סבסוד שלנו:</span>
                            <span class="page-stat-value">${Utils.formatCurrency(stats.totalAdminSubsidy)}</span>
                        </div>
                        <div class="page-stat">
                            <span>הנחת מוסד:</span>
                            <span class="page-stat-value">${stats.institutionSubsidyRange}</span>
                        </div>
                        <div class="page-stat">
                            <span>סבסוד מנהל:</span>
                            <span class="page-stat-value">${stats.adminSubsidyRange}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==================== Institution View ====================

    renderInstitution(params) {
        const institution = dataManager.getInstitution(params.id);
        if (!institution) {
            this.navigate('dashboard');
            return;
        }

        const stats = dataManager.getInstitutionStats(params.id);

        const html = `
            <div class="back-btn" onclick="router.navigate('dashboard')">
                → חזרה לדשבורד
            </div>

            <div class="page-header">
                <h1 class="page-title">🏛️ ${institution.name}</h1>
                <div class="page-stats">
                    <div class="page-stat">
                        <span>שווי תלושים:</span>
                        <span class="page-stat-value">${Utils.formatCurrency(stats.totalFaceValue)}</span>
                    </div>
                    <div class="page-stat">
                        <span>חוב:</span>
                        <span class="page-stat-value">${Utils.formatCurrency(stats.totalDebt)}</span>
                    </div>
                    <div class="page-stat">
                        <span>סבסוד שלנו:</span>
                        <span class="page-stat-value">${Utils.formatCurrency(stats.totalAdminSubsidy)}</span>
                    </div>
                </div>
            </div>

            <h2 style="margin-bottom: var(--spacing-lg);">קבוצות</h2>
            ${institution.groups.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-title">אין קבוצות עדיין</div>
                    <p>לחץ על + להוספת קבוצה ראשונה</p>
                </div>
            ` : `
                <div class="cards-grid">
                    ${institution.groups.map(group => this.renderGroupCard(institution.id, group)).join('')}
                </div>
            `}
        `;

        document.getElementById('mainContent').innerHTML = html;
        this.showFab(() => App.showAddGroupModal(params.id));
        this.setupExportButton(() => {
            const content = dataManager.exportInstitutionData(params.id);
            Utils.exportToTXT(content, `דוח_${institution.name}.txt`);
            Utils.showToast('הנתונים יוצאו בהצלחה');
        });
    }

    renderGroupCard(institutionId, group) {
        const stats = dataManager.getGroupStats(institutionId, group.id);

        return `
            <div class="card" onclick="router.navigate('group', { institutionId: '${institutionId}', groupId: '${group.id}' })" style="cursor: pointer;">
                <div class="card-header">
                    <h3 class="card-title">👥 ${group.name}</h3>
                    <div class="dropdown">
                        <button class="btn btn-icon btn-ghost" onclick="event.stopPropagation(); toggleDropdown(this)">⋮</button>
                        <div class="dropdown-menu">
                            <div class="dropdown-item" onclick="event.stopPropagation(); App.showEditGroupModal('${institutionId}', '${group.id}')">
                                ✏️ עריכה
                            </div>
                            <div class="dropdown-item danger" onclick="event.stopPropagation(); App.confirmDeleteGroup('${institutionId}', '${group.id}')">
                                🗑️ מחיקת קבוצה
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="page-stats" style="flex-direction: column; gap: var(--spacing-xs);">
                        <div class="page-stat">
                            <span>סבסוד מוסד:</span>
                            <span class="page-stat-value">${group.institutionSubsidyPercent}%</span>
                        </div>
                        <div class="page-stat">
                            <span>סבסוד מנהל:</span>
                            <span class="page-stat-value">${group.adminSubsidyPercent}%</span>
                        </div>
                        <div class="page-stat">
                            <span>תלושים:</span>
                            <span class="page-stat-value">${stats.voucherCount}</span>
                        </div>
                        <div class="page-stat">
                            <span>שווי:</span>
                            <span class="page-stat-value">${Utils.formatCurrency(stats.totalFaceValue)}</span>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); App.printGroupVouchers('${institutionId}', '${group.id}')">
                        🖨️ הדפס
                    </button>
                    <button class="btn btn-danger" onclick="event.stopPropagation(); App.confirmDeleteAllVouchers('${institutionId}', '${group.id}')">
                        🗑️ מחק תלושים
                    </button>
                </div>
            </div>
        `;
    }

    // ==================== Group View ====================

    renderGroup(params) {
        const institution = dataManager.getInstitution(params.institutionId);
        const group = dataManager.getGroup(params.institutionId, params.groupId);

        if (!institution || !group) {
            this.navigate('dashboard');
            return;
        }

        const stats = dataManager.getGroupStats(params.institutionId, params.groupId);

        // קיבוץ תלושים לפי שם בעלים
        const vouchersByOwner = this.groupVouchersByOwner(group.vouchers);

        const html = `
            <div class="back-btn" onclick="router.navigate('institution', { id: '${params.institutionId}' })">
                → חזרה ל${institution.name}
            </div>

            <div class="page-header">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h1 class="page-title">👥 ${group.name}</h1>
                        <div class="page-stats">
                            <div class="page-stat">
                                <span>סבסוד מוסד:</span>
                                <span class="page-stat-value">${group.institutionSubsidyPercent}%</span>
                            </div>
                            <div class="page-stat">
                                <span>סבסוד מנהל:</span>
                                <span class="page-stat-value">${group.adminSubsidyPercent}%</span>
                            </div>
                            <div class="page-stat">
                                <span>תלושים:</span>
                                <span class="page-stat-value">${stats.voucherCount}</span>
                            </div>
                            <div class="page-stat">
                                <span>שווי:</span>
                                <span class="page-stat-value">${Utils.formatCurrency(stats.totalFaceValue)}</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-ghost" onclick="App.showEditGroupModal('${params.institutionId}', '${params.groupId}')">
                        ✏️ עריכה
                    </button>
                </div>
            </div>

            <div style="margin-bottom: var(--spacing-lg);">
                <button class="btn btn-primary" onclick="App.showUploadExcelModal('${params.institutionId}', '${params.groupId}')">
                    📂 העלאת קובץ Excel
                </button>
            </div>

            <h2 style="margin-bottom: var(--spacing-lg);">תלושים</h2>
            ${group.vouchers.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state-icon">🎫</div>
                    <div class="empty-state-title">אין תלושים עדיין</div>
                    <p>לחץ על "העלאת קובץ Excel" ליצירת תלושים</p>
                </div>
            ` : `
                <div class="owners-list">
                    ${this.renderVouchersGroupedByOwner(params.institutionId, params.groupId, vouchersByOwner, stats.totalDiscountPercent)}
                </div>
            `}
        `;

        document.getElementById('mainContent').innerHTML = html;
        this.hideFab();
        this.setupExportButton(() => {
            const content = dataManager.exportGroupData(params.institutionId, params.groupId);
            Utils.exportToTXT(content, `דוח_${group.name}.txt`);
            Utils.showToast('הנתונים יוצאו בהצלחה');
        });
    }

    /**
     * קיבוץ תלושים לפי שם בעלים
     */
    groupVouchersByOwner(vouchers) {
        const grouped = {};
        for (const voucher of vouchers) {
            if (!grouped[voucher.ownerName]) {
                grouped[voucher.ownerName] = [];
            }
            grouped[voucher.ownerName].push(voucher);
        }
        return grouped;
    }

    /**
     * רינדור תלושים מקובצים לפי בעלים עם צבעים מבדילים
     */
    renderVouchersGroupedByOwner(institutionId, groupId, vouchersByOwner, discountPercent) {
        const ownerNames = Object.keys(vouchersByOwner);
        const colors = [
            'rgba(108, 99, 255, 0.1)',   // סגול בהיר
            'rgba(78, 205, 196, 0.1)',   // טורקיז בהיר
            'rgba(255, 107, 157, 0.1)',  // ורוד בהיר
            'rgba(255, 230, 109, 0.15)', // צהוב בהיר
            'rgba(130, 170, 255, 0.1)',  // כחול בהיר
            'rgba(255, 159, 67, 0.1)',   // כתום בהיר
        ];

        return ownerNames.map((ownerName, index) => {
            const ownerVouchers = vouchersByOwner[ownerName];
            const bgColor = colors[index % colors.length];
            const totalValue = ownerVouchers.reduce((sum, v) => sum + v.faceValue, 0);

            return `
                <div class="owner-group" style="background: ${bgColor}; border-radius: var(--radius-lg); padding: var(--spacing-md); margin-bottom: var(--spacing-md);">
                    <div class="owner-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm); padding-bottom: var(--spacing-sm); border-bottom: 1px solid rgba(0,0,0,0.1);">
                        <div>
                            ${(() => {
                    // חילוץ שם נקי ואזהרה מהשם (אם קיים)
                    const warningMatch = ownerName.match(/\{warning:(\d+)\}/);
                    const displayName = ownerName.replace(/\{warning:\d+\}/, '').trim();
                    const warningAmount = warningMatch ? parseInt(warningMatch[1]) : 0;

                    let warningBadge = '';
                    if (warningAmount > 0) {
                        warningBadge = `<span class="badge" style="background: #ffaa00; color: #fff; margin-right: var(--spacing-sm);">⚠️ יתרה לא מנוצלת: ${Utils.formatCurrency(warningAmount)}</span>`;
                    }

                    return `<strong style="font-size: var(--font-size-lg);">👤 ${displayName}</strong> ${warningBadge}`;
                })()}
                            <span class="badge badge-primary" style="margin-right: var(--spacing-sm);">${ownerVouchers.length} תלושים</span>
                            <span class="text-muted">סה"כ: ${Utils.formatCurrency(totalValue)}</span>
                        </div>
                    </div>
                    <div class="owner-vouchers" style="display: flex; flex-wrap: wrap; gap: var(--spacing-sm);">
                        ${ownerVouchers.map(v => this.renderVoucherBubble(institutionId, groupId, v, discountPercent)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * רינדור תלוש כבועה קומפקטית
     */
    renderVoucherBubble(institutionId, groupId, voucher, discountPercent) {
        return `
            <div class="voucher-bubble" style="
                background: var(--bg-card);
                border-radius: var(--radius-md);
                padding: var(--spacing-sm) var(--spacing-md);
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                box-shadow: var(--shadow-sm);
                ${voucher.hasWarning ? 'border: 2px solid var(--color-warning);' : ''}
            ">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: var(--font-size-md);">${Utils.formatCurrency(voucher.faceValue)}</div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary);">${voucher.barcode}</div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="btn btn-ghost btn-icon" style="width: 28px; height: 28px; font-size: 14px;" onclick="App.printSingleVoucher('${institutionId}', '${groupId}', '${voucher.id}')" title="הדפס">
                        🖨️
                    </button>
                    <button class="btn btn-ghost btn-icon" style="width: 28px; height: 28px; font-size: 14px; color: var(--color-danger);" onclick="App.deleteVoucher('${institutionId}', '${groupId}', '${voucher.id}')" title="מחק">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    renderVoucherItem(institutionId, groupId, voucher, discountPercent) {
        return `
            <div class="data-item ${voucher.hasWarning ? 'alert-warning' : ''}">
                <div class="data-item-info">
                    <div class="data-item-title">${voucher.ownerName}</div>
                    <div class="data-item-meta">
                        <span>ברקוד: ${voucher.barcode}</span>
                        <span>סך: ${Utils.formatCurrency(voucher.faceValue)}</span>
                        <span class="badge badge-success">הנחה: ${discountPercent}%</span>
                    </div>
                </div>
                <div class="data-item-actions">
                    <button class="btn btn-primary btn-icon" onclick="App.printSingleVoucher('${institutionId}', '${groupId}', '${voucher.id}')" title="הדפס">
                        🖨️
                    </button>
                    <button class="btn btn-danger btn-icon" onclick="App.deleteVoucher('${institutionId}', '${groupId}', '${voucher.id}')" title="מחק">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    // ==================== Helpers ====================

    showFab(onClick) {
        const fab = document.getElementById('fabBtn');
        fab.classList.remove('hidden');
        fab.onclick = onClick;
    }

    hideFab() {
        document.getElementById('fabBtn').classList.add('hidden');
    }

    setupExportButton() {
        const btn = document.getElementById('exportBtn');
        const menu = document.getElementById('exportMenu');
        const txtBtn = document.getElementById('exportTxt');
        const excelBtn = document.getElementById('exportExcel');

        if (!btn || !menu) return;

        // Toggle menu
        btn.onclick = (e) => {
            e.stopPropagation();
            menu.classList.toggle('hidden');
        };

        // Close menu on outside click
        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });

        // Export to TXT
        txtBtn.onclick = () => {
            const content = dataManager.exportAllData();
            Utils.exportToTXT(content, 'דוח_מלא.txt');
            Utils.showToast('הנתונים יוצאו בהצלחה (TXT)');
            menu.classList.add('hidden');
        };

        // Export to Excel (CSV)
        excelBtn.onclick = () => {
            const data = dataManager.exportAllToExcel();
            Utils.exportToCSV(data, 'דוח_מלא.csv');
            Utils.showToast('הנתונים יוצאו בהצלחה (Excel/CSV)');
            menu.classList.add('hidden');
        };
    }
}

// יצירת instance גלובלי
window.router = new Router();

// פונקציית עזר ל-dropdown
function toggleDropdown(button) {
    const dropdown = button.closest('.dropdown');
    const isOpen = dropdown.classList.contains('open');

    // סגור את כל ה-dropdowns
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));

    // פתח/סגור את הנוכחי
    if (!isOpen) {
        dropdown.classList.add('open');
    }
}

// סגירת dropdowns בלחיצה מחוץ
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
    }
});
