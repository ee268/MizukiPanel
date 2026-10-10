export interface RecoveryParticipant {
  label: string;
  prepare?: () => void;
  save: () => Promise<void>;
  snapshot: () => unknown;
}
export class RecoveryRegistry {
  private participants = new Set<RecoveryParticipant>();
  register(participant: RecoveryParticipant) {
    this.participants.add(participant);
    return () => {
      this.participants.delete(participant);
    };
  }
  capture() {
    const files: { label: string; data: unknown }[] = [];
    for (const participant of this.participants) participant.prepare?.();
    for (const participant of this.participants) {
      const data = participant.snapshot();
      if (data !== null && data !== undefined) files.push({ label: participant.label, data });
    }
    return files;
  }
  async save(timeout = 5000): Promise<string[]> {
    const errors: string[] = [];
    // Flush editable widgets before their owners capture the current React state.
    for (const participant of this.participants)
      try {
        participant.prepare?.();
      } catch (error) {
        errors.push(`${participant.label}：${(error as Error).message}`);
      }
    const saves = Promise.allSettled(
      [...this.participants].map(async (participant) => {
        try {
          await participant.save();
        } catch (error) {
          throw new Error(`${participant.label}：${(error as Error).message}`);
        }
      }),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const results = await Promise.race([
        saves,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("保存恢复副本超时，输入仍保留。")), timeout);
        }),
      ]);
      errors.push(
        ...results
          .filter((result) => result.status === "rejected")
          .map((result) => (result as PromiseRejectedResult).reason.message),
      );
    } catch (error) {
      errors.push((error as Error).message);
    } finally {
      clearTimeout(timer);
    }
    return errors;
  }
}
