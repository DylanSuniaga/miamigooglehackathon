import { memo, useMemo, useEffect, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Bot, FileText, Settings, Cpu } from "lucide-react";
import type { Agent, AgentContextDocument } from "@/lib/types";

// --- Custom Nodes ---

function AgentNodeComponent({ data }: { data: any }) {
  return (
    <div
      className="px-4 py-3 bg-[var(--hm-bg)] rounded-xl shadow-sm border-[1.5px] min-w-[200px]"
      style={{ borderColor: data.color || "#1D1C1D" }}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-[var(--hm-muted)]" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--hm-surface-light)] text-xl border border-[var(--hm-border)]">
          {data.emoji || <Bot className="w-5 h-5 text-[var(--hm-muted)]" />}
        </div>
        <div>
          <div className="font-semibold text-[15px] text-[var(--hm-text)]">
            {data.name}
          </div>
          <div className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--hm-surface-light)] text-[var(--hm-muted)] border border-[var(--hm-border)] inline-block mt-1 uppercase tracking-wider">
            {data.type}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-[var(--hm-muted)]" />
    </div>
  );
}
const AgentNode = memo(AgentNodeComponent);


function ContextNodeComponent({ data }: { data: any }) {
  return (
    <div
      className={`px-3 py-2 bg-[var(--hm-bg)] rounded-lg shadow-sm border min-w-[160px] transition-opacity cursor-pointer hover:border-[var(--hm-text)] ${
        data.isActive ? "border-[var(--hm-border)]" : "border-dashed border-[var(--hm-border)] opacity-60"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--hm-surface-light)] text-[var(--hm-muted)]">
          <FileText className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-[13px] text-[var(--hm-text)] truncate max-w-[120px]">
            {data.title}
          </span>
          <span className="text-[10px] text-[var(--hm-muted)] uppercase tracking-wider">
            {data.docType}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-[var(--hm-muted)]" />
    </div>
  );
}
const ContextNode = memo(ContextNodeComponent);


function ConfigNodeComponent({ data }: { data: any }) {
  return (
    <div className="px-3 py-2 bg-[var(--hm-surface-light)] rounded-lg shadow-sm border border-[var(--hm-border)] min-w-[180px] cursor-pointer hover:border-[var(--hm-text)]">
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-[var(--hm-muted)]" />
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-4 h-4 text-[var(--hm-muted)]" />
        <span className="font-medium text-[12px] text-[var(--hm-text)]">Configuration</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--hm-muted)]">Model</span>
          <span className="text-[11px] font-medium text-[var(--hm-text)] bg-[var(--hm-bg)] px-1 py-0.5 rounded border border-[var(--hm-border)]">
            {data.model.replace("google:", "").replace("openai:", "").replace("anthropic:", "")}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--hm-muted)]">Temp</span>
          <span className="text-[11px] font-medium text-[var(--hm-text)] bg-[var(--hm-bg)] px-1 py-0.5 rounded border border-[var(--hm-border)]">
            {data.temperature.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
const ConfigNode = memo(ConfigNodeComponent);

const customNodeTypes = {
  agentNode: AgentNode,
  contextNode: ContextNode,
  configNode: ConfigNode,
};

// --- Main Map Component ---

interface AgentVisualMapProps {
  agent: Agent;
  contextDocs: AgentContextDocument[];
  onNodeDoubleClick?: (type: "agent" | "config" | "context", id?: string) => void;
}

export function AgentVisualMap({ agent, contextDocs, onNodeDoubleClick }: AgentVisualMapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Regenerate nodes/edges when agent or contextDocs change
  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // 1. Center Agent Node
    newNodes.push({
      id: "agent-center",
      type: "agentNode",
      position: { x: 350, y: Math.max(0, (contextDocs.length * 60) / 2) },
      data: {
        name: agent.display_name,
        emoji: agent.avatar_emoji,
        type: agent.agent_type,
        color: agent.color,
      },
    });

    // 2. Config Node (Right side)
    newNodes.push({
      id: "config-node",
      type: "configNode",
      position: { x: 650, y: Math.max(0, (contextDocs.length * 60) / 2) + 10 },
      data: {
        model: agent.model,
        temperature: agent.temperature,
      },
    });

    newEdges.push({
      id: "edge-agent-config",
      source: "agent-center",
      target: "config-node",
      animated: true,
      style: { stroke: "#ABABAD", strokeWidth: 1.5, strokeDasharray: "4 4" },
    });

    // 3. Context Nodes (Left side)
    contextDocs.forEach((doc, idx) => {
      const nodeId = `context-${doc.id}`;
      newNodes.push({
        id: nodeId,
        type: "contextNode",
        position: { x: 50, y: idx * 70 },
        data: {
          id: doc.id,
          title: doc.title,
          docType: doc.doc_type,
          isActive: doc.is_active,
        },
      });

      newEdges.push({
        id: `edge-${nodeId}`,
        source: nodeId,
        target: "agent-center",
        animated: doc.is_active,
        style: { stroke: doc.is_active ? agent.color || "#1D1C1D" : "#E0E0E0", strokeWidth: 1.5 },
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [agent, contextDocs, setNodes, setEdges]);

  const handleNodeDoubleClick = useCallback(
    (_: any, node: Node) => {
      if (!onNodeDoubleClick) return;
      
      if (node.type === "agentNode") {
        onNodeDoubleClick("agent");
      } else if (node.type === "configNode") {
        onNodeDoubleClick("config");
      } else if (node.type === "contextNode") {
        onNodeDoubleClick("context", node.data.id as string);
      }
    },
    [onNodeDoubleClick]
  );

  return (
    <div className="w-full h-full bg-[var(--hm-bg)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={customNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="[&_.react-flow__controls-button]:border-[var(--hm-border)] [&_.react-flow__controls-button]:bg-[var(--hm-bg)] [&_.react-flow__controls-button]:text-[var(--hm-text)]"
      >
        <Background gap={16} size={1} color="#E0E0E0" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
