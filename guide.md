# Deploy Guide: Frontend on Vercel + Backend on Fly.io

## Prerequisites

- GitHub account (repo with your code)
- Vercel account (free — sign up with GitHub)
- Fly.io account (free — need credit card for identity verification, no charges)

---

## Part 1: Backend on Fly.io

### Step 1: Install flyctl

**Windows (PowerShell as admin):**
```powershell
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**Mac/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

### Step 2: Login

```bash
fly auth login
```

### Step 3: Set up the app

```bash
cd codebenders
fly launch --name supplysense-backend --region bom --no-deploy --dockerfile Dockerfile.backend
```

### Step 4: Set secrets

```bash
fly secrets set GEMINI_API_KEY="your-actual-gemini-api-key"
```

### Step 5: Deploy

```bash
fly deploy
```

Your backend URL → `https://supplysense-backend.fly.dev`

Test it:
```bash
curl https://supplysense-backend.fly.dev/health
```

---

## Part 2: Frontend on Vercel

### Step 1: Push to GitHub

```bash
git add -A
git commit -m "ready for deployment"
git remote add origin https://github.com/your-username/supplysense.git
git push -u origin main
```

### Step 2: Connect Vercel

1. Visit [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. **Framework Preset:** Next.js (auto-detected)
4. **Root Directory:** `./` (project root)
5. **Build Command:** `pnpm install && pnpm run build`
6. **Output Directory:** `.next`

### Step 3: Add environment variable

In Vercel dashboard → Project Settings → Environment Variables:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://supplysense-backend.fly.dev` |

Check **Production**, **Preview**, **Development** then Save.

### Step 4: Deploy

Click **Deploy**. Done.

---

## Part 3: Verify

```bash
curl https://supplysense-backend.fly.dev/health
# → {"status":"healthy","llm_status":"available","llm_provider":"gemini","db":"connected"}
```

Visit `https://your-app.vercel.app` → login with `demo@supplysense.ai` / `Hackathon2026!`

---

## Fly.io Commands

| Command | Purpose |
|---------|---------|
| `fly logs` | Watch live logs |
| `fly ssh console` | SSH into the running VM |
| `fly status` | Check app status |
| `fly deploy` | Redeploy after code changes |
| `fly secrets list` | View set env vars |
| `fly secrets set KEY=val` | Add/update secret |

---

## Cost Summary

| Service | Cost | Limits |
|---------|------|--------|
| Vercel | Free | 100GB bandwidth, 6000 build min/mo |
| Fly.io | Free | 3 shared VMs (256MB), 3GB storage |
| **Total** | **$0/mo** | No cold start, always-on |

---

## Troubleshooting

### Backend crashes on Fly
```bash
fly logs
```
- `GEMINI_API_KEY` not set → `fly secrets set GEMINI_API_KEY=...`
- Port mismatch → Fly expects port 8000 (matches `fly.toml` + `main.py`)

### Frontend can't reach backend
```bash
curl https://supplysense-backend.fly.dev/health
```
If this works, the env var `NEXT_PUBLIC_API_BASE_URL` in Vercel might be wrong.

### Database is empty on deploy
The `api/index.py` auto-seeds the database on first run. On Fly.io, the DB is baked into the Docker image.
