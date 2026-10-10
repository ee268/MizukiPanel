import { useEffect, useRef } from "react";
import { sessionLifecycle } from "./session-lifecycle";
import type { RecoveryParticipant } from "./session-recovery";
export function useSessionRecovery(participant: RecoveryParticipant) {
  const latest = useRef(participant);
  latest.current = participant;
  useEffect(
    () =>
      sessionLifecycle.recovery.register({
        label: participant.label,
        prepare: () => latest.current.prepare?.(),
        save: () => latest.current.save(),
        snapshot: () => latest.current.snapshot(),
      }),
    [],
  );
}
export function useUnsavedSessionRecovery(label: string, dirty: boolean, snapshot: unknown) {
  useSessionRecovery({
    label,
    save: async () => {
      if (dirty) throw new Error(`${label}尚未保存，请下载修改副本后登录。`);
    },
    snapshot: () => (dirty ? snapshot : null),
  });
}
