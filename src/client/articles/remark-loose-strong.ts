import { $remark } from "@milkdown/kit/utils";
import {
  normalizeLooseStrong,
  restoreLooseStrong,
  restoreLooseStrongMarkers,
} from "../../lib/articles/loose-strong";

export const remarkLooseStrong = $remark(
  "restoreLooseStrong",
  () =>
    function () {
      return (tree, file) => {
        const source = String(file);
        const { normalized, markers } = normalizeLooseStrong(source);
        if (markers.size > 0) {
          const reparsed = this.parse(normalized);
          restoreLooseStrongMarkers(
            reparsed as unknown as Parameters<typeof restoreLooseStrongMarkers>[0],
            markers,
          );
          tree.children = (reparsed as typeof tree).children;
        }
        restoreLooseStrong(tree as unknown as Parameters<typeof restoreLooseStrong>[0], source);
      };
    },
);
