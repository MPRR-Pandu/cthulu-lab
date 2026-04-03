import { Handle, Position } from "@xyflow/react";

export default function FetchNode({ data }: { data: { label: string; command?: string; runStatus?: string } }) {
  const statusClass = data.runStatus === "running" ? "wf-running" : data.runStatus === "completed" ? "wf-completed" : data.runStatus === "failed" ? "wf-failed" : "";
  return (
    <div className={`wf-node wf-fetch ${statusClass}`}>
      <div className="wf-header">
        <span className="wf-badge wf-badge-fetch">FETCH</span>
        <span className="wf-label">{data.label || "Fetch"}</span>
      </div>
      {data.command && <div className="wf-kind">{data.command.slice(0, 30)}{data.command.length > 30 ? "..." : ""}</div>}
      <Handle type="target" position={Position.Left} className="wf-handle" />
      <Handle type="source" position={Position.Right} className="wf-handle" />
    </div>
  );
}
