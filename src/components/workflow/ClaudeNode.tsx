import { Handle, Position } from "@xyflow/react";

export default function ClaudeNode({ data }: { data: { label: string; prompt?: string; runStatus?: string } }) {
  const statusClass = data.runStatus === "running" ? "wf-running" : data.runStatus === "completed" ? "wf-completed" : data.runStatus === "failed" ? "wf-failed" : "";
  return (
    <div className={`wf-node wf-claude ${statusClass}`}>
      <div className="wf-header">
        <span className="wf-badge wf-badge-claude">CLAUDE</span>
        <span className="wf-label">{data.label || "Claude"}</span>
      </div>
      {data.prompt && <div className="wf-kind">{data.prompt.slice(0, 30)}{data.prompt.length > 30 ? "..." : ""}</div>}
      <Handle type="target" position={Position.Left} className="wf-handle" />
      <Handle type="source" position={Position.Right} className="wf-handle" />
    </div>
  );
}
