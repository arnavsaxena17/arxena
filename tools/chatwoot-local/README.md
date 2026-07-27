# Chatwoot Local / Production Sidecar

This folder holds the lightweight runtime pieces we keep in the monorepo for
the branded Arxena Chatwoot deployment.

## Files

- `docker-compose.yml`: runs Chatwoot, Postgres, and Redis
- `.env.example`: template environment for local or production
- `prepare-source.sh`: clones upstream Chatwoot into `../chatwoot-source` and
  applies Arxena branding assets/strings

## Usage

```bash
cd tools/chatwoot-local
cp .env.example .env
./prepare-source.sh
docker compose build rails sidekiq
docker compose up -d
```

The cloned `tools/chatwoot-source` app is intentionally not committed to Git.
