import { Handle, Position } from "@xyflow/react";

export default function SinkNode({ data }: { data: { label: string; runStatus?: string } }) {
  const statusClass = data.runStatus === "running" ? "wf-running" : data.runStatus === "completed" ? "wf-completed" : data.runStatus === "failed" ? "wf-failed" : "";
  return (
    <div className={`wf-node wf-sink ${statusClass}`}>
      <div className="wf-header">
        <span className="wf-badge wf-badge-sink">OUTPUT</span>
        <span className="wf-label">{data.label || "UI"}</span>
      </div>
      <Handle type="target" position={Position.Left} className="wf-handle" />
    </div>
  );
}
