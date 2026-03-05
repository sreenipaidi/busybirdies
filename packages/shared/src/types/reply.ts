import type { ReplySource } from '../constants/index.js';
import type { UserSummary } from './user.js';

export interface TicketReply {
  id: string;
  ticket_id: string;
  user: UserSummary;
  body: string;
  is_internal: boolean;
  source: ReplySource;
  attachments: Attachment[];
  created_at: string;
}

export interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  download_url: string;
}

export interface AuditEntry {
  id: string;
  ticket_id: string;
  user: UserSummary | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
