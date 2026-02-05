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

            // שלב 1: טעינת מבנה (מוסדות וקבוצות)
            const { data: institutions, error: instError } = await window.supabaseClient
                .from('institutions')
                .select(`
                    *,
                    groups (*)
                `)
                .order('created_at', { ascending: true });

            if (instError) throw instError;

            if (!institutions || institutions.length === 0) {
                console.log('Cloud is empty. Checking for migration...');
                await this.migrateFromLocalStorage();
                return this.init();
            }

            // שלב 2: טעינת כל התלושים במכה אחת (עם הגדלת המגבלה ל-10,000)
            // אנו אוספים את כל ה-ID של הקבוצות כדי להביא רק את התלושים הרלוונטיים (למרות שכרגע זה הכל)
            const allGroupIds = institutions.flatMap(i => (i.groups || []).map(g => g.id));

            let allVouchers = [];
            if (allGroupIds.length > 0) {
                // פיצול רשימת הקבוצות למנות קטנות כדי למנוע שגיאת URI Too Long
                const chunkSize = 20; // 20 קבוצות בכל בקשה
                // מגבלת מקביליות כדי לא לחנוק את הדפדפן/שרת (Rate Limiting)
                const maxConcurrency = 5;
                const allChunks = [];

                // הכנת רשימת המנות לביצוע
                for (let i = 0; i < allGroupIds.length; i += chunkSize) {
                    allChunks.push(allGroupIds.slice(i, i + chunkSize));
                }

                // ביצוע במקביל אבל במנות (Waves)
                const results = [];
                for (let i = 0; i < allChunks.length; i += maxConcurrency) {
                    const activeBatch = allChunks.slice(i, i + maxConcurrency);

                    const batchPromises = activeBatch.map(async (groupIdsChunk) => {
                        let chunkVouchers = [];
                        let from = 0;
                        const step = 1000;
                        let more = true;

                        while (more) {
                            const to = from + step - 1;
                            const { data: vouchers, error: voucherError } = await window.supabaseClient
                                .from('vouchers')
                                .select('*')
                                .in('group_id', groupIdsChunk)
                                .range(from, to)
                                .order('created_at', { ascending: false });

                            if (voucherError) throw voucherError;

                            if (vouchers && vouchers.length > 0) {
                                chunkVouchers = chunkVouchers.concat(vouchers);
                                from += step;
                                if (vouchers.length < step) {
                                    more = false;
                                }
                            } else {
                                more = false;
                            }
                        }
                        return chunkVouchers;
                    });

                    // מחכים שרק הנגלה הזאת תסתיים לפני שעוברים לנגלה הבאה
                    const batchResults = await Promise.all(batchPromises);
                    results.push(...batchResults);
                }

                allVouchers = results.flat();
            }

            this.data.institutions = [];

            // שלב 3: איחוד הנתונים בזיכרון
            for (const inst of institutions) {

                // מיון קבוצות
                const sortedGroups = (inst.groups || []).sort((a, b) =>
                    new Date(a.created_at) - new Date(b.created_at)
                );

                const groupsWithVouchers = sortedGroups.map(group => {
                    // סינון התלושים ששייכים לקבוצה הזו מתוך המאגר הגדול
                    const groupVouchers = allVouchers.filter(v => v.group_id === group.id);

                    // מיון תלושים
                    const sortedVouchers = groupVouchers.sort((a, b) =>
                        new Date(b.created_at) - new Date(a.created_at)
                    );

                    // מיפוי נתונים
                    const mappedVouchers = sortedVouchers.map(v => ({
                        id: v.id,
                        ownerName: v.owner_name,
                        barcode: v.barcode,
                        faceValue: Number(v.face_value),
                        paidAmount: Number(v.paid_amount),
                        hasWarning: v.has_warning,
                        createdAt: v.created_at
                    }));

                    return {
                        id: group.id,
                        name: group.name,
                        institutionSubsidyPercent: Number(group.institution_subsidy_percent),
                        adminSubsidyPercent: Number(group.admin_subsidy_percent),
                        createdAt: group.created_at,
                        vouchers: mappedVouchers
                    };
                });

                this.data.institutions.push({
                    id: inst.id,
                    name: inst.name,
                    createdAt: inst.created_at,
                    groups: groupsWithVouchers
                });
            }

            console.log(`Data loaded successfully: ${institutions.length} institutions, ${allVouchers.length} vouchers`);
            return true;
        } catch (error) {
            console.error('Error loading data from Supabase:', error);
            Utils.showToast('שגיאה בטעינת נתונים מהענן', 'error');
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
