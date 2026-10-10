export interface ArchiveItem {
  id: string;
  kind: "backup" | "trash";
  createdAt: string;
  bytes: number;
  projectKey: string | null;
  projectName: string;
  originalPath: string;
  domain: string;
  restorable: boolean;
  reason: string;
  protected: boolean;
}
export interface ArchiveInventory {
  items: ArchiveItem[];
  version: string;
  totals: { backup: number; trash: number; count: number };
  warnings: string[];
  projectKey: string | null;
}
export interface MaintenancePreview {
  token: string;
  expiresAt: string;
  items: ArchiveItem[];
  bytes: number;
  destination?: string;
  version?: string | null;
}
