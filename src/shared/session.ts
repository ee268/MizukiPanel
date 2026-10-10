export interface SessionPolicy {
  idleEnabled: boolean;
  idleMinutes: number;
  maximumEnabled: boolean;
  maximumHours: number;
}
export interface PanelSessionStatus {
  authenticated: true;
  key: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string | null;
  policy: SessionPolicy;
}
export type SessionEndReason = "idle" | "maximum" | "invalid" | "logout";
