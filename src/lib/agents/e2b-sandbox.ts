import { Sandbox } from "@e2b/code-interpreter";

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  error: string | null;
  executionTimeMs: number;
}

const MAX_OUTPUT_LENGTH = 5000;

function truncate(str: string): string {
  if (str.length <= MAX_OUTPUT_LENGTH) return str;
  return str.slice(0, MAX_OUTPUT_LENGTH) + "\n... (output truncated)";
}

export async function executeCode(
  code: string,
  language?: "python" | "javascript" | "r" | "bash"
): Promise<CodeExecutionResult> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    return {
      stdout: "",
      stderr: "",
      error: "E2B_API_KEY is not configured",
      executionTimeMs: 0,
    };
  }

  const start = Date.now();
  let sbx: Sandbox | null = null;

  try {
    sbx = await Sandbox.create({ apiKey });

    // For bash, wrap in a Python subprocess call
    const actualCode =
      language === "bash"
        ? `import subprocess, sys\nresult = subprocess.run(${JSON.stringify(code)}, shell=True, capture_output=True, text=True)\nprint(result.stdout, end="")\nif result.stderr:\n    print(result.stderr, file=sys.stderr, end="")`
        : code;

    const execution = await sbx.runCode(actualCode, {
      language: language === "bash" ? "python" : language,
    });

    const stdout = execution.logs.stdout.join("\n");
    const stderr = execution.logs.stderr.join("\n");
    const error = execution.error
      ? `${execution.error.name}: ${execution.error.value}`
      : null;

    return {
      stdout: truncate(stdout),
      stderr: truncate(stderr),
      error,
      executionTimeMs: Date.now() - start,
    };
  } catch (err) {
    return {
      stdout: "",
      stderr: "",
      error: err instanceof Error ? err.message : "Unknown sandbox error",
      executionTimeMs: Date.now() - start,
    };
  } finally {
    if (sbx) {
      await sbx.kill().catch(() => {});
    }
  }
}
