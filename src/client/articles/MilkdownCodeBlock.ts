import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import type { NodeView } from "@milkdown/kit/prose/view";

export function createMilkdownCodeBlock(node: ProseMirrorNode): NodeView {
  const dom = document.createElement("div");
  const gutter = document.createElement("div");
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  const badge = document.createElement("span");

  dom.className = "mizuki-inserted-code-card";
  gutter.className = "mizuki-inserted-code-gutter";
  badge.className = "mizuki-inserted-code-language";
  gutter.setAttribute("aria-hidden", "true");
  badge.setAttribute("aria-hidden", "true");
  pre.append(code);
  dom.append(gutter, pre, badge);

  function updateDisplay(current: ProseMirrorNode) {
    const lineCount = Math.max(1, current.textContent.split("\n").length);
    gutter.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
    badge.textContent = current.attrs.language || "TEXT";
  }

  updateDisplay(node);
  return {
    dom,
    contentDOM: code,
    update(next) {
      if (next.type !== node.type) {
        return false;
      }
      updateDisplay(next);
      return true;
    },
    ignoreMutation(mutation) {
      return !code.contains(mutation.target);
    },
  };
}
