# Brand2Door — tenant store backend image (Medusa v2 / @dtc/backend).
#
# Instance-per-tenant: one container per tenant, its tenant id injected as
# TENANT_ID at provision time. This is the Phase 0 substrate artifact — the
# reproducible image the provisioning saga boots.
#
# Build context is apps/backend (this directory), treated as standalone. The
# build runs `medusa build`, whose output (.medusa/server) carries its own
# package.json; the runner installs prod deps from that output and starts it.
#
# NOTE (Phase 0 gate): FILE_PROVIDER defaults to local (S3 in production needs
# creds and crashes boot otherwise). Postgres/Redis come from the compose file
# or the orchestrator, not baked in.

# ---------- build ----------
FROM node:22-slim AS build
WORKDIR /app

# system deps some native modules need at build time
RUN apt-get update -y && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
# lockfile is optional here (monorepo root holds the canonical one); install
# resolves from package.json for the standalone image. --legacy-peer-deps
# mirrors the monorepo's lenient resolution (Medusa ships intra-package peer
# ranges that npm's strict resolver rejects, e.g. draft-order↔ui minor skew).
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY . .
RUN npx medusa build

# install production deps for the built server output
WORKDIR /app/.medusa/server
RUN npm install --omit=dev --no-audit --no-fund --legacy-peer-deps

# ---------- runner ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV FILE_PROVIDER=local

# non-root
RUN useradd -m -u 10001 medusa
COPY --from=build --chown=medusa:medusa /app/.medusa/server ./

USER medusa
EXPOSE 9000

# Migrations are run by the provisioning saga (step 2), not blindly on every
# boot, so this default start is safe to re-run. Override CMD in the saga to
# run `npx medusa db:migrate` explicitly against the tenant DB before start.
CMD ["npm", "run", "start"]
