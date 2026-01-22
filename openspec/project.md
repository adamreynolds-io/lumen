# Project Context

## Purpose

**Midnight Lumen** is a developer wallet for the Midnight blockchain ecosystem. It serves multiple purposes:

1. **QA Testing Tool**: Chrome plugin and local service for QA teams to validate devnet and testnet releases of the midnight-dapp-connector-api and midnight-wallet
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

- **midnight-dapp-connector-api**: Standard interface for dApps to request wallet operations
- **midnight-wallet**: Production wallet that Lumen helps test and validates compatibility with

## Important Constraints

- Must be compatible with Chrome Extension Manifest V3
- Must implement the midnight-dapp-connector-api specification exactly
- Designed for development/QA use - security posture appropriate for non-production initially
- Should support both browser plugin and local service modes

## External Dependencies

- **Midnight Network**: https://midnight.network/ - The underlying blockchain
- **midnight-dapp-connector-api**: https://github.com/midnightntwrk/midnight-dapp-connector-api - dApp connection interface
- **midnight-wallet**: https://github.com/midnightntwrk/midnight-wallet - Reference wallet for compatibility testing
- **Chrome Web Store** (future): For plugin distribution
