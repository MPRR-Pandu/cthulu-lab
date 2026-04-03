import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { ipc } from "../lib/ipc";

export function SkillSuggestion() {
  const skillSuggestion = useAppStore((s) => s.skillSuggestion);
  const setSkillSuggestion = useAppStore((s) => s.setSkillSuggestion);
  const sessions = useAppStore((s) => s.sessions);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [whenToUse, setWhenToUse] = useState("");
  const [procedure, setProcedure] = useState("");
  const [pitfalls, setPitfalls] = useState("");
  const [verification, setVerification] = useState("");

  if (!skillSuggestion) return null;

  const handleStartEdit = () => {
    const msgs = sessions[skillSuggestion.agentId] ?? [];
    const lastAgent = [...msgs].reverse().find((m) => m.role === "Agent");
    const agentResponse = lastAgent?.content?.slice(0, 200) ?? "";

    setName(skillSuggestion.task.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, ""));
    setDescription(skillSuggestion.task);
    setWhenToUse("When you need to: " + skillSuggestion.task);
    setProcedure("1. " + agentResponse);
    setPitfalls("Check for common issues with this type of task");
    setVerification("Verify by running tests or checking output");
    setEditing(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await ipc.createSkill(name, description, whenToUse, procedure, pitfalls, verification);
      setSuccess(true);
      setTimeout(() => {
        setSkillSuggestion(null);
        setEditing(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to create skill:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    setSkillSuggestion(null);
    setEditing(false);
  };

  if (success) {
    return (
      <div className="border-t border-[#4de84d]/30 bg-[#0a1a0a] px-3 py-2 font-mono text-[10px]">
        <span className="text-[#4de84d]">SKILL SAVED</span>
        <span className="text-[#808080] ml-2">
          Claude Code can now load this skill natively
        </span>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="border-t border-[#e8d44d]/30 bg-[#1a1a00] px-3 py-2 font-mono text-[10px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#e8d44d] font-bold">CREATE SKILL</span>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="px-2 py-0.5 border border-[#4de84d]/50 text-[#4de84d] hover:bg-[#1a3a1a] disabled:opacity-30"
            >
              {saving ? "SAVING..." : "[CREATE]"}
            </button>
            <button
              onClick={handleDismiss}
              className="px-2 py-0.5 border border-[#555555] text-[#808080] hover:bg-[#1a1a1a]"
            >
              [CANCEL]
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[#808080] w-20 shrink-0">name:</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-[#111111] border border-[#333333] px-1 py-0.5 text-[#e0e0e0] outline-none focus:border-[#e8d44d]/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#808080] w-20 shrink-0">description:</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 bg-[#111111] border border-[#333333] px-1 py-0.5 text-[#e0e0e0] outline-none focus:border-[#e8d44d]/50"
            />
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#808080] w-20 shrink-0">when:</span>
            <textarea
              value={whenToUse}
              onChange={(e) => setWhenToUse(e.target.value)}
              rows={2}
              className="flex-1 bg-[#111111] border border-[#333333] px-1 py-0.5 text-[#e0e0e0] outline-none focus:border-[#e8d44d]/50 resize-none"
            />
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#808080] w-20 shrink-0">procedure:</span>
            <textarea
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              rows={3}
              className="flex-1 bg-[#111111] border border-[#333333] px-1 py-0.5 text-[#e0e0e0] outline-none focus:border-[#e8d44d]/50 resize-none"
            />
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#808080] w-20 shrink-0">pitfalls:</span>
            <textarea
              value={pitfalls}
              onChange={(e) => setPitfalls(e.target.value)}
              rows={2}
              className="flex-1 bg-[#111111] border border-[#333333] px-1 py-0.5 text-[#e0e0e0] outline-none focus:border-[#e8d44d]/50 resize-none"
            />
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#808080] w-20 shrink-0">verify:</span>
            <textarea
              value={verification}
              onChange={(e) => setVerification(e.target.value)}
              rows={2}
              className="flex-1 bg-[#111111] border border-[#333333] px-1 py-0.5 text-[#e0e0e0] outline-none focus:border-[#e8d44d]/50 resize-none"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[#e8d44d]/30 bg-[#1a1a00] px-3 py-2 font-mono text-[10px]">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[#e8d44d]">COMPLEX TASK COMPLETED</span>
          <span className="text-[#808080] ml-2">
            ({skillSuggestion.toolCalls} tool calls). Save as reusable skill?
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleStartEdit}
            className="px-2 py-0.5 border border-[#e8d44d]/50 text-[#e8d44d] hover:bg-[#2a2a00]"
          >
            [SAVE SKILL]
          </button>
          <button
            onClick={handleDismiss}
            className="px-2 py-0.5 border border-[#555555] text-[#808080] hover:bg-[#1a1a1a]"
          >
            [DISMISS]
          </button>
        </div>
      </div>
    </div>
  );
}
