# Project Context

## Purpose

**Midnight Lumen** is a developer wallet for the Midnight blockchain ecosystem. It serves multiple purposes:

1. **QA Testing Tool**: Chrome plugin and local service for QA teams to validate devnet and testnet releases of the dapp-connector-api and wallet-sdk
2. **Reference Implementation**: Example wallet for wallet builders to follow when integrating with Midnight
3. **Server-side Wallet** (future): Potential production use for holding DUST tokens to pay gas fees

**Priority**: Chrome developer plugin

## Tech Stack

- **TypeScript** - Primary language with strict type checking
- **Node.js** - Runtime environment
- **Chrome Extension APIs** - For browser plugin functionality
- **Midnight SDK** - Integration with Midnight blockchain

## Project Conventions

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Prefer functional patterns where appropriate
- Use explicit types (avoid `any`)
- kebab-case for file names, PascalCase for components/classes, camelCase for functions/variables

### Architecture Patterns

- **Chrome Extension Manifest V3** architecture
- Service worker for background operations
- Content scripts for dApp interaction
- Popup UI for user interactions
- Message passing between extension components
- Clean separation between wallet core logic and UI

### Testing Strategy

- Scenario-based acceptance testing aligned with OpenSpec scenarios
- Unit tests for wallet core logic (key management, signing, transactions)
- Integration tests against devnet/testnet
- Manual QA validation for dApp connector compatibility

### Git Workflow

- `main` branch for stable releases
- Feature branches for development (`feature/<change-id>`)
- OpenSpec-driven changes: create proposal → implement → archive
- Conventional commits preferred

## Domain Context

### Midnight Blockchain Concepts

- **DUST**: Native token used for gas fees on Midnight
- **Devnet/Testnet**: Development and testing networks for validation
- **dApp Connector**: API for decentralized applications to interact with wallets
- **Midnight Wallet**: Reference consumer wallet that Lumen validates against

### Key Integration Points

- **dapp-connector-api**: Standard interface for dApps to request wallet operations
- **wallet-sdk**: SDK that Lumen helps test and validates compatibility with

## Important Constraints

- Must be compatible with Chrome Extension Manifest V3
- Must implement the dapp-connector-api specification exactly
- Designed for development/QA use - security posture appropriate for non-production initially
- Should support both browser plugin and local service modes

## External Dependencies

### NPM Packages (Public)

Lumen uses **publicly published npm packages** from the `@midnight-ntwrk` scope on npmjs.com.

#### dApp Connector
- `@midnight-ntwrk/dapp-connector-api` - dApp connector interface

#### Wallet SDK (Released)
These packages have stable releases:
- `@midnight-ntwrk/wallet-sdk-address-format` - Address formatting utilities
- `@midnight-ntwrk/wallet-sdk-capabilities` - Wallet capability definitions
- `@midnight-ntwrk/wallet-sdk-hd` - HD wallet derivation

#### Wallet SDK (Pre-release Only)
These packages only have pre-release versions (use with caution, API may change):
- `@midnight-ntwrk/wallet-sdk-abstractions` - Core abstractions
- `@midnight-ntwrk/wallet-sdk-dust-wallet` - DUST token wallet
- `@midnight-ntwrk/wallet-sdk-facade` - High-level wallet facade
- `@midnight-ntwrk/wallet-sdk-indexer-client` - Indexer integration
- `@midnight-ntwrk/wallet-sdk-node-client` - Node RPC client
- `@midnight-ntwrk/wallet-sdk-prover-client` - Zero-knowledge prover client
- `@midnight-ntwrk/wallet-sdk-runtime` - Wallet runtime
- `@midnight-ntwrk/wallet-sdk-shielded` - Shielded transactions
- `@midnight-ntwrk/wallet-sdk-unshielded-state` - Unshielded state management
- `@midnight-ntwrk/wallet-sdk-unshielded-wallet` - Unshielded wallet operations
- `@midnight-ntwrk/wallet-sdk-utilities` - General utilities

### Reference Repositories

These repos are for reference only (understanding specs, reviewing implementations):
- https://github.com/midnightntwrk/dapp-connector-api
- https://github.com/midnightntwrk/wallet-sdk

### Other

- **Midnight Network**: https://midnight.network/ - The underlying blockchain
- **Chrome Web Store** (future): For plugin distribution
