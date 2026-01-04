import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";

export function rehypeCustomSlug() {
  const idCounts = new Map<string, number>();

  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (["h1", "h2", "h3"].includes(node.tagName)) {
        const text = extractText(node);
        let id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const baseId = id;
        const count = idCounts.get(baseId) || 0;
        if (count > 0) {
          id = `${id}-${count}`;
        }
        idCounts.set(baseId, count + 1);

        node.properties = node.properties || {};
        node.properties.id = id;
      }
    });
  };
}

function extractText(node: any): string {
  if (node.type === "text") {
    return node.value;
  }
  if (node.children) {
    return node.children.map(extractText).join("");
  }
  return "";
}

