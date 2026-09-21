# KNĂ B2C auth setup

Cookie-based email/password + optional Google Sign-In. No Clerk / Auth0 / Firebase.

## How sessions work

1. Login / signup / Google → API sets HttpOnly cookies:
   - `access_token` — short JWT (default 15m)
   - `refresh_token` — opaque token; SHA-256 hash in `RefreshToken` table (default 30d)
2. Browser sends cookies automatically (`fetch` with `credentials: "include"`).
3. On 401, the web client calls `POST /auth/refresh` once, then retries.
4. Logout bumps `User.tokenVersion`, revokes refresh rows, clears cookies.

Tokens are **never** stored in `localStorage`.

## Local env

Copy [`apps/api/.env.example`](../apps/api/.env.example) → `apps/api/.env`.

Required:

- `JWT_SECRET`
- `CORS_ORIGIN` matching the web origin (`http://localhost:5173` or `http://localhost:8080`)
- `PUBLIC_BASE_URL` for verification links

Optional:

| Variable | Effect if set |
|----------|----------------|
| `GOOGLE_CLIENT_ID` | Enables `POST /auth/google` |
| `VITE_GOOGLE_CLIENT_ID` | Shows Google button in the auth modal (must match API) |
| `SMTP_*` | Sends verification email; otherwise the link is logged |

## Google Cloud Console

1. Create **OAuth 2.0 Client ID** → Application type **Web application**.
2. **Authorized JavaScript origins**: `http://localhost:8080`, `http://localhost:5173` (plus production origins).
3. Paste the client id into both `GOOGLE_CLIENT_ID` (API) and `VITE_GOOGLE_CLIENT_ID` (web build).

## Email verification

Soft gate: signup auto-logs the user in. Verification is encouraged via modal notice + resend.

Link format: `{PUBLIC_BASE_URL}/#account?verify={token}`

## Migrate

```bash
cd app
npm run db:migrate --workspace apps/api
# or against Docker Postgres:
# docker exec … npx prisma migrate deploy
```

## Demo accounts

Still seeded with `changeme123` and `emailVerified: true` — see `prisma/dataset.ts`.
