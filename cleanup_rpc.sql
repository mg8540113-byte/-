-- מוחק את פונקציית הנתונים כדי לוודא שאין שום דבר "רע" שרץ בשרת
-- הפונקציה הזו ממילא לא בשימוש בגרסה החדשה, אז בטוח למחוק אותה

drop function if exists get_dashboard_data();

-- בדיקת תקינות בסיסית (רק כדי לראות שהשרת חי)
select count(*) as total_vouchers from vouchers;
