# Архитектура backend

Статический фронтенд (`index.html`, `styles.css`, `app.js`) при работающем API загружает расписание и новости с сервера, хранит сессию по JWT и отправляет заявки на сервер.

Данные хранятся в **одном JSON-файле** (`server/data/club-data.json`) — не нужны ни SQLite, ни компилятор C++/Visual Studio: достаточно **Node.js** и **`npm install`**.

## Запуск

- `npm install`, затем `npm run dev` — API и статика на `http://localhost:3000/`
- **`JWT_SECRET` не обязателен для локальной разработки:** если в `.env` нет секрета, при первом запуске создаётся файл `server/data/.jwt-secret`. Для продакшена лучше задать переменную `JWT_SECRET` в окружении.
- Файл данных: `server/data/club-data.json`

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `PORT` | Порт HTTP (по умолчанию `3000`) |
| `JWT_SECRET` | Секрет подписи JWT (если не задан — создаётся `server/data/.jwt-secret`) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Если в файле данных ещё нет пользователей — создать одного админа |
| `ADMIN_EMAIL` | При первой регистрации пользователь с этим email получит роль `admin` (если нет других пользователей) |
| `ADMIN_PASSWORD` | Синоним для `SEED_ADMIN_PASSWORD` при создании seed-админа |

## Endpoints

Все пути ниже имеют префикс **`/api`**.

### Публично

- `GET /health` — проверка работы сервера
- `GET /sessions` — расписание слотов; в каждом объекте есть `booked` (занято мест по заявкам)
- `GET /news` — новости (`title`, `text`, `tag`, `date`)
- `GET /coaches` — краткий список тренеров

### Авторизация

Заголовок для защищённых методов: **`Authorization: Bearer <token>`**

- `POST /auth/register` — тело: `{ email, password, name, phone }` → `{ token, user }`
- `POST /auth/login` — тело: `{ email, password }` → `{ token, user }`
- `GET /auth/me` — текущий пользователь (требуется Bearer)

### Заявки (пользователь)

- `GET /me/applications` — список заявок текущего пользователя
- `POST /me/applications` — тело: `{ name, phone, sessionId, level }`
- `PUT /me/applications/:id` — обновить свою заявку (то же тело)
- `DELETE /me/applications/:id` — удалить свою заявку

### Администрирование (роль `admin`)

- `POST /admin/sessions` — создать слот; опционально поле `id`
- `PUT /admin/sessions/:id` — изменить слот (тело: `day`, `time`, `level`, `coach`, `capacity`)
- `DELETE /admin/sessions/:id` — удалить слот (ошибка, если есть заявки)
- `POST /admin/news` — тело: `title`, `text` (или `body`), `date` (или `published_at`), опционально `tag`
- `PUT /admin/news/:id` — изменить новость
- `DELETE /admin/news/:id` — удалить новость

Старые открытые `GET/POST /applications` без JWT отключены: заявки только для авторизованных пользователей.
