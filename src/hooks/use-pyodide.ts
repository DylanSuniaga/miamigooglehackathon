"use client";

import { useState, useCallback } from "react";

// Global singleton so Pyodide is only loaded once
let pyodideInstance: PyodideInterface | null = null;
let pyodideLoading: Promise<PyodideInterface> | null = null;

// Minimal type shim for Pyodide — installed via CDN
interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>;
  runPython: (code: string) => unknown;
  globals: {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
  };
  loadPackagesFromImports: (code: string) => Promise<void>;
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>;
    _pyodideReady?: boolean;
  }
}

async function loadPyodideScript(): Promise<PyodideInterface> {
  // Inject Pyodide CDN script once
  if (!document.querySelector("script[data-pyodide]")) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js";
      script.setAttribute("data-pyodide", "1");
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Wait until window.loadPyodide is available
  let attempts = 0;
  while (!window.loadPyodide && attempts < 50) {
    await new Promise((r) => setTimeout(r, 200));
    attempts++;
  }
  if (!window.loadPyodide) throw new Error("Pyodide CDN script failed to load");

  return window.loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/",
  });
}

async function getPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoading) return pyodideLoading;

  pyodideLoading = loadPyodideScript().then((py) => {
    pyodideInstance = py;
    return py;
  });
  return pyodideLoading;
}

export interface SandboxResult {
  outputHtml: string;
  outputRaw: string;
  error?: string;
  durationMs: number;
}

export function usePyodide() {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(!!pyodideInstance);

  const preload = useCallback(async () => {
    if (pyodideInstance) { setReady(true); return; }
    setLoading(true);
    try {
      await getPyodide();
      setReady(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const run = useCallback(async (code: string): Promise<SandboxResult> => {
    const start = Date.now();
    const py = await getPyodide();
    setReady(true);

    // Capture stdout
    const logs: string[] = [];
    const setup = `
import sys, io
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
`;
    const teardown = `
_captured_output = _stdout_capture.getvalue()
sys.stdout = sys.__stdout__
`;

    try {
      // Auto-install required packages from imports
      await py.loadPackagesFromImports(code);

      await py.runPythonAsync(setup);
      await py.runPythonAsync(code);
      await py.runPythonAsync(teardown);

      const captured = String(py.globals.get("_captured_output") ?? "");
      const durationMs = Date.now() - start;

      // Check if matplotlib figure was created
      let figureHtml = "";
      try {
        const hasFig = await py.runPythonAsync(`
import sys
'matplotlib' in sys.modules and bool(getattr(__import__('matplotlib.pyplot', fromlist=['pyplot']), 'get_fignums')())
`);
        if (hasFig) {
          // Export figure as base64 PNG
          const b64 = await py.runPythonAsync(`
import matplotlib.pyplot as plt, base64, io as _io
_buf = _io.BytesIO()
plt.savefig(_buf, format='png', bbox_inches='tight', dpi=120)
plt.close('all')
_buf.seek(0)
base64.b64encode(_buf.read()).decode()
`);
          figureHtml = `<img src="data:image/png;base64,${b64}" alt="Plot" style="max-width:100%;border-radius:8px;" />`;
        }
      } catch {
        // No matplotlib, that's fine
      }

      // Check for pandas DataFrame
      let tableHtml = "";
      try {
        const hasDF = await py.runPythonAsync(`
import sys
'pandas' in sys.modules
`);
        if (hasDF) {
          const dfHtml = await py.runPythonAsync(`
import sys
_last = None
for _k, _v in list(globals().items()):
  if hasattr(_v, 'to_html') and not _k.startswith('_'):
    _last = _v
if _last is not None:
  _last.to_html(classes='sandbox-table', border=0, index=True)
else:
  ''
`);
          if (dfHtml) tableHtml = String(dfHtml);
        }
      } catch {
        // No pandas or no DataFrame
      }

      const outputHtml = figureHtml || tableHtml || (captured ? `<pre>${captured}</pre>` : "<pre>(no output)</pre>");

      return { outputHtml, outputRaw: captured, durationMs };
    } catch (err) {
      // Try to reset stdout on error
      try { await py.runPythonAsync("import sys; sys.stdout = sys.__stdout__"); } catch {}
      return {
        outputHtml: `<pre style="color:#c0392b">${err instanceof Error ? err.message : String(err)}</pre>`,
        outputRaw: "",
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }, []);

  return { run, preload, loading, ready };
}
