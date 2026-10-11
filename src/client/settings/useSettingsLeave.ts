import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useBlocker } from "react-router-dom";
import { sessionLifecycle } from "../auth/session-lifecycle";
import type { SettingsController } from "./useSettingsController";

export function useSettingsLeave({
  dirty,
  saving,
  controller,
  template,
  scoped,
  preferences,
}: Pick<
  SettingsController,
  "dirty" | "saving" | "controller" | "template" | "scoped" | "preferences"
>) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  const [leaveError, setLeaveError] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const allowLogout = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (sessionLifecycle.canNavigate()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const logout = (event: MouseEvent) => {
      if (allowLogout.current) {
        allowLogout.current = false;
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest('button[aria-label="退出登录"]')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setLogoutOpen(true);
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", logout, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", logout, true);
    };
  }, [dirty]);
  function leave() {
    setLeaveError("");
    if (logoutOpen) {
      // Commit the chosen save/discard before logout can trigger a native unload.
      flushSync(() => setLogoutOpen(false));
      allowLogout.current = true;
      document.querySelector<HTMLButtonElement>('button[aria-label="退出登录"]')?.click();
    } else if (blocker.state === "blocked") blocker.proceed();
  }
  async function saveAndLeave() {
    if (
      (controller.dirty && !(await controller.save())) ||
      (template.dirty && !(await template.save())) ||
      !(await saveScoped())
    )
      setLeaveError("部分设置尚未保存。已保存范围保留，失败范围的输入仍保留，请继续编辑处理提示。");
    else leave();
  }
  async function saveScoped() {
    for (const item of scoped) if (item.dirty && !(await item.save())) return false;
    return true;
  }
  const cancelLeave = () => {
    setLeaveError("");
    setLogoutOpen(false);
    if (blocker.state === "blocked") blocker.reset();
  };
  return {
    open: blocker.state === "blocked" || logoutOpen,
    leaveError,
    cancelLeave,
    saveAndLeave,
    discardAndLeave: () => {
      controller.cancelAll();
      template.reset();
      scoped.forEach((item) => item.reset());
      leave();
    },
    saving,
    saveDisabled:
      saving ||
      (controller.dirty && preferences.snapshot.readOnly) ||
      (template.dirty && template.base?.settings.readOnly) ||
      scoped.some((item) => item.dirty && item.readOnly),
  };
}
