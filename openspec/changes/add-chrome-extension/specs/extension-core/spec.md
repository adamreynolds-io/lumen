# extension-core

Chrome extension infrastructure and build configuration.

## ADDED Requirements

### Requirement: Extension manifest configuration

The extension SHALL use Chrome Manifest V3 with appropriate permissions for wallet functionality.

#### Scenario: Extension loads successfully
- **WHEN** the extension is loaded in Chrome
- **THEN** Chrome accepts the manifest without errors
- **AND** the service worker registers successfully

#### Scenario: Required permissions declared
- **WHEN** the manifest is parsed
- **THEN** it declares storage permission for settings
- **AND** it declares activeTab permission for dApp interaction

---

### Requirement: Service worker lifecycle

The extension SHALL use a service worker as the background script per Manifest V3 requirements.

#### Scenario: Service worker starts on extension load
- **WHEN** Chrome loads the extension
- **THEN** the service worker initializes
- **AND** wallet state is reset to empty (no wallet loaded)

#### Scenario: Service worker handles restart
- **WHEN** the service worker restarts (Chrome lifecycle)
- **THEN** wallet state is cleared
- **AND** user must re-import wallet

#### Scenario: Service worker wakes from terminated state
- **WHEN** the service worker was terminated by Chrome (idle timeout)
- **AND** a message arrives from content script or popup
- **THEN** the service worker wakes and processes the message
- **AND** wallet state is empty (no wallet loaded)
- **AND** appropriate "no wallet" error is returned to caller

---

### Requirement: Session state indicator

The extension SHALL clearly indicate when wallet session has expired.

#### Scenario: Popup shows session expired state
- **WHEN** user opens popup after service worker restart
- **AND** wallet was previously loaded but state is now empty
- **THEN** the popup displays "Session expired - please reimport wallet"
- **AND** options to generate or import are shown

#### Scenario: dApp receives clear error on session loss
- **WHEN** dApp calls any wallet method after session expiry
- **THEN** the call rejects with error code `SESSION_EXPIRED`
- **AND** error message indicates wallet must be reimported

---

### Requirement: Content script injection

The extension SHALL inject a content script into web pages to enable dApp communication.

#### Scenario: Content script runs on web pages
- **WHEN** user navigates to a web page
- **THEN** the content script injects the dApp connector
- **AND** window.midnight becomes available to the page

---

### Requirement: Popup interface

The extension SHALL provide a popup UI for wallet management.

#### Scenario: Popup opens on icon click
- **WHEN** user clicks the extension icon
- **THEN** the popup opens
- **AND** displays current wallet status

---

### Requirement: TypeScript build configuration

The extension SHALL be built with TypeScript in strict mode using esbuild.

#### Scenario: Build produces extension bundle
- **WHEN** npm run build is executed
- **THEN** dist/ contains all extension files
- **AND** manifest.json is copied to dist/
- **AND** service worker, content script, and popup bundles are created

#### Scenario: Build validates extension structure
- **WHEN** npm run build is executed
- **THEN** manifest.json is validated against Chrome extension schema
- **AND** build fails if manifest is invalid
- **AND** build warns if CSP issues are detected
