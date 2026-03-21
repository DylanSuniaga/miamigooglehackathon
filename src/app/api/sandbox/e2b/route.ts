// POST /api/sandbox/e2b — Execute code in E2B server-side sandbox
import { NextRequest, NextResponse } from "next/server";
import { runInE2B } from "@/lib/sandbox/e2b-runner";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { code, language, sessionId, channelId, agentId } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    const lang = language === "javascript" || language === "js" ? "javascript" :
                 language === "bash" || language === "sh" ? "bash" : "python";

    const result = await runInE2B(code, lang, sessionId);

    // If channelId is provided, optionally broadcast or log the run in sandbox_runs
    if (channelId && agentId) {
      const supabase = createServiceClient();
      await supabase.from("sandbox_runs").insert({
        channel_id: channelId,
        agent_id: agentId,
        code,
        language: lang,
        stdout: result.stdout,
        stderr: result.stderr,
        success: !result.error && !result.stderr,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("E2B execution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error during E2B execution" },
      { status: 500 }
    );
  }
}
