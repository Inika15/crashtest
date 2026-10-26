import { ScenarioResult, Severity } from '@crashtest/runner';

const SEVERITY_WEIGHTS: Record<Severity, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };

export interface ScoreBreakdown {
  overall: number;        // 0-100
  grade: string;          // A/B/C/D/F
  riskLabel: string;      // "Critical Risk" / "High Risk" / "Moderate Risk" / "Low Risk" / "Resilient"
  byCategory: {
    webhook: number;
    checkout: number;
    concurrency: number;
    agent: number;
  };
  totalPossible: number;
  totalEarned: number;
}

export function computeScore(results: ScenarioResult[]): ScoreBreakdown {
  const categories = ['webhook', 'checkout', 'concurrency', 'agent'] as const;
  const byCategory: ScoreBreakdown['byCategory'] = { webhook: 0, checkout: 0, concurrency: 0, agent: 0 };

  let totalPossible = 0;
  let totalEarned = 0;

  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat && r.status !== 'SKIP');
    if (catResults.length === 0) { byCategory[cat] = 100; continue; } // no tests = assume passing

    let possible = 0;
    let earned = 0;
    for (const r of catResults) {
      const w = SEVERITY_WEIGHTS[r.severity];
      possible += w;
      if (r.status === 'PASS') earned += w;
      else if (r.status === 'WARN') earned += w * 0.5;
    }
    byCategory[cat] = possible > 0 ? Math.round((earned / possible) * 100) : 100;
    totalPossible += possible;
    totalEarned += earned;
  }

  const overall = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 100;

  return { overall, grade: toGrade(overall), riskLabel: toRiskLabel(overall), byCategory, totalPossible, totalEarned };
}

function toGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function toRiskLabel(score: number): string {
  if (score >= 90) return 'Resilient';
  if (score >= 75) return 'Low Risk';
  if (score >= 60) return 'Moderate Risk';
  if (score >= 40) return 'High Risk';
  return 'Critical Risk';
}
