import { randomUUID } from 'crypto';
import { RunConfig, RunResult, ScenarioResult, RunSummary, Scenario } from './types.js';
import { createHttpClient } from './http-client.js';

export async function* runScenarios(
  config: RunConfig,
  scenarios: Scenario[]
): AsyncGenerator<ScenarioResult> {
  const http = createHttpClient();
  const toRun = config.scenarioIds?.length
    ? scenarios.filter(s => config.scenarioIds!.includes(s.id))
    : scenarios;

  for (const scenario of toRun) {
    // Reset target state before each scenario
    try {
      await http.post(config.target.resetUrl, {});
    } catch {
      // non-fatal: target may not support reset
    }

    const result = await scenario.run(config.target, http, config.mockMode);
    yield result;
  }
}

export async function runAll(
  config: RunConfig,
  scenarios: Scenario[]
): Promise<RunResult> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const results: ScenarioResult[] = [];

  for await (const result of runScenarios(config, scenarios)) {
    results.push(result);
  }

  const completedAt = new Date().toISOString();
  const summary = buildSummary(results);
  const score = calculateScore(results);

  return {
    runId,
    targetId: config.target.id,
    targetName: config.target.name,
    startedAt,
    completedAt,
    scenarioResults: results,
    score,
    grade: scoreToGrade(score),
    summary,
  };
}

function buildSummary(results: ScenarioResult[]): RunSummary {
  return {
    total: results.length,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status === 'FAIL').length,
    warned: results.filter(r => r.status === 'WARN').length,
    skipped: results.filter(r => r.status === 'SKIP').length,
    criticalFailures: results.filter(r => r.status === 'FAIL' && r.severity === 'CRITICAL').length,
    highFailures: results.filter(r => r.status === 'FAIL' && r.severity === 'HIGH').length,
  };
}

function calculateScore(results: ScenarioResult[]): number {
  if (results.length === 0) return 0;
  const weights: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
  let totalWeight = 0;
  let earnedWeight = 0;
  for (const r of results) {
    const w = weights[r.severity] ?? 1;
    totalWeight += w;
    if (r.status === 'PASS') earnedWeight += w;
    else if (r.status === 'WARN') earnedWeight += w * 0.5;
  }
  return Math.round((earnedWeight / totalWeight) * 100);
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
