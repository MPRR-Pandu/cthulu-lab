import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { ipc } from "../lib/ipc";
import type { SkillInfo } from "../types/skill";

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function SkillsSection() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSkills = async () => {
    try {
      const result = await ipc.listSkills();
      setSkills(result);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleDelete = async (skill: SkillInfo) => {
    try {
      await ipc.deleteSkill(skill.name);
      setSkills((prev) => prev.filter((s) => s.path !== skill.path));
    } catch (err) {
      console.error("Failed to delete skill:", err);
    }
  };

  return (
    <div className="py-1 border-b border-[#222222]">
      <div className="px-2 mb-1 flex items-center justify-between">
        <span className="text-[#808080]">
          -- SKILLS ({skills.length}) --
        </span>
        <button
          onClick={fetchSkills}
          className="text-[10px] text-[#5dadec] hover:text-[#7dc3ff]"
        >
          [REFRESH]
        </button>
      </div>
      {loading ? (
        <div className="px-2 text-[#444444]">loading...</div>
      ) : skills.length === 0 ? (
        <div className="px-2 text-[#444444]">no skills</div>
      ) : (
        skills.map((skill) => (
          <div
            key={skill.path}
            className="px-2 py-0.5 hover:bg-[#1a1a1a] flex items-start justify-between group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[#e0e0e0] text-[10px]">{skill.name}</span>
                <span
                  className={`text-[8px] px-1 border ${
                    skill.auto_generated
                      ? "border-[#e8d44d]/30 text-[#e8d44d]"
                      : "border-[#5dadec]/30 text-[#5dadec]"
                  }`}
                >
                  {skill.auto_generated ? "auto" : "manual"}
                </span>
              </div>
              {skill.description && (
                <div className="text-[#808080] text-[10px] truncate">
                  {skill.description}
                </div>
              )}
            </div>
            {skill.auto_generated && (
              <button
                onClick={() => handleDelete(skill)}
                className="text-[10px] text-[#555555] hover:text-[#f06060] opacity-0 group-hover:opacity-100 ml-1 shrink-0"
              >
                [x]
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function LessonsSection() {
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const lessons = useAppStore((s) => s.lessons);
  const removeLesson = useAppStore((s) => s.removeLesson);

  const agentLessons = activeAgentId
    ? lessons.filter((l) => l.agentId === activeAgentId)
    : lessons;

  if (agentLessons.length === 0) return null;

  const unresolved = agentLessons.filter((l) => !l.fix);
  const resolved = agentLessons.filter((l) => l.fix);

  return (
    <div className="py-1 border-b border-[#222222]">
      <div className="px-2 mb-1">
        <span className="text-[#808080]">
          -- LESSONS ({unresolved.length} open, {resolved.length} resolved) --
        </span>
      </div>
      {unresolved.map((lesson) => (
        <div
          key={lesson.id}
          className="px-2 py-0.5 hover:bg-[#1a1a1a] group border-l-2 border-[#f06060]/40"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[#f06060] text-[10px] truncate">
                {lesson.error.slice(0, 60)}
              </div>
              <div className="text-[#808080] text-[10px] truncate">
                task: {lesson.task.slice(0, 40)}
              </div>
            </div>
            <button
              onClick={() => removeLesson(lesson.id)}
              className="text-[10px] text-[#555] hover:text-[#f06060] opacity-0 group-hover:opacity-100 shrink-0 ml-1"
            >
              [x]
            </button>
          </div>
        </div>
      ))}
      {resolved.slice(-3).map((lesson) => (
        <div
          key={lesson.id}
          className="px-2 py-0.5 hover:bg-[#1a1a1a] group border-l-2 border-[#5ddb6e]/40"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[#555] text-[10px] truncate line-through">
                {lesson.error.slice(0, 40)}
              </div>
              <div className="text-[#5ddb6e] text-[10px] truncate">
                fix: {lesson.fix.slice(0, 50)}
              </div>
            </div>
            <button
              onClick={() => removeLesson(lesson.id)}
              className="text-[10px] text-[#555] hover:text-[#f06060] opacity-0 group-hover:opacity-100 shrink-0 ml-1"
            >
              [x]
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MemoryPanel() {
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const agentMemory = useAppStore((s) => s.agentMemory);
  const clearMemory = useAppStore((s) => s.clearMemory);

  const memories = activeAgentId ? agentMemory[activeAgentId] ?? [] : [];

  const handleCopy = (task: string) => {
    navigator.clipboard.writeText(task).catch(() => {});
  };

  return (
    <div>
      <SkillsSection />
      <LessonsSection />
      <div className="py-1">
        <div className="px-2 mb-1 flex items-center justify-between">
          <span className="text-[#808080]">
            -- MEMORY ({memories.length}) --
          </span>
          {activeAgentId && memories.length > 0 && (
            <button
              onClick={() => clearMemory(activeAgentId)}
              className="text-[10px] text-[#f06060] hover:text-[#ff8080]"
            >
              [CLEAR]
            </button>
          )}
        </div>
        {memories.length === 0 ? (
          <div className="px-2 text-[#444444]">no memories</div>
        ) : (
          [...memories].reverse().map((entry) => (
            <button
              key={entry.id}
              onClick={() => handleCopy(entry.task)}
              className="w-full text-left px-2 py-0.5 hover:bg-[#1a1a1a] block"
              title="Click to copy task"
            >
              <span className="text-[#555555]">[{formatTime(entry.timestamp)}] </span>
              <span className="text-[#e0e0e0]">
                {entry.task.length > 30 ? entry.task.slice(0, 30) + "..." : entry.task}
              </span>
              <div className="text-[#808080] pl-4 truncate">
                {entry.result}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
