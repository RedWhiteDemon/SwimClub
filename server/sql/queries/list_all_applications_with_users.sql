SELECT a.id, a.name, a.phone, a.session_id, a.level, a.created_at, a.user_id,
       u.id AS u_id, u.email AS u_email, u.name AS u_name
FROM applications a
LEFT JOIN users u ON u.id = a.user_id
ORDER BY a.created_at DESC;
