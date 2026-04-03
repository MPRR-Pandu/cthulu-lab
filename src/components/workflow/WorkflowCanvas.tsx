import { useMemo } from "react";
import { ReactFlow, Background, BackgroundVariant, Position, type Node, type Edge, type NodeTypes } from "@xyflow/react";
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

export default function WorkflowCanvas({ workflow, height = 250 }: Props) {
  const { nodes, edges } = useMemo(() => buildGraph(workflow), [workflow]);

  return (
    <div style={{ height }} className="border border-[#333] bg-[#050505]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a1a" />
      </ReactFlow>
    </div>
  );
}
