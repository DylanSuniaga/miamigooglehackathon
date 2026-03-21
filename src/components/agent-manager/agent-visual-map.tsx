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
import { Bot, FileText, Settings, Cpu, Wrench, Users } from "lucide-react";
import type { Agent, AgentContextDocument } from "@/lib/types";

import { TOOL_REGISTRY } from "@/lib/tools/tool-registry";

// --- Custom Nodes ---

function AgentNodeComponent({ data }: { data: any }) {
  return (
    <div
      className="px-4 py-3 bg-white rounded-xl shadow-sm border-[1.5px] min-w-[200px]"
      style={{ borderColor: data.color || "#1D1C1D" }}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-[#616061]" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#F8F8F8] text-xl border border-[#E0E0E0]">
          {data.emoji || <Bot className="w-5 h-5 text-[#616061]" />}
        </div>
        <div>
          <div className="font-semibold text-[15px] text-[#1D1C1D]">
            {data.name}
          </div>
          <div className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#F8F8F8] text-[#616061] border border-[#E0E0E0] inline-block mt-1 uppercase tracking-wider">
            {data.type}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-[#616061]" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-2 h-2 !bg-[#616061]" />
    </div>
  );
}
const AgentNode = memo(AgentNodeComponent);


function ContextNodeComponent({ data }: { data: any }) {
  return (
    <div
      className={`px-3 py-2 bg-white rounded-lg shadow-sm border min-w-[160px] transition-opacity cursor-pointer hover:border-[#1D1C1D] ${
        data.isActive ? "border-[#E0E0E0]" : "border-dashed border-[#E0E0E0] opacity-60"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded flex items-center justify-center bg-[#F8F8F8] text-[#616061]">
          <FileText className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-[13px] text-[#1D1C1D] truncate max-w-[120px]">
            {data.title}
          </span>
          <span className="text-[10px] text-[#616061] uppercase tracking-wider">
            {data.docType}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-[#616061]" />
    </div>
  );
}
const ContextNode = memo(ContextNodeComponent);


function ConfigNodeComponent({ data }: { data: any }) {
  return (
    <div className="px-3 py-2 bg-[#F8F8F8] rounded-lg shadow-sm border border-[#E0E0E0] min-w-[180px] cursor-pointer hover:border-[#1D1C1D]">
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-[#616061]" />
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-4 h-4 text-[#616061]" />
        <span className="font-medium text-[12px] text-[#1D1C1D]">Configuration</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#616061]">Model</span>
          <span className="text-[11px] font-medium text-[#1D1C1D] bg-white px-1 py-0.5 rounded border border-[#E0E0E0]">
            {data.model.replace("google:", "").replace("openai:", "").replace("anthropic:", "")}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#616061]">Temp</span>
          <span className="text-[11px] font-medium text-[#1D1C1D] bg-white px-1 py-0.5 rounded border border-[#E0E0E0]">
            {data.temperature.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
const ConfigNode = memo(ConfigNodeComponent);

function ToolNodeComponent({ data }: { data: any }) {
  return (
    <div className="px-3 py-1.5 bg-white rounded shadow-sm border border-[#1264A3] min-w-[120px] flex items-center justify-center gap-2">
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-[#616061]" />
      <Wrench className="w-3.5 h-3.5 text-[#1264A3]" />
      <span className="font-medium text-[11px] text-[#1264A3]">{data.name}</span>
    </div>
  );
}
const ToolNode = memo(ToolNodeComponent);

function SubagentNodeComponent({ data }: { data: any }) {
  return (
    <div
      className="px-3 py-1.5 bg-[#F8F8F8] rounded shadow-sm border min-w-[120px] flex items-center justify-between gap-3 opacity-90"
      style={{ borderColor: data.color || "#1D1C1D" }}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-[#616061]" />
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{data.emoji}</span>
        <span className="font-medium text-[12px] text-[#1D1C1D]">{data.name}</span>
      </div>
    </div>
  );
}
const SubagentNode = memo(SubagentNodeComponent);

const customNodeTypes = {
  agentNode: AgentNode,
  contextNode: ContextNode,
  configNode: ConfigNode,
  toolNode: ToolNode,
  subagentNode: SubagentNode,
};

// --- Main Map Component ---

interface AgentVisualMapProps {
  agent: Agent;
  contextDocs: AgentContextDocument[];
  allAgents: Agent[];
  onNodeDoubleClick?: (type: "agent" | "config" | "context", id?: string) => void;
}

export function AgentVisualMap({ agent, contextDocs, allAgents, onNodeDoubleClick }: AgentVisualMapProps) {
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
      position: { x: 350, y: Math.max(0, (contextDocs.length * 70) / 2) },
      data: {
        name: agent.display_name,
        emoji: agent.avatar_emoji,
        type: agent.agent_type,
        color: agent.color,
      },
    });

    // 2. Config Node (Right side top)
    newNodes.push({
      id: "config-node",
      type: "configNode",
      position: { x: 650, y: Math.max(0, (contextDocs.length * 70) / 2) - 40 },
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

    // 4. Tool Nodes (Bottom side)
    const activeTools = Array.isArray(agent.tools) ? agent.tools : [];
    const toolMap = new Map(TOOL_REGISTRY.map(t => [t.id, t.name]));
    
    activeTools.forEach((toolId, idx) => {
      const nodeId = `tool-${toolId}`;
      const name = toolMap.get(toolId as string) || toolId;
      // Spread out horizontally below the agent
      const startX = 350 - (activeTools.length * 140) / 2 + 70;
      
      newNodes.push({
        id: nodeId,
        type: "toolNode",
        position: { x: startX + idx * 140, y: Math.max(0, (contextDocs.length * 70) / 2) + 120 },
        data: { name },
      });

      newEdges.push({
        id: `edge-${nodeId}`,
        source: "agent-center",
        sourceHandle: "bottom",
        target: nodeId,
        animated: true,
        style: { stroke: "#1264A3", strokeWidth: 1.5, opacity: 0.6 },
      });
    });

    // 5. Subagents (Right side bottom) - only if delegation tool is enabled
    if (activeTools.includes("delegate")) {
      const peers = allAgents.filter(a => a.id !== agent.id && a.is_active);
      peers.forEach((peer, idx) => {
        const nodeId = `peer-${peer.id}`;
        
        newNodes.push({
          id: nodeId,
          type: "subagentNode",
          position: { x: 650, y: Math.max(0, (contextDocs.length * 70) / 2) + 60 + idx * 50 },
          data: {
            name: peer.display_name,
            emoji: peer.avatar_emoji,
            color: peer.color,
          },
        });

        newEdges.push({
          id: `edge-${nodeId}`,
          source: "agent-center",
          target: nodeId,
          animated: true,
          style: { stroke: "#ABABAD", strokeWidth: 1.5 },
          label: "can delegate to",
          labelStyle: { fill: "#616061", fontSize: 10, fontWeight: 500 },
          labelBgStyle: { fill: "#F8F8F8", fillOpacity: 0.8 },
        });
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [agent, contextDocs, allAgents, setNodes, setEdges]);

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
    <div className="w-full h-full bg-[#FCFCFC]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={customNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="[&_.react-flow__controls-button]:border-[#E0E0E0] [&_.react-flow__controls-button]:bg-white [&_.react-flow__controls-button]:text-[#1D1C1D]"
      >
        <Background gap={16} size={1} color="#E0E0E0" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
