# NoviAi Call System — Deployment Guide

## Options overview

| Option | Cost | Sleep? | WebSocket | RAM | Best for |
|--------|------|--------|-----------|-----|----------|
| Render + UptimeRobot | Free | No (with pinger) | Yes | 512 MB | Quickest free start |
| Oracle Cloud Always Free | Free forever | No | Yes | 12 GB | Production, best choice |
| Fly.io | $2-5/mo | No | Yes | 256 MB | Paid backup option |

---

## Option 1: Render + UptimeRobot (quickest free setup)

### Step 1 — Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/noviai-call-system.git
git push -u origin main
```

### Step 2 — Create Render web service

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Render detects `render.yaml` automatically — click **Apply**
4. Service settings (already in render.yaml):
   - Region: Frankfurt
   - Build: `npm install --omit=dev`
   - Start: `node src/server.js`
   - Plan: Free

### Step 3 — Set environment variables in Render dashboard

Go to your service → Environment → Add each secret:

| Key | Value |
|-----|-------|
| `TELNYX_API_KEY` | Your Telnyx API key |
| `TELNYX_PHONE_NUMBER` | e.g. `+46851791777` |
| `TELNYX_CONNECTION_ID` | Your Telnyx SIP connection ID |
| `TELNYX_PUBLIC_KEY` | From Telnyx portal → Webhooks → Ed25519 public key |
| `GROQ_API_KEY` | Your Groq API key |
| `NOVA_ADMIN_TOKEN` | Your admin password |
| `AICHATT_DATABASE_URL` | PostgreSQL connection string |
| `MEGA_EMAIL` | bestfinderai@gmail.com |
| `MEGA_PASSWORD` | Your MEGA password |
| `SERVER_DOMAIN` | Your Render URL (e.g. `noviai-call-system.onrender.com`) |

### Step 4 — Prevent sleep with UptimeRobot

Render free tier sleeps after 15 min of inactivity. UptimeRobot prevents this:

1. Sign up at [uptimerobot.com](https://uptimerobot.com) (free)
2. Add monitor → HTTP(s)
3. URL: `https://noviai-call-system.onrender.com/health`
4. Check interval: **5 minutes**
5. Alert contact: your email

### Step 5 — Update Telnyx webhook URL

In Telnyx portal → Messaging/Voice → Your connection → Webhook URL:
```
https://noviai-call-system.onrender.com/webhooks/telnyx
```

### Step 6 — Custom domain (optional)

In Render → Settings → Custom Domains → Add `calls.noviai.se`

In your DNS (noviai.se nameserver):
```
CNAME  calls  noviai-call-system.onrender.com
```

Then update `SERVER_DOMAIN=calls.noviai.se` in Render env vars.

---

## Option 2: Oracle Cloud Always Free (best for production)

Oracle Always Free includes: 2 OCPUs + 12 GB RAM ARM instance, forever free.

### Step 1 — Create Oracle Cloud account

1. Sign up at [cloud.oracle.com](https://cloud.oracle.com) — requires credit card (not charged)
2. Create a VM:
   - Shape: **VM.Standard.A1.Flex** (ARM — 2 OCPU, 12 GB RAM)
   - Image: Ubuntu 22.04 LTS
   - Add your SSH key
3. Note the public IP address

### Step 2 — Open firewall ports in Oracle Cloud console

Go to your instance → VCN → Security Lists → Ingress Rules:
- Port 22 (SSH) — already open
- Port 80 (HTTP) — add rule: `0.0.0.0/0, TCP, 80`
- Port 443 (HTTPS) — add rule: `0.0.0.0/0, TCP, 443`

### Step 3 — Point domain to your instance

In your DNS (noviai.se):
```
A  calls  <YOUR_ORACLE_IP>
```

Wait for DNS propagation (~5 min).

### Step 4 — Run the automated setup script

Upload the project files to your server:
```bash
# From your local machine (Windows PowerShell):
scp -r C:\claude-pro\noviaivapi\* ubuntu@<YOUR_IP>:/opt/noviai/
scp C:\claude-pro\noviaivapi\.env ubuntu@<YOUR_IP>:/opt/noviai/.env
```

SSH into the server and run:
```bash
ssh ubuntu@<YOUR_IP>
sudo DOMAIN=calls.noviai.se bash /opt/noviai/scripts/setup-oracle.sh
```

The script will:
- Install Node.js 20, PM2, nginx
- Configure nginx with WebSocket support
- Obtain SSL certificate via Let's Encrypt
- Configure firewall (UFW)
- Start NoviAi with PM2, auto-restart on reboot

### Step 5 — Update .env on server

```bash
sudo nano /opt/noviai/.env
```

Set `SERVER_DOMAIN=calls.noviai.se` and all API keys.

### Step 6 — Restart and verify

```bash
pm2 restart noviai-call-system
curl https://calls.noviai.se/health
```

Expected response:
```json
{"status":"ok","version":"1.0.0","uptime":42,"env":"production",...}
```

### PM2 commands

```bash
pm2 status                    # Show running processes
pm2 logs noviai-call-system   # Stream logs
pm2 restart noviai-call-system
pm2 stop noviai-call-system
```

---

## Post-deployment checklist

- [ ] `/health` returns `{"status":"ok"}`
- [ ] Telnyx webhook URL updated in Telnyx portal
- [ ] `TELNYX_PUBLIC_KEY` set in env vars
- [ ] `SERVER_DOMAIN` matches deployed URL (no trailing slash)
- [ ] `NODE_ENV=production` set
- [ ] `NOVA_ADMIN_TOKEN` set (not default placeholder)
- [ ] Test admin endpoint: `GET /admin/config` with `Authorization: Bearer <token>`
- [ ] Make a test call to +46851791777

---

## Updating the app

### Render
Push to GitHub — Render auto-deploys on push to `main`.

### Oracle Cloud / VPS
```bash
cd /opt/noviai
git pull
npm ci --omit=dev
pm2 restart noviai-call-system
```

---

## Troubleshooting

**WebSocket not connecting**
- Check nginx config: `location /ws` must have `Upgrade` and `Connection` headers
- Test: `curl -i https://calls.noviai.se/health`

**Calls not arriving**
- Verify Telnyx webhook URL is exactly `https://YOUR_DOMAIN/webhooks/telnyx`
- Check `TELNYX_PUBLIC_KEY` is set (production rejects unverified webhooks)
- Check logs: `pm2 logs noviai-call-system`

**MEGA upload failing**
- Verify `MEGA_EMAIL` and `MEGA_PASSWORD` are correct
- System falls back to local `recordings/` if MEGA fails

**Memory issues on Render (512 MB)**
- Monitor: `GET /health` → check `memory.rssMB`
- If > 400 MB, reduce `MAX_RECORDING_BUFFER` in call-session.js (currently 5000 chunks)
