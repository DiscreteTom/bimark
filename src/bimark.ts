import { remark } from "remark";
import { visit } from "unist-util-visit";
import { BiDoc } from "./bidoc.js";
import rehypeStringify from "rehype-stringify";
import remark2rehype from "remark-rehype";
import { unified } from "unified";
import { Definition, EscapedReference, Position, Reference } from "./model.js";
import { Parent, Text } from "mdast";

export type BiMarkRenderOptions = {
  def?: {
    /** Show alias using `name|alias`. */
    showAlias?: boolean;
    /** Show brackets using `[[name|alias]]`. */
    showBrackets?: boolean;
  };
  ref?: {
    /** Show brackets using `[[name]]`. */
    showBrackets?: boolean;
    /** Render link as HTML `<a>` instead of markdown inline link. */
    html?: boolean;
  };
  output?: {
    html?: boolean;
  };
};

export class BiMark extends BiDoc {
  constructor(
    options?: Partial<Pick<BiMark, "refIdGenerator" | "defIdGenerator">>
  ) {
    super(options);
  }

  /**
   * Find all text nodes in a markdown document.
   */
  findTextNodes(md: string) {
    const ast = remark.parse(md);
    const nodes = [] as {
      node: Text;
      parent: Parent;
      index: number;
    }[];
    visit(ast, (node) => {
      if ("children" in node) {
        node.children;
        node.children.forEach((c, i) => {
          if (c.type == "text") {
            nodes.push({ node: c, parent: node, index: i });
          }
        });
      }
    });
    return { nodes, ast };
  }

  /**
   * Collect definitions from a markdown document.
   * Return the definitions collected.
   */
  collectDefs(path: string, content: string) {
    const result = [] as Definition[];
    this.findTextNodes(content).nodes.forEach(({ node }) => {
      const res = this.collectDefinitions(
        node.value,
        path,
        node.position! as Position
      );
      result.push(...res.defs);
    });
    return result;
  }

  /*
   * Collect definitions from a markdown document.
   */
  collect(path: string, content: string) {
    this.collectDefs(path, content);
    return this;
  }

  /**
   * Collect references from a markdown document.
   */
  collectRefs(path: string, md: string) {
    const result = {
      refs: [] as { ref: Reference; parent: Text; index: number }[],
      escaped: [] as { ref: EscapedReference; parent: Text; index: number }[],
    };
    this.findTextNodes(md).nodes.forEach(({ node: c, index: i }) => {
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
   * Render a markdown file based on the collected definitions.
   */
  render(path: string, md: string, options?: BiMarkRenderOptions) {
    const { nodes, ast } = this.findTextNodes(md);

    nodes.forEach(({ node: c, index: i, parent }) => {
      const { type, value, ...rest } = c;
      parent.children[i] = {
        type: "html", // use html node to avoid escaping
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
            return options?.ref?.html || options?.output?.html
              ? `<a href="${ref.def.path}#${ref.def.id}">${span}</a>`
              : `[${span}](${ref.def.path}#${ref.def.id})`;
          }
        ),
        ...rest,
      };
    });

    if (options?.output?.html)
      return unified()
        .use(rehypeStringify, { allowDangerousHtml: true })
        .stringify(
          unified()
            .use(remark2rehype, { allowDangerousHtml: true })
            .runSync(ast) as any // TODO: how to type this?
        );

    return remark.stringify(ast);
  }

  /**
   * Collect definitions from a markdown file then render it.
   */
  static singleFile(
    md: string,
    options?: {
      path?: string;
    } & BiMarkRenderOptions
  ) {
    const path = options?.path ?? "";
    return new BiMark().collect(path, md).render(path, md, options);
  }
}
