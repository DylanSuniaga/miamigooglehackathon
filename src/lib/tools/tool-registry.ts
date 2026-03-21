export interface ToolSpec {
  id: string;
  name: string;
  description: string;
  category: string;
  codegen?: boolean;
  requiresKey?: string;
}

export const TOOL_REGISTRY: ToolSpec[] = [
  {
    id: "webSearch",
    name: "Web Search",
    description: "Search the web for current information using Tavily",
    category: "research",
    requiresKey: "TAVILY_API_KEY",
  },
  {
    id: "run_code",
    name: "Run Code (Pyodide)",
    description: "Execute Python code in the browser via Pyodide",
    category: "execution",
    codegen: true,
  },
  {
    id: "e2b_sandbox",
    name: "E2B Sandbox",
    description: "Execute code in a persistent server-side sandbox",
    category: "execution",
    requiresKey: "E2B_API_KEY",
  },
  {
    id: "delegate",
    name: "Delegate",
    description: "Delegate subtasks to other agents in the workspace",
    category: "orchestration",
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "Create, list, and manage calendar events",
    category: "productivity",
  },
  {
    id: "image_gen",
    name: "Image Generation",
    description: "Generate images from text prompts",
    category: "creative",
  },
];

export const CATEGORY_ORDER = [
  "research",
  "execution",
  "orchestration",
  "productivity",
  "creative",
];

export const CATEGORY_LABELS: Record<string, string> = {
  research: "Research & Analysis",
  execution: "Code Execution",
  orchestration: "Agent Orchestration",
  productivity: "Productivity",
  creative: "Creative",
};
