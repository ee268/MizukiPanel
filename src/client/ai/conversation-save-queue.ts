import type { ConversationSnapshot, StoredConversations } from "../../shared/ai-conversations";

/** Serialize writes so every update uses the version returned by the previous save. */
export class ConversationSaveQueue {
  version: string | null = null;
  private pending: StoredConversations | null = null;
  private running: Promise<void> | null = null;
  constructor(
    private write: (
      document: StoredConversations,
      version: string | null,
    ) => Promise<ConversationSnapshot>,
  ) {}
  get dirty() {
    return Boolean(this.pending || this.running);
  }
  enqueue(document: StoredConversations) {
    this.pending = document;
  }
  flush(): Promise<void> {
    if (this.running) return this.running.then(() => this.flush());
    if (!this.pending) return Promise.resolve();
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async drain() {
    while (this.pending) {
      const document = this.pending;
      this.pending = null;
      try {
        this.version = (await this.write(document, this.version)).version;
      } catch (cause) {
        this.pending ??= document;
        throw cause;
      }
    }
  }
}
