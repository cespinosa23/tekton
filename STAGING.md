# Tekton — Staging Environment Guide

Runs a second, isolated copy of the app on the **same VPS** as production, accessed
directly by IP on a separate port — no DNS or subdomain needed.

**Isolation summary:**

| | Production | Staging |
|---|---|---|
| Code | `/home/ubuntu/tekton` | `/home/ubuntu/tekton-staging` |
| Database | `tekton` | `tekton_staging` |
| Backend port | `127.0.0.1:8000` | `127.0.0.1:8001` |
| Systemd service | `tekton-backend` | `tekton-backend-staging` |
| Web root | `/var/www/tekton` | `/var/www/tekton-staging` |
| Public URL | `https://app.tekton.energy` (port 80/443) | `http://209.74.82.224:8080` |
| Logs | `/var/log/tekton` | `/var/log/tekton-staging` |

Both share the same MySQL server. Staging needs its own firewall rule (below) since
port 8080 isn't covered by the existing rules (which only open 22, 22022, 80, 443).

> **Why a distinct port, not just the bare IP on port 80:** production's Nginx config
> uses `server_name _;` — a catch-all that matches *any* hostname, including the bare
> IP. If staging also listened on port 80, `http://209.74.82.224` would route to
> **production**, not staging. Using port `8080` for staging avoids that conflict
> entirely, with no Nginx changes needed on the production side.

---

## Step 1 — Open the Firewall for the Staging Port

```bash
sudo ufw allow 8080/tcp
sudo ufw reload
sudo ufw status verbose
```

Confirm `8080/tcp` shows `ALLOW IN Anywhere` before continuing.

---

## Step 2 — Check Out the Code

```bash
cd /home/ubuntu
git clone https://github.com/cespinosa23/tekton.git tekton-staging
cd tekton-staging
```

(Keeps it on `main`, same as production — you decide when to `git pull` in each
directory independently, so staging can sit ahead of or behind production as needed.)

---

## Step 3 — Create the Staging Database

```bash
sudo mysql
```

```sql
CREATE DATABASE tekton_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON tekton_staging.* TO 'tekton_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

(Reuses the same `tekton_user` MySQL account as production — just a different
database, so there's no risk of staging and production data ever mixing.)

---

## Step 4 — Set Up the Backend

```bash
cd /home/ubuntu/tekton-staging/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Create `.env`

```bash
cp .env.example .env
nano .env
```

| Variable | What to put |
|----------|-------------|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` | Same as production's `.env` |
| `DB_NAME` | `tekton_staging` |
| `SECRET_KEY` | **A different key than production** — run `python3 -c "import secrets; print(secrets.token_hex(64))"` again. Never reuse production's key; otherwise a staging login token would also work against production. |
| `FRONTEND_URL` | `http://209.74.82.224:8080` |
| `ALLOWED_ORIGINS` | `http://209.74.82.224:8080` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_FROM` / `MAIL_PORT` | Same as production, **but see the warning below** |

> **Email warning:** `app/core/email.py` sends through a fixed SMTP host
> (`mail.spacemail.com`), so `MAIL_USERNAME`/`MAIL_PASSWORD` must be a real mailbox
> hosted there — a Gmail address/app-password will simply fail to authenticate, it's
> not a valid alternative. If you reuse production's real mailbox credentials,
> password-reset and invite emails sent from staging will go to **real email
> addresses** (the recipient is whatever email you type into the app, regardless of
> which mailbox sends it) — be careful during testing not to trigger those flows
> against real users. If you want to avoid this entirely, set up a separate throwaway
> mailbox on the same Spacemail-hosted domain instead.

### Run Migrations

```bash
alembic upgrade head
```

This runs against a **completely empty** `tekton_staging` database, so it's a good
real-world test that the full migration chain still works end to end.

### Seed Roles and a First Admin

Same as `DEPLOY.md` Step 6 — run the role-seeding and admin-creation snippets from
there, adjusting the email/password for your staging admin.

---

## Step 5 — Build the Frontend

```bash
cd /home/ubuntu/tekton-staging/frontend
npm install
npm run build

sudo mkdir -p /var/www/tekton-staging
sudo cp -r dist/. /var/www/tekton-staging/
sudo chown -R www-data:www-data /var/www/tekton-staging
```

---

## Step 6 — Systemd Service

```bash
sudo mkdir -p /var/log/tekton-staging
sudo chown ubuntu:ubuntu /var/log/tekton-staging
sudo nano /etc/systemd/system/tekton-backend-staging.service
```

```ini
[Unit]
Description=Tekton Backend API - STAGING (FastAPI + Gunicorn)
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/tekton-staging/backend
Environment="PATH=/home/ubuntu/tekton-staging/backend/venv/bin"
EnvironmentFile=/home/ubuntu/tekton-staging/backend/.env
ExecStart=/home/ubuntu/tekton-staging/backend/venv/bin/gunicorn app.main:app \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8001 \
    --timeout 120 \
    --access-logfile /var/log/tekton-staging/access.log \
    --error-logfile /var/log/tekton-staging/error.log
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable tekton-backend-staging
sudo systemctl start tekton-backend-staging
sudo systemctl status tekton-backend-staging
```

---

## Step 7 — Nginx

```bash
sudo nano /etc/nginx/sites-available/tekton-staging
```

```nginx
server {
    listen 8080;
    server_name _;

    root /var/www/tekton-staging;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:8001/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 10M;
    }
}
```

`listen 8080;` on its own port means this block can never conflict with production's
`listen 80;` block, regardless of `server_name` — that's what actually keeps the two
sites isolated, not the (deliberately generic) `server_name _;` line.

```bash
sudo ln -sf /etc/nginx/sites-available/tekton-staging /etc/nginx/sites-enabled/tekton-staging
sudo nginx -t
sudo systemctl reload nginx
```

`sudo nginx -t` must print "syntax is ok" / "test is successful" before reloading —
if it doesn't, fix the reported line before proceeding, since a bad `nginx -t` means
`reload` will leave the **old** config running (including production's), not crash it.

---

## Step 8 — Verify

Open `http://209.74.82.224:8080` — you should see the Tekton login page, and
`http://209.74.82.224:8080/api/docs` should show the FastAPI Swagger UI, both
completely independent of production.

---

## Redeploying Staging After Code Changes

Same idea as `DEPLOY.md`'s redeploy section, just in the `tekton-staging` directory
and using `tekton-backend-staging` as the service name:

```bash
# Backend
cd /home/ubuntu/tekton-staging/backend
git pull
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
sudo systemctl restart tekton-backend-staging

# Frontend
cd /home/ubuntu/tekton-staging/frontend
git pull
npm install
npm run build
sudo cp -r dist/. /var/www/tekton-staging/
sudo chown -R www-data:www-data /var/www/tekton-staging
```
