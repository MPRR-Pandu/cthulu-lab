import { useMemo, useCallback, type DragEvent } from "react";
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Position,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type NodeTypes, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import TriggerNode from "./TriggerNode";
import FetchNode from "./FetchNode";
import ClaudeNode from "./ClaudeNode";
import SinkNode from "./SinkNode";
import type { Workflow } from "../../lib/workflowApi";

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  fetch: FetchNode,
  claude: ClaudeNode,
  sink: SinkNode,
};

function buildGraph(workflow: Workflow): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const fetchSteps = workflow.steps.filter(s => s.type === "fetch");
  const claudeSteps = workflow.steps.filter(s => s.type === "claude");

  nodes.push({
    id: "trigger",
    type: "trigger",
    position: { x: 0, y: 100 },
    data: { label: workflow.schedule === "manual" ? "Manual" : workflow.schedule, kind: "cron" },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });

  const fetchStartY = 100 - ((fetchSteps.length - 1) * 40);
  fetchSteps.forEach((step, i) => {
    const id = `fetch-${i}`;
    nodes.push({
      id,
      type: "fetch",
      position: { x: 220, y: fetchStartY + i * 80 },
      data: { label: step.name || `Fetch ${i + 1}`, command: step.command },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
    edges.push({ id: `e-trigger-${id}`, source: "trigger", target: id, animated: true, style: { stroke: "#4de8e0", strokeWidth: 2 } });
  });

  claudeSteps.forEach((step, i) => {
    const id = `claude-${i}`;
    nodes.push({
      id,
      type: "claude",
      position: { x: 440, y: 100 },
      data: { label: step.name || `Claude ${i + 1}`, prompt: step.prompt },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
    fetchSteps.forEach((_, fi) => {
      edges.push({ id: `e-fetch${fi}-${id}`, source: `fetch-${fi}`, target: id, animated: true, style: { stroke: "#a78bfa", strokeWidth: 2 } });
    });
  });

  nodes.push({
    id: "sink",
    type: "sink",
    position: { x: 660, y: 100 },
    data: { label: workflow.sink.toUpperCase() },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });

  claudeSteps.forEach((_, i) => {
    edges.push({ id: `e-claude${i}-sink`, source: `claude-${i}`, target: "sink", animated: true, style: { stroke: "#e8d44d", strokeWidth: 2 } });
  });

  if (claudeSteps.length === 0) {
    fetchSteps.forEach((_, i) => {
      edges.push({ id: `e-fetch${i}-sink`, source: `fetch-${i}`, target: "sink", animated: true, style: { stroke: "#e8d44d", strokeWidth: 2 } });
    });
  }

  return { nodes, edges };
}

interface Props {
  workflow: Workflow;
  height?: number;
}

let nodeIdCounter = 0;

export default function WorkflowCanvas({ workflow, height = 250 }: Props) {
  const initial = useMemo(() => buildGraph(workflow), [workflow]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  useMemo(() => {
    const g = buildGraph(workflow);
    setNodes(g.nodes);
    setEdges(g.edges);
  }, [workflow]);

  // Handle new connections (rewiring)
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#4de8e0", strokeWidth: 2 } }, eds));
  }, [setEdges]);

  // Handle drop from node palette
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow-type");
    const label = event.dataTransfer.getData("application/reactflow-label");
    if (!type) return;

    const bounds = (event.target as HTMLElement).closest(".react-flow")?.getBoundingClientRect();
    if (!bounds) return;

    const position = {
      x: event.clientX - bounds.left - 60,
      y: event.clientY - bounds.top - 20,
    };

    const newNode: Node = {
      id: `${type}-drop-${++nodeIdCounter}`,
      type,
      position,
      data: { label: label || type, kind: type },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  return (
    <div style={height ? { height } : { height: "100%" }} className="border border-[#333] bg-[#050505]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={true}
        minZoom={0.3}
        maxZoom={3}
        defaultEdgeOptions={{ animated: true, style: { stroke: "#4de8e0", strokeWidth: 2 } }}
        connectionLineStyle={{ stroke: "#4de8e0", strokeWidth: 2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a1a" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "trigger") return "#5ddb6e";
            if (n.type === "fetch") return "#4de8e0";
            if (n.type === "claude") return "#a78bfa";
            if (n.type === "sink") return "#e8d44d";
            return "#555";
          }}
          maskColor="rgba(0,0,0,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
