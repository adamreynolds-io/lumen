# Tasks: Add Health Check Indicators

## Phase 1: Health Check Infrastructure

- [ ] 1.1 Define ServiceHealth interface (status, latency, lastChecked, error)
- [ ] 1.2 Define HealthCheckResult interface for individual service checks
- [ ] 1.3 Update ConnectionStatus interface with node, indexer, prover fields
- [ ] 1.4 Add checkNodeHealth() function to network.ts (GET /health + RPC test)
- [ ] 1.5 Add checkIndexerHealth() function to network.ts (HTTP + WS test)
- [ ] 1.6 Add checkProverHealth() function to network.ts (GET /version)

## Phase 2: Service Worker Integration

- [ ] 2.1 Add health check state to service worker
- [ ] 2.2 Implement runHealthChecks() function calling all three checks
- [ ] 2.3 Add periodic health check polling (every 10 seconds)
- [ ] 2.4 Add getHealthStatus message handler
- [ ] 2.5 Add refreshHealthStatus message handler for manual refresh
- [ ] 2.6 Update facade.getConnectionStatus() to include health data

## Phase 3: UI Display

- [ ] 3.1 Add prover status row to debug panel HTML
- [ ] 3.2 Add latency display elements (hidden by default)
- [ ] 3.3 Add refresh button next to connection section
- [ ] 3.4 Update status indicator styles for healthy/degraded/unhealthy states
- [ ] 3.5 Implement updateHealthIndicator() with color coding
- [ ] 3.6 Add hover/click to show latency and last-checked time
- [ ] 3.7 Wire up refresh button to refreshHealthStatus handler

## Phase 4: Testing

- [ ] 4.1 Test with all services running (all green)
- [ ] 4.2 Test with indexer stopped (indexer red, others green)
- [ ] 4.3 Test with node stopped (all red - dependency)
- [ ] 4.4 Test with prover stopped (prover red, others green)
- [ ] 4.5 Test manual refresh button
- [ ] 4.6 Verify latency display updates correctly
