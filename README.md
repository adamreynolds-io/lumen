# Lumen

**Developer wallet for the Midnight blockchain ecosystem**

A Chrome extension wallet designed for QA teams and developers to test Midnight dApps. Implements the full `@midnight-ntwrk/dapp-connector-api` specification with real wallet SDK integration.

---

## Features

### Wallet Management
- **Generate wallets** - BIP39 mnemonic seed phrase generation
- **Import wallets** - From seed phrase, private key, or hex seed
- **Prefunded localnet wallets** - One-click import of genesis mint wallets (0-3)
- **Secure key storage** - In-memory only, keys never persisted to disk

### dApp Connector API
- Full `window.midnight` API implementation (v4.0.0-beta.2)
- `InitialAPI` with connect flow
- `ConnectedAPI` with balance queries, signing, configuration
- Compatible with Midnight dApps expecting standard wallet interface

### Network Support
| Network | Node | Indexer | Prover |
|---------|------|---------|--------|
| Localnet | localhost:9944 | localhost:8088 | localhost:6300 |
| DevNet | devnet.midnight.network | devnet indexer | devnet prover |
| QANET | qanet.midnight.network | qanet indexer | qanet prover |
| Preview | preview.midnight.network | preview indexer | preview prover |
| PreProd | preprod.midnight.network | preprod indexer | preprod prover |
| Custom | User-defined URLs | | |

### Debug Panel
- **Dust tab** - DUST coin inventory with values and status
- **Shielded tab** - Shielded wallet state and balances
- **Unshielded tab** - Unshielded wallet state and balances
- **Transactions tab** - Recent transaction history from both wallets

### Health Monitoring
- Real-time status indicators for Node, Indexer, and Prover
- Color-coded health dots (green/yellow/red)
- Latency display and error reporting
- Automatic polling with exponential backoff

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- Chrome browser

### Installation

```bash
# Clone the repository
git clone https://github.com/user/lumen.git
cd lumen

# Install dependencies
npm install

# Build the extension
npm run build
```

### Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `dist/` folder from the project

### First Use

1. Click the Lumen extension icon in Chrome toolbar
2. Select your target network (Localnet, DevNet, etc.)
3. Either:
   - Click **Generate Wallet** to create a new wallet
   - Click **Import** to restore from seed phrase
   - For Localnet: Use quick-import buttons for prefunded wallets

---

## dApp Integration

### Detecting Lumen

```javascript
// Check if Lumen is installed
if (window.midnight && window.midnight['lumen-wallet']) {
  console.log('Lumen wallet detected');
}

// Listen for wallet availability
window.addEventListener('midnight#ready', (event) => {
  console.log('Wallet ready:', event.detail.uuid);
});
```

### Connecting

```javascript
const lumen = window.midnight['lumen-wallet'];

// Connect to wallet
const api = await lumen.connect('devnet');

// Get addresses
const { dustAddress } = await api.getDustAddress();
const { unshieldedAddress } = await api.getUnshieldedAddress();

// Get balance
const { balance, cap } = await api.getDustBalance();
console.log(`Balance: ${balance} / ${cap}`);
```

### Signing Data

```javascript
const signature = await api.signData('Hello Midnight', {
  encoding: 'text',
  keyType: 'unshielded'
});

console.log('Signature:', signature.signature);
console.log('Verifying key:', signature.verifyingKey);
```

### Getting Configuration

```javascript
const config = await api.getConfiguration();
// Returns: { indexerUri, indexerWsUri, proverServerUri, substrateNodeUri, networkId }
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Chrome Extension                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │    Popup     │    │   Content    │    │   Inject     │       │
│  │  (popup.ts)  │    │  (content.ts)│    │ (inject.ts)  │       │
│  │              │    │              │    │              │       │
│  │  - UI/UX     │    │  - Message   │    │  - window.   │       │
│  │  - Settings  │    │    relay     │    │    midnight  │       │
│  │  - Debug     │    │  - Origin    │    │  - dApp API  │       │
│  │    panel     │    │    validation│    │              │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └─────────┬─────────┴─────────┬─────────┘                │
│                   │                   │                          │
│                   ▼                   ▼                          │
│         ┌─────────────────────────────────────┐                  │
│         │         Service Worker              │                  │
│         │       (service-worker.ts)           │                  │
│         │                                     │                  │
│         │  ┌─────────────┐ ┌───────────────┐  │                  │
│         │  │   Wallet    │ │    Facade     │  │                  │
│         │  │   Core      │ │  (SDK wrap)   │  │                  │
│         │  │             │ │               │  │                  │
│         │  │ - Keys      │ │ - DustWallet  │  │                  │
│         │  │ - Signing   │ │ - Shielded    │  │                  │
│         │  │ - Import    │ │ - Unshielded  │  │                  │
│         │  └─────────────┘ └───────────────┘  │                  │
│         └─────────────────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │      Midnight Network         │
              │                               │
              │  Node ─── Indexer ─── Prover  │
              └───────────────────────────────┘
```

### Project Structure

```
src/
├── background/
│   └── service-worker.ts   # Wallet state, message handlers, SDK facade
├── content/
│   └── content.ts          # Message relay, origin validation
├── inject/
│   └── inject.ts           # window.midnight API implementation
├── popup/
│   ├── popup.html          # Extension popup markup
│   ├── popup.css           # Styles
│   └── popup.ts            # UI logic, debug panel
├── core/
│   ├── wallet.ts           # Key generation, signing, import
│   ├── network.ts          # RPC client, health checks
│   ├── facade.ts           # Wallet SDK wrapper
│   └── types.ts            # Shared type definitions
└── lib/
    └── messaging.ts        # Message passing utilities
```

---

## Security

Lumen implements defense-in-depth security measures:

### Key Protection
- **In-memory only** - Keys never written to disk or chrome.storage
- **Secure wiping** - Random overwrite before clearing key buffers
- **Popup-only access** - Sensitive methods restricted to extension popup
- **Error cleanup** - Automatic key wipe on uncaught errors

### dApp Isolation
- **Origin validation** - Approved origins tracked per session
- **Protocol blocking** - Rejects `data:`, `blob:`, `file:`, `javascript:` URLs
- **Rate limiting** - 100 requests/minute per origin
- **Specific postMessage** - No wildcard origins

### Data Protection
- **XSS prevention** - HTML escaping for all blockchain data
- **Config integrity** - SHA-256 checksums for stored settings
- **Response limits** - 100KB max for health check responses
- **Generic errors** - No implementation details leaked

### Production Hardening
- **Conditional logging** - Sensitive data only logged in development
- **Private IP blocking** - SSRF protection for custom URLs
- **Exponential backoff** - Circuit breaker for failed operations

---

## Localnet Setup

Run a local Midnight network for development and testing.

### Prerequisites
- Docker and Docker Compose
- Ports 9944, 8088, and 6300 available

### Commands

```bash
npm run localnet:up      # Start all services
npm run localnet:down    # Stop all services
npm run localnet:logs    # View service logs
npm run localnet:reset   # Reset data and restart
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| node | 9944 | Midnight Substrate node (WebSocket RPC) |
| indexer | 8088 | GraphQL indexer API |
| proof-server | 6300 | ZK proof generation server |

### Prefunded Wallets

Localnet includes 4 prefunded genesis wallets with DUST:

| Wallet | Quick Import |
|--------|--------------|
| Wallet 0 | Click "0" button in popup |
| Wallet 1 | Click "1" button in popup |
| Wallet 2 | Click "2" button in popup |
| Wallet 3 | Click "3" button in popup |

### Custom Configuration

```bash
cp .env.example .env
# Edit .env to customize:
# - APP_INFRA_SECRET for indexer auth
```

---

## Development

### Setup

```bash
npm install          # Install dependencies
npm run build        # Production build
npm run dev          # Watch mode (rebuilds on changes)
```

### Testing

```bash
npm test             # Run unit tests
```

### Manual Testing

1. Load the extension in Chrome (see Quick Start)
2. Open `test/dapp-test.html` in a browser tab
3. Click "Detect Wallet" to verify API injection
4. Click "Connect" to test wallet connection flow

### Build Output

```
dist/
├── manifest.json       # Extension manifest
├── background.js       # Service worker bundle (~29MB with WASM)
├── content.js          # Content script
├── inject.js           # Injected script
└── popup/
    ├── popup.html
    ├── popup.css
    └── popup.js
```

---

## API Reference

### InitialAPI (window.midnight['lumen-wallet'])

| Property | Type | Description |
|----------|------|-------------|
| `rdns` | string | Reverse DNS identifier (`io.lumen.wallet`) |
| `name` | string | Wallet name (`Lumen`) |
| `icon` | string | Base64 SVG icon |
| `apiVersion` | string | API version (`4.0.0-beta.2`) |
| `connect(networkId)` | function | Connect and return ConnectedAPI |

### ConnectedAPI

| Method | Returns | Description |
|--------|---------|-------------|
| `getDustAddress()` | `{ dustAddress }` | Get DUST address |
| `getUnshieldedAddress()` | `{ unshieldedAddress }` | Get unshielded address |
| `getDustBalance()` | `{ balance, cap }` | Get DUST balance |
| `signData(data, options)` | `{ data, signature, verifyingKey }` | Sign arbitrary data |
| `getConfiguration()` | `Configuration` | Get network endpoints |
| `getConnectionStatus()` | `{ status, networkId }` | Check connection state |

---

## Troubleshooting

### Extension not loading
- Ensure `dist/` folder exists (run `npm run build`)
- Check Chrome developer mode is enabled
- Look for errors in `chrome://extensions`

### Wallet not connecting to dApp
- Verify the dApp page is using `window.midnight['lumen-wallet']`
- Check browser console for connection errors
- Ensure wallet is unlocked (has active wallet loaded)

### Balance showing 0
- Wait for wallet sync (check debug panel for sync progress)
- Verify network selection matches where funds exist
- For localnet, use prefunded wallets (0-3)

### Health indicators red
- Check if localnet services are running (`npm run localnet:logs`)
- Verify network URLs in settings
- Check network connectivity

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- TypeScript strict mode
- No `any` types without justification
- ESLint + Prettier formatting

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Midnight Network](https://midnight.network) - Blockchain platform
- [@midnight-ntwrk packages](https://www.npmjs.com/org/midnight-ntwrk) - Official SDK
- [Polkadot.js](https://polkadot.js.org/) - Substrate RPC client
