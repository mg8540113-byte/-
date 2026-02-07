-- פונקציה לשליפת כל נתוני הדשבורד בקריאה אחת יעילה
-- יש להריץ את הסקריפט הזה ב-SQL Editor בתוך ממשק הניהול של Supabase

-- בדיקה אם הפונקציה קיימת והסרתה לצורך עדכון
drop function if exists get_dashboard_data();

create or replace function get_dashboard_data()
returns json
language sql
security definer -- רץ עם הרשאות מנהל כדי לעקוף בעיות גישה אם יש
as $$
  select coalesce(json_agg(
    json_build_object(
      'id', i.id,
      'name', i.name,
      'created_at', i.created_at,
      'groups', (
        select coalesce(json_agg(
          json_build_object(
            'id', g.id,
            'institution_id', g.institution_id,
            'name', g.name,
            'institution_subsidy_percent', g.institution_subsidy_percent,
            'admin_subsidy_percent', g.admin_subsidy_percent,
            'created_at', g.created_at,
            'vouchers', (
              select coalesce(json_agg(
                json_build_object(
                  'id', v.id,
                  'group_id', v.group_id,
                  'owner_name', v.owner_name,
                  'barcode', v.barcode,
                  'face_value', v.face_value,
                  'paid_amount', v.paid_amount,
                  'has_warning', v.has_warning,
                  'created_at', v.created_at
                ) order by v.created_at desc
              ), '[]'::json)
              from vouchers v
              where v.group_id = g.id
            )
          ) order by g.created_at
        ), '[]'::json)
        from groups g
        where g.institution_id = i.id
      )
    ) order by i.created_at
  ), '[]'::json)
  from institutions i;
$$;

-- הענקת הרשאות חובה כדי שהדפדפן יוכל להפעיל את הפונקציה!
grant execute on function get_dashboard_data() to anon, authenticated, service_role;
