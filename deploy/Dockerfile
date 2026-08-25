# BuildingOS runtime dev image (M1.5 ② — deploy/Dockerfile).
# Build context = the BuildingOS tool repository root (the repo that contains
# pnpm-workspace.yaml). The image builds the CLI and globally installs the
# self-contained bundle, so `buildingos` is the container entry point.
FROM node:22-alpine

WORKDIR /tool
COPY . .

# pnpm's global bin dir must be on PATH for `pnpm add -g` (pnpm 11 check).
ENV PATH="/root/.local/share/pnpm/bin:$PATH"

# corepack gives us pnpm; the workspace's allowBuilds (esbuild) allows its
# postinstall to fetch the platform binary. Then: install → build → pack the
# self-contained CLI tarball → global install → drop the temp tarball.
# The tool sources stay at /tool for in-container debugging (dogfooding).
RUN corepack enable \
 && pnpm install --frozen-lockfile \
 && pnpm build \
 && cd cli \
 && pnpm pack --pack-destination /tmp \
 && pnpm add -g /tmp/buildingos-cli-*.tgz \
 && cd / \
 && rm -f /tmp/buildingos-cli-*.tgz

# The tenant workspace is mounted here (docker compose binds <tenant>:<here>).
WORKDIR /workspace
ENTRYPOINT ["buildingos"]
