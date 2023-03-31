import { rehype } from "rehype";
import { unified } from "unified";
import rehypeStringify from "rehype-stringify";
import { BiDoc } from "./bidoc.js";
import { selectAll } from "hast-util-select";
import { Element, Text } from "hast";
import { Definition, EscapedReference, Position, Reference } from "./model.js";

export type BiMLRenderOptions = {
  def?: {
    /**
     * Query selectors for HTML to select elements to render definitions.
     * Default: `["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "li"]`
     */
    selectors?: string[];
    /** Show alias using `name|alias`. */
    showAlias?: boolean;
    /** Show brackets using `[[name|alias]]`. */
    showBrackets?: boolean;
  };
  ref?: {
    /**
     * Query selectors for HTML to select elements to render references.
     * Default: the same as `options.def.selectors`
     */
    selectors?: string[];
    /** Show brackets using `[[name]]`. */
    showBrackets?: boolean;
  };
};

export type BiMLCollectOptions = {
  /**
   * Query selectors for HTML to select elements to collect definitions.
   * Default: `["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "li"]`
   */
  selectors?: string[];
};

export class BiML extends BiDoc {
  constructor(
    options?: Partial<Pick<BiML, "refIdGenerator" | "defIdGenerator">>
  ) {
    super(options);
  }

  /**
   * Find all text nodes in an html document.
   */
  findTextNodes(content: string, options?: BiMLCollectOptions) {
    const selectors = options?.selectors ?? [
      "p",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "li",
    ];

    /** text=>{parent,index}, avoid processing the same text node twice */
    const nodes = new Map<Text, { parent: Element; index: number }>();

    // collect all targets
    const ast = rehype.parse(content);
    selectors.forEach((s) => {
      selectAll(s, ast).forEach((node) => {
        node.children.forEach((c, i) => {
          if (c.type == "text") nodes.set(c, { parent: node, index: i });
        });
      });
    });

    return {
      nodes: [...nodes.entries()].map((entry) => ({
        node: entry[0],
        parent: entry[1].parent,
        index: entry[1].index,
      })),
      ast,
    };
  }

  /**
   * Collect definitions from an html document.
   * Return the definitions collected.
   */
  collectDefs(path: string, content: string, options?: BiMLCollectOptions) {
    const result = [] as Definition[];
    this.findTextNodes(content, options).nodes.forEach(({ node: c }) => {
      const res = this.collectDefinitions(
        c.value,
        path,
        c.position! as Position
      );
      result.push(...res.defs);
    });
    return result;
  }

  /**
   * Collect definitions from an html document.
   */
  collect(path: string, content: string, options?: BiMLCollectOptions) {
    this.collectDefs(path, content, options);
    return this;
  }

  /**
   * Collect references from an html document.
   */
  collectRefs(path: string, md: string, options?: BiMLCollectOptions) {
    const result = {
      refs: [] as { ref: Reference; parent: Text; index: number }[],
      escaped: [] as { ref: EscapedReference; parent: Text; index: number }[],
    };
    this.findTextNodes(md, options).nodes.forEach(({ node: c, index: i }) => {
      const { type, value, ...rest } = c;
      const res = this.collectReferences(
        path,
        value,
        rest.position! as Position
      );
      res.refs.forEach((r) => {
        result.refs.push({ ref: r, parent: c, index: i });
      });
      res.escaped.forEach((r) => {
        result.escaped.push({ ref: r, parent: c, index: i });
      });
    });

    return result;
  }

  /**
   * Render an html file based on the collected definitions.
   */
  render(path: string, md: string, options?: BiMLRenderOptions) {
    const defSelectors = options?.def?.selectors ?? [
      "p",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "li",
    ];
    const refSelectors = options?.ref?.selectors ?? defSelectors;

    const { nodes: targets, ast } = this.findTextNodes(md, {
      selectors: [...new Set([...defSelectors, ...refSelectors])],
    });

    // render
    targets.forEach(({ parent, index, node: c }) => {
      parent.children[index] = {
        type: "raw",
        value: this.renderText(
          path,
          c.value,
          c.position! as Position,
          // def renderer
          (d) =>
            `<span id="${d.id}">${
              (options?.def?.showBrackets ? "[[" : "") +
              d.name +
              (options?.def?.showAlias && d.alias.length > 0
                ? "|" + d.alias.join("|")
                : "") +
              (options?.def?.showBrackets ? "]]" : "")
            }</span>`,
          // ref renderer
          (ref) => {
            const span = `<span id="${this.refIdGenerator(ref)}">${
              (options?.ref?.showBrackets ? "[[" : "") +
              ref.name + // don't use def.name here, because it may be an alias
              (options?.ref?.showBrackets ? "]]" : "")
            }</span>`;
            return `<a href="${ref.def.path}#${ref.def.id}">${span}</a>`;
          }
        ),
      };
    });

    return unified()
      .use(rehypeStringify, {
        allowDangerousHtml: true,
      })
      .stringify(ast);
  }

  /**
   * Collect definitions from an html file then render it.
   */
  static singleFile(
    md: string,
    options?: {
      path?: string;
    } & BiMLRenderOptions
  ) {
    const path = options?.path ?? "";
    return new BiML().collect(path, md).render(path, md, options);
  }
}
