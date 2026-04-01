export type InboxMessageType = "Delegation" | "Report" | "Question" | "Alert";

export interface InboxMessage {
  id: string;
  from: string;
  to: string;
  message_type: InboxMessageType;
  content: string;
  timestamp: string;
  read: boolean;
}
