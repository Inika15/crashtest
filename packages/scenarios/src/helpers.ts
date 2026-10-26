import { ScenarioResult, HttpTrace, TargetManifest, HttpClient, Severity, ScenarioCategory } from '@crashtest/runner';

export function makeTrace(label: string, req: HttpTrace['request'], res: HttpTrace['response']): HttpTrace {
  return { label, request: req, response: res };
}

export function passResult(
  id: string, name: string, category: ScenarioCategory, severity: Severity,
  traces: HttpTrace[], durationMs: number
): ScenarioResult {
  return { scenarioId: id, name, category, severity, status: 'PASS', traces, durationMs, timestamp: new Date().toISOString() };
}

export function failResult(
  id: string, name: string, category: ScenarioCategory, severity: Severity,
  traces: HttpTrace[], failureReason: string, durationMs: number,
  databaseAssertions?: ScenarioResult['databaseAssertions']
): ScenarioResult {
  return { scenarioId: id, name, category, severity, status: 'FAIL', traces, failureReason, databaseAssertions, durationMs, timestamp: new Date().toISOString() };
}

export async function getTargetState(target: TargetManifest, http: HttpClient): Promise<{ fulfillmentCount: number; processedEventIds: string[] }> {
  const res = await http.get(target.debugStateUrl);
  return res.body as { fulfillmentCount: number; processedEventIds: string[] };
}

export function buildTraceEntry(method: string, url: string, headers: Record<string, string>, body: unknown, res: Awaited<ReturnType<HttpClient['post']>>, label: string): HttpTrace {
  return {
    label,
    request: { method, url, headers, body, timestamp: new Date().toISOString() },
    response: { ...res, timestamp: new Date().toISOString() },
  };
}
