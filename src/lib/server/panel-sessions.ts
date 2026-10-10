import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readPanelSettings } from "./panel-settings";
import { defaultStateDir } from "./workspace";
import type { PanelSessionStatus, SessionEndReason, SessionPolicy } from "../../shared/session";
interface Session {
  key: string;
  created: number;
  activity: number;
  tokenHash: string;
}
export class SessionPolicyError extends Error {}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export class PanelSessions {
  private sessions = new Map<string, Session>();
  constructor(
    private stateDir = defaultStateDir(),
    private now: () => number = Date.now,
  ) {}
  async policy(): Promise<SessionPolicy> {
    const settings = await readPanelSettings("machine", undefined, this.stateDir);
    if (settings.readOnly || settings.warnings.some((warning) => warning.startsWith("session.")))
      throw new SessionPolicyError(
        "会话策略无法安全读取，请检查设置文件或升级面板；原设置已保留。",
      );
    return settings.document.values.session as unknown as SessionPolicy;
  }
  private expired(session: Session, policy: SessionPolicy): SessionEndReason | null {
    const now = this.now();
    if (policy.maximumEnabled && now >= session.created + policy.maximumHours * 3600000)
      return "maximum";
    if (policy.idleEnabled && now >= session.activity + policy.idleMinutes * 60000) return "idle";
    return null;
  }
  private status(session: Session, policy: SessionPolicy): PanelSessionStatus {
    const deadlines = [
      policy.idleEnabled ? session.activity + policy.idleMinutes * 60000 : Infinity,
      policy.maximumEnabled ? session.created + policy.maximumHours * 3600000 : Infinity,
    ];
    const deadline = Math.min(...deadlines);
    return {
      authenticated: true,
      key: session.key,
      createdAt: new Date(session.created).toISOString(),
      lastActivityAt: new Date(session.activity).toISOString(),
      expiresAt: Number.isFinite(deadline) ? new Date(deadline).toISOString() : null,
      policy,
    };
  }
  async create(): Promise<{ id: string; status: PanelSessionStatus }> {
    const policy = await this.policy();
    const expected = process.env.PANEL_ACCESS_TOKEN;
    if (!expected) throw new SessionPolicyError("访问令牌未配置。");
    for (const [id, session] of this.sessions)
      if (session.tokenHash !== hash(expected) || this.expired(session, policy))
        this.sessions.delete(id);
    if (this.sessions.size >= 1000)
      throw new SessionPolicyError("登录会话数量达到上限，请退出已有会话或重启服务。");
    const id = randomBytes(32).toString("base64url");
    const now = this.now();
    const session = { key: randomUUID(), created: now, activity: now, tokenHash: hash(expected) };
    this.sessions.set(hash(id), session);
    return { id, status: this.status(session, policy) };
  }
  async verify(
    id: string | undefined,
  ): Promise<{ status: PanelSessionStatus } | { reason: SessionEndReason }> {
    if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return { reason: "invalid" };
    const key = hash(id);
    const session = this.sessions.get(key);
    if (!session) return { reason: "invalid" };
    if (session.tokenHash !== hash(process.env.PANEL_ACCESS_TOKEN ?? "")) {
      this.sessions.delete(key);
      return { reason: "invalid" };
    }
    const policy = await this.policy();
    const reason = this.expired(session, policy);
    if (reason) {
      this.sessions.delete(key);
      return { reason };
    }
    return { status: this.status(session, policy) };
  }
  async activity(id: string | undefined) {
    const checked = await this.verify(id);
    if ("reason" in checked) return checked;
    const session = this.sessions.get(hash(id!));
    if (!session) return { reason: "invalid" as const };
    // The server timestamp is authoritative; there is no client-provided timestamp.
    session.activity = this.now();
    return { status: this.status(session, checked.status.policy) };
  }
  revoke(id: string | undefined) {
    if (id) this.sessions.delete(hash(id));
  }
}
