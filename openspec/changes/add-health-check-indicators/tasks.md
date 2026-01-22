# Tasks: Add Health Check Indicators

## Phase 1: Health Check Infrastructure ✅

- [x] 1.1 Define ServiceHealth interface (status, latency, lastChecked, error)
- [x] 1.2 Define HealthCheckResult interface for individual service checks
- [x] 1.3 Update ConnectionStatus interface with node, indexer, prover fields
- [x] 1.4 Add checkNodeHealth() function to network.ts (GET /health + RPC test)
- [x] 1.5 Add checkIndexerHealth() function to network.ts (HTTP GraphQL test)
- [x] 1.6 Add checkProverHealth() function to network.ts (GET /version)

## Phase 2: Service Worker Integration ✅

- [x] 2.1 Health check state tracked via facade.getConnectionStatus()
- [x] 2.2 facade.getConnectionStatus() runs all three checks in parallel
- [x] 2.3 Periodic polling via popup's 1s auto-refresh calling getConnectionStatus
- [x] 2.4 getConnectionStatus message handler exists in service worker
- [x] 2.5 ~~refreshHealthStatus~~ (not needed - auto-refresh handles it)
- [x] 2.6 facade.getConnectionStatus() returns full health data (done in Phase 1)

## Phase 3: UI Display ✅

- [x] 3.1 Add prover status row to debug panel HTML
- [x] 3.2 Add latency display inline with status
- [x] 3.3 ~~Add refresh button~~ (not needed - auto-refresh every 1s)
- [x] 3.4 Update status indicator styles for healthy/degraded/unhealthy states
- [x] 3.5 Implement updateHealthIndicator() with color coding
- [x] 3.6 Add hover/click to show latency and last-checked time
- [x] 3.7 ~~Wire up refresh button~~ (not needed - auto-refresh every 1s)

## Phase 4: Testing ✅

- [x] 4.1 Test with all services running (all green)
- [x] 4.2 Test with indexer stopped (indexer red, others green)
- [x] 4.3 Test with node stopped (all red - dependency)
- [x] 4.4 Test with prover stopped (prover red, others green)
- [x] 4.5 ~~Test manual refresh button~~ (removed - auto-refresh handles it)
- [x] 4.6 Verify latency display updates correctly
