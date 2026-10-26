import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runAll, runScenarios, TargetManifest, RunConfig, RunResult, ScenarioResult } from '@crashtest/runner';
import { ALL_SCENARIOS } from '@crashtest/scenarios';
import { computeScore } from '@crashtest/scoring';
import { AIClient, MockAIClient } from '@crashtest/ai';

dotenv.config({ path: '../../.env' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MOCK_MODE = process.env.MOCK_MODE === 'true' || !process.env.ANTHROPIC_API_KEY;

const aiClient = MOCK_MODE
  ? new MockAIClient()
  : new AIClient(process.env.ANTHROPIC_API_KEY!);

// Preset targets
const PRESET_TARGETS: TargetManifest[] = [
  {
    id: 'target-naive',
    name: 'Hosted Naive Target (Vulnerable)',
    webhookUrl: process.env.NAIVE_TARGET_URL ? `${process.env.NAIVE_TARGET_URL}/api/webhook` : 'http://localhost:3002/api/webhook',
    captureUrl: process.env.NAIVE_TARGET_URL ? `${process.env.NAIVE_TARGET_URL}/api/capture` : 'http://localhost:3002/api/capture',
    createOrderUrl: process.env.NAIVE_TARGET_URL ? `${process.env.NAIVE_TARGET_URL}/api/orders` : 'http://localhost:3002/api/orders',
    debugStateUrl: process.env.NAIVE_TARGET_URL ? `${process.env.NAIVE_TARGET_URL}/api/debug/state` : 'http://localhost:3002/api/debug/state',
    resetUrl: process.env.NAIVE_TARGET_URL ? `${process.env.NAIVE_TARGET_URL}/api/debug/reset` : 'http://localhost:3002/api/debug/reset',
  },
  {
    id: 'target-hardened',
    name: 'Hosted Hardened Target (Resilient)',
    webhookUrl: process.env.HARDENED_TARGET_URL ? `${process.env.HARDENED_TARGET_URL}/api/webhook` : 'http://localhost:3003/api/webhook',
    captureUrl: process.env.HARDENED_TARGET_URL ? `${process.env.HARDENED_TARGET_URL}/api/capture` : 'http://localhost:3003/api/capture',
    createOrderUrl: process.env.HARDENED_TARGET_URL ? `${process.env.HARDENED_TARGET_URL}/api/orders` : 'http://localhost:3003/api/orders',
    debugStateUrl: process.env.HARDENED_TARGET_URL ? `${process.env.HARDENED_TARGET_URL}/api/debug/state` : 'http://localhost:3003/api/debug/state',
    resetUrl: process.env.HARDENED_TARGET_URL ? `${process.env.HARDENED_TARGET_URL}/api/debug/reset` : 'http://localhost:3003/api/debug/reset',
  },
];

// Run memory store
const runsStore = new Map<string, RunResult>();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'crashtest-api',
    mockMode: MOCK_MODE,
    scenariosCount: ALL_SCENARIOS.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/targets', (_req, res) => {
  res.json({ targets: PRESET_TARGETS });
});

// Execute run (supports regular POST or SSE streaming via query ?stream=true)
app.post('/api/runs', async (req, res) => {
  const { target, scenarioIds, stream } = req.body as {
    target: TargetManifest;
    scenarioIds?: string[];
    stream?: boolean;
  };

  if (!target || !target.webhookUrl) {
    return res.status(400).json({ error: 'Valid target manifest is required.' });
  }

  const runConfig: RunConfig = {
    target,
    scenarioIds,
    mockMode: MOCK_MODE,
    concurrency: 1,
  };

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const results: ScenarioResult[] = [];
    const runId = `run-${Date.now()}`;
    const startedAt = new Date().toISOString();

    res.write(`data: ${JSON.stringify({ type: 'start', runId, startedAt })}\n\n`);

    try {
      for await (const result of runScenarios(runConfig, ALL_SCENARIOS)) {
        results.push(result);
        res.write(`data: ${JSON.stringify({ type: 'scenario_completed', result })}\n\n`);
      }

      const completedAt = new Date().toISOString();
      const scoreBreakdown = computeScore(results);

      const runResult: RunResult = {
        runId,
        targetId: target.id || 'custom-target',
        targetName: target.name || 'Custom Target',
        startedAt,
        completedAt,
        scenarioResults: results,
        score: scoreBreakdown.overall,
        grade: scoreBreakdown.grade,
        summary: {
          total: results.length,
          passed: results.filter((r) => r.status === 'PASS').length,
          failed: results.filter((r) => r.status === 'FAIL').length,
          warned: results.filter((r) => r.status === 'WARN').length,
          skipped: results.filter((r) => r.status === 'SKIP').length,
          criticalFailures: results.filter((r) => r.status === 'FAIL' && r.severity === 'CRITICAL').length,
          highFailures: results.filter((r) => r.status === 'FAIL' && r.severity === 'HIGH').length,
        },
      };

      runsStore.set(runId, runResult);
      res.write(`data: ${JSON.stringify({ type: 'done', run: runResult, scoreBreakdown })}\n\n`);
      res.end();
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    }
  } else {
    try {
      const runResult = await runAll(runConfig, ALL_SCENARIOS);
      const scoreBreakdown = computeScore(runResult.scenarioResults);
      runsStore.set(runResult.runId, runResult);
      res.json({ run: runResult, scoreBreakdown });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.get('/api/runs/:runId', (req, res) => {
  const run = runsStore.get(req.params.runId);
  if (!run) {
    return res.status(404).json({ error: 'Run report not found.' });
  }
  const scoreBreakdown = computeScore(run.scenarioResults);
  res.json({ run, scoreBreakdown });
});

// AI Diagnosis endpoint
app.post('/api/diagnose', async (req, res) => {
  const { scenarioResult } = req.body as { scenarioResult: ScenarioResult };
  if (!scenarioResult) {
    return res.status(400).json({ error: 'scenarioResult is required' });
  }
  try {
    const diagnosis = await aiClient.diagnoseFailure(scenarioResult);
    res.json({ diagnosis });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Patch generator endpoint
app.post('/api/patch', async (req, res) => {
  const { scenarioResult, diagnosis, repoPath } = req.body;
  if (!scenarioResult || !diagnosis) {
    return res.status(400).json({ error: 'scenarioResult and diagnosis are required' });
  }
  try {
    const patch = await aiClient.generatePatch(scenarioResult, diagnosis, repoPath);
    res.json({ patch });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[crashtest-api] Server running on http://localhost:${PORT} (MOCK_MODE=${MOCK_MODE})`);
});
