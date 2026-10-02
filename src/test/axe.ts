import axe from "axe-core";

/** Runs axe on a rendered subtree; layout-dependent rules are off because jsdom has no CSS layout. */
export async function axeViolations(node: Element): Promise<string[]> {
  const result = await axe.run(node, {
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
    },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}
