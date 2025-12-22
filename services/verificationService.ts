
import { Task, Submission, VerificationResult, VerifierSpec } from '../types';

/**
 * Stub verifier runner.
 * In a real implementation, this would trigger a Playwright/Puppeteer run in a secure environment.
 */
export const runVerificationStub = async (
  task: Task,
  submission: Submission
): Promise<VerificationResult> => {
  const spec = task.verifierSpec;
  
  if (!spec) {
    return {
      verdict: "INCONCLUSIVE",
      evidence: { summary: "No verifier specification found for this task." },
      ranAt: Date.now()
    };
  }

  // Simulate "Work" delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  const content = submission.content.toLowerCase();
  const isUrl = content.startsWith('http');

  // Simple stub logic: if it's a URL and we expect one, or if it contains specific text
  let verdict: "PASS" | "FAIL" | "INCONCLUSIVE" = "PASS";
  let summary = "All automated assertions completed successfully.";
  let failingId: string | undefined = undefined;

  // Mock execution trace
  const trace = spec.assertions.map((a, i) => `Step ${i+1}: Running ${a.type}... OK`).join('\n');

  // Stub failure simulation
  if (spec.testUrlSource === "submission_url" && !isUrl) {
    verdict = "FAIL";
    summary = "Validation failed: Submission must be a valid URL for automated testing.";
    failingId = "0"; // First assertion failure
  }

  return {
    verdict,
    failingAssertionId: failingId,
    evidence: {
      summary,
      trace,
      screenshots: verdict === "PASS" ? ["https://picsum.photos/400/300?random=verif"] : [],
      console: ["[System] Starting browser instance...", "[Network] Navigating to target...", "[Log] Selector found: .app-root"]
    },
    ranAt: Date.now()
  };
};
