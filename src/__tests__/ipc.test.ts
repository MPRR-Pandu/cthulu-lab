import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ipc } from "../lib/ipc";
import { inboxIpc } from "../lib/inboxIpc";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

describe("IPC Wrappers", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe("Agent IPC", () => {
    it("listAgents calls correct command", async () => {
      mockInvoke.mockResolvedValue([]);
      await ipc.listAgents();
      expect(mockInvoke).toHaveBeenCalledWith("list_agents");
    });

    it("switchAgent passes agentId", async () => {
      mockInvoke.mockResolvedValue({});
      await ipc.switchAgent("planner");
      expect(mockInvoke).toHaveBeenCalledWith("switch_agent", { agentId: "planner" });
    });

    it("sendMessage passes agentId and content", async () => {
      mockInvoke.mockResolvedValue("msg-id-123");
      const result = await ipc.sendMessage("builder", "build it");
      expect(mockInvoke).toHaveBeenCalledWith("send_message", {
        agentId: "builder",
        content: "build it",
      });
      expect(result).toBe("msg-id-123");
    });

    it("getChatHistory passes agentId", async () => {
      mockInvoke.mockResolvedValue([]);
      await ipc.getChatHistory("fixer");
      expect(mockInvoke).toHaveBeenCalledWith("get_chat_history", { agentId: "fixer" });
    });

    it("toggleVoice calls correct command", async () => {
      mockInvoke.mockResolvedValue(true);
      const result = await ipc.toggleVoice();
      expect(mockInvoke).toHaveBeenCalledWith("toggle_voice");
      expect(result).toBe(true);
    });
  });

  describe("Inbox IPC", () => {
    it("getInbox calls correct command", async () => {
      mockInvoke.mockResolvedValue([]);
      await inboxIpc.getInbox();
      expect(mockInvoke).toHaveBeenCalledWith("get_inbox");
    });

    it("sendMessage passes all params", async () => {
      mockInvoke.mockResolvedValue({ id: "inbox-1" });
      await inboxIpc.sendMessage("user", "planner", "Delegation", "build auth");
      expect(mockInvoke).toHaveBeenCalledWith("send_inbox_message", {
        from: "user",
        to: "planner",
        messageType: "Delegation",
        content: "build auth",
      });
    });

    it("markRead passes messageId", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await inboxIpc.markRead("inbox-42");
      expect(mockInvoke).toHaveBeenCalledWith("mark_inbox_read", { messageId: "inbox-42" });
    });
  });
});
