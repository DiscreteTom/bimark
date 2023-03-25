import { rehype } from "rehype";
import { unified } from "unified";
import rehypeStringify from "rehype-stringify";
import { BiDoc } from "./bidoc.js";
import { selectAll } from "hast-util-select";
import { Element, Text } from "hast";

export type BiMLRenderOptions = {
  def?: {
    selectors?: string[];
    showAlias?: boolean;
    showBrackets?: boolean;
  };
  ref?: {
    selectors?: string[];
    showBrackets?: boolean;
  };
};

export class BiML extends BiDoc {
  constructor(
    options?: Partial<Pick<BiML, "refIdGenerator" | "defIdGenerator">>
  ) {
    super(options);
  }

  /**
   * Collect definitions from an html document.
   */
  collect(path: string, content: string, options?: { selectors?: string[] }) {
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

    const targets = new Set<Text>(); // avoid processing the same text node twice
    const ast = rehype.parse(content);

    selectors.forEach((s) => {
      selectAll(s, ast).forEach((node) => {
        node.children.forEach((c) => {
          if (c.type == "text") {
            targets.add(c);
          }
        });
      });
    });

    targets.forEach((c) => this.collectDefinition(c.value, path, c.position!));
    return this;
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

    const ast = rehype.parse(md);
    /** text=>{parent,index}, avoid processing the same text node twice */
    const targets = new Map<Text, { parent: Element; index: number }>();

    // collect all targets
    defSelectors.forEach((s) => {
      selectAll(s, ast).forEach((node) => {
        node.children.forEach((c, i) => {
          if (c.type == "text") targets.set(c, { parent: node, index: i });
        });
      });
    });
    refSelectors.forEach((s) => {
      selectAll(s, ast).forEach((node) => {
        node.children.forEach((c, i) => {
          if (c.type == "text") targets.set(c, { parent: node, index: i });
        });
      });
    });

    // render
    targets.forEach(({ parent, index }, c) => {
      parent.children[index] = {
        type: "raw",
        value: this.renderText(
          path,
          c.value,
          c.position!,
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
          (ref, def) => {
            const span = `<span id="${this.refIdGenerator(ref, def)}">${
              (options?.ref?.showBrackets ? "[[" : "") +
              ref.name + // don't use def.name here, because it may be an alias
              (options?.ref?.showBrackets ? "]]" : "")
            }</span>`;
            return `<a href="${def.path}#${def.id}">${span}</a>`;
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
