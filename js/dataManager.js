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
        this.data = {
            institutions: []
        };
        // Data loading is now async via init()
    }

    /**
     * טעינת נתונים ראשונית מהענן
     */
    async init() {
        try {
            console.log('Loading data from Supabase...');

            // טעינת מוסדות
            const { data: institutions, error: instError } = await window.supabaseClient
                .from('institutions')
                .select('*')
                .order('created_at', { ascending: true });

            if (instError) throw instError;

            // בדיקת מיגרציה: אם אין כלום בענן, ננסה לייבא לוקאלית
            if (institutions.length === 0) {
                console.log('Cloud is empty. Checking for migration...');
                await this.migrateFromLocalStorage();
                // אחרי המיגרציה נטען שוב (רקורסיבי אבל מבוקר כי אז יהיה דאטה)
                // נקרא שוב ל-Supabase "ידנית" כדי למלא את ה-state
                // או שפשוט נחזיר true וזה יטען בפעם הבאה?
                // עדיף לטעון:
                return this.init();
            }

            this.data.institutions = [];

            for (const inst of institutions) {
                // טעינת קבוצות לכל מוסד
                const { data: groups, error: groupError } = await window.supabaseClient
                    .from('groups')
                    .select('*')
                    .eq('institution_id', inst.id)
                    .order('created_at', { ascending: true });

                if (groupError) throw groupError;

                const groupsWithVouchers = [];
                for (const group of groups) {
                    // טעינת תלושים לכל קבוצה
                    const { data: vouchers, error: voucherError } = await window.supabaseClient
                        .from('vouchers')
                        .select('*')
                        .eq('group_id', group.id)
                        .order('created_at', { ascending: false });

                    if (voucherError) throw voucherError;

                    // מיפוי נתונים (Snake Case -> Camel Case)
                    const mappedVouchers = vouchers.map(v => ({
                        id: v.id,
                        ownerName: v.owner_name,
                        barcode: v.barcode,
                        faceValue: Number(v.face_value),
                        paidAmount: Number(v.paid_amount),
                        hasWarning: v.has_warning,
                        createdAt: v.created_at
                    }));

                    groupsWithVouchers.push({
                        id: group.id,
                        name: group.name,
                        institutionSubsidyPercent: Number(group.institution_subsidy_percent),
                        adminSubsidyPercent: Number(group.admin_subsidy_percent),
                        createdAt: group.created_at,
                        vouchers: mappedVouchers
                    });
                }

                this.data.institutions.push({
                    id: inst.id,
                    name: inst.name,
                    createdAt: inst.created_at,
                    groups: groupsWithVouchers
                });
            }

            console.log('Data loaded successfully from Cloud');
            return true;
        } catch (error) {
            console.error('Error loading data from Supabase:', error);
            Utils.showToast('שגיאה בטעינת נתונים מהענן', 'error');
            return false;
        }
    }

    /**
     * מיגרציה מ-LocalStorage ל-Supabase
     */
    async migrateFromLocalStorage() {
        try {
            const stored = localStorage.getItem('voucherSystemData');
            if (!stored) return;

            const localData = JSON.parse(stored);
            if (!localData.institutions || localData.institutions.length === 0) return;

            console.log('Migrating data from LocalStorage:', localData);
            Utils.showToast('מבצע מיגרציה של נתונים לענן...', 'info');

            for (const inst of localData.institutions) {
                // יצירת מוסד
                const { error: instError } = await window.supabaseClient
                    .from('institutions')
                    .insert([{ id: inst.id, name: inst.name }]);

                if (instError) throw instError;

                for (const group of inst.groups) {
                    // יצירת קבוצה
                    const { error: groupError } = await window.supabaseClient
                        .from('groups')
                        .insert([{
                            id: group.id,
                            institution_id: inst.id,
                            name: group.name,
                            institution_subsidy_percent: group.institutionSubsidyPercent,
                            admin_subsidy_percent: group.adminSubsidyPercent
                        }]);

                    if (groupError) throw groupError;

                    // הכנת תלושים
                    const vouchersToInsert = group.vouchers.map(v => ({
                        id: v.id,
                        group_id: group.id,
                        owner_name: v.ownerName,
                        barcode: v.barcode,
                        face_value: v.faceValue,
                        paid_amount: v.paidAmount,
                        has_warning: v.hasWarning,
                        created_at: v.createdAt
                    }));

                    if (vouchersToInsert.length > 0) {
                        const { error: voucherError } = await window.supabaseClient
                            .from('vouchers')
                            .insert(vouchersToInsert);

                        if (voucherError) throw voucherError;
                    }
                }
            }

            Utils.showToast('המיגרציה הושלמה בהצלחה!');
            console.log('Migration completed');

        } catch (error) {
            console.error('Migration failed:', error);
            Utils.showToast('שגיאה במיגרציה נתונים', 'error');
        }
    }

    // ==================== מוסדות (Async) ====================

    /**
     * הוספת מוסד חדש
     */
    async addInstitution(name) {
        const id = Utils.generateId();
        try {
            const { error } = await window.supabaseClient
                .from('institutions')
                .insert([{ id, name }]);

            if (error) throw error;

            const institution = {
                id,
                name: name,
                createdAt: new Date().toISOString(),
                groups: []
            };
            this.data.institutions.push(institution);
            return institution;
        } catch (error) {
            console.error('Error adding institution:', error);
            Utils.showToast('שגיאה בשמירת מוסד', 'error');
            throw error;
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

    // addInstitution כבר קיים למעלה (אסינכרוני)

    /**
     * עריכת מוסד
     */
    async updateInstitution(id, updates) {
        try {
            const { error } = await window.supabaseClient
                .from('institutions')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            const institution = this.getInstitution(id);
            if (institution) {
                Object.assign(institution, updates);
            }
            return institution;
        } catch (error) {
            console.error('Error updating institution:', error);
            Utils.showToast('שגיאה בעדכון מוסד', 'error');
            throw error;
        }
    }

    /**
     * מחיקת מוסד (כולל כל הקבוצות והתלושים)
     */
    async deleteInstitution(id) {
        try {
            const { error } = await window.supabaseClient
                .from('institutions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            const index = this.data.institutions.findIndex(inst => inst.id === id);
            if (index !== -1) {
                this.data.institutions.splice(index, 1);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting institution:', error);
            Utils.showToast('שגיאה במחיקת מוסד', 'error');
            throw error;
        }
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
     * הוספת קבוצה חדשה למוסד (Async)
     */
    async addGroup(institutionId, name, institutionSubsidyPercent, adminSubsidyPercent) {
        const institution = this.getInstitution(institutionId);
        if (!institution) return null;

        const id = Utils.generateId();
        const group = {
            id,
            institution_id: institutionId,
            name: name,
            institution_subsidy_percent: Number(institutionSubsidyPercent),
            admin_subsidy_percent: Number(adminSubsidyPercent)
        };

        try {
            const { error } = await window.supabaseClient
                .from('groups')
                .insert([group]);

            if (error) throw error;

            const newGroup = {
                id: group.id,
                name: group.name,
                institutionSubsidyPercent: group.institution_subsidy_percent,
                adminSubsidyPercent: group.admin_subsidy_percent,
                createdAt: new Date().toISOString(),
                vouchers: []
            };

            institution.groups.push(newGroup);
            return newGroup;
        } catch (error) {
            console.error('Error adding group:', error);
            Utils.showToast('שגיאה בשמירת קבוצה', 'error');
            throw error;
        }
    }

    /**
     * עריכת קבוצה (Async)
     */
    async updateGroup(institutionId, groupId, updates) {
        // המרה לפורמט של DB במידת הצורך
        const dbUpdates = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.institutionSubsidyPercent !== undefined) dbUpdates.institution_subsidy_percent = updates.institutionSubsidyPercent;
        if (updates.adminSubsidyPercent !== undefined) dbUpdates.admin_subsidy_percent = updates.adminSubsidyPercent;

        if (Object.keys(dbUpdates).length === 0) return this.getGroup(institutionId, groupId);

        try {
            const { error } = await window.supabaseClient
                .from('groups')
                .update(dbUpdates)
                .eq('id', groupId);

            if (error) throw error;

            const group = this.getGroup(institutionId, groupId);
            if (group) {
                Object.assign(group, updates);
            }
            return group;
        } catch (error) {
            console.error('Error updating group:', error);
            Utils.showToast('שגיאה בעדכון קבוצה', 'error');
            throw error;
        }
    }

    /**
     * מחיקת קבוצה (Async)
     */
    async deleteGroup(institutionId, groupId) {
        const institution = this.getInstitution(institutionId);
        if (!institution) return false;

        try {
            const { error } = await window.supabaseClient
                .from('groups')
                .delete()
                .eq('id', groupId);

            if (error) throw error;

            const index = institution.groups.findIndex(g => g.id === groupId);
            if (index !== -1) {
                institution.groups.splice(index, 1);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting group:', error);
            Utils.showToast('שגיאה במחיקת קבוצה', 'error');
            throw error;
        }
    }

    /**
     * מחיקת כל התלושים מקבוצה (Async)
     */
    async deleteAllVouchersFromGroup(institutionId, groupId) {
        const group = this.getGroup(institutionId, groupId);
        if (!group) return false;

        try {
            const { error } = await window.supabaseClient
                .from('vouchers')
                .delete()
                .eq('group_id', groupId);

            if (error) throw error;

            group.vouchers = [];
            return true;
        } catch (error) {
            console.error('Error deleting all vouchers:', error);
            Utils.showToast('שגיאה במחיקת תלושים', 'error');
            throw error;
        }
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
    /**
     * הוספת תלושים מקובץ Excel (Async Batch Insert)
     * @param {string} institutionId - ID המוסד
     * @param {string} groupId - ID הקבוצה
     * @param {Array} data - נתונים מהאקסל [{name, amount}, ...]
     * @param {Object} distribution - חלוקת אחוזים {50: 20, 100: 30, 200: 50}
     */
    async addVouchersFromExcel(institutionId, groupId, data, distribution) {
        const group = this.getGroup(institutionId, groupId);
        if (!group) return { success: false, error: 'קבוצה לא נמצאה' };

        const results = {
            success: true,
            created: 0,
            warnings: []
        };
        const vouchersToInsert = [];
        const localVouchers = [];

        console.log('=== יצירת תלושים (Supabase) ===');

        for (const row of data) {
            const paidAmount = Number(row.amount);
            if (isNaN(paidAmount) || paidAmount <= 0) {
                results.warnings.push(`${row.name}: סכום לא תקין`);
                continue;
            }

            // חישוב ערך נקוב כולל
            const faceValue = Utils.calculateFaceValue(
                paidAmount,
                group.institutionSubsidyPercent,
                group.adminSubsidyPercent
            );

            // חלוקת תלושים
            const dist = Utils.distributeVouchers(faceValue, distribution);

            // יצירת תלושים לכל סוג
            const denominations = [200, 100, 50]; // סדר יצירה
            for (const denom of denominations) {
                const count = dist.vouchers[denom]?.count || 0;
                for (let i = 0; i < count; i++) {
                    const voucherPaidAmount = dist.totalAllocated > 0
                        ? (paidAmount * denom) / dist.totalAllocated
                        : 0;

                    const id = Utils.generateId();
                    const barcode = Utils.generateBarcode();
                    const createdAt = new Date().toISOString();

                    // אובייקט ל-DB (Snake Case)
                    let ownerNameDB = row.name;
                    // אם זה התלוש הראשון ויש אזהרה, נצמיד את סכום האזהרה לשם (פתרון זמני ללא שינוי סכמה)
                    if (i === 0 && denom === denominations.find(d => dist.vouchers[d].count > 0) && dist.hasWarning && dist.remainder > 0) {
                        // בדיקה שזו האיטרציה הראשונה באמת שיצרנו תלוש עבורה
                    }

                    // לוגיקה פשוטה יותר: נסמן את התלוש הראשון שנוצר עבור האדם הזה
                    const isFirstVoucherForPerson = vouchersToInsert.filter(v => v.owner_name.startsWith(row.name)).length === 0;

                    if (isFirstVoucherForPerson && dist.hasWarning && dist.remainder > 0) {
                        ownerNameDB = `${row.name} {warning:${dist.remainder}}`;
                    }

                    vouchersToInsert.push({
                        id: id,
                        group_id: groupId,
                        owner_name: ownerNameDB,
                        barcode: barcode,
                        face_value: denom,
                        paid_amount: voucherPaidAmount,
                        has_warning: dist.hasWarning,
                        // created_at נוצר אוטומטית אבל נשלח כדי לסנכרן
                    });

                    // אובייקט ל-Local State (Camel Case)
                    localVouchers.push({
                        id: id,
                        ownerName: ownerNameDB,
                        barcode: barcode,
                        faceValue: denom,
                        paidAmount: voucherPaidAmount,
                        hasWarning: dist.hasWarning,
                        createdAt: createdAt
                    });
                    results.created++;
                }
            }

            if (dist.hasWarning) {
                results.warnings.push(`${row.name}: נותר סכום של ${Utils.formatCurrency(dist.remainder)} שלא חולק`);
            }
        }

        if (vouchersToInsert.length === 0) {
            return results;
        }

        try {
            // Batch Insert ל-Supabase
            const { error } = await window.supabaseClient
                .from('vouchers')
                .insert(vouchersToInsert);

            if (error) throw error;

            console.log(`Saved ${vouchersToInsert.length} vouchers to Cloud`);

            // עדכון ה-State המקומי
            group.vouchers.push(...localVouchers);
            return results;
        } catch (error) {
            console.error('Error saving vouchers to Supabase:', error);
            Utils.showToast('שגיאה בשמירת התלושים בענן', 'error');
            return { success: false, error: error.message, created: 0, warnings: results.warnings };
        }
    }

    /**
     * מחיקת תלוש בודד (Async)
     */
    async deleteVoucher(institutionId, groupId, voucherId) {
        const group = this.getGroup(institutionId, groupId);
        if (!group) return false;

        try {
            const { error } = await window.supabaseClient
                .from('vouchers')
                .delete()
                .eq('id', voucherId);

            if (error) throw error;

            const index = group.vouchers.findIndex(v => v.id === voucherId);
            if (index !== -1) {
                group.vouchers.splice(index, 1);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting voucher:', error);
            Utils.showToast('שגיאה במחיקת תלוש', 'error');
            throw error;
        }
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
