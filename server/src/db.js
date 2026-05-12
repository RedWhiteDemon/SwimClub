const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { sessions, coaches, newsItems } = require("./seedData");

const dataDir = path.join(__dirname, "..", "data");
const jsonPath = path.join(dataDir, "club-data.json");

/** @type {{
 * sessions: Array<{ id: string, day: string, time: string, level: string, coach: string, capacity: number }>,
 * coaches: Array<{ id: number, name: string, specialization: string }>,
 * applications: Array<{ id: string, name: string, phone: string, session_id: string, level: string, created_at: string, user_id: string | null }>,
 * users: Array<{ id: string, email: string, password_hash: string, name: string, phone: string, role: string, created_at: string }>,
 * news_items: Array<{ id: string, title: string, body: string, tag: string | null, published_at: string }>,
 * password_reset_tokens: Array<{ token_hash: string, user_id: string, expires_at: string }>,
 * direct_messages: Array<{ id: string, from_user_id: string, to_user_id: string, text: string, created_at: string }>,
 * site_chat_messages: Array<{ id: string, user_id: string, text: string, created_at: string }>,
 * discussion_posts: Array<{ id: string, user_id: string, title: string, body: string, created_at: string }>,
 * discussion_comments: Array<{ id: string, post_id: string, user_id: string, body: string, created_at: string }>
 * }} */
let data = {
  sessions: [],
  coaches: [],
  applications: [],
  users: [],
  news_items: [],
  password_reset_tokens: [],
  direct_messages: [],
  site_chat_messages: [],
  discussion_posts: [],
  discussion_comments: []
};

function load() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, "utf8");
      data = { ...data, ...JSON.parse(raw) };
    } catch {
      /* оставить пустое */
    }
  }
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!Array.isArray(data.coaches)) data.coaches = [];
  if (!Array.isArray(data.applications)) data.applications = [];
  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.news_items)) data.news_items = [];
  if (!Array.isArray(data.password_reset_tokens)) data.password_reset_tokens = [];
  if (!Array.isArray(data.direct_messages)) data.direct_messages = [];
  if (!Array.isArray(data.site_chat_messages)) data.site_chat_messages = [];
  if (!Array.isArray(data.discussion_posts)) data.discussion_posts = [];
  if (!Array.isArray(data.discussion_comments)) data.discussion_comments = [];
}

function save() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");
}

function sortSessions(list) {
  return [...list].sort((a, b) => {
    const d = String(a.day).localeCompare(String(b.day), "ru");
    if (d !== 0) return d;
    return String(a.time).localeCompare(String(b.time), "ru");
  });
}

function sortNews(list) {
  return [...list].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
}

// --- API для index.js ---

function initDb() {
  load();

  if (data.sessions.length === 0) {
    data.sessions = sessions.map((s) => ({ ...s }));
    save();
  }
  if (data.coaches.length === 0) {
    data.coaches = coaches.map((c, i) => ({ id: i + 1, name: c.name, specialization: c.specialization }));
    save();
  }
  if (data.news_items.length === 0) {
    data.news_items = newsItems.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      tag: n.tag || null,
      published_at: n.published_at
    }));
    save();
  }

  seedAdminUserIfEmpty();
}

function seedAdminUserIfEmpty() {
  if (data.users.length > 0) return;
  const email = (process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const pass = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!email || !pass) return;
  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync(String(pass), 10);
  const now = new Date().toISOString();
  data.users.push({
    id,
    email,
    password_hash: hash,
    name: "Администратор",
    phone: "+375291111111",
    role: "admin",
    created_at: now
  });
  save();
}

function countUsers() {
  return data.users.length;
}

function getUserByEmail(email) {
  const em = String(email).trim().toLowerCase();
  return data.users.find((u) => u.email === em) || null;
}

function getUserById(id) {
  const u = data.users.find((x) => x.id === id);
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role };
}

function getUserRowById(id) {
  return data.users.find((x) => x.id === id) || null;
}

function insertUser(row) {
  data.users.push(row);
  save();
}

function pruneExpiredPasswordResetTokens() {
  const now = Date.now();
  const before = data.password_reset_tokens.length;
  data.password_reset_tokens = data.password_reset_tokens.filter((t) => Date.parse(t.expires_at) > now);
  if (data.password_reset_tokens.length !== before) {
    save();
  }
}

function hashPasswordResetToken(plain) {
  return crypto.createHash("sha256").update(String(plain), "utf8").digest("hex");
}

function addPasswordResetToken(userId, tokenHashHex, expiresAtIso) {
  pruneExpiredPasswordResetTokens();
  data.password_reset_tokens = data.password_reset_tokens.filter((t) => t.user_id !== userId);
  data.password_reset_tokens.push({
    token_hash: tokenHashHex,
    user_id: userId,
    expires_at: expiresAtIso
  });
  save();
}

function consumePasswordResetToken(plainToken) {
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
  const now = Date.now();
  let foundIdx = -1;
  let userId = null;
  for (let i = 0; i < data.password_reset_tokens.length; i++) {
    const t = data.password_reset_tokens[i];
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
      foundIdx = i;
      userId = t.user_id;
      break;
    }
  }
  if (foundIdx === -1) {
    return null;
  }
  data.password_reset_tokens.splice(foundIdx, 1);
  save();
  return userId;
}

function setUserPasswordHash(userId, passwordHash) {
  const u = data.users.find((x) => x.id === userId);
  if (!u) {
    return false;
  }
  u.password_hash = passwordHash;
  save();
  return true;
}

function listSessionsOrdered() {
  return sortSessions(data.sessions);
}

function getSessionById(id) {
  return data.sessions.find((s) => s.id === id) || null;
}

function insertSession(session) {
  data.sessions.push(session);
  save();
}

function updateSession(id, fields) {
  const i = data.sessions.findIndex((s) => s.id === id);
  if (i === -1) return null;
  data.sessions[i] = { ...data.sessions[i], ...fields, id };
  save();
  return data.sessions[i];
}

function deleteSession(id) {
  const i = data.sessions.findIndex((s) => s.id === id);
  if (i === -1) return false;
  data.sessions.splice(i, 1);
  save();
  return true;
}

function listCoachesOrdered() {
  return [...data.coaches].sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
}

function countApplicationsOnSession(sessionId, ignoreId = null) {
  return data.applications.filter(
    (a) => a.session_id === sessionId && (!ignoreId || a.id !== ignoreId)
  ).length;
}

function listApplicationsByUser(userId) {
  return data.applications
    .filter((a) => a.user_id === userId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function getApplicationById(id) {
  return data.applications.find((a) => a.id === id) || null;
}

function insertApplication(app) {
  data.applications.push(app);
  save();
}

function updateApplication(id, fields) {
  const i = data.applications.findIndex((a) => a.id === id);
  if (i === -1) return null;
  data.applications[i] = { ...data.applications[i], ...fields, id };
  save();
  return data.applications[i];
}

function deleteApplication(id) {
  const i = data.applications.findIndex((a) => a.id === id);
  if (i === -1) return false;
  data.applications.splice(i, 1);
  save();
  return true;
}

function listNewsForApi() {
  return sortNews(data.news_items).map((n) => ({
    id: n.id,
    title: n.title,
    text: n.body,
    tag: n.tag,
    date: n.published_at
  }));
}

function getNewsItemRow(id) {
  return data.news_items.find((n) => n.id === id) || null;
}

function insertNewsItem(row) {
  data.news_items.push(row);
  save();
}

function updateNewsItem(id, fields) {
  const i = data.news_items.findIndex((n) => n.id === id);
  if (i === -1) return null;
  data.news_items[i] = { ...data.news_items[i], ...fields, id };
  save();
  return data.news_items[i];
}

function deleteNewsItem(id) {
  const i = data.news_items.findIndex((n) => n.id === id);
  if (i === -1) return false;
  data.news_items.splice(i, 1);
  save();
  return true;
}

function listAllApplicationsWithUsers() {
  const rows = [...data.applications].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
  return rows.map((a) => {
    const u = a.user_id ? getUserById(a.user_id) : null;
    return {
      id: a.id,
      name: a.name,
      phone: a.phone,
      session_id: a.session_id,
      level: a.level,
      created_at: a.created_at,
      user_id: a.user_id,
      user: u ? { id: u.id, email: u.email, name: u.name } : null
    };
  });
}

const SITE_CHAT_MAX_MESSAGES = 500;

function listSiteChatMessagesForApi() {
  const sorted = [...data.site_chat_messages].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
  const slice = sorted.length > SITE_CHAT_MAX_MESSAGES ? sorted.slice(-SITE_CHAT_MAX_MESSAGES) : sorted;
  return slice.map((m) => {
    const u = getUserById(m.user_id);
    return {
      id: m.id,
      from_user_id: m.user_id,
      text: m.text,
      created_at: m.created_at,
      author_name: u && u.name ? String(u.name) : "Участник"
    };
  });
}

function insertSiteChatMessage(row) {
  data.site_chat_messages.push(row);
  save();
}

function getDiscussionPostById(id) {
  return data.discussion_posts.find((p) => p.id === id) || null;
}

function listDiscussionPostsForApi() {
  const sorted = [...data.discussion_posts].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
  return sorted.map((p) => {
    const u = getUserById(p.user_id);
    const body = String(p.body || "");
    const preview =
      body.length > 220 ? `${body.slice(0, 220).trim()}…` : body;
    return {
      id: p.id,
      title: p.title,
      body_preview: preview,
      created_at: p.created_at,
      author_id: p.user_id,
      author_name: u && u.name ? String(u.name) : "Участник",
      comment_count: data.discussion_comments.filter((c) => c.post_id === p.id).length
    };
  });
}

function listDiscussionCommentsForApi(postId) {
  const rows = data.discussion_comments.filter((c) => c.post_id === postId);
  return [...rows]
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((c) => {
      const u = getUserById(c.user_id);
      return {
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        author_id: c.user_id,
        author_name: u && u.name ? String(u.name) : "Участник"
      };
    });
}

function getDiscussionThreadForApi(postId) {
  const post = getDiscussionPostById(postId);
  if (!post) {
    return null;
  }
  const u = getUserById(post.user_id);
  return {
    post: {
      id: post.id,
      title: post.title,
      body: post.body,
      created_at: post.created_at,
      author_id: post.user_id,
      author_name: u && u.name ? String(u.name) : "Участник"
    },
    comments: listDiscussionCommentsForApi(postId)
  };
}

function insertDiscussionPost(row) {
  data.discussion_posts.push(row);
  save();
}

function insertDiscussionComment(row) {
  data.discussion_comments.push(row);
  save();
}

function getDiscussionCommentById(id) {
  return data.discussion_comments.find((c) => c.id === id) || null;
}

function updateDiscussionPost(id, fields) {
  const i = data.discussion_posts.findIndex((p) => p.id === id);
  if (i === -1) {
    return null;
  }
  const row = data.discussion_posts[i];
  const next = { ...row, ...fields, id };
  data.discussion_posts[i] = next;
  save();
  return next;
}

function updateDiscussionComment(id, fields) {
  const i = data.discussion_comments.findIndex((c) => c.id === id);
  if (i === -1) {
    return null;
  }
  const row = data.discussion_comments[i];
  const next = { ...row, ...fields, id };
  data.discussion_comments[i] = next;
  save();
  return next;
}

module.exports = {
  initDb,
  jsonPath,
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
