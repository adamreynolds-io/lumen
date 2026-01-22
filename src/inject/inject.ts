/**
 * Injected Script
 *
 * Runs in the page context (not extension context).
 * Exposes window.midnight API for dApps to interact with Lumen wallet.
 *
 * Implements the @midnight-ntwrk/dapp-connector-api specification.
 * See: https://github.com/midnightntwrk/midnight-dapp-connector-api
 */

console.log('[Lumen] Injecting dapp-connector-api');

// ============================================
// Types (aligned with @midnight-ntwrk/dapp-connector-api)
// ============================================

/** Error codes from dapp-connector-api */
const ErrorCodes = {
  InternalError: 'InternalError',
  Rejected: 'Rejected',
  InvalidRequest: 'InvalidRequest',
  PermissionRejected: 'PermissionRejected',
  Disconnected: 'Disconnected',
} as const;

type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

interface APIError extends Error {
  type: 'DAppConnectorAPIError';
  code: ErrorCode;
  reason: string;
}

function createAPIError(code: ErrorCode, reason: string): APIError {
  const error = new Error(reason) as APIError;
  error.type = 'DAppConnectorAPIError';
  error.code = code;
  error.reason = reason;
  return error;
}

// ============================================
// Message Handling
// ============================================

interface LumenRequest {
  type: 'LUMEN_REQUEST';
  id: number;
  payload: { method: string; params?: unknown };
}

interface LumenResponse {
  type: 'LUMEN_RESPONSE';
  id: number;
  payload: { result?: unknown; error?: string; errorCode?: string };
}

let messageId = 0;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const pendingRequests = new Map<number, PendingRequest>();

// Listen for responses from content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'LUMEN_RESPONSE') return;

  const response = event.data as LumenResponse;
  const pending = pendingRequests.get(response.id);

  if (pending) {
    pendingRequests.delete(response.id);

    if (response.payload?.error) {
      const code = mapErrorCode(response.payload.errorCode);
      pending.reject(createAPIError(code, response.payload.error));
    } else {
      pending.resolve(response.payload?.result);
    }
  }
});

function mapErrorCode(code?: string): ErrorCode {
  switch (code) {
    case 'NO_WALLET':
    case 'SESSION_EXPIRED':
      return ErrorCodes.Disconnected;
    case 'USER_REJECTED':
      return ErrorCodes.Rejected;
    case 'INVALID_INPUT':
    case 'INVALID_TX':
      return ErrorCodes.InvalidRequest;
    case 'NETWORK_ERROR':
    default:
      return ErrorCodes.InternalError;
  }
}

function sendRequest(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingRequests.set(id, { resolve, reject });

    const request: LumenRequest = {
      type: 'LUMEN_REQUEST',
      id,
      payload: { method, params },
    };

    window.postMessage(request, '*');

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(createAPIError(ErrorCodes.InternalError, `Request timeout: ${method}`));
      }
    }, 30000);
  });
}

// ============================================
// Connected API Implementation
// ============================================

interface Configuration {
  indexerUri: string;
  indexerWsUri: string;
  proverServerUri?: string;
  substrateNodeUri: string;
  networkId: string;
}

interface ConnectionStatus {
  status: 'connected' | 'disconnected';
  networkId?: string;
}

interface Signature {
  data: string;
  signature: string;
  verifyingKey: string;
}

type SignDataOptions = {
  encoding: 'hex' | 'base64' | 'text';
  keyType: 'unshielded';
};

type TokenType = string;

interface DesiredOutput {
  kind: 'shielded' | 'unshielded';
  type: TokenType;
  value: bigint;
  recipient: string;
}

interface DesiredInput {
  kind: 'shielded' | 'unshielded';
  type: TokenType;
  value: bigint;
}

type WalletConnectedAPI = {
  getShieldedBalances(): Promise<Record<TokenType, bigint>>;
  getUnshieldedBalances(): Promise<Record<TokenType, bigint>>;
  getDustBalance(): Promise<{ cap: bigint; balance: bigint }>;
  getShieldedAddresses(): Promise<{
    shieldedAddress: string;
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>;
  getDustAddress(): Promise<{ dustAddress: string }>;
  getTxHistory(pageNumber: number, pageSize: number): Promise<unknown[]>;
  balanceUnsealedTransaction(tx: string): Promise<{ tx: string }>;
  balanceSealedTransaction(tx: string): Promise<{ tx: string }>;
  makeTransfer(desiredOutputs: DesiredOutput[]): Promise<{ tx: string }>;
  makeIntent(
    desiredInputs: DesiredInput[],
    desiredOutputs: DesiredOutput[],
    options: { intentId: number | 'random'; payFees: boolean }
  ): Promise<{ tx: string }>;
  signData(data: string, options: SignDataOptions): Promise<Signature>;
  submitTransaction(tx: string): Promise<void>;
  getProvingProvider(keyMaterialProvider: unknown): Promise<unknown>;
  getConfiguration(): Promise<Configuration>;
  getConnectionStatus(): Promise<ConnectionStatus>;
};

type HintUsage = {
  hintUsage(methodNames: Array<keyof WalletConnectedAPI>): Promise<void>;
};

type ConnectedAPI = WalletConnectedAPI & HintUsage;

let connectedNetworkId: string | null = null;

function createConnectedAPI(networkId: string): ConnectedAPI {
  connectedNetworkId = networkId;

  const notImplemented = (method: string) => {
    return Promise.reject(
      createAPIError(ErrorCodes.InternalError, `${method} is not implemented in Lumen developer wallet`)
    );
  };

  return {
    // Balance methods
    async getShieldedBalances(): Promise<Record<TokenType, bigint>> {
      // Developer wallet doesn't support shielded tokens
      return {};
    },

    async getUnshieldedBalances(): Promise<Record<TokenType, bigint>> {
      // Developer wallet doesn't support unshielded token balances
      return {};
    },

    async getDustBalance(): Promise<{ cap: bigint; balance: bigint }> {
      const balance = (await sendRequest('getBalance')) as string;
      const balanceBigInt = BigInt(balance || '0');
      return {
        cap: balanceBigInt,
        balance: balanceBigInt,
      };
    },

    // Address methods
    async getShieldedAddresses(): Promise<{
      shieldedAddress: string;
      shieldedCoinPublicKey: string;
      shieldedEncryptionPublicKey: string;
    }> {
      // Developer wallet doesn't support shielded addresses
      return notImplemented('getShieldedAddresses');
    },

    async getUnshieldedAddress(): Promise<{ unshieldedAddress: string }> {
      const address = (await sendRequest('getAddress')) as string;
      return { unshieldedAddress: address };
    },

    async getDustAddress(): Promise<{ dustAddress: string }> {
      const address = (await sendRequest('getAddress')) as string;
      return { dustAddress: address };
    },

    // Transaction history
    async getTxHistory(_pageNumber: number, _pageSize: number): Promise<unknown[]> {
      // Developer wallet doesn't track transaction history
      return [];
    },

    // Transaction methods
    async balanceUnsealedTransaction(_tx: string): Promise<{ tx: string }> {
      return notImplemented('balanceUnsealedTransaction');
    },

    async balanceSealedTransaction(_tx: string): Promise<{ tx: string }> {
      return notImplemented('balanceSealedTransaction');
    },

    async makeTransfer(_desiredOutputs: DesiredOutput[]): Promise<{ tx: string }> {
      return notImplemented('makeTransfer');
    },

    async makeIntent(
      _desiredInputs: DesiredInput[],
      _desiredOutputs: DesiredOutput[],
      _options: { intentId: number | 'random'; payFees: boolean }
    ): Promise<{ tx: string }> {
      return notImplemented('makeIntent');
    },

    // Signing
    async signData(data: string, options: SignDataOptions): Promise<Signature> {
      if (options.keyType !== 'unshielded') {
        throw createAPIError(ErrorCodes.InvalidRequest, 'Only unshielded key signing is supported');
      }

      const result = (await sendRequest('signMessage', { message: data })) as { signature: string };
      const address = (await sendRequest('getAddress')) as string;

      return {
        data,
        signature: result.signature,
        verifyingKey: address,
      };
    },

    // Transaction submission
    async submitTransaction(tx: string): Promise<void> {
      await sendRequest('submitTransaction', { tx });
    },

    // Proving
    async getProvingProvider(_keyMaterialProvider: unknown): Promise<unknown> {
      return notImplemented('getProvingProvider');
    },

    // Configuration
    async getConfiguration(): Promise<Configuration> {
      const network = (await sendRequest('getNetwork')) as {
        networkId: string;
        nodeUrl: string;
        indexerUrl: string;
        indexerWsUrl: string;
        proverUrl: string;
      };
      return {
        indexerUri: network.indexerUrl,
        indexerWsUri: network.indexerWsUrl,
        proverServerUri: network.proverUrl,
        substrateNodeUri: network.nodeUrl,
        networkId: network.networkId,
      };
    },

    // Connection status
    async getConnectionStatus(): Promise<ConnectionStatus> {
      const isEnabled = (await sendRequest('isEnabled')) as boolean;
      if (isEnabled && connectedNetworkId) {
        return { status: 'connected', networkId: connectedNetworkId };
      }
      return { status: 'disconnected' };
    },

    // Hint usage (no-op for developer wallet)
    async hintUsage(_methodNames: Array<keyof WalletConnectedAPI>): Promise<void> {
      // Developer wallet doesn't require permission hints
    },
  };
}

// ============================================
// Initial API Implementation
// ============================================

interface InitialAPI {
  rdns: string;
  name: string;
  icon: string;
  apiVersion: string;
  connect: (networkId: string) => Promise<ConnectedAPI>;
}

const LUMEN_UUID = 'lumen-wallet';
const API_VERSION = '4.0.0-beta.2';

// Lumen wallet icon (simple base64 encoded SVG)
const LUMEN_ICON = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="45" fill="#1a1a2e"/>
  <circle cx="50" cy="50" r="30" fill="#16213e"/>
  <circle cx="50" cy="50" r="15" fill="#e94560"/>
  <text x="50" y="58" text-anchor="middle" fill="white" font-size="20" font-family="sans-serif">L</text>
</svg>
`)}`;

const lumenInitialAPI: InitialAPI = {
  rdns: 'io.lumen.wallet',
  name: 'Lumen',
  icon: LUMEN_ICON,
  apiVersion: API_VERSION,

  async connect(networkId: string): Promise<ConnectedAPI> {
    // Request wallet enable
    const result = (await sendRequest('enable')) as { enabled: boolean; address: string };

    if (!result.enabled) {
      throw createAPIError(ErrorCodes.Rejected, 'User rejected connection');
    }

    // Set the network if different from current
    const currentNetwork = (await sendRequest('getNetwork')) as { networkId: string };
    if (currentNetwork.networkId !== networkId) {
      await sendRequest('setNetwork', { network: networkId });
    }

    return createConnectedAPI(networkId);
  },
};

// ============================================
// Expose on window.midnight
// ============================================

declare global {
  interface Window {
    midnight?: {
      [key: string]: InitialAPI;
    };
  }
}

// Initialize window.midnight if not exists
if (!window.midnight) {
  window.midnight = {};
}

// Register Lumen wallet under its UUID
window.midnight[LUMEN_UUID] = lumenInitialAPI;

console.log('[Lumen] dapp-connector-api ready:', LUMEN_UUID);

// Dispatch event to notify page that wallet is available
window.dispatchEvent(new CustomEvent('midnight#ready', { detail: { uuid: LUMEN_UUID } }));
