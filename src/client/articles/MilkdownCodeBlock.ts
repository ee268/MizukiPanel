import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";

const languageOptions = [
  "text",
  "bash",
  "c",
  "cpp",
  "css",
  "go",
  "html",
  "java",
  "javascript",
  "json",
  "python",
  "rust",
  "sql",
  "typescript",
  "yaml",
];

let languageListId = 0;

export function createMilkdownCodeBlock(
  node: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined,
  readOnly: boolean,
): NodeView {
  const dom = document.createElement("div");
  const toolbar = document.createElement("div");
  const languageLabel = document.createElement("label");
  const languageInput = document.createElement("input");
  const languageList = document.createElement("datalist");
  const deleteButton = document.createElement("button");
  const content = document.createElement("div");
  const gutter = document.createElement("div");
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  const badge = document.createElement("span");
  let currentNode = node;

  dom.className = "mizuki-inserted-code-card";
  toolbar.className = "mizuki-inserted-code-toolbar";
  content.className = "mizuki-inserted-code-content";
  gutter.className = "mizuki-inserted-code-gutter";
  badge.className = "mizuki-inserted-code-language";
  languageInput.type = "text";
  languageInput.setAttribute("aria-label", "代码语言");
  languageInput.setAttribute("placeholder", "语言");
  languageList.id = `mizuki-code-languages-${++languageListId}`;
  languageInput.setAttribute("list", languageList.id);
  languageList.replaceChildren(
    ...languageOptions.map((language) => {
      const option = document.createElement("option");
      option.value = language;
      return option;
    }),
  );
  deleteButton.type = "button";
  deleteButton.textContent = "删除";
  deleteButton.setAttribute("aria-label", "删除代码块");
  gutter.setAttribute("aria-hidden", "true");
  badge.setAttribute("aria-hidden", "true");
  languageLabel.append(languageInput, languageList);
  toolbar.append(languageLabel, deleteButton);
  pre.append(code);
  content.append(gutter, pre);
  dom.append(toolbar, content, badge);

  function updateDisplay(current: ProseMirrorNode) {
    currentNode = current;
    const lineCount = Math.max(1, current.textContent.split("\n").length);
    gutter.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
    badge.textContent = current.attrs.language || "TEXT";
    if (languageInput !== document.activeElement) {
      languageInput.value = current.attrs.language || "";
    }
  }

  function closeOutside(event: PointerEvent) {
    if (event.target instanceof Node && !dom.contains(event.target)) {
      dom.classList.remove("is-editing");
    }
  }

  if (!readOnly) {
    dom.addEventListener("click", () => dom.classList.add("is-editing"));
    document.addEventListener("pointerdown", closeOutside, true);
    languageInput.addEventListener("input", () => {
      const position = getPos();
      if (typeof position !== "number") return;
      view.dispatch(
        view.state.tr.setNodeMarkup(position, undefined, {
          ...currentNode.attrs,
          language: languageInput.value,
        }),
      );
    });
    deleteButton.addEventListener("click", () => {
      const position = getPos();
      if (typeof position !== "number") return;
      view.dispatch(view.state.tr.delete(position, position + currentNode.nodeSize));
      view.focus();
    });
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
    stopEvent(event) {
      return toolbar.contains(event.target as Node);
    },
    destroy() {
      document.removeEventListener("pointerdown", closeOutside, true);
    },
  };
}
