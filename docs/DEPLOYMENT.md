# CandyVault candyserver Deployment

This guide prepares a future candyserver deployment. It does not add authentication, PostgreSQL, TLS, or public-internet hardening. CandyVault should remain on a trusted household network until those controls exist.

## Target candyserver paths

Docker named volumes map persistent application data to these container paths:

| Purpose | Target path |
| --- | --- |
| SQLite database | `/opt/candyvault/database` |
| Uploaded files | `/opt/candyvault/uploads` |
| Backup archives | `/opt/candyvault/backups` |
| Future application logs | `/opt/candyvault/logs` |

The logs volume is reserved now; CandyVault does not yet write structured files there.

These are persistent named-volume mount targets inside the containers. Keep application source in `/opt/candyvault/app`; do not store source code inside a data volume.

## Windows development

Backend, from `CandyVault/backend`:

```powershell
Copy-Item .env.example .env
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload
```

Frontend, from `CandyVault/frontend`:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Development defaults remain:

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8000`
- Status: `http://127.0.0.1:8000/system/status`

## Environment configuration

Backend variables:

- `APP_ENV`: environment label returned by `/system/status`
- `DATABASE_URL`: SQLAlchemy connection string
- `UPLOAD_DIR`: root upload directory; documents live below `documents/`
- `BACKUP_DIR`: backup ZIP destination
- `MAX_UPLOAD_MB`: document upload limit in megabytes
- `CORS_ORIGINS`: comma-separated browser origins

Frontend variable:

- `VITE_API_BASE_URL`: browser-visible backend URL

Vite variables are compiled into the frontend image. Changing `VITE_API_BASE_URL` requires rebuilding the frontend image.

Never commit `.env` files. Commit only `.env.example` templates.

## GitHub workflow

From the development machine:

```powershell
git status
git add backend frontend docs docker-compose.yml .env.example
git commit -m "Prepare CandyVault for candyserver deployment"
git push origin main
```

Review the staged files before committing. Database files, uploads, backups, virtual environments, `.env`, `node_modules`, and build output should remain untracked.

## candyserver clone workflow

On candyserver, create the application root and keep source code separate from persistent data:

```bash
sudo mkdir -p /opt/candyvault
sudo chown "$USER":"$USER" /opt/candyvault
git clone <YOUR_GITHUB_REPOSITORY_URL> /opt/candyvault/app
cd /opt/candyvault/app
cp .env.candyserver.example .env
```

Edit `.env` and replace the example candyserver hostnames with the hostname or LAN IP that household browsers actually use. `CORS_ORIGINS` must exactly match the frontend browser origin, including scheme and port.

For a server reached as `candyserver`, use:

```dotenv
VITE_API_BASE_URL=http://candyserver:8000
CORS_ORIGINS=http://candyserver,http://candyserver.local
```

For a server reached by LAN IP, use the same IP in both settings. For example:

```dotenv
VITE_API_BASE_URL=http://192.168.1.50:8000
CORS_ORIGINS=http://192.168.1.50
```

The frontend uses port 80 in production, so its origin does not need `:80`. The API URL is resolved by the household browser, not by the frontend container. Include every hostname or LAN-IP origin household browsers will actually use in the comma-separated `CORS_ORIGINS` value.

## Docker Compose workflow

Validate configuration before starting anything:

```bash
docker compose config
docker compose build
```

Future start commands:

```bash
docker compose up -d --wait
docker compose ps
docker compose logs --tail=100 backend frontend
```

Health checks:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/system/status
curl http://127.0.0.1/healthz
```

Then open `http://candyserver` (or the configured LAN IP) from a household browser. Confirm both themes in Settings; the selection is stored in that browser's local storage under `candyvault-theme`.

The production Compose configuration mounts named volumes at:

```text
/opt/candyvault/database
/opt/candyvault/uploads
/opt/candyvault/backups
/opt/candyvault/logs
```

Confirm the mounts with:

```bash
docker compose exec backend sh -c 'mount | grep /opt/candyvault || true'
docker volume ls | grep candyvault
```

Do not run `docker compose down -v`; `-v` deletes the named volumes containing the SQLite database, uploads, and backups.

## Backup notes

Before every server update:

1. Create a CandyVault backup in Settings.
2. Inspect the backup and confirm database/uploads/folders are included.
3. Download a copy to another machine.
4. Confirm `/system/status` reports ready directories.

The in-app backup ZIP is the portable backup. Docker volumes provide persistence but are not a substitute for an off-server copy.

## Update process

```bash
cd /opt/candyvault/app
docker compose ps
docker compose logs --tail=100 backend frontend
git pull --ff-only origin main
docker compose build
docker compose up -d --wait
docker compose ps
curl http://127.0.0.1:8000/system/status
```

After updating, open Dashboard, Expenses, Documents, Notes, Pay Profiles, Calculators, and Settings from a household browser and verify live API data.

## Troubleshooting

### Frontend loads but data is offline

- Check `VITE_API_BASE_URL`; it must be reachable by the browser, not merely inside Docker.
- Rebuild the frontend after changing it.
- Confirm `CORS_ORIGINS` contains the exact frontend origin.
- Check `docker compose logs backend` and `/system/status`.

### Database is unavailable

- Confirm the database volume is mounted at `/opt/candyvault/database`.
- Confirm `DATABASE_URL=sqlite:////opt/candyvault/database/candyvault.db`.
- Ensure only one backend replica writes to the SQLite file.

### Uploads or backups are unavailable

- Check the corresponding status fields in `/system/status`.
- Inspect volume mounts with `docker compose config`.
- Confirm the container user can write the mounted paths.

### Existing documents cannot open

Document metadata currently stores resolved file paths. Preserve the configured upload path consistently when moving an existing installation, and test view/download before considering migration complete.

### Container is unhealthy

```bash
docker compose ps
docker compose logs --tail=200 backend
docker compose exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/system/status').read().decode())"
```

## Remaining production blockers

Before exposing CandyVault beyond a trusted LAN, add:

- Authentication and authorization
- HTTPS through a reverse proxy
- Firewall rules and restricted backend exposure
- Off-server scheduled backup verification
- Log rotation/monitoring
- A tested restore procedure
- SQLite concurrency and disk-capacity monitoring

PostgreSQL is intentionally not required for this deployment-preparation phase.

## Verified rehearsal

The production images and Compose stack were rehearsed locally on June 21, 2026 using isolated test volumes. The rehearsal verified image builds, container health, browser-to-API CORS, Docker-internal backend DNS, SQLite/upload/backup persistence across a backend restart, backup create/inspect/download/delete, document and linked-note workflows, search/filter endpoints, all frontend routes, and Candy/Forest theme persistence in a real production-served browser session. This is strong deployment readiness evidence, but the final hostname, firewall, disk permissions, and browser access must still be checked on candyserver itself.

Use [CANDYSERVER_DEPLOY_CHECKLIST.md](./CANDYSERVER_DEPLOY_CHECKLIST.md) for the exact first-deployment sequence.
