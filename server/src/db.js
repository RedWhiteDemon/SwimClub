const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const { sessions, coaches, newsItems } = require("./seedData");

function toIso(v) {
  if (v == null) {
    return null;
  }
  if (v instanceof Date) {
    return v.toISOString();
  }
  return String(v);
}

function createPool() {
  const conn = process.env.DATABASE_URL;
  if (conn && String(conn).trim()) {
    return new Pool({ connectionString: String(conn).trim() });
  }
  const user = process.env.PGUSER;
  const database = process.env.PGDATABASE || "swimclub";
  if (!user) {
    throw new Error(
      "PostgreSQL: задайте DATABASE_URL или пару PGUSER + PGDATABASE (и при необходимости PGHOST, PGPORT, PGPASSWORD)."
    );
  }
  return new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user,
    password: process.env.PGPASSWORD || "",
    database
  });
}

const pool = createPool();
const schemaSqlPath = path.resolve(__dirname, "../sql/schema.sql");
const queriesDir = path.resolve(__dirname, "../sql/queries");

function readSql(name) {
  const sqlPath = path.join(queriesDir, name);
  const sql = fs.readFileSync(sqlPath, "utf8").trim();
  if (!sql) {
    throw new Error(`PostgreSQL: SQL query file is empty (${sqlPath}).`);
  }
  return sql;
}

const SQL_LIST_ALL_APPLICATIONS_WITH_USERS = readSql("list_all_applications_with_users.sql");
const SQL_LIST_SITE_CHAT_MESSAGES = readSql("list_site_chat_messages.sql");
const SQL_LIST_DISCUSSION_POSTS = readSql("list_discussion_posts.sql");
const SQL_LIST_DISCUSSION_COMMENTS = readSql("list_discussion_comments.sql");

async function runMigrations() {
  const schemaSql = fs.readFileSync(schemaSqlPath, "utf8").trim();
  if (!schemaSql) {
    throw new Error(`PostgreSQL: SQL schema file is empty (${schemaSqlPath}).`);
  }
  await pool.query(schemaSql);
}

async function initDb() {
  await runMigrations();

  const { rows: coachCount } = await pool.query("SELECT COUNT(*)::int AS n FROM coaches");
  if (coachCount[0].n === 0) {
    for (let i = 0; i < coaches.length; i++) {
      const c = coaches[i];
      await pool.query(
        "INSERT INTO coaches (name, specialization) VALUES ($1, $2)",
        [c.name, c.specialization]
      );
    }
  }

  const { rows: sessCount } = await pool.query("SELECT COUNT(*)::int AS n FROM sessions");
  if (sessCount[0].n === 0) {
    for (const s of sessions) {
      await pool.query(
        "INSERT INTO sessions (id, day, time, level, coach, capacity) VALUES ($1,$2,$3,$4,$5,$6)",
        [s.id, s.day, s.time, s.level, s.coach, s.capacity]
      );
    }
  }

  const { rows: newsCount } = await pool.query("SELECT COUNT(*)::int AS n FROM news_items");
  if (newsCount[0].n === 0) {
    for (const n of newsItems) {
      await pool.query(
        "INSERT INTO news_items (id, title, body, tag, published_at) VALUES ($1,$2,$3,$4,$5::date)",
        [n.id, n.title, n.body, n.tag || null, n.published_at]
      );
    }
  }

  await seedAdminUserIfEmpty();
}

async function seedAdminUserIfEmpty() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  if (rows[0].n > 0) {
    return;
  }
  const email = (process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const pass = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!email || !pass) {
    return;
  }
  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync(String(pass), 10);
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, phone, role, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz)`,
    [id, email, hash, "Администратор", "+375291111111", "admin", now]
  );
}

async function countUsers() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  return rows[0].n;
}

async function getUserByEmail(email) {
  const em = String(email).trim().toLowerCase();
  const { rows } = await pool.query("SELECT * FROM users WHERE lower(email) = lower($1)", [em]);
  return rows[0] || null;
}

async function getUserById(id) {
  const { rows } = await pool.query(
    "SELECT id, email, name, phone, role FROM users WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

async function getUserRowById(id) {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] || null;
}

async function insertUser(row) {
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, phone, role, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz)`,
    [row.id, row.email, row.password_hash, row.name, row.phone, row.role, row.created_at]
  );
}

function hashPasswordResetToken(plain) {
  return crypto.createHash("sha256").update(String(plain), "utf8").digest("hex");
}

async function pruneExpiredPasswordResetTokens() {
  await pool.query("DELETE FROM password_reset_tokens WHERE expires_at <= NOW()");
}

async function addPasswordResetToken(userId, tokenHashHex, expiresAtIso) {
  await pruneExpiredPasswordResetTokens();
  await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
  await pool.query(
    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3::timestamptz)",
    [userId, tokenHashHex, expiresAtIso]
  );
}

async function consumePasswordResetToken(plainToken) {
  if (!plainToken || typeof plainToken !== "string") {
    return null;
  }
  const wantHex = hashPasswordResetToken(plainToken);
  let wantBuf;
  try {
    wantBuf = Buffer.from(wantHex, "hex");
  } catch {
    return null;
  }
  const { rows } = await pool.query(
    "SELECT user_id, token_hash FROM password_reset_tokens WHERE expires_at > NOW()"
  );
  const now = Date.now();
  for (const t of rows) {
    if (Number.isNaN(Date.parse(t.expires_at)) || Date.parse(t.expires_at) <= now) {
      continue;
    }
    let rowBuf;
    try {
      rowBuf = Buffer.from(String(t.token_hash), "hex");
    } catch {
      continue;
    }
    if (rowBuf.length !== wantBuf.length) {
      continue;
    }
    if (crypto.timingSafeEqual(rowBuf, wantBuf)) {
      await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [t.user_id]);
      return t.user_id;
    }
  }
  return null;
}

async function setUserPasswordHash(userId, passwordHash) {
  const r = await pool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, passwordHash]);
  return r.rowCount > 0;
}

async function listSessionsOrdered() {
  const { rows } = await pool.query(
    "SELECT id, day, time, level, coach, capacity FROM sessions ORDER BY day, time"
  );
  return rows.map((r) => ({ ...r, capacity: Number(r.capacity) }));
}

async function getSessionById(id) {
  const { rows } = await pool.query(
    "SELECT id, day, time, level, coach, capacity FROM sessions WHERE id = $1",
    [id]
  );
  if (!rows[0]) {
    return null;
  }
  const r = rows[0];
  return { ...r, capacity: Number(r.capacity) };
}

async function insertSession(session) {
  await pool.query(
    "INSERT INTO sessions (id, day, time, level, coach, capacity) VALUES ($1,$2,$3,$4,$5,$6)",
    [session.id, session.day, session.time, session.level, session.coach, session.capacity]
  );
}

async function updateSession(id, fields) {
  const { rows } = await pool.query(
    `UPDATE sessions SET day = $2, time = $3, level = $4, coach = $5, capacity = $6
     WHERE id = $1
     RETURNING id, day, time, level, coach, capacity`,
    [id, fields.day, fields.time, fields.level, fields.coach, fields.capacity]
  );
  if (!rows[0]) {
    return null;
  }
  const r = rows[0];
  return { ...r, capacity: Number(r.capacity) };
}

async function deleteSession(id) {
  const r = await pool.query("DELETE FROM sessions WHERE id = $1", [id]);
  return r.rowCount > 0;
}

async function listCoachesOrdered() {
  const { rows } = await pool.query("SELECT id, name, specialization FROM coaches ORDER BY name");
  return rows.map((r) => ({ id: Number(r.id), name: r.name, specialization: r.specialization }));
}

async function countApplicationsOnSession(sessionId, ignoreId = null) {
  if (ignoreId) {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM applications WHERE session_id = $1 AND id <> $2",
      [sessionId, ignoreId]
    );
    return rows[0].n;
  }
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM applications WHERE session_id = $1",
    [sessionId]
  );
  return rows[0].n;
}

async function listApplicationsByUser(userId) {
  const { rows } = await pool.query(
    "SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows.map((a) => ({
    ...a,
    created_at: toIso(a.created_at)
  }));
}

async function getApplicationById(id) {
  const { rows } = await pool.query("SELECT * FROM applications WHERE id = $1", [id]);
  if (!rows[0]) {
    return null;
  }
  const a = rows[0];
  return { ...a, created_at: toIso(a.created_at) };
}

async function insertApplication(app) {
  await pool.query(
    `INSERT INTO applications (id, name, phone, session_id, level, created_at, user_id)
     VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7)`,
    [app.id, app.name, app.phone, app.session_id, app.level, app.created_at, app.user_id]
  );
}

async function updateApplication(id, fields) {
  await pool.query(
    `UPDATE applications SET name = $2, phone = $3, session_id = $4, level = $5
     WHERE id = $1`,
    [id, fields.name, fields.phone, fields.session_id, fields.level]
  );
  return getApplicationById(id);
}

async function deleteApplication(id) {
  const r = await pool.query("DELETE FROM applications WHERE id = $1", [id]);
  return r.rowCount > 0;
}

function formatNewsDate(d) {
  if (d instanceof Date) {
    return d.toISOString().slice(0, 10);
  }
  return String(d).slice(0, 10);
}

async function listNewsForApi() {
  const { rows } = await pool.query(
    "SELECT id, title, body, tag, published_at FROM news_items ORDER BY published_at DESC"
  );
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    text: n.body,
    tag: n.tag,
    date: formatNewsDate(n.published_at)
  }));
}

async function getNewsItemRow(id) {
  const { rows } = await pool.query("SELECT * FROM news_items WHERE id = $1", [id]);
  if (!rows[0]) {
    return null;
  }
  const n = rows[0];
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    tag: n.tag,
    published_at: formatNewsDate(n.published_at)
  };
}

async function insertNewsItem(row) {
  await pool.query(
    "INSERT INTO news_items (id, title, body, tag, published_at) VALUES ($1,$2,$3,$4,$5::date)",
    [row.id, row.title, row.body, row.tag, row.published_at]
  );
}

async function updateNewsItem(id, fields) {
  await pool.query(
    "UPDATE news_items SET title = $2, body = $3, tag = $4, published_at = $5::date WHERE id = $1",
    [id, fields.title, fields.body, fields.tag, fields.published_at]
  );
  return getNewsItemRow(id);
}

async function deleteNewsItem(id) {
  const r = await pool.query("DELETE FROM news_items WHERE id = $1", [id]);
  return r.rowCount > 0;
}

async function listAllApplicationsWithUsers() {
  const { rows } = await pool.query(SQL_LIST_ALL_APPLICATIONS_WITH_USERS);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    session_id: r.session_id,
    level: r.level,
    created_at: toIso(r.created_at),
    user_id: r.user_id,
    user: r.u_id ? { id: r.u_id, email: r.u_email, name: r.u_name } : null
  }));
}

const SITE_CHAT_MAX_MESSAGES = 500;

async function listSiteChatMessagesForApi() {
  const { rows } = await pool.query(SQL_LIST_SITE_CHAT_MESSAGES, [SITE_CHAT_MAX_MESSAGES]);
  return rows.map((m) => ({
    id: m.id,
    from_user_id: m.user_id,
    text: m.message_body,
    created_at: toIso(m.created_at),
    author_name: m.author_name ? String(m.author_name) : "Участник"
  }));
}

async function insertSiteChatMessage(row) {
  await pool.query(
    "INSERT INTO site_chat_messages (id, user_id, message_body, created_at) VALUES ($1,$2,$3,$4::timestamptz)",
    [row.id, row.user_id, row.text, row.created_at]
  );
}

async function getDiscussionPostById(id) {
  const { rows } = await pool.query("SELECT * FROM discussion_posts WHERE id = $1", [id]);
  if (!rows[0]) {
    return null;
  }
  const p = rows[0];
  return { ...p, created_at: toIso(p.created_at) };
}

async function listDiscussionPostsForApi() {
  const { rows } = await pool.query(SQL_LIST_DISCUSSION_POSTS);
  return rows.map((p) => {
    const body = String(p.body || "");
    const preview = body.length > 220 ? `${body.slice(0, 220).trim()}…` : body;
    return {
      id: p.id,
      title: p.title,
      body_preview: preview,
      created_at: toIso(p.created_at),
      author_id: p.user_id,
      author_name: p.author_name ? String(p.author_name) : "Участник",
      comment_count: Number(p.comment_count) || 0
    };
  });
}

async function listDiscussionCommentsForApi(postId) {
  const { rows } = await pool.query(SQL_LIST_DISCUSSION_COMMENTS, [postId]);
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    created_at: toIso(c.created_at),
    author_id: c.user_id,
    author_name: c.author_name ? String(c.author_name) : "Участник"
  }));
}

async function getDiscussionThreadForApi(postId) {
  const post = await getDiscussionPostById(postId);
  if (!post) {
    return null;
  }
  const u = await getUserById(post.user_id);
  return {
    post: {
      id: post.id,
      title: post.title,
      body: post.body,
      created_at: post.created_at,
      author_id: post.user_id,
      author_name: u && u.name ? String(u.name) : "Участник"
    },
    comments: await listDiscussionCommentsForApi(postId)
  };
}

async function insertDiscussionPost(row) {
  await pool.query(
    `INSERT INTO discussion_posts (id, user_id, title, body, created_at)
     VALUES ($1,$2,$3,$4,$5::timestamptz)`,
    [row.id, row.user_id, row.title, row.body || "", row.created_at]
  );
}

async function insertDiscussionComment(row) {
  await pool.query(
    `INSERT INTO discussion_comments (id, post_id, user_id, body, created_at)
     VALUES ($1,$2,$3,$4,$5::timestamptz)`,
    [row.id, row.post_id, row.user_id, row.body, row.created_at]
  );
}

async function getDiscussionCommentById(id) {
  const { rows } = await pool.query("SELECT * FROM discussion_comments WHERE id = $1", [id]);
  if (!rows[0]) {
    return null;
  }
  const c = rows[0];
  return { ...c, created_at: toIso(c.created_at) };
}

async function updateDiscussionPost(id, fields) {
  await pool.query("UPDATE discussion_posts SET title = $2, body = $3 WHERE id = $1", [
    id,
    fields.title,
    fields.body != null ? fields.body : ""
  ]);
  return getDiscussionPostById(id);
}

async function updateDiscussionComment(id, fields) {
  await pool.query("UPDATE discussion_comments SET body = $2 WHERE id = $1", [id, fields.body]);
  return getDiscussionCommentById(id);
}

async function closePool() {
  await pool.end();
}

module.exports = {
  initDb,
  closePool,
  pool,
  countUsers,
  getUserByEmail,
  getUserById,
  getUserRowById,
  insertUser,
  hashPasswordResetToken,
  addPasswordResetToken,
  consumePasswordResetToken,
  setUserPasswordHash,
  listSessionsOrdered,
  getSessionById,
  insertSession,
  updateSession,
  deleteSession,
  listCoachesOrdered,
  countApplicationsOnSession,
  listApplicationsByUser,
  getApplicationById,
  insertApplication,
  updateApplication,
  deleteApplication,
  listNewsForApi,
  getNewsItemRow,
  insertNewsItem,
  updateNewsItem,
  deleteNewsItem,
  listAllApplicationsWithUsers,
  listSiteChatMessagesForApi,
  insertSiteChatMessage,
  getDiscussionPostById,
  listDiscussionPostsForApi,
  getDiscussionThreadForApi,
  insertDiscussionPost,
  insertDiscussionComment,
  getDiscussionCommentById,
  updateDiscussionPost,
  updateDiscussionComment
};
