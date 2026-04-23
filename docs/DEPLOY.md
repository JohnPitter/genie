# Deploy Guide — Genie Single Binary

This document covers building and deploying the self-contained `genie` binary that
bundles the API (Go) and the frontend (SvelteKit static build) into a single executable.

---

## Requirements (build machine only)

| Tool | Minimum version |
|------|----------------|
| Go   | 1.23            |
| Node.js | 20+          |
| pnpm | 8+              |

The resulting binary has **zero runtime dependencies** — no Node, no pnpm, no
external SQLite library. It carries the frontend and a pure-Go SQLite driver.

---

## Build

### Unix / macOS / WSL

```bash
# Option A — Make
make build          # produces ./genie

# Option B — script
./scripts/build.sh  # produces ./genie
```

### Windows (PowerShell 7)

```powershell
# Option A — Make (requires GNU make / scoop)
make build          # produces .\genie.exe

# Option B — script
.\scripts\build.ps1 # produces .\genie.exe
```

Expected output size: **30–50 MB** (frontend assets + Pure-Go SQLite + Go runtime).

---

## Run

```bash
# Minimum required — set your OpenRouter API key
OPENROUTER_API_KEY=sk-or-v1-... ./genie
```

The server starts on port **5858** by default. Open `http://localhost:5858` in your
browser — the embedded frontend is served automatically.

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key |
| `OPENROUTER_MODEL` | No | `anthropic/claude-sonnet-4.6` | LLM model |
| `PORT` | No | `5858` | HTTP port |
| `DB_PATH` | No | `genie.db` | SQLite file path |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `ADMIN_TOKEN` | No | — | Enables `/api/admin/*` endpoints |
| `BRAPI_TOKEN` | No | — | Optional brapi.dev token (raises rate limits) |

You can also create a `.env` file next to the binary — it is auto-loaded at startup.

---

## Systemd service (Linux)

```ini
# /etc/systemd/system/genie.service
[Unit]
Description=Genie financial assistant
After=network.target

[Service]
Type=simple
User=genie
WorkingDirectory=/opt/genie
ExecStart=/opt/genie/genie
Restart=on-failure
RestartSec=5s
EnvironmentFile=/opt/genie/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now genie
sudo journalctl -u genie -f
```

---

## Nginx reverse proxy (optional, with TLS)

```nginx
server {
    listen 443 ssl http2;
    server_name genie.example.com;

    ssl_certificate     /etc/letsencrypt/live/genie.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/genie.example.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:5858;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;  # allow long SSE streams (chat)
        proxy_buffering    off;   # required for SSE
    }
}
```

---

## Cross-platform release builds

```bash
# Requires build-web to have run first (or run make build-web explicitly).
make release
# Produces:
#   genie-linux-amd64
#   genie-darwin-arm64
#   genie-windows-amd64.exe
```

Or per-platform:

```bash
make build-linux    # GOOS=linux  GOARCH=amd64
make build-darwin   # GOOS=darwin GOARCH=arm64
make build-windows  # GOOS=windows GOARCH=amd64
```

Cross-compilation works without any C toolchain because `modernc.org/sqlite` is
pure Go — no CGO required.

---

## Upgrade

1. Stop the running process (or systemd service).
2. Replace the binary:
   ```bash
   sudo cp genie-linux-amd64 /opt/genie/genie
   sudo chmod +x /opt/genie/genie
   ```
3. Restart: `sudo systemctl restart genie`

Database schema migrations run automatically on startup — no manual SQL needed.

---

## Dev mode (no embed)

Without the `-tags embedweb` build tag the binary runs in API-only mode and logs:

```
no embedded frontend — running API-only mode
```

The frontend must be running separately (`pnpm dev` from the repo root), which is the
normal development workflow. CORS is pre-configured to allow `http://localhost:5173`.

```bash
# API only (dev)
cd apps/api && go run ./cmd/genie

# Frontend only (dev)
cd apps/web && pnpm dev
```
