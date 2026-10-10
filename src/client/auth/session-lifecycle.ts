import type { PanelSessionStatus, SessionEndReason } from "../../shared/session";
import { RecoveryRegistry } from "./session-recovery";
interface Exit {
  reason: SessionEndReason;
  message: string;
  showDialog: boolean;
  working: boolean;
  errors: string[];
}
interface State {
  session: PanelSessionStatus | null;
  exit: Exit | null;
}
export class SessionLifecycle {
  readonly recovery = new RecoveryRegistry();
  private state: State = { session: null, exit: null };
  private listeners = new Set<() => void>();
  private sequence = 0;
  private epoch = 0;
  private navigationAllowed = false;
  private revoke: (() => Promise<void>) | undefined;
  private exitOpenedAt = 0;
  constructor(private navigate: () => void) {}
  getState = () => this.state;
  getEpoch = () => this.epoch;
  canNavigate = () => this.navigationAllowed;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(state: State) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  adopt(session: PanelSessionStatus) {
    const changed = this.state.session?.key !== session.key;
    if (changed) {
      this.sequence++;
      this.epoch++;
      this.revoke = undefined;
      this.navigationAllowed = false;
    }
    this.update({ session, exit: changed ? null : this.state.exit });
  }
  async end(
    reason: SessionEndReason,
    message: string,
    epoch = this.epoch,
    revoke?: () => Promise<void>,
  ) {
    if (epoch !== this.epoch || this.state.exit) return;
    let showDialog = true;
    if (reason === "logout") {
      try {
        // Flush pending editor input before checking for unsaved changes.
        showDialog = this.recovery.capture().length > 0;
      } catch {
        // Keep recovery available if a widget or snapshot cannot be read.
      }
    }
    this.revoke = revoke;
    this.exitOpenedAt = Date.now();
    this.update({
      ...this.state,
      exit: { reason, message, showDialog, working: true, errors: [] },
    });
    await this.retry();
  }
  async retry() {
    if (!this.state.exit) return;
    const sequence = ++this.sequence;
    this.update({ ...this.state, exit: { ...this.state.exit, working: true, errors: [] } });
    const errors = await this.recovery.save();
    if (sequence !== this.sequence || !this.state.exit) return;
    if (errors.length) this.fail(errors);
    else await this.finish(sequence);
  }
  private fail(errors: string[]) {
    if (!this.state.exit) return;
    if (!this.state.exit.showDialog) this.exitOpenedAt = Date.now();
    this.update({
      ...this.state,
      exit: { ...this.state.exit, showDialog: true, working: false, errors },
    });
  }
  async finish(sequence = this.sequence) {
    if (sequence !== this.sequence || !this.state.exit) return;
    this.update({ ...this.state, exit: { ...this.state.exit, working: true } });
    // Count saving time toward the minimum dialog duration, including retries.
    const remaining = this.state.exit.showDialog ? 1000 - (Date.now() - this.exitOpenedAt) : 0;
    if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    if (sequence !== this.sequence || !this.state.exit) return;
    try {
      await this.revoke?.();
    } catch (error) {
      if (sequence === this.sequence) this.fail([(error as Error).message]);
      return;
    }
    if (sequence !== this.sequence || !this.state.exit) return;
    this.navigationAllowed = true;
    this.navigate();
  }
  cancel() {
    if (this.state.exit?.reason !== "logout") return;
    this.sequence++;
    this.revoke = undefined;
    this.update({ ...this.state, exit: null });
  }
}
export const sessionLifecycle = new SessionLifecycle(() => window.location.replace("/login"));
