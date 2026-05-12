require("dotenv").config();
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const path = require("path");
const {
  initDb,
  pool,
  countUsers,
  getUserByEmail,
  getUserById,
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
} = require("./db");
const { sendPasswordResetEmail, isSmtpConfigured } = require("./mail");
const { normalizeEmail, isValidEmail } = require("./emailValidate");

const dataDirForSecret = path.join(__dirname, "..", "data");
const jwtSecretFile = path.join(dataDirForSecret, ".jwt-secret");

function resolveJwtSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && String(fromEnv).length >= 16) {
    return String(fromEnv);
  }
  if (fs.existsSync(jwtSecretFile)) {
    const fileSecret = fs.readFileSync(jwtSecretFile, "utf8").trim();
    if (fileSecret.length >= 16) {
      return fileSecret;
    }
  }
  if (!fs.existsSync(dataDirForSecret)) {
    fs.mkdirSync(dataDirForSecret, { recursive: true });
  }
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(jwtSecretFile, generated, "utf8");
  console.log(
    "[swim-club-api] Создан JWT_SECRET в server/data/.jwt-secret — вход доступен без .env. Для продакшена задайте переменную JWT_SECRET."
  );
  return generated;
}

const JWT_SECRET = resolveJwtSecret();
const jwtReady = Boolean(JWT_SECRET && String(JWT_SECRET).length >= 16);
if (!jwtReady) {
  console.warn("[swim-club-api] Внутренняя ошибка: JWT_SECRET слишком короткий.");
}

if (!isSmtpConfigured()) {
  console.log(
    "[swim-club-api] SMTP не настроен (.env: SMTP_HOST или SMTP_URL + SMTP_FROM/SMTP_USER). Письма сброса пароля не отправляются — ссылка появится в логе при «Забыли пароль»."
  );
}

const app = express();
const port = Number(process.env.PORT) || 3000;
const PASSWORD_RESET_TTL_MS = Number(process.env.PASSWORD_RESET_TTL_MS) || 3600000;

if (isSmtpConfigured() && !(process.env.PUBLIC_APP_URL || "").trim()) {
  console.warn(
    "[swim-club-api] SMTP настроен, но PUBLIC_APP_URL пуст — задайте публичный URL сайта для корректных ссылок в письмах."
  );
}

function absolutePasswordResetLink(tokenPlain) {
  const base = (process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  const p = `/reset-password.html#token=${encodeURIComponent(tokenPlain)}`;
  if (base) {
    return `${base}${p}`;
  }
  return `http://localhost:${port}${p}`;
}

app.use(cors());
app.use(express.json());

/** Оборачивает async-обработчики для Express 4 (передача ошибок в next). */
function ar(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (err) {
      next(err);
    }
  };
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Беларусь: +375 и 9 цифр после кода страны */
function isValidBYPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("375")) return true;
  const withoutPlus = String(phone || "")
    .replace(/\s/g, "")
    .replace(/^\+/, "");
  return /^375\d{9}$/.test(withoutPlus);
}

function signToken(user) {
  if (!JWT_SECRET || String(JWT_SECRET).length < 16) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function verifyToken(token) {
  if (!jwtReady) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function ensureJwt(res) {
  if (!jwtReady) {
    res.status(503).json({ error: "Сервер не настроен: укажите JWT_SECRET (минимум 16 символов) в .env." });
    return false;
  }
  return true;
}

async function authMiddleware(req, res, next) {
  if (!jwtReady) {
    return res.status(503).json({ error: "Сервер не настроен: укажите JWT_SECRET в .env." });
  }
  const header = req.headers.authorization || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : null;
  if (!token) {
    return res.status(401).json({ error: "Требуется авторизация." });
  }
  const payload = verifyToken(token);
  if (!payload || !payload.sub) {
    return res.status(401).json({ error: "Сессия недействительна." });
  }
  try {
    const user = await getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "Пользователь не найден." });
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Недостаточно прав." });
  }
  next();
}

async function rowToSessionWithBooked(row) {
  if (!row) return null;
  const booked = await countApplicationsOnSession(row.id);
  return {
    id: row.id,
    day: row.day,
    time: row.time,
    level: row.level,
    coach: row.coach,
    capacity: row.capacity,
    booked
  };
}

app.get(
  "/api/health",
  ar(async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "postgresql" });
  })
);

app.get(
  "/api/sessions",
  ar(async (_req, res) => {
    const rows = await listSessionsOrdered();
    const out = await Promise.all(rows.map((r) => rowToSessionWithBooked(r)));
    res.json(out);
  })
);

app.get(
  "/api/news",
  ar(async (_req, res) => {
    res.json(await listNewsForApi());
  })
);

app.get(
  "/api/coaches",
  ar(async (_req, res) => {
    res.json(await listCoachesOrdered());
  })
);

// --- Auth ---

app.post(
  "/api/auth/register",
  ar(async (req, res) => {
    if (!ensureJwt(res)) return;

    const { email, password, name, phone } = req.body || {};
    if (!email || !password || !name || !phone) {
      return res.status(400).json({ error: "Заполните email, пароль, имя и телефон." });
    }
    const em = normalizeEmail(email);
    if (!isValidEmail(em)) {
      return res.status(400).json({ error: "Укажите действительный адрес электронной почты." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Пароль не короче 8 символов." });
    }
    if (!isValidBYPhone(phone)) {
      return res.status(400).json({ error: "Телефон: формат +375 и 9 цифр номера." });
    }

    if (await getUserByEmail(em)) {
      return res.status(409).json({ error: "Этот email уже зарегистрирован." });
    }

    const userCount = await countUsers();
    const adminEnv = normalizeEmail(process.env.ADMIN_EMAIL || "");
    const firstMatchesAdmin = userCount === 0 && adminEnv && em === adminEnv;
    const role = firstMatchesAdmin ? "admin" : "user";

    const id = crypto.randomUUID();
    const hash = bcrypt.hashSync(String(password), 10);
    const now = new Date().toISOString();
    await insertUser({
      id,
      email: em,
      password_hash: hash,
      name: String(name).trim(),
      phone: String(phone).trim(),
      role,
      created_at: now
    });

    const user = await getUserById(id);
    const jwtToken = signToken(user);
    res.status(201).json({ token: jwtToken, user });
  })
);

app.post(
  "/api/auth/login",
  ar(async (req, res) => {
    if (!ensureJwt(res)) return;

    const { email, password } = req.body || {};
    const em = normalizeEmail(email);
    if (!em || !password) {
      return res.status(400).json({ error: "Укажите email и пароль." });
    }
    const row = await getUserByEmail(em);
    if (!row || !bcrypt.compareSync(String(password), row.password_hash)) {
      return res.status(401).json({ error: "Неверный email или пароль." });
    }
    const user = {
      id: row.id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      role: row.role
    };
    const jwtToken = signToken(user);
    res.json({ token: jwtToken, user });
  })
);

app.post("/api/auth/forgot-password", async (req, res) => {
  const generic = {
    message: "Если указанный email зарегистрирован, мы отправили инструкцию по восстановлению пароля."
  };
  const requireSmtp =
    process.env.NODE_ENV === "production" ||
    process.env.PASSWORD_RESET_REQUIRE_SMTP === "1" ||
    process.env.PASSWORD_RESET_REQUIRE_SMTP === "true";
  if (requireSmtp && !isSmtpConfigured()) {
    return res.status(503).json({
      error:
        "Восстановление пароля по почте не настроено на сервере (SMTP). Обратитесь в клуб или администратора."
    });
  }
  try {
    const { email } = req.body || {};
    const em = normalizeEmail(email);
    if (!em || !isValidEmail(em)) {
      return res.status(400).json({ error: "Укажите действительный адрес электронной почты." });
    }
    const row = await getUserByEmail(em);
    if (row) {
      const plain = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashPasswordResetToken(plain);
      const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
      await addPasswordResetToken(row.id, tokenHash, expires);
      const resetUrl = absolutePasswordResetLink(plain);
      const ttlHours = Math.max(1, Math.round(PASSWORD_RESET_TTL_MS / 3600000));
      const siteName = (process.env.SITE_NAME || "SwimClub").trim() || "SwimClub";
      if (!isSmtpConfigured()) {
        console.log(`[swim-club-api] Сброс пароля (SMTP не настроен): ${resetUrl}`);
      } else {
        try {
          const { sent } = await sendPasswordResetEmail(row.email, resetUrl, {
            ttlHours,
            siteName
          });
          if (!sent) {
            console.log(`[swim-club-api] Не удалось отправить письмо, ссылка сброса: ${resetUrl}`);
            if (requireSmtp) {
              return res.status(503).json({
                error: "Не удалось отправить письмо. Проверьте настройки SMTP."
              });
            }
          }
        } catch (err) {
          console.error("[swim-club-api] Ошибка SMTP:", err && err.message ? err.message : err);
          console.log(`[swim-club-api] Ссылка сброса: ${resetUrl}`);
          if (requireSmtp) {
            return res.status(503).json({
              error: "Не удалось отправить письмо. Проверьте настройки SMTP или попробуйте позже."
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("[swim-club-api] forgot-password:", e);
  }
  res.json(generic);
});

app.post(
  "/api/auth/reset-password",
  ar(async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: "Укажите токен и новый пароль." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Пароль не короче 8 символов." });
    }
    const userId = await consumePasswordResetToken(String(token));
    if (!userId) {
      return res.status(400).json({
        error: "Ссылка недействительна или срок её действия истёк. Запросите новую."
      });
    }
    const hash = bcrypt.hashSync(String(password), 10);
    if (!(await setUserPasswordHash(userId, hash))) {
      return res.status(400).json({ error: "Не удалось обновить пароль." });
    }
    res.json({ ok: true });
  })
);

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// --- Applications (user) ---

app.get(
  "/api/me/applications",
  authMiddleware,
  ar(async (req, res) => {
    res.json(await listApplicationsByUser(req.user.id));
  })
);

app.post(
  "/api/me/applications",
  authMiddleware,
  ar(async (req, res) => {
    const { name, phone, sessionId, level } = req.body || {};
    if (!name || !phone || !sessionId || !level) {
      return res.status(400).json({ error: "Не все поля заполнены." });
    }
    if (!isValidBYPhone(phone)) {
      return res.status(400).json({ error: "Телефон: формат +375 и 9 цифр номера." });
    }
    const session = await getSessionById(sessionId);
    if (!session) {
      return res.status(400).json({ error: "Тренировка не найдена." });
    }
    const booked = await countApplicationsOnSession(sessionId);
    if (booked >= session.capacity) {
      return res.status(409).json({ error: "Нет свободных мест." });
    }
    const id = generateId("app");
    const now = new Date().toISOString();
    await insertApplication({
      id,
      name: String(name).trim(),
      phone: String(phone).trim(),
      session_id: sessionId,
      level: String(level),
      created_at: now,
      user_id: req.user.id
    });
    const row = await getApplicationById(id);
    res.status(201).json(row);
  })
);

app.put(
  "/api/me/applications/:id",
  authMiddleware,
  ar(async (req, res) => {
    const { id } = req.params;
    const { name, phone, sessionId, level } = req.body || {};
    const existing = await getApplicationById(id);
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: "Заявка не найдена." });
    }
    if (!name || !phone || !sessionId || !level) {
      return res.status(400).json({ error: "Не все поля заполнены." });
    }
    if (!isValidBYPhone(phone)) {
      return res.status(400).json({ error: "Телефон: формат +375 и 9 цифр номера." });
    }
    const session = await getSessionById(sessionId);
    if (!session) {
      return res.status(400).json({ error: "Тренировка не найдена." });
    }
    const booked = await countApplicationsOnSession(sessionId, id);
    if (booked >= session.capacity) {
      return res.status(409).json({ error: "Нет свободных мест." });
    }
    await updateApplication(id, {
      name: String(name).trim(),
      phone: String(phone).trim(),
      session_id: sessionId,
      level: String(level)
    });
    const row = await getApplicationById(id);
    res.json(row);
  })
);

app.delete(
  "/api/me/applications/:id",
  authMiddleware,
  ar(async (req, res) => {
    const { id } = req.params;
    const existing = await getApplicationById(id);
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: "Заявка не найдена." });
    }
    await deleteApplication(id);
    res.status(204).end();
  })
);

// --- Discussions (forum-style posts; read open, write for registered users) ---

app.get(
  "/api/discussions",
  ar(async (_req, res) => {
    res.json(await listDiscussionPostsForApi());
  })
);

app.get(
  "/api/discussions/:id",
  ar(async (req, res) => {
    const thread = await getDiscussionThreadForApi(req.params.id);
    if (!thread) {
      return res.status(404).json({ error: "Тема не найдена." });
    }
    res.json(thread);
  })
);

app.post(
  "/api/discussions",
  authMiddleware,
  ar(async (req, res) => {
    const title = String((req.body && req.body.title) || "").trim();
    const body = String((req.body && req.body.body) || "").trim();
    if (!title) {
      return res.status(400).json({ error: "Укажите заголовок темы." });
    }
    if (title.length > 300) {
      return res.status(400).json({ error: "Заголовок не длиннее 300 символов." });
    }
    if (body.length > 8000) {
      return res.status(400).json({ error: "Текст не длиннее 8000 символов." });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await insertDiscussionPost({
      id,
      user_id: req.user.id,
      title,
      body,
      created_at: now
    });
    const u = await getUserById(req.user.id);
    res.status(201).json({
      id,
      title,
      body,
      created_at: now,
      author_id: req.user.id,
      author_name: u && u.name ? String(u.name) : "Участник",
      comment_count: 0
    });
  })
);

app.post(
  "/api/discussions/:id/comments",
  authMiddleware,
  ar(async (req, res) => {
    const postId = String(req.params.id || "").trim();
    const text = String((req.body && req.body.text) || "").trim();
    if (!postId) {
      return res.status(400).json({ error: "Некорректная тема." });
    }
    if (!text) {
      return res.status(400).json({ error: "Укажите текст комментария." });
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: "Комментарий не длиннее 4000 символов." });
    }
    if (!(await getDiscussionPostById(postId))) {
      return res.status(404).json({ error: "Тема не найдена." });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await insertDiscussionComment({
      id,
      post_id: postId,
      user_id: req.user.id,
      body: text,
      created_at: now
    });
    const u = await getUserById(req.user.id);
    res.status(201).json({
      id,
      body: text,
      created_at: now,
      author_id: req.user.id,
      author_name: u && u.name ? String(u.name) : "Участник"
    });
  })
);

app.put(
  "/api/discussions/:id",
  authMiddleware,
  ar(async (req, res) => {
    const postId = String(req.params.id || "").trim();
    const post = await getDiscussionPostById(postId);
    if (!post) {
      return res.status(404).json({ error: "Тема не найдена." });
    }
    const isAdmin = req.user.role === "admin";
    const isAuthor = post.user_id === req.user.id;
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: "Редактировать может только автор или администратор." });
    }
    const title = String((req.body && req.body.title) || "").trim();
    const body = String((req.body && req.body.body) || "").trim();
    if (!title) {
      return res.status(400).json({ error: "Укажите заголовок темы." });
    }
    if (title.length > 300) {
      return res.status(400).json({ error: "Заголовок не длиннее 300 символов." });
    }
    if (body.length > 8000) {
      return res.status(400).json({ error: "Текст не длиннее 8000 символов." });
    }
    await updateDiscussionPost(postId, { title, body });
    const updated = await getDiscussionPostById(postId);
    const u = await getUserById(updated.user_id);
    res.json({
      id: updated.id,
      title: updated.title,
      body: updated.body,
      created_at: updated.created_at,
      author_id: updated.user_id,
      author_name: u && u.name ? String(u.name) : "Участник"
    });
  })
);

app.put(
  "/api/discussions/:postId/comments/:commentId",
  authMiddleware,
  ar(async (req, res) => {
    const postId = String(req.params.postId || "").trim();
    const commentId = String(req.params.commentId || "").trim();
    if (!(await getDiscussionPostById(postId))) {
      return res.status(404).json({ error: "Тема не найдена." });
    }
    const comment = await getDiscussionCommentById(commentId);
    if (!comment || comment.post_id !== postId) {
      return res.status(404).json({ error: "Комментарий не найден." });
    }
    const isAdmin = req.user.role === "admin";
    const isAuthor = comment.user_id === req.user.id;
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: "Редактировать может только автор или администратор." });
    }
    const text = String((req.body && req.body.text) || "").trim();
    if (!text) {
      return res.status(400).json({ error: "Укажите текст комментария." });
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: "Комментарий не длиннее 4000 символов." });
    }
    await updateDiscussionComment(commentId, { body: text });
    const updated = await getDiscussionCommentById(commentId);
    const u = await getUserById(updated.user_id);
    res.json({
      id: updated.id,
      body: updated.body,
      created_at: updated.created_at,
      author_id: updated.user_id,
      author_name: u && u.name ? String(u.name) : "Участник"
    });
  })
);

// --- Site-wide chat (registered users) ---

app.get(
  "/api/me/chat/messages",
  authMiddleware,
  ar(async (_req, res) => {
    res.json(await listSiteChatMessagesForApi());
  })
);

app.post(
  "/api/me/chat/messages",
  authMiddleware,
  ar(async (req, res) => {
    const { text } = req.body || {};
    const t = String(text || "").trim();
    if (!t) {
      return res.status(400).json({ error: "Укажите текст сообщения." });
    }
    if (t.length > 2000) {
      return res.status(400).json({ error: "Сообщение не длиннее 2000 символов." });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await insertSiteChatMessage({
      id,
      user_id: req.user.id,
      text: t,
      created_at: now
    });
    const u = await getUserById(req.user.id);
    res.status(201).json({
      id,
      from_user_id: req.user.id,
      text: t,
      created_at: now,
      author_name: u && u.name ? String(u.name) : "Участник"
    });
  })
);

// --- Admin: sessions ---

app.post(
  "/api/admin/sessions",
  authMiddleware,
  requireAdmin,
  ar(async (req, res) => {
    const { id, day, time, level, coach, capacity } = req.body || {};
    if (!day || !time || !level || !coach || capacity == null) {
      return res.status(400).json({ error: "Укажите день, время, уровень, тренера и вместимость." });
    }
    const sessionId = id && String(id).trim() ? String(id).trim() : generateId("s");
    if (await getSessionById(sessionId)) {
      return res.status(409).json({ error: "Слот с таким id уже есть." });
    }
    const row = {
      id: sessionId,
      day: String(day).trim(),
      time: String(time).trim(),
      level: String(level).trim(),
      coach: String(coach).trim(),
      capacity: Number(capacity)
    };
    await insertSession(row);
    res.status(201).json(await rowToSessionWithBooked(row));
  })
);

app.put(
  "/api/admin/sessions/:id",
  authMiddleware,
  requireAdmin,
  ar(async (req, res) => {
    const { id } = req.params;
    const { day, time, level, coach, capacity } = req.body || {};
    const existing = await getSessionById(id);
    if (!existing) {
      return res.status(404).json({ error: "Слот не найден." });
    }
    if (!day || !time || !level || !coach || capacity == null) {
      return res.status(400).json({ error: "Укажите день, время, уровень, тренера и вместимость." });
    }
    const row = await updateSession(id, {
      day: String(day).trim(),
      time: String(time).trim(),
      level: String(level).trim(),
      coach: String(coach).trim(),
      capacity: Number(capacity)
    });
    res.json(await rowToSessionWithBooked(row));
  })
);

app.delete(
  "/api/admin/sessions/:id",
  authMiddleware,
  requireAdmin,
  ar(async (req, res) => {
    const { id } = req.params;
    const apps = await countApplicationsOnSession(id);
    if (apps > 0) {
      return res.status(409).json({ error: "Нельзя удалить слот: есть заявки." });
    }
    if (!(await deleteSession(id))) {
      return res.status(404).json({ error: "Слот не найден." });
    }
    res.status(204).end();
  })
);

// --- Admin: news ---

app.post(
  "/api/admin/news",
  authMiddleware,
  requireAdmin,
  ar(async (req, res) => {
    const { title, text, body, tag, date, published_at } = req.body || {};
    const bodyText = text != null ? text : body;
    const dateStr = published_at || date;
    if (!title || !bodyText || !dateStr) {
      return res.status(400).json({ error: "Укажите заголовок, текст и дату." });
    }
    const nid = generateId("news");
    await insertNewsItem({
      id: nid,
      title: String(title).trim(),
      body: String(bodyText).trim(),
      tag: tag ? String(tag).trim() : null,
      published_at: String(dateStr).trim()
    });
    const n = await getNewsItemRow(nid);
    res.status(201).json({
      id: n.id,
      title: n.title,
      text: n.body,
      tag: n.tag,
      date: n.published_at
    });
  })
);

app.put(
  "/api/admin/news/:id",
  authMiddleware,
  requireAdmin,
  ar(async (req, res) => {
    const { id } = req.params;
    const { title, text, body, tag, date, published_at } = req.body || {};
    const bodyText = text != null ? text : body;
    const dateStr = published_at || date;
    if (!(await getNewsItemRow(id))) {
      return res.status(404).json({ error: "Новость не найдена." });
    }
    if (!title || !bodyText || !dateStr) {
      return res.status(400).json({ error: "Укажите заголовок, текст и дату." });
    }
    await updateNewsItem(id, {
      title: String(title).trim(),
      body: String(bodyText).trim(),
      tag: tag ? String(tag).trim() : null,
      published_at: String(dateStr).trim()
    });
    const n = await getNewsItemRow(id);
    res.json({
      id: n.id,
      title: n.title,
      text: n.body,
      tag: n.tag,
      date: n.published_at
    });
  })
);

app.delete(
  "/api/admin/news/:id",
  authMiddleware,
  requireAdmin,
  ar(async (req, res) => {
    const { id } = req.params;
    if (!(await deleteNewsItem(id))) {
      return res.status(404).json({ error: "Новость не найдена." });
    }
    res.status(204).end();
  })
);

app.get(
  "/api/admin/applications",
  authMiddleware,
  requireAdmin,
  ar(async (_req, res) => {
    res.json(await listAllApplicationsWithUsers());
  })
);

app.delete(
  "/api/admin/applications/:id",
  authMiddleware,
  requireAdmin,
  ar(async (req, res) => {
    const { id } = req.params;
    if (!(await deleteApplication(id))) {
      return res.status(404).json({ error: "Заявка не найдена." });
    }
    res.status(204).end();
  })
);

app.use(express.static(path.join(__dirname, "..", "..")));

app.use((err, req, res, _next) => {
  console.error("[swim-club-api]", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Внутренняя ошибка сервера." });
  }
});

async function start() {
  await initDb();
  app.listen(port, () => {
    console.log(`SwimClub API listening on http://localhost:${port}`);
    console.log("[swim-club-api] Хранилище: PostgreSQL");
  });
}

start().catch((err) => {
  console.error("[swim-club-api] Не удалось запустить сервер:", err.message || err);
  process.exit(1);
});
