export interface CSATResponse {
  id: string;
  ticket_id: string;
  rating: number;
  comment: string | null;
  responded_at: string | null;
}

export interface HeartbeatViewer {
  user_id: string;
  full_name: string;
  is_composing: boolean;
  last_seen_at: string;
}
