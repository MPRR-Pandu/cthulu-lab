import { Handle, Position } from "@xyflow/react";

export default function TriggerNode({ data }: { data: { label: string; kind: string; runStatus?: string } }) {
  const statusClass = data.runStatus === "running" ? "wf-running" : data.runStatus === "completed" ? "wf-completed" : data.runStatus === "failed" ? "wf-failed" : "";
  return (
    <div className={`wf-node wf-trigger ${statusClass}`}>
      <div className="wf-header">
        <span className="wf-badge wf-badge-trigger">CRON</span>
        <span className="wf-label">{data.label || "Trigger"}</span>
      </div>
      {data.kind && <div className="wf-kind">{data.kind}</div>}
      <Handle type="source" position={Position.Right} className="wf-handle" />
    </div>
  );
}
