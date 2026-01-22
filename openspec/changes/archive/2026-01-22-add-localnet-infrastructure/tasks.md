# Tasks: Add Localnet Infrastructure

## 1. Docker Compose Setup

- [x] 1.1 Create `docker-compose.yml` with three services:
  - midnight-node (port 9944)
  - indexer-standalone (port 8088)
  - proof-server (port 6300)
- [x] 1.2 Configure health checks for all services
- [x] 1.3 Add persistent volume for node data

## 2. Environment Configuration

- [x] 2.1 Create `.env.example` with required variables
- [x] 2.2 Add `.env` to `.gitignore` (already present)
- [x] 2.3 Document environment variable generation

## 3. NPM Scripts

- [x] 3.1 Add `localnet:up` script to start infrastructure
- [x] 3.2 Add `localnet:down` script to stop infrastructure
- [x] 3.3 Add `localnet:logs` script to view logs
- [x] 3.4 Add `localnet:reset` script to clear data and restart

## 4. Documentation

- [x] 4.1 Update README with localnet setup instructions

## Implementation Notes

- Docker images from `ghcr.io/midnight-ntwrk/`:
  - `midnight-node:0.20.0-rc.1`
  - `indexer-standalone:3.0.0-alpha.25`
  - `proof-server:7.0.0-rc.1`
- Security hardening: capabilities dropped, no-new-privileges enabled
- Node data persisted in `lumen-node-data` volume
- Indexer depends on healthy node before starting
