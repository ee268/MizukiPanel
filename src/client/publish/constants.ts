import type { PublishChange } from "../types";

export const operationLabels = {
  commit: "Git 提交",
  build: "站点构建",
};

export function statusLabel(change: PublishChange): string {
  if (change.conflict) return "冲突";
  if (change.status === "??") {
    return "新增";
  }
  if (change.status.includes("D")) {
    return "删除";
  }
  if (change.status.includes("R")) {
    return "重命名";
  }
  return "修改";
}
