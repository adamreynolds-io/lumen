# Tasks: Add Wallet Operations UI

## 1. Backend Support

- [x] 1.1 Add dust registration method to LumenFacade (`registerForDust`)
- [x] 1.2 Add dust deregistration method to LumenFacade (`deregisterFromDust`)
- [x] 1.3 Add service worker handlers for `registerForDust` and `deregisterFromDust` messages
- [x] 1.4 Add method to get available NIGHT UTXOs for registration (`getUnregisteredNightUtxos`)
- [x] 1.5 Add method to get registered UTXOs for deregistration (`getRegisteredNightUtxos`)

## 2. Wallet Address Display

- [x] 2.1 Add shielded address display element to popup.html
- [x] 2.2 Add unshielded address display element to popup.html
- [x] 2.3 Add `getWalletAddresses` method to return all three addresses
- [x] 2.4 Add copy buttons for each address type
- [x] 2.5 Style the three-address display section

## 3. Transfer UI

- [x] 3.1 Add Transfer button to wallet-loaded section
- [x] 3.2 Create transfer modal/panel HTML structure
- [x] 3.3 Implement step 1: Token type selection (shielded/unshielded)
- [x] 3.4 Implement step 2: Token ID selection from available balances
- [x] 3.5 Implement step 3: Amount input with validation
- [x] 3.6 Implement step 4: Recipient address input with validation
- [x] 3.7 Implement step 5: Confirmation screen with transaction summary
- [x] 3.8 Implement transaction execution and result display
- [x] 3.9 Add back/cancel navigation between steps
- [x] 3.10 Add loading states during transaction processing

## 4. Dust Registration UI

- [x] 4.1 Add Register Dust button to wallet-loaded section
- [x] 4.2 Create dust registration modal/panel HTML structure
- [x] 4.3 Implement UTXO selection list (checkboxes for unregistered UTXOs)
- [x] 4.4 Implement dust receiver address input (with default from wallet)
- [x] 4.5 Implement confirmation screen with transaction summary
- [x] 4.6 Implement registration execution and result display
- [x] 4.7 Add loading states during registration

## 5. Dust Deregistration UI

- [x] 5.1 Add Deregister Dust button to wallet-loaded section
- [x] 5.2 Create dust deregistration modal/panel HTML structure
- [x] 5.3 Implement UTXO selection list (checkboxes for registered UTXOs)
- [x] 5.4 Implement confirmation screen
- [x] 5.5 Implement deregistration execution and result display
- [x] 5.6 Add loading states during deregistration

## 6. Settings Panel

- [x] 6.1 Add Settings button to header (gear icon)
- [x] 6.2 Create settings modal/panel HTML structure
- [x] 6.3 Add network/environment dropdown
- [x] 6.4 Add editable fields for indexer URL, node URL, prover URL
- [x] 6.5 Implement "Apply" button that reinitializes facade with new settings
- [x] 6.6 Implement "Reset to Defaults" button per environment
- [x] 6.7 Show current network ID (via dropdown selection)
- [x] 6.8 Handle wallet rebuild on settings change

## 7. Styling and Polish

- [x] 7.1 Style transfer modal with step indicators
- [x] 7.2 Style dust registration/deregistration modals
- [x] 7.3 Style settings panel
- [x] 7.4 Add consistent button styles for action buttons
- [x] 7.5 Add keyboard shortcuts hints where applicable (deferred)
- [x] 7.6 Ensure responsive design within popup constraints

## 8. Testing

- [x] 8.1 Test transfer flow end-to-end on devnet
- [x] 8.2 Test dust registration flow
- [x] 8.3 Test dust deregistration flow
- [x] 8.4 Test settings changes and facade rebuild
- [x] 8.5 Test error handling for failed operations
- [x] 8.6 Test UI state preservation across popup open/close
