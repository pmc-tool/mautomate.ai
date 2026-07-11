# Brand2Door substrate (Phase 0)

The reproducible tenant-store image + the single-tenant compose template the
provisioning saga stamps out per customer.

## What's here

- **`../Dockerfile`** — multi-stage build of `@dtc/backend`. Build stage runs
  `medusa build`; runner serves `.medusa/server` as a non-root user with
  `FILE_PROVIDER=local` (S3 default crashes boot without creds).
- **`docker-compose.tenant.yml`** — one tenant = backend + own Postgres + Redis.
  `TENANT_ID`, `DATABASE_URL`, `PLATFORM_KEK`, port and secrets are injected per
  tenant at provision time.

## Substrate decision

Docker Compose on the current VM for the first ~10 tenants; graduate the long
tail to an orchestrator. Recorded so Phases 1–2 build the provisioning saga and
routing against a decided runtime (the review flagged deferring this as a
rework risk).

## Phase 0 exit gate

The gate for closing Phase 0 and starting the saga:

```bash
# build the image
docker build -t brand2door/tenant-backend:dev -f Dockerfile .

# provision one throwaway tenant
export TENANT_ID=ten_scratch TENANT_DB_NAME=scratch TENANT_PORT=9401 \
       PLATFORM_KEK=$(openssl rand -base64 32)
docker compose -f docker/docker-compose.tenant.yml -p scratch up -d

# ... verify it boots + routes ...

# tear down with ZERO orphans (this is the assertion)
docker compose -f docker/docker-compose.tenant.yml -p scratch down -v
```

Exit is green when: image builds reproducibly, the scratch tenant boots and
serves, teardown leaves no container/volume/network behind, and
`npm test -- crypto` (the secret-encryption gate) passes.

## Notes

- Build context is `apps/backend`, treated as standalone. If workspace-linked
  deps are added later, switch to a monorepo-root build context with a pruned
  turbo scope.
- `PLATFORM_KEK` here is a compose env for the local gate. In production it is a
  KMS-managed master key, never an env literal.
