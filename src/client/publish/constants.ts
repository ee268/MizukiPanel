import type { PublishChange } from "../types";

export const checkColors = {
  pass: "success",
  warning: "warning",
  error: "error",
} as const;

export const operationLabels = {
  validate: "发布校验",
  sync: "内容同步",
  build: "站点构建",
};

export function statusLabel(change: PublishChange): string {
  if (change.status === "??") {
    return "新增";
  }
  if (change.status.includes("D")) {
    return "删除";
  }
  if (change.status.includes("R")) {
    return "重命名";
  }
  if (change.conflict) {
    return "冲突";
  }
  return "修改";
}

export function publishSteps(external: boolean) {
  return external
    ? ["发布前检查", "提交内容", "推送内容仓库", "同步至 Mizuki", "构建站点"]
    : ["发布前检查", "提交内容", "推送 Mizuki", "构建站点"];
}
