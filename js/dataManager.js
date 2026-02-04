/**
 * DataManager - ניהול נתונים
 * מערכת ניהול שוברים
 * 
 * מבנה הנתונים:
 * {
 *     institutions: [
 *         {
 *             id: string,
 *             name: string,
 *             createdAt: string,
 *             groups: [
 *                 {
 *                     id: string,
 *                     name: string,
 *                     institutionSubsidyPercent: number,
 *                     adminSubsidyPercent: number,
 *                     createdAt: string,
 *                     vouchers: [
 *                         {
 *                             id: string,
 *                             ownerName: string,
 *                             barcode: string,
 *                             faceValue: number,
 *                             paidAmount: number,
 *                             createdAt: string,
 *                             hasWarning: boolean
 *                         }
 *                     ]
 *                 }
 *             ]
 *         }
 *     ]
 * }
 */

class DataManager {
    constructor() {
        this.STORAGE_KEY = 'voucherSystemData';
        this.data = this.loadData();
    }

    // ==================== אחסון ====================

    /**
     * טעינת נתונים מ-LocalStorage
     */
    loadData() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
        return { institutions: [] };
    }

    /**
     * שמירת נתונים ל-LocalStorage
     */
    saveData() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (error) {
            console.error('Error saving data:', error);
            Utils.showToast('שגיאה בשמירת הנתונים', 'error');
        }
    }

    // ==================== סטטיסטיקות גלובליות ====================

    /**
     * קבלת סטטיסטיקות כלליות לדשבורד
     */
    getGlobalStats() {
        let totalFaceValue = 0;
        let totalInstitutionDebt = 0;
        let totalAdminSubsidy = 0;

        for (const institution of this.data.institutions) {
            const instStats = this.getInstitutionStats(institution.id);
            totalFaceValue += instStats.totalFaceValue;
            totalInstitutionDebt += instStats.totalDebt;
            totalAdminSubsidy += instStats.totalAdminSubsidy;
        }

        return {
            totalFaceValue,
            totalInstitutionDebt,
            totalAdminSubsidy
        };
    }

    // ==================== מוסדות ====================

    /**
     * קבלת כל המוסדות
     */
    getAllInstitutions() {
        return this.data.institutions;
    }

    /**
     * קבלת מוסד לפי ID
     */
    getInstitution(id) {
        return this.data.institutions.find(inst => inst.id === id);
    }

    /**
     * הוספת מוסד חדש
     */
    addInstitution(name) {
        const institution = {
            id: Utils.generateId(),
            name: name,
            createdAt: new Date().toISOString(),
            groups: []
        };
        this.data.institutions.push(institution);
        this.saveData();
        return institution;
    }

    /**
     * עריכת מוסד
     */
    updateInstitution(id, updates) {
        const institution = this.getInstitution(id);
        if (institution) {
            Object.assign(institution, updates);
            this.saveData();
        }
        return institution;
    }

    /**
     * מחיקת מוסד (כולל כל הקבוצות והתלושים)
     */
    deleteInstitution(id) {
        const index = this.data.institutions.findIndex(inst => inst.id === id);
        if (index !== -1) {
            this.data.institutions.splice(index, 1);
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * קבלת סטטיסטיקות של מוסד
     */
    getInstitutionStats(institutionId) {
        const institution = this.getInstitution(institutionId);
        if (!institution) return null;

        let totalFaceValue = 0;
        let totalDebt = 0;
        let totalAdminSubsidy = 0;
        let totalVouchers = 0;
        const subsidyRanges = { institution: [], admin: [] };

        for (const group of institution.groups) {
            subsidyRanges.institution.push(group.institutionSubsidyPercent);
            subsidyRanges.admin.push(group.adminSubsidyPercent);

            for (const voucher of group.vouchers) {
                totalFaceValue += voucher.faceValue;
                totalDebt += Utils.calculateInstitutionDebt(voucher.paidAmount, group.institutionSubsidyPercent);
                totalAdminSubsidy += Utils.calculateAdminSubsidy(voucher.paidAmount, group.adminSubsidyPercent);
                totalVouchers++;
            }
        }

        return {
            totalFaceValue,
            totalDebt,
            totalAdminSubsidy,
            totalVouchers,
            institutionSubsidyRange: Utils.formatPercentRange(subsidyRanges.institution),
            adminSubsidyRange: Utils.formatPercentRange(subsidyRanges.admin)
        };
    }

    // ==================== קבוצות ====================

    /**
     * קבלת קבוצה לפי ID
     */
    getGroup(institutionId, groupId) {
        const institution = this.getInstitution(institutionId);
        if (!institution) return null;
        return institution.groups.find(g => g.id === groupId);
    }

    /**
     * הוספת קבוצה חדשה למוסד
     */
    addGroup(institutionId, name, institutionSubsidyPercent, adminSubsidyPercent) {
        const institution = this.getInstitution(institutionId);
        if (!institution) return null;

        const group = {
            id: Utils.generateId(),
            name: name,
            institutionSubsidyPercent: Number(institutionSubsidyPercent),
            adminSubsidyPercent: Number(adminSubsidyPercent),
            createdAt: new Date().toISOString(),
            vouchers: []
        };

        institution.groups.push(group);
        this.saveData();
        return group;
    }

    /**
     * עריכת קבוצה
     */
    updateGroup(institutionId, groupId, updates) {
        const group = this.getGroup(institutionId, groupId);
        if (group) {
            Object.assign(group, updates);
            this.saveData();
        }
        return group;
    }

    /**
     * מחיקת קבוצה (כולל כל התלושים)
     */
    deleteGroup(institutionId, groupId) {
        const institution = this.getInstitution(institutionId);
        if (!institution) return false;

        const index = institution.groups.findIndex(g => g.id === groupId);
        if (index !== -1) {
            institution.groups.splice(index, 1);
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * מחיקת כל התלושים מקבוצה
     */
    deleteAllVouchersFromGroup(institutionId, groupId) {
        const group = this.getGroup(institutionId, groupId);
        if (group) {
            group.vouchers = [];
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * קבלת סטטיסטיקות של קבוצה
     */
    getGroupStats(institutionId, groupId) {
        const group = this.getGroup(institutionId, groupId);
        if (!group) return null;

        let totalFaceValue = 0;
        let totalPaid = 0;
        let totalDebt = 0;
        let totalAdminSubsidy = 0;

        for (const voucher of group.vouchers) {
            totalFaceValue += voucher.faceValue;
            totalPaid += voucher.paidAmount;
            totalDebt += Utils.calculateInstitutionDebt(voucher.paidAmount, group.institutionSubsidyPercent);
            totalAdminSubsidy += Utils.calculateAdminSubsidy(voucher.paidAmount, group.adminSubsidyPercent);
        }

        return {
            totalFaceValue,
            totalPaid,
            totalDebt,
            totalAdminSubsidy,
            voucherCount: group.vouchers.length,
            totalDiscountPercent: group.institutionSubsidyPercent + group.adminSubsidyPercent
        };
    }

    // ==================== תלושים ====================

    /**
     * הוספת תלושים מקובץ Excel
     * @param {string} institutionId - ID המוסד
     * @param {string} groupId - ID הקבוצה
     * @param {Array} data - נתונים מהאקסל [{name, amount}, ...]
     * @param {Object} distribution - חלוקת אחוזים {50: 20, 100: 30, 200: 50}
     */
    addVouchersFromExcel(institutionId, groupId, data, distribution) {
        const group = this.getGroup(institutionId, groupId);
        if (!group) return { success: false, error: 'קבוצה לא נמצאה' };

        const results = {
            success: true,
            created: 0,
            warnings: []
        };

        // לוג לבדיקה
        console.log('=== יצירת תלושים ===');
        console.log('חלוקה:', distribution);
        console.log('סבסוד מוסד:', group.institutionSubsidyPercent, '%');
        console.log('סבסוד מנהל:', group.adminSubsidyPercent, '%');

        for (const row of data) {
            const paidAmount = Number(row.amount);
            if (isNaN(paidAmount) || paidAmount <= 0) {
                results.warnings.push(`${row.name}: סכום לא תקין`);
                continue;
            }

            console.log(`--- ${row.name}: ${paidAmount} ₪ ---`);

            // חישוב ערך נקוב כולל (סכום + סבסודים)
            const faceValue = Utils.calculateFaceValue(
                paidAmount,
                group.institutionSubsidyPercent,
                group.adminSubsidyPercent
            );

            console.log(`  ערך נקוב: ${faceValue} ₪`);

            // חלוקת תלושים לפי אחוזים
            const dist = Utils.distributeVouchers(faceValue, distribution);

            console.log(`  חולק: ${dist.totalAllocated} ₪, שארית: ${dist.remainder} ₪`);

            // יצירת תלושים לכל סוג
            for (const denom of [50, 100, 200]) {
                const count = dist.vouchers[denom]?.count || 0;

                if (count > 0) {
                    console.log(`    תלוש ${denom}₪: ${count} יחידות`);
                }

                for (let i = 0; i < count; i++) {
                    // חישוב paidAmount לכל תלוש: חלק יחסי מהסכום ששולם
                    // אם totalAllocated > 0, נחשב את החלק היחסי של denom מתוך הסה"כ
                    const voucherPaidAmount = dist.totalAllocated > 0
                        ? (paidAmount * denom) / dist.totalAllocated
                        : 0;

                    const voucher = {
                        id: Utils.generateId(),
                        ownerName: row.name,
                        barcode: Utils.generateBarcode(),
                        faceValue: denom,
                        paidAmount: voucherPaidAmount,
                        createdAt: new Date().toISOString(),
                        hasWarning: dist.hasWarning
                    };
                    group.vouchers.push(voucher);
                    results.created++;
                }
            }

            // הוספת אזהרה אם יש שארית
            if (dist.hasWarning) {
                results.warnings.push(`${row.name}: נותר סכום של ${Utils.formatCurrency(dist.remainder)} שלא חולק`);
            }
        }

        console.log(`=== נוצרו ${results.created} תלושים ===`);

        this.saveData();
        return results;
    }

    /**
     * מחיקת תלוש בודד
     */
    deleteVoucher(institutionId, groupId, voucherId) {
        const group = this.getGroup(institutionId, groupId);
        if (!group) return false;

        const index = group.vouchers.findIndex(v => v.id === voucherId);
        if (index !== -1) {
            group.vouchers.splice(index, 1);
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * קבלת תלוש לפי ID
     */
    getVoucher(institutionId, groupId, voucherId) {
        const group = this.getGroup(institutionId, groupId);
        if (!group) return null;
        return group.vouchers.find(v => v.id === voucherId);
    }

    // ==================== חיפוש ====================

    /**
     * חיפוש גלובלי במוסדות, קבוצות ואנשים
     */
    search(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();

        for (const institution of this.data.institutions) {
            // חיפוש במוסדות
            if (institution.name.toLowerCase().includes(lowerQuery)) {
                results.push({
                    type: 'institution',
                    typeLabel: 'מוסד',
                    id: institution.id,
                    name: institution.name,
                    path: { institutionId: institution.id }
                });
            }

            for (const group of institution.groups) {
                // חיפוש בקבוצות
                if (group.name.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        type: 'group',
                        typeLabel: 'קבוצה',
                        id: group.id,
                        name: group.name,
                        subtitle: institution.name,
                        path: { institutionId: institution.id, groupId: group.id }
                    });
                }

                // חיפוש באנשים (בעלי תלושים)
                const owners = new Set();
                for (const voucher of group.vouchers) {
                    if (voucher.ownerName.toLowerCase().includes(lowerQuery) && !owners.has(voucher.ownerName)) {
                        owners.add(voucher.ownerName);
                        results.push({
                            type: 'person',
                            typeLabel: 'אדם',
                            id: voucher.id,
                            name: voucher.ownerName,
                            subtitle: `${group.name} - ${institution.name}`,
                            path: { institutionId: institution.id, groupId: group.id }
                        });
                    }
                }
            }
        }

        return results;
    }

    // ==================== ייצוא ====================

    /**
     * ייצוא כל הנתונים לפורמט טקסט
     */
    exportAllData() {
        const stats = this.getGlobalStats();
        let content = '';

        content += '='.repeat(50) + '\n';
        content += 'מערכת ניהול שוברים - דוח מלא\n';
        content += `תאריך הפקה: ${Utils.formatDate(new Date())}\n`;
        content += '='.repeat(50) + '\n\n';

        content += '--- סיכום כללי ---\n';
        content += `שווי שוק כולל: ${Utils.formatCurrency(stats.totalFaceValue)}\n`;
        content += `סך חוב מוסדות: ${Utils.formatCurrency(stats.totalInstitutionDebt)}\n`;
        content += `סך סבסוד שלנו: ${Utils.formatCurrency(stats.totalAdminSubsidy)}\n\n`;

        for (const institution of this.data.institutions) {
            const instStats = this.getInstitutionStats(institution.id);
            content += '-'.repeat(40) + '\n';
            content += `מוסד: ${institution.name}\n`;
            content += `שווי תלושים: ${Utils.formatCurrency(instStats.totalFaceValue)}\n`;
            content += `חוב: ${Utils.formatCurrency(instStats.totalDebt)}\n`;
            content += `סבסוד שלנו: ${Utils.formatCurrency(instStats.totalAdminSubsidy)}\n`;

            for (const group of institution.groups) {
                const groupStats = this.getGroupStats(institution.id, group.id);
                content += `\n  קבוצה: ${group.name}\n`;
                content += `  סבסוד מוסד: ${group.institutionSubsidyPercent}%\n`;
                content += `  סבסוד מנהל: ${group.adminSubsidyPercent}%\n`;
                content += `  תלושים: ${groupStats.voucherCount}\n`;
                content += `  שווי: ${Utils.formatCurrency(groupStats.totalFaceValue)}\n`;

                for (const voucher of group.vouchers) {
                    content += `    - ${voucher.ownerName}: ${Utils.formatCurrency(voucher.faceValue)} [${voucher.barcode}]\n`;
                }
            }
            content += '\n';
        }

        return content;
    }

    /**
     * ייצוא כל התלושים לפורמט Excel (CSV)
     */
    exportAllToExcel() {
        const rows = [];

        // כותרות
        rows.push(['מוסד', 'קבוצה', 'סבסוד מוסד %', 'סבסוד מנהל %', 'שם בעלים', 'ערך נקוב', 'סכום ששולם', 'ברקוד', 'תאריך יצירה']);

        for (const institution of this.data.institutions) {
            for (const group of institution.groups) {
                for (const voucher of group.vouchers) {
                    rows.push([
                        institution.name,
                        group.name,
                        group.institutionSubsidyPercent,
                        group.adminSubsidyPercent,
                        voucher.ownerName,
                        voucher.faceValue,
                        Math.round(voucher.paidAmount * 100) / 100,
                        voucher.barcode,
                        Utils.formatDate(voucher.createdAt)
                    ]);
                }
            }
        }

        return rows;
    }

    /**
     * ייצוא נתוני מוסד ספציפי
     */
    exportInstitutionData(institutionId) {
        const institution = this.getInstitution(institutionId);
        if (!institution) return '';

        const stats = this.getInstitutionStats(institutionId);
        let content = '';

        content += `מוסד: ${institution.name}\n`;
        content += `תאריך: ${Utils.formatDate(new Date())}\n`;
        content += '-'.repeat(30) + '\n';
        content += `שווי תלושים: ${Utils.formatCurrency(stats.totalFaceValue)}\n`;
        content += `חוב: ${Utils.formatCurrency(stats.totalDebt)}\n`;
        content += `סבסוד שלנו: ${Utils.formatCurrency(stats.totalAdminSubsidy)}\n\n`;

        for (const group of institution.groups) {
            const groupStats = this.getGroupStats(institutionId, group.id);
            content += `קבוצה: ${group.name}\n`;
            content += `תלושים: ${groupStats.voucherCount} | שווי: ${Utils.formatCurrency(groupStats.totalFaceValue)}\n`;

            for (const voucher of group.vouchers) {
                content += `  - ${voucher.ownerName}: ${Utils.formatCurrency(voucher.faceValue)} [${voucher.barcode}]\n`;
            }
            content += '\n';
        }

        return content;
    }

    /**
     * ייצוא נתוני קבוצה ספציפית
     */
    exportGroupData(institutionId, groupId) {
        const institution = this.getInstitution(institutionId);
        const group = this.getGroup(institutionId, groupId);
        if (!institution || !group) return '';

        const stats = this.getGroupStats(institutionId, groupId);
        let content = '';

        content += `מוסד: ${institution.name}\n`;
        content += `קבוצה: ${group.name}\n`;
        content += `תאריך: ${Utils.formatDate(new Date())}\n`;
        content += '-'.repeat(30) + '\n';
        content += `סבסוד מוסד: ${group.institutionSubsidyPercent}%\n`;
        content += `סבסוד מנהל: ${group.adminSubsidyPercent}%\n`;
        content += `סה"כ הנחה: ${stats.totalDiscountPercent}%\n\n`;
        content += `תלושים: ${stats.voucherCount}\n`;
        content += `שווי כולל: ${Utils.formatCurrency(stats.totalFaceValue)}\n\n`;

        content += 'רשימת תלושים:\n';
        for (const voucher of group.vouchers) {
            content += `${voucher.ownerName} | ${Utils.formatCurrency(voucher.faceValue)} | ${voucher.barcode}\n`;
        }

        return content;
    }
}

// יצירת instance גלובלי
window.dataManager = new DataManager();
