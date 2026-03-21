"use client";

import { useState, useEffect, useCallback } from "react";
import { usePyodide } from "@/hooks/use-pyodide";
import { extractSandboxBlocks } from "@/lib/sandbox/extract-sandbox-block";
import { Code, ChevronDown, ChevronUp, Play, Loader2, Terminal } from "lucide-react";

interface SandboxOutputCardProps {
  /** Raw message content containing <<<SANDBOX:{...}>>> blocks */
  messageContent: string;
  /** Auto-run on mount (default: true) */
  autoRun?: boolean;
}

type TabType = "output" | "code" | "raw";

export function SandboxOutputCard({
  messageContent,
  autoRun = true,
}: SandboxOutputCardProps) {
  const blocks = extractSandboxBlocks(messageContent);
  const { run, preload, loading: pyLoading, ready } = usePyodide();

  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("output");
  const [expanded, setExpanded] = useState(true);

  // Per-block state
  const [results, setResults] = useState<Array<{
    outputHtml: string;
    outputRaw: string;
    artifacts?: Array<{ name: string; type: string; data: string }>;
    error?: string;
    durationMs: number;
    ran: boolean;
    running: boolean;
  }>>(blocks.map(() => ({ outputHtml: "", outputRaw: "", ran: false, running: false, durationMs: 0 })));

  const runBlock = useCallback(async (idx: number) => {
    const block = blocks[idx];
    if (!block) return;

    setResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], running: true, ran: false };
      return next;
    });

    let result;
    const start = Date.now();
    
    // Server-side E2B mode
    if ((block as any).mode === "server" || (block as any).mode === "e2b") {
      try {
        const res = await fetch("/api/sandbox/e2b", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: block.code, language: block.language })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        const raw = `[stdout]\n${data.stdout}\n[stderr]\n${data.stderr}`;
        let html = `<pre>${data.stdout || "(no output)"}</pre>`;
        if (data.stderr) html += `<pre style="color:#c0392b">${data.stderr}</pre>`;
        
        result = { 
          outputHtml: html, 
          outputRaw: raw, 
          artifacts: data.artifacts,
          durationMs: Date.now() - start 
        };
      } catch (err) {
        result = { outputHtml: `<pre style="color:#c0392b">${err}</pre>`, outputRaw: "", error: String(err), durationMs: 0 };
      }
    } 
    // Client-side Pyodide/HTML/JS mode
    else if (block.language === "python") {
      result = await run(block.code);
    } else if (block.language === "html") {
      result = {
        outputHtml: `<iframe srcdoc="${block.code.replace(/"/g, "&quot;")}" style="width:100%;border:none;border-radius:8px;min-height:200px;" sandbox="allow-scripts" />`,
        outputRaw: block.code,
        durationMs: 0,
      };
    } else {
      // javascript — eval in isolated function
      try {
        const logs: string[] = [];
        const mockConsole = { log: (...a: unknown[]) => logs.push(a.map(String).join(" ")) };
        // eslint-disable-next-line no-new-func
        const fn = new Function("console", block.code);
        fn(mockConsole);
        result = { outputHtml: `<pre>${logs.join("\n") || "(no output)"}</pre>`, outputRaw: logs.join("\n"), durationMs: 0 };
      } catch (err) {
        result = { outputHtml: `<pre style="color:#c0392b">${err}</pre>`, outputRaw: "", error: String(err), durationMs: 0 };
      }
    }

    setResults((prev) => {
      const next = [...prev];
      next[idx] = { ...result, ran: true, running: false };
      return next;
    });
  }, [blocks, run]);

  useEffect(() => {
    if (autoRun && blocks.length > 0) {
      preload().then(() => {
        blocks.forEach((_, i) => runBlock(i));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (blocks.length === 0) return null;

  const activeBlock = blocks[activeBlockIdx];
  const activeResult = results[activeBlockIdx];

  const TAB_CLASSES = (active: boolean) =>
    `px-3 py-1.5 text-[12px] font-medium transition-colors rounded-t-sm ${
      active ? "text-[#1D1C1D] border-b-2 border-[#1D1C1D]" : "text-[#ABABAD] hover:text-[#616061]"
    }`;

  return (
    <div className="mt-2 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E0E0E0] bg-white">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-[#616061]" />
          <span className="text-[13px] font-semibold text-[#1D1C1D]">
            {activeBlock.title ?? "Code Output"}
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[#F0F0F0] text-[#616061] font-mono">
            {activeBlock.language}
          </span>
          {activeResult.running && (
            <Loader2 className="h-3 w-3 animate-spin text-[#616061]" />
          )}
          {activeResult.ran && !activeResult.running && !activeResult.error && (
            <span className="text-[10px] text-[#2ECC71]">
              ✓ {activeResult.durationMs}ms
            </span>
          )}
          {activeResult.error && (
            <span className="text-[10px] text-[#E8593C]">✗ error</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!activeResult.running && (
            <button
              onClick={() => runBlock(activeBlockIdx)}
              disabled={!ready && !activeResult.running}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-[#1D1C1D] text-white hover:bg-[#333] disabled:opacity-50 transition-colors"
            >
              {pyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {pyLoading ? "Loading..." : "Run"}
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded-md text-[#ABABAD] hover:text-[#616061] hover:bg-[#F0F0F0]"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Block tabs (if multiple blocks) */}
      {blocks.length > 1 && (
        <div className="flex gap-1 px-4 border-b border-[#E0E0E0] bg-white">
          {blocks.map((b, i) => (
            <button
              key={i}
              onClick={() => setActiveBlockIdx(i)}
              className={`px-2 py-1.5 text-[11px] font-mono transition-colors ${
                i === activeBlockIdx ? "text-[#1264A3] border-b-2 border-[#1264A3]" : "text-[#ABABAD] hover:text-[#616061]"
              }`}
            >
              {b.title ?? `block ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <>
          {/* Tab bar: Output | Code | Raw */}
          <div className="flex gap-0.5 px-4 border-b border-[#E0E0E0] bg-white">
            {(["output", "code", "raw"] as TabType[]).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)} className={TAB_CLASSES(activeTab === t)}>
                {t === "output" ? "Output" : t === "code" ? "Code" : "Raw"}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 min-h-[80px] max-h-[500px] overflow-auto">
            {activeTab === "output" && (
              activeResult.running ? (
                <div className="flex items-center gap-2 py-4 text-[13px] text-[#ABABAD]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running {activeBlock.language}…
                </div>
              ) : activeResult.ran ? (
                <div className="flex flex-col gap-2">
                  <div
                    className="sandbox-output text-[13px] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: activeResult.outputHtml }}
                  />
                  {activeResult.artifacts && activeResult.artifacts.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2">
                      {activeResult.artifacts.map((art, idx) => (
                        <div key={idx} className="border border-[#E0E0E0] rounded-md p-1 bg-white">
                          <img src={art.data} alt={art.name} className="max-w-full h-auto rounded" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-[13px] text-[#ABABAD] flex items-center gap-1.5">
                  <Code className="h-3.5 w-3.5" /> Click Run to execute
                </div>
              )
            )}
            {activeTab === "code" && (
              <pre className="text-[12px] font-mono text-[#1D1C1D] whitespace-pre-wrap leading-relaxed">
                {activeBlock.code}
              </pre>
            )}
            {activeTab === "raw" && (
              <pre className="text-[12px] font-mono text-[#616061] whitespace-pre-wrap leading-relaxed">
                {activeResult.outputRaw || "(run first to see raw output)"}
              </pre>
            )}
          </div>
        </>
      )}

      {/* Sandbox iframe styles */}
      <style jsx global>{`
        .sandbox-output pre {
          font-family: ui-monospace, monospace;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
          color: #1D1C1D;
        }
        .sandbox-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          font-family: ui-monospace, monospace;
        }
        .sandbox-table th, .sandbox-table td {
          padding: 4px 10px;
          border: 1px solid #E0E0E0;
          text-align: left;
        }
        .sandbox-table th {
          background: #F8F8F8;
          font-weight: 600;
        }
        .sandbox-table tr:nth-child(even) { background: #FAFAFA; }
      `}</style>
    </div>
  );
}
