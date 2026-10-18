# E-Bookstore — online bookstore

React (Vite) + Tailwind CSS v4 frontend, Node.js/Express 5 API, PostgreSQL.

```
backend/   Express API, db/schema.sql, openapi.yaml, tests/
frontend/  React app (react-router, Tailwind)
```

## Run locally

```bash
# 1. PostgreSQL 17 (macOS)
brew install postgresql@17 && brew services start postgresql@17
export PATH=/opt/homebrew/opt/postgresql@17/bin:$PATH

# 2. Databases and a least-privilege app role
createdb bookworm && createdb bookworm_test
psql -d postgres -c "CREATE ROLE bookworm_app LOGIN PASSWORD '<generate one>' NOSUPERUSER NOCREATEDB NOCREATEROLE"
for db in bookworm bookworm_test; do
  psql -d $db -v ON_ERROR_STOP=1 -f backend/db/schema.sql
  psql -d $db -v app_role=bookworm_app -f backend/db/grants.sql
done
# Require passwords on TCP: set the 127.0.0.1 / ::1 lines in pg_hba.conf to scram-sha-256.

# 3. Backend (http://127.0.0.1:4000)
cd backend && cp .env.example .env   # fill in the password and SESSION_SECRET
npm install && npm run seed          # prints the demo login
npm start

# 4. Frontend (http://127.0.0.1:5173) — in a second terminal
cd frontend && npm install && npm run dev
```

Tests: `cd backend && npm test` (19 tests; run against `bookworm_test`) and `cd frontend && npm test` (9 component tests).
API docs: `backend/openapi.yaml`.

## Customer journey coverage

| Step | Where |
|------|-------|
| Login, authentication, guest shopping | `/login`, `/register`; guest cart is created on first add and merged/upgraded on sign-in |
| Order history with **Buy it again** | `/orders` |
| Recommendations from order history | "Recommended for You" row on `/` |
| Category, brands, catalogue | sidebar, **Brands** chips, `/category/:slug` |
| Product with tentative delivery date, related products | `/books/:id` |
| Add to basket | `/cart` |
| Select delivery address | `/checkout` (saved addresses or new) |
| Payment option (Credit/Debit card, UPI, Wallet, Net banking, COD), gift points | "Pay Now" on `/checkout` opens the **Complete Payment** dialog |
| Payment confirmation popup with **Continue your Shopping** | `/orders/:id` after paying |
| Cancel order within 48 hours | `/orders/:id` |

## Pricing rules (enforced on the server)

Coupon `%` of subtotal, then 5% tax on the discounted amount, INR 49 shipping on physical orders under INR 500,
gift points (1 point = INR 1) redeemed last, 1 point earned per INR 100 paid. Coupons: `BOOKWORM10`, `WELCOME20`.

## Known limitations

- Payments are simulated (no gateway); COD orders stay `pending`. Card, UPI and wallet details are validated in the browser only and are never sent to the API or stored.
- Book covers are generated gradients; set `books.cover_url` to use real images.
- Rate limiting and sessions are per-instance (single node); use a shared store when scaling out.
- Run behind TLS in production and set `NODE_ENV=production` (enables Secure cookies and DB TLS).
