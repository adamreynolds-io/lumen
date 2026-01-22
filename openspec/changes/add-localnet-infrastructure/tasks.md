# Tasks: Add Localnet Infrastructure

## 1. Docker Compose Setup

- [ ] 1.1 Create `docker-compose.yml` with three services:
  - midnight-node (port 9944)
  - indexer-standalone (port 8088)
  - proof-server (port 6300)
- [ ] 1.2 Configure health checks for all services
- [ ] 1.3 Add persistent volume for node data

## 2. Environment Configuration

- [ ] 2.1 Create `.env.example` with required variables
- [ ] 2.2 Add `.env` to `.gitignore`
- [ ] 2.3 Document environment variable generation

## 3. NPM Scripts

- [ ] 3.1 Add `localnet:up` script to start infrastructure
- [ ] 3.2 Add `localnet:down` script to stop infrastructure
- [ ] 3.3 Add `localnet:logs` script to view logs
- [ ] 3.4 Add `localnet:reset` script to clear data and restart

## 4. Documentation

- [ ] 4.1 Update README with localnet setup instructions
