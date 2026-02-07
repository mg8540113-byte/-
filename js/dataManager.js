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
            console.log('Loading data: Starting Parallel Global Fetch...');

            // אנחנו שולפים את הטבלאות במקביל כדי לחסוך זמן
            // אין תלות בין הבקשות - השרת יחזיר מה שמותר למשתמש לראות (RLS)

            const pInstitutions = window.supabaseClient
                .from('institutions')
                .select('*')
                .order('created_at', { ascending: true });

            const pGroups = window.supabaseClient
                .from('groups')
                .select('*')
                .order('created_at', { ascending: true });

            // פונקציה פנימית למשיכת *כל* התלושים בפייג'ינג (Pagination)
            const fetchAllVouchers = async () => {
                let allVouchers = [];
                let from = 0;
                const step = 1000; // המקסימום של Supabase
                let more = true;

                while (more) {
                    console.log(`[DataManager] Fetching vouchers range ${from}-${from + step}...`);
                    const { data, error } = await window.supabaseClient
                        .from('vouchers')
                        .select('*')
                        .range(from, from + step - 1)
                        .order('created_at', { ascending: false });

                    if (error) throw error;

                    if (data && data.length > 0) {
                        allVouchers = allVouchers.concat(data);
                        from += step;
                        // אם קיבלנו פחות מהמקסימום, סימן שזה הסוף
                        if (data.length < step) more = false;
                    } else {
                        more = false;
                    }
                }
                return allVouchers;
            };

            // הרצת הבקשות במקביל
            const [instRes, groupRes, vouchersData] = await Promise.all([
                pInstitutions,
                pGroups,
                fetchAllVouchers()
            ]);

            if (instRes.error) throw instRes.error;
            if (groupRes.error) throw groupRes.error;

            const institutions = instRes.data;
            const groups = groupRes.data;
            // vouchersData is usually an array, not a response object because of the custom function

            if (!institutions || institutions.length === 0) {
                console.log('Cloud is empty. Checking for migration...');
                await this.migrateFromLocalStorage();
                return this.init(); // Retry
            }

            console.log(`[DataManager] Raw data loaded. Inst: ${institutions.length}, Groups: ${groups.length}, Vouchers: ${vouchersData.length}`);

            // === עיבוד וחיבור הנתונים בזיכרון (In-Memory Join) ===

            this.data.institutions = institutions.map(inst => {
                // מציאת הקבוצות של המוסד הזה
                const instGroups = groups.filter(g => g.institution_id === inst.id);

                // עיבוד הקבוצות
                const processedGroups = instGroups.map(group => {
                    // מציאת התלושים של הקבוצה הזו
                    const groupVouchers = vouchersData.filter(v => v.group_id === group.id);

                    return {
                        id: group.id,
                        name: group.name,
                        institutionSubsidyPercent: Number(group.institution_subsidy_percent),
                        adminSubsidyPercent: Number(group.admin_subsidy_percent),
                        createdAt: group.created_at,
                        vouchers: groupVouchers.map(v => ({
                            id: v.id,
                            ownerName: v.owner_name,
                            barcode: v.barcode,
                            faceValue: Number(v.face_value),
                            paidAmount: Number(v.paid_amount),
                            hasWarning: v.has_warning,
                            createdAt: v.created_at
                        }))
                    };
                });

                return {
                    id: inst.id,
                    name: inst.name,
                    createdAt: inst.created_at,
                    groups: processedGroups
                };
            });

            console.log('Data structure built successfully.');
            return true;

        } catch (error) {
            console.error('[DataManager] Critical Error:', error);
            Utils.showToast('שגיאה בטעינת נתונים (Global Fetch)', 'error');
            return false;
        }
    }

    /**
     * מיגרציה מ-localStorage ל-Supabase
     */
    async migrateFromLocalStorage() {
        try {
            const localDataStr = localStorage.getItem('voucherApp_data');
            if (!localDataStr) return;

            const localData = JSON.parse(localDataStr);
            if (!localData.institutions || localData.institutions.length === 0) return;

            console.log('Starting migration...');
            Utils.showToast('מתחיל מיגרציה לענן...', 'info');

            for (const inst of localData.institutions) {
                // יצירת מוסד
                const { data: newInst, error: instError } = await window.supabaseClient
                    .from('institutions')
                    .insert({ name: inst.name, created_at: inst.createdAt })
                    .select()
                    .single();

                if (instError) throw instError;

                for (const group of inst.groups) {
                    // יצירת קבוצה
                    const { data: newGroup, error: groupError } = await window.supabaseClient
                        .from('groups')
                        .insert({
                            institution_id: newInst.id,
                            name: group.name,
                            institution_subsidy_percent: group.institutionSubsidyPercent,
                            admin_subsidy_percent: group.adminSubsidyPercent,
                            created_at: group.createdAt
                        })
                        .select()
                        .single();

                    if (groupError) throw groupError;

                    // יצירת תלושים ב-Batch
                    const vouchersToInsert = group.vouchers.map(v => ({
                        group_id: newGroup.id,
                        owner_name: v.ownerName,
                        barcode: v.barcode,
                        face_value: v.faceValue,
                        paid_amount: v.paidAmount,
                        has_warning: v.hasWarning,
                        created_at: v.createdAt
                    }));

                    // מטפלים ב-Batch של 100 כדי לא להעמיס
                    const batchSize = 100;
                    for (let i = 0; i < vouchersToInsert.length; i += batchSize) {
                        const batch = vouchersToInsert.slice(i, i + batchSize);
                        const { error: voucherError } = await window.supabaseClient
                            .from('vouchers')
                            .insert(batch);

                        if (voucherError) throw voucherError;
                    }
                }
            }

            console.log('Migration completed successfully');
            Utils.showToast('הנתונים הועברו לענן בהצלחה!', 'success');

            // אפשר למחוק את הלוקאל אחרי שבדקנו שהכל עובד
            // localStorage.removeItem('voucherApp_data');

        } catch (error) {
            console.error('Migration failed:', error);
            Utils.showToast('שגיאה במיגרציה', 'error');
        }
    }

    /**
     * הוספת מוסד חדש
     */
    async addInstitution(name) {
        try {
            const { data, error } = await window.supabaseClient
                .from('institutions')
                .insert({ name: name })
                .select()
                .single();

            if (error) throw error;

            // רענון נתונים מלא
            await this.init();
            return data;
        } catch (error) {
            console.error('Error adding institution:', error);
            Utils.showToast('שגיאה בהוספת מוסד', 'error');
            throw error;
        }
    }

    /**
     * הוספת קבוצה למוסד
     */
    async addGroup(institutionId, groupData) {
        try {
            const { data, error } = await window.supabaseClient
                .from('groups')
                .insert({
                    institution_id: institutionId,
                    name: groupData.name,
                    institution_subsidy_percent: groupData.institutionSubsidyPercent,
                    admin_subsidy_percent: groupData.adminSubsidyPercent
                })
                .select()
                .single();

            if (error) throw error;

            await this.init();
            return data;
        } catch (error) {
            console.error('Error adding group:', error);
            Utils.showToast('שגיאה בהוספת קבוצה', 'error');
            throw error;
        }
    }

    /**
     * הוספת תלושים לקבוצה
     */
    async addVouchers(groupId, vouchers) {
        try {
            // המרה לפורמט של המסד
            const vouchersToInsert = vouchers.map(v => ({
                group_id: groupId,
                owner_name: v.ownerName,
                barcode: v.barcode,
                face_value: v.faceValue,
                paid_amount: v.paidAmount,
                has_warning: v.hasWarning,
                created_at: v.createdAt || new Date().toISOString()
            }));

            // שליחה בבת אחת (Supabase תומך ב-Batch insert)
            // אם הכמות גדולה מ-1000, כדאי לפצל, אבל ברוב המקרים זה בסדר
            const batchSize = 1000;
            for (let i = 0; i < vouchersToInsert.length; i += batchSize) {
                const batch = vouchersToInsert.slice(i, i + batchSize);
                const { error } = await window.supabaseClient
                    .from('vouchers')
                    .insert(batch);

                if (error) throw error;
            }

            await this.init();
            return true;
        } catch (error) {
            console.error('Error adding vouchers:', error);
            Utils.showToast('שגיאה בהוספת תלושים', 'error');
            throw error;
        }
    }

    /**
     * מחיקת תלושים של קבוצה
     */
    async deleteGroupVouchers(groupId) {
        try {
            const { error } = await window.supabaseClient
                .from('vouchers')
                .delete()
                .eq('group_id', groupId);

            if (error) throw error;

            // עדכון מקומי מהיר במקום טעינה מלאה
            await this.init();
            return true;
        } catch (error) {
            console.error('Error deleting vouchers:', error);
            Utils.showToast('שגיאה במחיקת תלושים', 'error');
            throw error;
        }
    }

    // --- Getters ---

    getInstitutions() {
        return this.data.institutions;
    }

    getInstitution(id) {
        return this.data.institutions.find(i => i.id === id);
    }

    getGroup(institutionId, groupId) {
        const inst = this.getInstitution(institutionId);
        if (inst) {
            return inst.groups.find(g => g.id === groupId);
        }
        return null;
    }
}
