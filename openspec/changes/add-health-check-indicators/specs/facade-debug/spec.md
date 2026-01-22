# Capability: Facade Debug

## MODIFIED Requirements

### Requirement: Connection Status Display

The debug panel SHALL display the health status of all network services: node, indexer, and prover.

#### Scenario: Show node health status
- **WHEN** the debug panel is visible
- **THEN** display node RPC status with color indicator (green=healthy, red=unhealthy, gray=unknown)

#### Scenario: Show indexer health status
- **WHEN** the debug panel is visible
- **THEN** display indexer status with color indicator (green=healthy, red=unhealthy, gray=unknown)

#### Scenario: Show prover health status
- **WHEN** the debug panel is visible
- **THEN** display prover status with color indicator (green=healthy, red=unhealthy, gray=unknown)

#### Scenario: Show service latency
- **WHEN** the debug panel is visible AND user hovers over a service status indicator
- **THEN** display the last recorded latency in milliseconds AND the timestamp of the last successful check

#### Scenario: Manual health refresh
- **WHEN** user clicks the refresh button in the connection section
- **THEN** immediately trigger health checks for all services AND update status indicators

## ADDED Requirements

### Requirement: Active Health Monitoring

The extension SHALL periodically check the health of network services while a wallet is loaded.

#### Scenario: Periodic health checks
- **WHEN** a wallet is loaded AND the extension is running
- **THEN** health checks for node, indexer, and prover run automatically every 10 seconds

#### Scenario: Node health check
- **WHEN** a health check runs for the node
- **THEN** the system checks the node's /health HTTP endpoint AND measures response latency

#### Scenario: Indexer health check
- **WHEN** a health check runs for the indexer
- **THEN** the system checks the indexer's HTTP endpoint availability AND measures response latency

#### Scenario: Prover health check
- **WHEN** a health check runs for the prover
- **THEN** the system checks the prover's /version HTTP endpoint AND measures response latency

#### Scenario: Health check failure handling
- **WHEN** a health check fails for any service
- **THEN** the service status is set to unhealthy AND the error message is recorded

### Requirement: Health Status Data Structure

The connection status SHALL include detailed health information for each service.

#### Scenario: Health status fields
- **WHEN** connection status is requested
- **THEN** return status (healthy/unhealthy/unknown), latency (ms), lastChecked (timestamp), and error (if any) for each service
