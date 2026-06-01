# Tekton — Deployment Guide

**Target:** Ubuntu 24.04 LTS on a Spaceship VPS  
**Architecture:** Nginx (reverse proxy) → Gunicorn/FastAPI (backend) + MySQL 8

---

## Before You Start

You need:
- Your VM's **public IP address** (shown in Spaceship dashboard after provisioning)
- An **SSH client** — Windows: use [PuTTY](https://www.putty.org/) or the built-in terminal (`ssh` command)
- Your code uploaded to the server (see Step 4)

---

## Step 1 — Create the VM on Spaceship

1. Log in to Spaceship → **VPS** → Create Server
2. Choose **Ubuntu 24.04 LTS**
3. Pick a plan (2 vCPU / 2 GB RAM is enough to start)
4. Note your VM's **IP address** and **root password** (or set up an SSH key)

---

## Step 2 — SSH Into the VM

```bash
ssh root@YOUR_VM_IP
```

Once logged in, create a regular user (safer than using root):

```bash
adduser ubuntu
usermod -aG sudo ubuntu
su - ubuntu
```

---

## Step 3 — Install System Dependencies

```bash
sudo apt update && sudo apt upgrade -y

# Python 3.12 (ships with Ubuntu 24.04), pip, venv
sudo apt install -y python3 python3-venv python3-pip

# Node.js 20 (for building the frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL 8
sudo apt install -y mysql-server

# Nginx
sudo apt install -y nginx

# Git (to clone your repo)
sudo apt install -y git
```

---

## Step 4 — Upload Your Code

**Option A — Git (recommended if your code is on GitHub):**

```bash
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/tekton.git
```

**Option B — Copy from your Windows machine** (run this on your PC, not the VM):

```bash
# In Windows Terminal / PowerShell, from your project root:
scp -r . ubuntu@YOUR_VM_IP:/home/ubuntu/tekton
```

---

## Step 5 — Set Up MySQL

```bash
sudo mysql
```

Inside MySQL, run these commands (replace `STRONG_PASSWORD` with a real password):

```sql
CREATE DATABASE tekton CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tekton_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON tekton.* TO 'tekton_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## Step 6 — Set Up the Backend

```bash
cd /home/ubuntu/tekton/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Create the .env file

```bash
cp .env.example .env
nano .env
```

Fill in every value. Pay attention to these:

| Variable | What to put |
|----------|-------------|
| `DB_PASSWORD` | The MySQL password you set in Step 5 |
| `SECRET_KEY` | Run: `python3 -c "import secrets; print(secrets.token_hex(64))"` and paste the output |
| `FRONTEND_URL` | `http://YOUR_VM_IP` |
| `ALLOWED_ORIGINS` | `http://YOUR_VM_IP` |
| `MAIL_USERNAME` | Your Gmail address |
| `MAIL_PASSWORD` | A Gmail [App Password](https://myaccount.google.com/apppasswords) (not your regular password) |

Save and exit: `Ctrl+O`, Enter, `Ctrl+X`

### Run Database Migrations

```bash
# Still inside the backend folder with venv active
alembic upgrade head
```

### Seed Initial Roles (run once)

```bash
python3 -c "
from app.db.database import SessionLocal
from app.models.role import Role
db = SessionLocal()
for name in ['Admin','HR','Engineer','Accounting','Liaison','Others']:
    if not db.query(Role).filter(Role.name == name).first():
        db.add(Role(name=name))
db.commit()
db.close()
print('Roles seeded.')
"
```

### Register the First Admin User

```bash
python3 -c "
from app.db.database import SessionLocal
from app.models.user import User
from app.models.role import Role, UserRole
from app.core.security import hash_password
db = SessionLocal()
user = User(email='admin@yourdomain.com', hashed_password=hash_password('ChangeMe123!'), is_active=True)
db.add(user)
db.flush()
role = db.query(Role).filter(Role.name == 'Admin').first()
db.add(UserRole(user_id=user.id, role_id=role.id))
db.commit()
print('Admin user created.')
db.close()
"
```

> Change `admin@yourdomain.com` and `ChangeMe123!` to your own values. Log in via the app and change the password immediately.

---

## Step 7 — Build the Frontend

```bash
cd /home/ubuntu/tekton/frontend
npm install
npm run build
```

This creates a `dist/` folder with the compiled React app.

### Copy the Build to Nginx's Web Root

```bash
sudo mkdir -p /var/www/tekton
sudo cp -r dist/. /var/www/tekton/
sudo chown -R www-data:www-data /var/www/tekton
```

---

## Step 8 — Configure Nginx

```bash
# Copy the provided config
sudo cp /home/ubuntu/tekton/deploy/nginx-tekton.conf /etc/nginx/sites-available/tekton

# Enable it (remove default if present)
sudo ln -sf /etc/nginx/sites-available/tekton /etc/nginx/sites-enabled/tekton
sudo rm -f /etc/nginx/sites-enabled/default

# Test the config
sudo nginx -t

# Apply
sudo systemctl reload nginx
```

---

## Step 9 — Configure the Backend as a System Service

```bash
# Create log directory
sudo mkdir -p /var/log/tekton
sudo chown ubuntu:ubuntu /var/log/tekton

# Install the service
sudo cp /home/ubuntu/tekton/deploy/tekton-backend.service /etc/systemd/system/tekton-backend.service

# Reload systemd and start
sudo systemctl daemon-reload
sudo systemctl enable tekton-backend
sudo systemctl start tekton-backend

# Check it's running
sudo systemctl status tekton-backend
```

You should see `Active: active (running)`. If not, check logs:

```bash
sudo journalctl -u tekton-backend -n 50
```

---

## Step 10 — Open the Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Step 11 — Verify Everything Works

Open your browser and go to:

```
http://YOUR_VM_IP
```

You should see the Tekton login page. Log in with the admin credentials you created in Step 6.

To verify the API is reachable:

```
http://YOUR_VM_IP/api/docs
```

You should see the FastAPI Swagger UI.

---

## Redeploying After Code Changes

### Backend changes:

```bash
cd /home/ubuntu/tekton/backend
source venv/bin/activate
pip install -r requirements.txt        # only if requirements changed
alembic upgrade head                   # only if models changed
sudo systemctl restart tekton-backend
```

### Frontend changes:

```bash
cd /home/ubuntu/tekton/frontend
npm install                            # only if package.json changed
npm run build
sudo cp -r dist/. /var/www/tekton/
sudo chown -R www-data:www-data /var/www/tekton
```

---

## Troubleshooting

| Symptom | Command to check |
|---------|-----------------|
| Backend not starting | `sudo journalctl -u tekton-backend -n 50` |
| Nginx errors | `sudo nginx -t` and `sudo tail -f /var/log/nginx/error.log` |
| Database errors | `sudo tail -f /var/log/tekton/error.log` |
| Can't connect at all | `sudo ufw status` — make sure port 80 is open |
| 502 Bad Gateway | Backend isn't running: `sudo systemctl status tekton-backend` |
