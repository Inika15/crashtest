export type ScenarioCategory = 'webhook' | 'checkout' | 'concurrency' | 'agent';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM';
export type ScenarioStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'RUNNING' | 'QUEUED';

export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: string; // ISO 8601
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  timestamp: string;
}

export interface HttpTrace {
  label: string;
  request: HttpRequest;
  response: HttpResponse;
}

export interface DbAssertion {
  field: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

export interface ScenarioResult {
  scenarioId: string;
  name: string;
  category: ScenarioCategory;
  severity: Severity;
  status: ScenarioStatus;
  traces: HttpTrace[];
  failureReason?: string; // deterministic, never LLM-generated
  databaseAssertions?: DbAssertion[];
  durationMs: number;
  timestamp: string;
}

export interface TargetManifest {
  id: string;
  name: string;
  webhookUrl: string;
  captureUrl: string;
  createOrderUrl: string;
  debugStateUrl: string; // GET → returns { fulfillmentCount: number; processedEventIds: string[] }
  resetUrl: string;      // POST → resets target state between scenario runs
  agentChatUrl?: string; // optional for agent injection tests
  repoPath?: string;     // optional local path for AI patch generation
}

export interface RunConfig {
  target: TargetManifest;
  scenarioIds?: string[]; // if empty, run all
  mockMode: boolean;
  concurrency: number; // max parallel scenarios (default 3)
}

export interface RunResult {
  runId: string;
  targetId: string;
  targetName: string;
  startedAt: string;
  completedAt: string;
  scenarioResults: ScenarioResult[];
  score: number;         // 0-100, deterministic
  grade: string;         // A/B/C/D/F
  summary: RunSummary;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  warned: number;
  skipped: number;
  criticalFailures: number;
  highFailures: number;
}

export interface Scenario {
  id: string;
  name: string;
  category: ScenarioCategory;
  severity: Severity;
  description: string;
  run(target: TargetManifest, http: HttpClient, mockMode: boolean): Promise<ScenarioResult>;
}

export interface HttpClient {
  get(url: string, headers?: Record<string, string>): Promise<{ status: number; headers: Record<string, string>; body: unknown; durationMs: number }>;
  post(url: string, body: unknown, headers?: Record<string, string>): Promise<{ status: number; headers: Record<string, string>; body: unknown; durationMs: number }>;
  postRaw(url: string, rawBody: string, headers?: Record<string, string>): Promise<{ status: number; headers: Record<string, string>; body: unknown; durationMs: number }>;
}
