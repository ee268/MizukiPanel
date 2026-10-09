import { configureVditorStrong } from "./vditor-strong";

let runtime: Promise<void> | null = null;

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      script.id = id;
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`无法加载编辑器资源：${src}`));
    };
    document.head.appendChild(script);
  });
}

/** Complete runtime loading before construction, including React's rapid mount/unmount cycle. */
export function loadVditorRuntime(): Promise<void> {
  runtime ??= Promise.all([
    loadScript("/assets/vditor/dist/js/i18n/zh_CN.js", "vditorI18nScriptzh_CN"),
    loadScript("/assets/vditor/dist/js/lute/lute.min.js", "vditorLuteScript"),
  ])
    .then(() => {
      configureVditorStrong(Lute);
    })
    .catch((error) => {
      runtime = null;
      throw error;
    });
  return runtime;
}
