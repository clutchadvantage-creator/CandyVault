# CandyVault candyserver Deployment Checklist

CandyVault is intended for a trusted household LAN. It does not yet have authentication, HTTPS, or a restore workflow. Do not expose it directly to the public internet.

## 1. Confirm prerequisites

```bash
git --version
docker --version
docker compose version
hostname
hostname -I
```

Choose the hostname or LAN IP that household browsers will use. The examples below use `candyserver`.

## 2. Create the application directory and clone

```bash
sudo mkdir -p /opt/candyvault
sudo chown "$USER":"$USER" /opt/candyvault
git clone <YOUR_GITHUB_REPOSITORY_URL> /opt/candyvault/app
cd /opt/candyvault/app
```

## 3. Create production environment configuration

```bash
cp .env.candyserver.example .env
nano .env
```

For hostname access, confirm these values:

```dotenv
APP_ENV=production
MAX_UPLOAD_MB=25
BACKEND_PORT=8000
FRONTEND_PORT=80
VITE_API_BASE_URL=http://candyserver:8000
CORS_ORIGINS=http://candyserver,http://candyserver.local
```

For LAN-IP access, replace `candyserver` with the actual address. Example:

```dotenv
VITE_API_BASE_URL=http://192.168.1.50:8000
CORS_ORIGINS=http://192.168.1.50
```

Never commit `.env`. `VITE_API_BASE_URL` is compiled into the frontend image, so rebuild after changing it.

## 4. Validate and build

```bash
docker compose config
docker compose build
```

Do not continue if either command fails.

## 5. Start CandyVault

```bash
docker compose up -d --wait
docker compose ps
docker compose logs --tail=100 backend frontend
```

Both services should report healthy.

## 6. Verify health and persistent mounts

```bash
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1:8000/system/status
curl --fail http://127.0.0.1/healthz
docker volume ls | grep candyvault
docker compose exec backend sh -c 'test -w /opt/candyvault/database && test -w /opt/candyvault/uploads && test -w /opt/candyvault/backups && test -w /opt/candyvault/logs'
```

`/system/status` should report a healthy database and ready uploads/backups directories.

## 7. Verify household-browser access

Open `http://candyserver` or the configured LAN IP. Check:

- Dashboard data and backend health
- Expenses create/edit/delete, recurring status, search, and filters
- Document folder create/rename/delete rules
- Document upload/view/download/delete and attached notes
- Standalone and linked notes create/edit/delete
- Pay profile create/edit/toggle/delete and income summaries
- All calculators with valid, empty, and invalid input
- Settings backup health and inspection
- Candy and Forest Waterfall theme switching and persistence after refresh

If the UI loads but API data is offline, verify `VITE_API_BASE_URL`, `CORS_ORIGINS`, browser developer-console errors, and backend logs. Rebuild after any `VITE_API_BASE_URL` change.

## 8. Verify a portable backup

In Settings:

1. Create a backup.
2. Inspect it.
3. Confirm database, uploads, document folders, and manifest are detected.
4. Download the ZIP to another machine.
5. Keep the backup; do not test restore because restore is not implemented.

## 9. Update procedure

Create, inspect, and download a backup before every update. Then run:

```bash
cd /opt/candyvault/app
docker compose ps
docker compose logs --tail=100 backend frontend
git status --short
git pull --ff-only origin main
docker compose build
docker compose up -d --wait
docker compose ps
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1:8000/system/status
```

Repeat the browser smoke checks after updating.

## 10. Data-safety rules

- Never run `docker compose down -v`; `-v` deletes persistent data volumes.
- Never delete CandyVault Docker volumes manually.
- Keep downloaded backups on another machine or storage device.
- Keep a single backend replica while using SQLite.
- Preserve the `/opt/candyvault/*` container paths when moving existing data.
- Monitor free disk space on candyserver.

## 11. Stop without deleting data

```bash
cd /opt/candyvault/app
docker compose stop
```

Start it again with:

```bash
docker compose up -d --wait
```

## Deployment gate

Deployment is ready when both containers are healthy, all three health checks pass, browser API calls succeed without CORS errors, a downloaded backup passes inspection, both themes persist after refresh, and the smoke checklist is complete. Public-internet exposure remains blocked until authentication, HTTPS/reverse proxying, and firewall hardening are added.
