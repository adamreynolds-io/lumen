# Change: Add Health Check Indicators for Network Services

## Why

The current connection status display only infers indexer WebSocket status from facade state availability. It does not:
- Actively probe service health endpoints
- Track node RPC connection status (hardcoded to 'unknown')
- Monitor prover server availability
- Show latency or error details

Developers need clear visibility into which services are healthy to diagnose sync and transaction issues.

## What Changes

### Active Health Monitoring
- Add periodic health checks for node, indexer, and prover services
- Check node `/health` endpoint and RPC availability
- Check indexer HTTP and WebSocket endpoints
- Check prover `/version` endpoint

### Enhanced Connection Status
- Track individual status per service: node, indexer, prover
- Record last successful check timestamp per service
- Capture latency metrics
- Store error messages per service

### UI Enhancements
- Display three separate status indicators (node, indexer, prover)
- Color-coded status: green (healthy), yellow (degraded), red (unhealthy), gray (unknown)
- Show latency and last-checked timestamp on hover/expand
- Add manual "Refresh" button to trigger immediate health check

## Impact

- Affected specs: `facade-debug` (MODIFIED)
- Affected code:
  - `src/core/facade.ts` - Enhanced ConnectionStatus interface, active health checks
  - `src/core/network.ts` - Add health check functions for indexer and prover
  - `src/background/service-worker.ts` - Periodic health polling
  - `src/popup/popup.html` - Three-service status display
  - `src/popup/popup.ts` - Update status indicators
  - `src/popup/popup.css` - Status indicator styles
