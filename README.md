# FOODSbyme

**Real food. Real kitchens. Real people.**

A home cook monetisation platform. Not a restaurant delivery app.

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile app | React Native + Expo SDK 55 |
| Backend | Node.js + Express |
| Database | **Neon** (serverless PostgreSQL) |
| File storage | Cloudinary |
| Auth | Custom OTP via **Termii** (Nigerian SMS provider) |
| Payments | Flutterwave |
| Logistics | Bolt / Kwik / Sendbox (swappable) |
| Hosting | Railway |

## What's in this project

```
foodsbyme/
├── supabase/migrations/     ← 11 SQL files, run in order (001–011)
├── backend/
│   ├── server.js            ← Entry point
│   ├── routes/              ← All API routes (auth complete, others are placeholders)
│   ├── services/            ← Core business logic
│   ├── middleware/          ← Auth + role guard
│   └── supabase/db.js      ← Neon database client with helpers
├── app/                     ← React Native (Expo) folder structure
├── admin/                   ← Web admin panel folder structure
└── web/                     ← Next.js PWA folder structure
```

## How to set up

### Step 1: Create your Neon project
1. Go to [neon.tech](https://neon.tech) and sign up (free tier gives you 1 project)
2. Create a project, name it `foodsbyme`
3. Copy the connection string — it looks like `postgresql://user:pass@host/dbname?sslmode=require`

### Step 2: Run the database migrations
1. In Neon console, open the **SQL Editor**
2. Paste and run each migration file **in order** (001 through 011)
3. Each file depends on the ones before it

### Step 3: Set up the backend
```bash
cd backend
cp .env.example .env
# Fill in your Neon DATABASE_URL and other values
npm install
npm run dev
```

### Step 4: Test the server
Open `http://localhost:3000/health` in your browser. You should see:
```json
{ "status": "ok", "platform": "FOODSbyme" }
```

### Step 5: Set up SMS (Termii)
1. Sign up at [termii.com](https://termii.com)
2. Get your API key from Settings
3. Add to `.env` — without it, OTPs just print to console (fine for dev)

### Step 6: Set up file uploads (Cloudinary)
1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier is generous)
2. Copy cloud name, API key, and secret from your dashboard
3. Add to `.env`

### Step 7: Set up payments (Flutterwave)
1. Sign up at [flutterwave.com](https://flutterwave.com)
2. Get API keys from Settings → API
3. **Apply for the Transfer product** (separate approval, needed for cook payouts)
4. Add to `.env`

### Step 8: Deploy to Railway
1. Push project to GitHub
2. Connect repo to [Railway](https://railway.app)
3. Set all environment variables in Railway dashboard
4. Deploy

---

*FOODSbyme — foodsbyme.com — Real food. Real kitchens. Real people.*
