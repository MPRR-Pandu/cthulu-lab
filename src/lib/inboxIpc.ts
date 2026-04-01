import { invoke } from "@tauri-apps/api/core";
import type { InboxMessage } from "../types/inbox";

export const inboxIpc = {
  getInbox: () => invoke<InboxMessage[]>("get_inbox"),

  sendMessage: (
    from: string,
    to: string,
    messageType: string,
    content: string
  ) =>
    invoke<InboxMessage>("send_inbox_message", {
      from,
      to,
      messageType,
      content,
    }),

  markRead: (messageId: string) =>
    invoke("mark_inbox_read", { messageId }),
};
