# Lumen

Developer wallet for the Midnight blockchain ecosystem.

## Features

- Chrome Extension (Manifest V3)
- Full dApp Connector API implementation (`window.midnight`)
- Wallet generation and import (mnemonic, private key, hex seed)
- Prefunded localnet wallet support
- Network switching (localnet, devnet, qanet, preview, preprod)

## Quick Start

### Install Dependencies

```bash
npm install
```

### Build Extension

```bash
npm run build
```

### Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist/` folder

## Localnet Setup

Run a local Midnight network for development and testing.

### Prerequisites

- Docker and Docker Compose installed
- Ports 9944, 8088, and 6300 available

### Configuration

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```

2. Generate the indexer secret:
   ```bash
   # On macOS/Linux:
   openssl rand -hex 32
   ```

3. Add the generated secret to `.env`:
   ```
   APP_INFRA_SECRET=your_generated_secret_here
   ```

### Start Localnet

```bash
npm run localnet:up
```

This starts three services:

| Service | Port | Description |
|---------|------|-------------|
| node | 9944 | Midnight Substrate node (WebSocket RPC) |
| indexer | 8088 | GraphQL indexer API |
| proof-server | 6300 | ZK proof generation server |

### Localnet Commands

```bash
npm run localnet:up      # Start all services
npm run localnet:down    # Stop all services
npm run localnet:logs    # View service logs
npm run localnet:reset   # Reset (clear data and restart)
```

### Using with Lumen

1. Start the localnet
2. Open the Lumen extension popup
3. Select "Localnet" from the network dropdown
4. Import a prefunded wallet (Wallet 0-3) or generate a new one

## Development

```bash
npm run dev    # Watch mode (rebuilds on changes)
npm test       # Run unit tests
```

## Project Structure

```
src/
├── background/     # Service worker (wallet state, signing)
├── content/        # Content script (message relay)
├── inject/         # Injected script (window.midnight API)
├── popup/          # Extension popup UI
└── core/           # Shared wallet and network logic
```

## License

MIT
