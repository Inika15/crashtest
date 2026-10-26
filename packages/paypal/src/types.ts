export interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface CreateOrderRequest {
  intent: 'CAPTURE';
  purchase_units: Array<{
    amount: { currency_code: string; value: string };
    custom_id?: string;
    description?: string;
  }>;
}

export interface OrderResponse {
  id: string;
  status: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

export interface CaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    payments: {
      captures: Array<{ id: string; status: string; amount: { value: string; currency_code: string } }>;
    };
  }>;
}

export interface WebhookVerifyRequest {
  auth_algo: string;
  cert_url: string;
  transmission_id: string;
  transmission_sig: string;
  transmission_time: string;
  webhook_id: string;
  webhook_event: Record<string, unknown>;
}

export interface WebhookVerifyResponse {
  verification_status: 'SUCCESS' | 'FAILURE';
}
