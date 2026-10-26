import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../../../fixtures/webhooks');

export interface WebhookFixture {
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

// Mock fixtures used when MOCK_MODE=true or no real fixtures recorded yet
const MOCK_FIXTURES: Record<string, WebhookFixture> = {
  'checkout-order-approved': {
    headers: {
      'paypal-transmission-id': 'mock-transmission-id-001',
      'paypal-transmission-time': new Date().toISOString(),
      'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-1d93a270',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'mock-valid-signature-abc123def456',
    },
    body: {
      id: 'WH-mock-001',
      event_type: 'CHECKOUT.ORDER.APPROVED',
      resource_type: 'checkout-order',
      resource: {
        id: 'MOCK-ORDER-12345',
        status: 'APPROVED',
        purchase_units: [{ amount: { value: '49.99', currency_code: 'USD' }, custom_id: 'order-001' }],
      },
      create_time: new Date().toISOString(),
    },
  },
  'checkout-order-completed': {
    headers: {
      'paypal-transmission-id': 'mock-transmission-id-002',
      'paypal-transmission-time': new Date().toISOString(),
      'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-1d93a270',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'mock-valid-signature-xyz789',
    },
    body: {
      id: 'WH-mock-002',
      event_type: 'CHECKOUT.ORDER.COMPLETED',
      resource_type: 'checkout-order',
      resource: {
        id: 'MOCK-ORDER-12345',
        status: 'COMPLETED',
        purchase_units: [{ amount: { value: '49.99', currency_code: 'USD' } }],
      },
      create_time: new Date().toISOString(),
    },
  },
};

export async function loadFixture(name: string, mockMode: boolean): Promise<WebhookFixture> {
  if (mockMode) {
    const fixture = MOCK_FIXTURES[name];
    if (!fixture) throw new Error(`No mock fixture for '${name}'`);
    return fixture;
  }

  try {
    const raw = await readFile(join(FIXTURES_DIR, `${name}.json`), 'utf-8');
    return JSON.parse(raw) as WebhookFixture;
  } catch {
    console.warn(`[fixtures] Real fixture '${name}.json' not found, falling back to mock`);
    const fixture = MOCK_FIXTURES[name];
    if (!fixture) throw new Error(`No mock fixture for '${name}'`);
    return fixture;
  }
}
