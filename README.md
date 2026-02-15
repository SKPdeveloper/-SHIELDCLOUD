# ShieldCloud

Система захисту даних у хмарних обчисленнях з демонстрацією атак та механізмів захисту.

## Технології

### Backend
- **Flask** — веб-фреймворк
- **Flask-JWT-Extended** — JWT автентифікація
- **SQLAlchemy** — ORM для SQLite
- **bcrypt** — хешування паролів
- **boto3** — інтеграція з AWS S3/KMS

### Frontend
- **React 18** — UI фреймворк
- **Vite** — збірка
- **TailwindCSS** — стилізація
- **Axios** — HTTP клієнт
- **Web Crypto API** — клієнтське шифрування AES-256-GCM

### Інфраструктура
- **Docker Compose** — оркестрація
- **LocalStack** — емуляція AWS (S3, KMS, CloudWatch)
- **MinIO** — друге S3-сумісне сховище
- **Nginx** — веб-сервер для фронтенду

## Запуск

```bash
docker compose up -d --build
```

| Сервіс | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| MinIO Console | http://localhost:9001 |

## Облікові записи

| Роль | Логін | Пароль |
|------|-------|--------|
| Admin | admin | admin123 |
| User | user | user123 |

## Архітектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  LocalStack │
│   (React)   │     │   (Flask)   │     │  (AWS S3)   │
│   :3000     │     │   :5000     │     │   :4566     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    MinIO    │
                    │  (S3-like)  │
                    │  :9000/9001 │
                    └─────────────┘
```

## Ролі та права доступу (RBAC)

| Ресурс | Admin | User | Guest |
|--------|-------|------|-------|
| **Files** | create, read, read_all, update, delete, delete_all | create, read, update, delete | read (публічні) |
| **Users** | read, create, update, delete, change_role, block | — | — |
| **Audit** | read, export | — | — |
| **Threats** | read, resolve | — | — |
| **Integrity** | check, check_all | check | — |

## Шифрування

### Клієнтська сторона (E2EE)
- **Алгоритм:** AES-256-GCM
- **Генерація ключа:** Web Crypto API
- **IV:** Унікальний 12-байтний вектор для кожного файлу
- Ключі зберігаються в localStorage браузера

### Серверна сторона
- **AWS KMS** — шифрування метаданих
- **S3 SSE** — шифрування на рівні сховища

## Цілісність даних

- **SHA-256** хеш при завантаженні
- Періодична верифікація цілісності
- Статуси: `verified`, `compromised`, `unchecked`

## Система загроз

### Типи атак та пороги детекції

| Тип загрози | Поріг | Threat Score |
|-------------|-------|--------------|
| **BRUTE_FORCE** | 5 невдалих входів / 10 хв | +25 |
| **MASS_DOWNLOAD** | 20 файлів / 5 хв | +15-25 |
| **MASS_DELETE** | 10 файлів / 5 хв | +30 |
| **RAPID_REQUESTS** | 100 запитів / 1 хв | +20 |
| **UNAUTHORIZED_ACCESS** | Спроба доступу до чужого ресурсу | +30 |
| **PRIVILEGE_ESCALATION** | Спроба підвищення прав | +50 |

### Threat Score
- **0-49:** Нормальний стан
- **50-99:** Попередження, підвищений моніторинг
- **100+:** Автоматичне блокування акаунту

### Реакція на загрози
1. Реєстрація події в журналі
2. Збільшення Threat Score користувача
3. При досягненні порогу — блокування акаунту
4. Rate limiting для RAPID_REQUESTS (HTTP 429)

## Демонстрація атак

### Неавтентифіковані (Login Page)

| Атака | Опис |
|-------|------|
| **Brute Force** | Перебір паролів для admin (8 спроб) |
| **Password Spray** | Один пароль для багатьох акаунтів |
| **Dictionary Attack** | Атака зі словником популярних паролів |
| **User Enumeration** | Визначення існуючих акаунтів |

### Автентифіковані (Dashboard)

| Атака | Опис |
|-------|------|
| **Mass Download** | Масове скачування файлів (25 спроб) |
| **Mass Delete** | Масове видалення файлів |
| **Rapid Requests** | DDoS-подібна атака (150 запитів) |
| **Unauthorized Access** | Спроба доступу до чужих файлів |

## API Endpoints

### Автентифікація
```
POST /api/auth/register    — Реєстрація
POST /api/auth/login       — Вхід
POST /api/auth/refresh     — Оновлення токена
POST /api/auth/logout      — Вихід
GET  /api/auth/me          — Поточний користувач
```

### Файли
```
GET    /api/files/              — Список файлів
POST   /api/files/upload        — Завантаження
GET    /api/files/<id>/download — Скачування
DELETE /api/files/<id>          — Видалення
POST   /api/files/<id>/verify   — Перевірка цілісності
GET    /api/files/stats         — Статистика
```

### Загрози
```
GET  /api/threats/          — Список загроз
GET  /api/threats/stats     — Статистика
GET  /api/threats/types     — Типи загроз
POST /api/threats/<id>/resolve — Вирішення загрози
```

### Аудит
```
GET /api/audit/         — Журнал подій
GET /api/audit/actions  — Типи дій
GET /api/audit/export   — Експорт (CSV/JSON)
```

### Користувачі (Admin)
```
GET    /api/users/              — Список користувачів
GET    /api/users/stats         — Статистика
GET    /api/users/permissions   — Матриця прав
POST   /api/users/<id>/role     — Зміна ролі
POST   /api/users/<id>/block    — Блокування
POST   /api/users/<id>/unblock  — Розблокування
POST   /api/users/demo-reset    — Скидання демо
GET    /api/users/demo-status   — Статус демо
```

### Хмарні провайдери
```
GET /api/cloud/providers — Список провайдерів
GET /api/cloud/status    — Статус підключення
```

## Інтерфейс

### Теми
- **Темна тема** — за замовчуванням (палітра: #100C00, #95122C, #FF9400)
- **Світла тема** — перемикається в sidebar (палітра: #F3F4F5, #D0E0E1, #95122C)

### Локалізація
- Українська (UA)
- Англійська (EN)

### Сторінки
- **Login** — авторизація + симуляція атак
- **Dashboard** — панель користувача/адміна
- **Files** — керування файлами
- **Audit** — журнал подій (admin)
- **Threats** — моніторинг загроз (admin)
- **Users** — керування користувачами (admin)
- **Settings** — налаштування теми та мови

## Конфігурація

### Змінні середовища (.env)

```env
# Безпека
SECRET_KEY=your-secret-key-min-32-chars
JWT_SECRET_KEY=your-jwt-secret

# AWS/LocalStack
AWS_ENDPOINT_URL=http://localstack:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=eu-central-1
S3_BUCKET_NAME=shieldcloud-files
KMS_KEY_ALIAS=alias/shieldcloud-key

# MinIO
MINIO_ENDPOINT_URL=http://minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=shieldcloud-minio

# База даних
DATABASE_URL=sqlite:///app.db
```

### Налаштування захисту

| Параметр | Значення |
|----------|----------|
| MAX_FAILED_LOGIN_ATTEMPTS | 5 спроб |
| ACCOUNT_LOCK_DURATION_MINUTES | 30 хв |
| BCRYPT_SALT_ROUNDS | 12 |
| JWT_ACCESS_TOKEN_EXPIRES | 15 хв |
| JWT_REFRESH_TOKEN_EXPIRES | 7 днів |
| MAX_FILE_SIZE | 50 MB |

## Структура проекту

```
ShieldCloud/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy моделі
│   │   ├── routes/          # API ендпоінти
│   │   ├── services/        # Бізнес-логіка
│   │   ├── middleware/      # RBAC, Threat Detection
│   │   └── utils/           # Допоміжні функції
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # API клієнт
│   │   ├── components/      # React компоненти
│   │   ├── context/         # Auth, Theme, Language
│   │   ├── pages/           # Сторінки
│   │   └── utils/           # Crypto utilities
│   ├── Dockerfile
│   └── nginx.conf
├── localstack/
│   └── init-aws.sh          # Ініціалізація AWS ресурсів
└── docker-compose.yml
```

## Журнал дій (Audit Log)

### Категорії подій
- **AUTH:** LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, USER_REGISTERED
- **FILE:** FILE_UPLOADED, FILE_DOWNLOADED, FILE_DELETED, INTEGRITY_CHECK
- **THREAT:** THREAT_DETECTED, THREAT_RESOLVED
- **USER:** USER_BLOCKED, USER_UNBLOCKED, ROLE_CHANGED
- **SYSTEM:** DEMO_RESET, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED

## Команди

```bash
# Запуск
docker compose up -d --build

# Перегляд логів
docker compose logs -f

# Логи конкретного сервісу
docker compose logs -f backend

# Зупинка
docker compose down

# Зупинка з видаленням даних
docker compose down -v

# Перезбірка без кешу
docker compose build --no-cache
```
