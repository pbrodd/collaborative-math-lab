# Run the lab on your own server

The Docker deployment is independent of Sites and Cloudflare. It runs the same app with Node.js 24 and SQLite, using a named Docker volume for workbooks, room memberships, contributions, and reviews. Cloudflare can optionally provide DNS, a proxy, or a Tunnel. No AI API key, Cloudflare account, or local Lean installation is needed to run the app.

## Handoff for the host

You need Docker Engine with Compose v2, a hostname, and an HTTPS reverse proxy or Cloudflare Tunnel. Run one application container with local persistent storage. This is a suitable starting deployment for a small trial group; capacity has not been load-tested.

```sh
git clone https://github.com/pbrodd/collaborative-math-lab.git
cd collaborative-math-lab
cp deploy/env.example .env
docker compose up -d --build --wait
```

For a local trial, open `http://localhost:3000`. For a server, edit `.env` first: set `APP_ORIGIN=https://math.your-domain.example` to the exact public origin, without a path. Configure HTTPS using one of the options below. Keep the same origin to preserve browser sessions.

The image builds from the checked-out source with the npm lockfile. It runs as the unprivileged `node` user, with a read-only application filesystem. `/data` holds SQLite, `/tmp` is disposable, and logs go to Docker with rotation. The image health check calls `/api/health`, which checks database availability. The runtime does not install dependencies or download proof tools at startup.

```sh
docker compose ps
docker compose logs --tail=100 app
curl --fail http://127.0.0.1:3000/api/health
```

## Option A: use your existing reverse proxy

The default host binding is `127.0.0.1:3000`. Point your host's Caddy, nginx, or equivalent HTTPS proxy there. For example, an existing Caddy installation can use:

```caddyfile
math.your-domain.example {
    reverse_proxy 127.0.0.1:3000
}
```

If the proxy itself runs in Docker, connect it to the `collaborative-math-lab_default` network and use `http://app:3000` as the upstream. `localhost` inside a proxy container refers to that container, not the app. The app's published port can stay bound to loopback.

Preserve the public Host header. `APP_ORIGIN` gives the app its canonical public URL and makes session cookies Secure on HTTPS even though the proxy's internal connection uses HTTP. It also supplies the expected origin for write requests. Do not cache `/api/*` or personalized HTML; leave Cloudflare's normal static-asset caching in place rather than adding a Cache Everything rule. For proxied Cloudflare DNS, use Full (strict) TLS with a valid origin certificate.

## Option B: add Cloudflare Tunnel

If you already have a tunnel, simply add a hostname route to this app. Otherwise the optional Compose overlay runs `cloudflared` on the app's Docker network:

1. Create a tunnel in Cloudflare and obtain its connector token. This is a **tunnel token**, not a general Cloudflare API token.
2. Create the ignored `secrets/` directory with mode `700`. Save the token in `secrets/tunnel-token.txt`. The container's unprivileged user must be able to read the file; with a private parent directory, file mode `644` supports the read-only Compose secret mount.
3. Set `APP_ORIGIN` in `.env` to the public HTTPS hostname.
4. In the tunnel's published application route, map that hostname to **`http://app:3000`**.
5. Start the stack:

```sh
docker compose -f compose.yaml -f deploy/compose.tunnel.yaml up -d --build --wait
```

Use both `-f` options for subsequent Compose operations on this stack. The tunnel needs outbound connectivity; the app needs no public inbound port. The token stays in a read-only secret mount and is excluded from Git and the Docker build context. The example tracks the maintained `cloudflared:latest` image; pin a tested image digest if your host manages upgrades that way.

See Cloudflare's [Tunnel setup](https://developers.cloudflare.com/tunnel/get-started/) and [token-file option](https://developers.cloudflare.com/tunnel/reference/run-parameters/#token-file). Cloudflare Access or an existing proxy login can limit the initial trial group. Room codes control workbook membership inside the app; they are separate from site access.

## Back up and restore

Data lives in the `collaborative-math-lab_lab-data` volume. Container replacement and ordinary `docker compose down` preserve it. **`docker compose down -v` deletes it.** The Sites-hosted app has a separate database; existing Sites data is not automatically copied to this deployment.

Use the SQLite online backup API, which produces a consistent snapshot while the app is running, including committed data still in the write-ahead log:

```sh
mkdir -p backups
docker compose exec -T app node scripts/backup.mjs /data/backup.sqlite
docker compose cp app:/data/backup.sqlite backups/math-lab.sqlite
```

Copy that backup off the server and keep dated versions. It includes student work and membership identifiers. Do not commit it or place it under the public web root. Schedule these commands with the host's existing backup system. The helper replaces an existing destination backup.

To restore, stop the app and restore into its existing volume. These commands replace the current database, so keep a fresh backup first:

```sh
docker compose stop app
docker compose run --rm --no-deps -v "$PWD/backups:/backup:ro" app \
  node --input-type=module -e '
    import { copyFileSync, rmSync } from "node:fs";
    for (const suffix of ["-wal", "-shm"]) rmSync("/data/math-lab.sqlite" + suffix, { force: true });
    copyFileSync("/backup/math-lab.sqlite", "/data/math-lab.sqlite");
  '
docker compose up -d --wait
```

The restore container uses the same unprivileged user and volume as the app. Keep the app stopped until restoration completes. Test your backup/restore procedure before relying on it.

## Update and roll back

Back up first. Record the current commit (`git rev-parse HEAD`), then update and rebuild:

```sh
git pull --ff-only
docker compose build --pull
docker compose up -d --wait
```

For reproducible releases, deploy a selected commit or tag and set `IMAGE_TAG` accordingly. Roll back by checking out the previous commit and rebuilding. If an update changes the database schema, consult its release notes and restore the matching backup when required. Current tables are initialized automatically on first use; future schema changes need explicit migration handling.

## What testers should know

- Create a workbook or choose a starting mission, then share the room code with teammates. Display names can be nicknames; no email account is required.
- Membership is tied to an HTTP-only cookie in that browser. Clearing cookies loses that browser identity; an invitation code can join again but does not restore creator ownership. Account recovery is not implemented.
- Keep one app replica per database volume. SQLite's local storage is intended for this single-server deployment, not several hosts sharing a network filesystem.
- Overkill mode includes the same Lean-checked examples and downloadable proof candidates. It does not execute arbitrary Lean submissions on your server. CI remains responsible for checking catalog contributions.
- Remix attribution records the source workbook and supplied creator name. It is not cryptographic proof of an author's identity. Lean verifies the displayed mathematical claim, not the story's real-world data or the entire application.

## Cloudflare Workers instead of a VPS

The original `npm run dev` and `npm run build` still target Workers with D1. `.openai/hosting.json` belongs to the existing Sites deployment; do not reuse its project ID to publish another instance. A deployment directly into your own Cloudflare account needs its own Worker configuration and D1 binding named `DB`, plus the `drizzle/` migrations. Docker is the ready-to-run independent deployment described here; no VPS or Cloudflare resources are created by cloning or building the repository.

For contributors, `npm run build:node` creates `dist/standalone/`, and `npm run start:node` runs it without Docker. Set `DATABASE_PATH` to choose the SQLite file and `APP_ORIGIN` for proxy hosting. Each build target writes `dist/`; build the desired target before packaging it.
