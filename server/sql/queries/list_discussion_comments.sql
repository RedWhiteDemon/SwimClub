SELECT c.id, c.body, c.created_at, c.user_id, u.name AS author_name
FROM discussion_comments c
JOIN users u ON u.id = c.user_id
WHERE c.post_id = $1
ORDER BY c.created_at ASC;
