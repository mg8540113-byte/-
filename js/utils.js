/**
 * Utils - פונקציות עזר כלליות
 * מערכת ניהול שוברים
 */

const Utils = {
    /**
     * יצירת מזהה ייחודי (UUID)
     */
    generateId() {
        return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * יצירת ברקוד אקראי (9 ספרות)
     */
    generateBarcode() {
        let barcode = '';
        for (let i = 0; i < 9; i++) {
            barcode += Math.floor(Math.random() * 10);
        }
        return barcode;
    },

    /**
     * פורמט מספר למטבע ישראלי
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('he-IL', {
            style: 'currency',
            currency: 'ILS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    /**
     * פורמט אחוזים
     */
    formatPercent(value) {
        return `${value}%`;
    },

    /**
     * פורמט טווח אחוזים (מינימום-מקסימום)
     */
    formatPercentRange(values) {
        if (!values || values.length === 0) return '0%';
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (min === max) return `${min}%`;
        return `${min}%-${max}%`;
    },

    /**
     * עיגול סכום לכפולה של 50
     */
    roundToNearest50(amount) {
        return Math.floor(amount / 50) * 50;
    },

    /**
     * חישוב ערך נקוב לפי סכום ששולם ואחוזי סבסוד
     * @param {number} paidAmount - הסכום ששילם הלקוח
     * @param {number} institutionSubsidyPercent - אחוז סבסוד המוסד
     * @param {number} adminSubsidyPercent - אחוז סבסוד המנהל
     * @returns {number} - הערך הנקוב הכולל
     */
    calculateFaceValue(paidAmount, institutionSubsidyPercent, adminSubsidyPercent) {
        const institutionSubsidy = paidAmount * (institutionSubsidyPercent / 100);
        const adminSubsidy = paidAmount * (adminSubsidyPercent / 100);
        return paidAmount + institutionSubsidy + adminSubsidy;
    },

    /**
     * חישוב חוב המוסד
     */
    calculateInstitutionDebt(paidAmount, institutionSubsidyPercent) {
        return paidAmount * (institutionSubsidyPercent / 100);
    },

    /**
     * חישוב סבסוד המנהל
     */
    calculateAdminSubsidy(paidAmount, adminSubsidyPercent) {
        return paidAmount * (adminSubsidyPercent / 100);
    },

    /**
     * חלוקת תלושים לפי אחוזים וסוגי ערך
     * @param {number} totalFaceValue - סך הערך הנקוב
     * @param {Object} distribution - אובייקט עם אחוזים לכל סוג תלוש {50: 20, 100: 30, 200: 50}
     * @returns {Object} - אובייקט עם כמות תלושים לכל סוג והאם יש שארית
     */
    /**
     * חלוקת תלושים לפי אחוזים, עם אופטימיזציה לשאריות
     * @param {number} totalFaceValue - סך הערך הנקוב
     * @param {Object} distribution - אובייקט עם אחוזים לכל סוג תלוש {50: 20, 100: 30, 200: 50}
     * @returns {Object} - אובייקט עם כמות תלושים לכל סוג והאם יש שארית
     */
    distributeVouchers(totalFaceValue, distribution) {
        const result = {
            vouchers: {},
            totalAllocated: 0,
            remainder: 0,
            hasWarning: false,
            stats: {}
        };

        const denominations = [200, 100, 50]; // סדר יורד חשוב לשלב השאריות
        let currentTotalAllocated = 0;

        // שלב 1: חלוקה לפי אחוזים (ללא חריגה)
        for (const denom of denominations) {
            const percent = distribution[denom] || 0;
            const targetAmount = (totalFaceValue * percent) / 100;

            // כמה תלושים שלמים נכנסים? (תמיד מעגלים למטה, לא חורגים)
            const count = Math.floor(targetAmount / denom);
            const allocated = count * denom;
            const remainderFromType = targetAmount - allocated;

            result.vouchers[denom] = {
                count: count,
                allocated: allocated
            };

            // שמירת נתונים סטטיסטיים לפי בקשת המשתמש
            // 1. הסכום שעוד לא מומש
            // 2. כמה אחוז ממה שאמור היה להיכנס - אכן נכנס
            result.stats[denom] = {
                unrealizedAmount: remainderFromType,
                fulfillmentPercent: targetAmount > 0 ? (allocated / targetAmount) * 100 : 0
            };

            currentTotalAllocated += allocated;
        }

        // שלב 2: טיפול בשאריות (Greedy)
        // סוכמים את כל השאריות מכל הסוגים (שזה בעצם הסך הכל פחות מה שהצלחנו לשבץ)
        let remainingGlobal = totalFaceValue - currentTotalAllocated;

        // מנסים להכניס את השארית לתלושים המתאימים (מהגדול לקטן)
        for (const denom of denominations) {
            if (remainingGlobal >= denom) {
                const extraCount = Math.floor(remainingGlobal / denom);
                const extraValue = extraCount * denom;

                // עדכון התלושים הקיימים
                result.vouchers[denom].count += extraCount;
                result.vouchers[denom].allocated += extraValue;

                currentTotalAllocated += extraValue;
                remainingGlobal -= extraValue;

                console.log(`  → שארית ${extraValue}₪ הומרה ל-${extraCount} תלושים של ${denom}₪`);
            }
        }

        // סיכום סופי
        result.totalAllocated = currentTotalAllocated;
        result.remainder = remainingGlobal;
        result.hasWarning = result.remainder > 0;

        return result;
    },

    /**
     * Debounce - השהיית פונקציה
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * הצגת הודעת Toast
     */
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * קריאת קובץ Excel
     * הערה: נדרש ספריית SheetJS (xlsx)
     */
    async readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                    // קבלת שמות העמודות (שורה ראשונה)
                    const headers = jsonData[0] || [];
                    // קבלת הנתונים (משורה שנייה ואילך)
                    const rows = jsonData.slice(1);

                    resolve({ headers, rows });
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * ייצוא נתונים ל-CSV
     */
    exportToCSV(data, filename) {
        const BOM = '\uFEFF'; // Unicode BOM for Hebrew support
        const csvContent = BOM + data.map(row =>
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    },

    /**
     * ייצוא נתונים ל-TXT
     */
    exportToTXT(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    },

    /**
     * פורמט תאריך
     */
    formatDate(date) {
        return new Intl.DateTimeFormat('he-IL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }
};

// הפיכת Utils לזמין גלובלית
window.Utils = Utils;
