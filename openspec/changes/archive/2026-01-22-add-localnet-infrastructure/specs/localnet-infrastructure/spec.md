# Localnet Infrastructure

Local Midnight network for development and testing.

## ADDED Requirements

### Requirement: Docker Compose Services

The system SHALL provide a Docker Compose configuration that runs the complete Midnight localnet stack including node, indexer, and proof server.

#### Scenario: Start localnet services

- **WHEN** developer runs `npm run localnet:up`
- **THEN** Docker Compose starts three services:
  - `node` on port 9944 (Substrate RPC)
  - `indexer` on port 8088 (GraphQL API)
  - `proof-server` on port 6300 (ZK proof generation)

#### Scenario: Services are healthy

- **WHEN** all services have started
- **THEN** each service reports healthy status via health check
- **AND** the node produces blocks
- **AND** the indexer connects to the node via WebSocket

### Requirement: Environment Configuration

The system SHALL provide environment configuration for localnet services.

#### Scenario: Environment template exists

- **WHEN** developer clones the repository
- **THEN** `.env.example` contains all required environment variables with documentation

#### Scenario: Generate indexer secret

- **WHEN** developer needs to configure `APP_INFRA_SECRET`
- **THEN** documentation explains how to generate a 32-byte hex secret using `openssl rand -hex 32`

### Requirement: Infrastructure Management Scripts

The system SHALL provide npm scripts for managing localnet infrastructure.

#### Scenario: Start infrastructure

- **WHEN** developer runs `npm run localnet:up`
- **THEN** Docker Compose starts all services in detached mode

#### Scenario: Stop infrastructure

- **WHEN** developer runs `npm run localnet:down`
- **THEN** Docker Compose stops all services

#### Scenario: View logs

- **WHEN** developer runs `npm run localnet:logs`
- **THEN** Docker Compose displays logs from all services

#### Scenario: Reset infrastructure

- **WHEN** developer runs `npm run localnet:reset`
- **THEN** Docker Compose stops services, removes volumes, and restarts fresh

### Requirement: Data Persistence

The system SHALL persist blockchain data across container restarts.

#### Scenario: Node data persists

- **WHEN** developer stops and restarts localnet
- **THEN** blockchain state is preserved
- **AND** existing accounts and balances remain available
