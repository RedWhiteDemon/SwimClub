SELECT m.id, m.user_id, m.message_body, m.created_at, u.name AS author_name
FROM (
  SELECT * FROM site_chat_messages ORDER BY created_at DESC LIMIT $1
) m
JOIN users u ON u.id = m.user_id
ORDER BY m.created_at ASC;
