import { CreateOrderRequest, OrderResponse, CaptureResponse, WebhookVerifyRequest, WebhookVerifyResponse, PayPalTokenResponse } from './types.js';

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';

export class PayPalClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private webhookId: string,
    private mockMode: boolean = false,
  ) {}

  private async getToken(): Promise<string> {
    if (this.mockMode) return 'mock-access-token';
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;

    const res = await fetch(`${SANDBOX_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
    const data = (await res.json()) as PayPalTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  async createOrder(req: CreateOrderRequest): Promise<OrderResponse> {
    if (this.mockMode) {
      return { id: 'MOCK-ORDER-' + Date.now(), status: 'CREATED', links: [] };
    }
    const token = await this.getToken();
    const res = await fetch(`${SANDBOX_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `order-${Date.now()}` },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`createOrder failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<OrderResponse>;
  }

  async captureOrder(orderId: string, requestId: string): Promise<CaptureResponse> {
    if (this.mockMode) {
      return {
        id: orderId, status: 'COMPLETED',
        purchase_units: [{ payments: { captures: [{ id: 'MOCK-CAPTURE-001', status: 'COMPLETED', amount: { value: '49.99', currency_code: 'USD' } }] } }],
      };
    }
    const token = await this.getToken();
    const res = await fetch(`${SANDBOX_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': requestId },
    });
    if (!res.ok) throw new Error(`captureOrder failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<CaptureResponse>;
  }

  async verifyWebhookSignature(req: WebhookVerifyRequest): Promise<WebhookVerifyResponse> {
    if (this.mockMode) return { verification_status: 'SUCCESS' };
    const token = await this.getToken();
    const res = await fetch(`${SANDBOX_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req, webhook_id: this.webhookId }),
    });
    if (!res.ok) throw new Error(`verifyWebhook failed: ${res.status}`);
    return res.json() as Promise<WebhookVerifyResponse>;
  }
}
