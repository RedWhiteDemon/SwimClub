SELECT p.id, p.title, p.body, p.created_at, p.user_id,
       u.name AS author_name,
       (SELECT COUNT(*)::int FROM discussion_comments c WHERE c.post_id = p.id) AS comment_count
FROM discussion_posts p
JOIN users u ON u.id = p.user_id
ORDER BY p.created_at DESC;
