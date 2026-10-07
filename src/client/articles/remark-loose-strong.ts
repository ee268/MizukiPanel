import { $remark } from "@milkdown/kit/utils";
import { restoreLooseStrong } from "../../lib/articles/loose-strong";

export const remarkLooseStrong = $remark("restoreLooseStrong", () => () => (tree, file) => {
  restoreLooseStrong(tree, String(file));
});
