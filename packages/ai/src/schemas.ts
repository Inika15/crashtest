import { z } from 'zod';

export const DiagnosisSchema = z.object({
  rootCause: z.string().describe('One sentence. The specific technical cause of the failure.'),
  evidenceQuote: z.string().describe('A direct quote from the HTTP trace or database assertion that proves the failure.'),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM']),
  affectedCodePattern: z.string().optional().describe('The code pattern that needs to change, e.g. "webhook handler before idempotency check".'),
  explanation: z.string().describe('Plain English explanation for a developer. 3-5 sentences. No jargon.'),
  attackScenario: z.string().describe('One sentence describing how a real production incident or malicious actor would trigger this.'),
});

export const PatchSchema = z.object({
  targetFile: z.string().describe('The most likely filename that needs patching, e.g. "src/webhook.ts"'),
  unifiedDiff: z.string().describe('A unified diff (--- a/... +++ b/...) that fixes the vulnerability. Minimal, surgical change only.'),
  explanation: z.string().describe('Why this patch fixes the issue. 2-3 sentences.'),
  caveat: z.string().optional().describe('Honest limitation, e.g. assumes PostgreSQL. Adjust for your database.'),
});

export const InjectionPayloadSchema = z.object({
  payloads: z.array(z.object({
    text: z.string().describe('The adversarial string to inject into a user-controlled field.'),
    technique: z.string().describe('e.g. direct injection, role confusion, delimiter escape'),
    targetField: z.string().describe('Where to inject it: shipping_note, product_description, coupon_code, etc.'),
  })),
});

export type Diagnosis = z.infer<typeof DiagnosisSchema>;
export type Patch = z.infer<typeof PatchSchema>;
export type InjectionPayloads = z.infer<typeof InjectionPayloadSchema>;
