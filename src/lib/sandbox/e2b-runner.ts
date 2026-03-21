import { executeCode } from "@/lib/agents/e2b-sandbox";

export interface E2BResult {
  stdout: string;
  stderr: string;
  error?: string;
  artifacts?: Array<{ name: string; type: string; data: string }>;
  durationMs?: number;
}

export async function runInE2B(
  code: string,
  language: "python" | "javascript" | "bash",
  _sessionId?: string
): Promise<E2BResult> {
  const result = await executeCode(code, language);
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error || undefined,
    durationMs: result.executionTimeMs,
  };
}
