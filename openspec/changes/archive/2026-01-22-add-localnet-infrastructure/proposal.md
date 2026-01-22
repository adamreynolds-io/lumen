# Change: Add Localnet Infrastructure

## Why

Developers need a local Midnight network to test the Lumen wallet without depending on external devnet/testnet availability. The midnight-wallet reference implementation uses Docker Compose to run local infrastructure, and Lumen should provide the same capability for consistent QA testing.

## What Changes

- Add Docker Compose configuration to run local Midnight network
- Include three services: node, indexer, and proof-server
- Provide environment configuration template
- Add npm scripts for easy infrastructure management
- Document setup and usage

## Impact

- Affected specs: New `localnet-infrastructure` capability
- Affected code: Root-level `docker-compose.yml`, `.env.example`, `package.json` scripts
- No changes to existing extension code
