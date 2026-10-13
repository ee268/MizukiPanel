export function waitForApiReady(child, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      child.off("message", ready);
      child.off("error", failed);
      child.off("exit", exited);
      signal.removeEventListener("abort", aborted);
    };
    const ready = (message) => {
      if (message?.type !== "mizuki-panel:api-ready") return;
      cleanup();
      resolve();
    };
    const failed = (error) => {
      cleanup();
      reject(error);
    };
    const exited = () => failed(new Error("API 在就绪前已退出，前端未启动"));
    const aborted = () => failed(signal.reason);
    if (signal.aborted) return aborted();
    if (child.exitCode !== null || child.signalCode !== null) return exited();
    child.on("message", ready);
    child.once("error", failed);
    child.once("exit", exited);
    signal.addEventListener("abort", aborted, { once: true });
  });
}
