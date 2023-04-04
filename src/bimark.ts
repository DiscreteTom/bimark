import { remark } from "remark";
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
   * Texts in links are ignored.
   *
   * @deprecated Use the static `findTextNodes` instead.
   */
  findTextNodes(md: string) {
    return BiMark.findTextNodes(md);
  }

  /**
   * Find all text nodes in a markdown document.
   * Texts in links are ignored.
   */
  static findTextNodes(md: string) {
    const ast = remark.parse(md);
    const nodes = BiMark.traverseNode(ast);
    ast.children;
    return { nodes, ast };
  }

  /**
   * Collect text nodes recursively, ignore links.
   */
  private static traverseNode(node: Parent) {
    const result = [] as {
      node: Text;
      parent: Parent;
      index: number;
    }[];

    // skip link
    if (node.type == "link") return result;

    node.children.forEach((c, i) => {
      if ("children" in c) {
        result.push(...BiMark.traverseNode(c));
      } else if (c.type == "text") {
        result.push({ node: c, parent: node, index: i });
      }
    });

    return result;
  }

  /**
   * Collect definitions from a markdown document.
   * Return the definitions collected.
   */
  collectDefs(path: string, content: string) {
    const result = [] as Definition[];
    BiMark.findTextNodes(content).nodes.forEach(({ node }) => {
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
    BiMark.findTextNodes(md).nodes.forEach(({ node: c, index: i }) => {
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
    const { nodes, ast } = BiMark.findTextNodes(md);

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
            const span = `<span id="${ref.id}">${
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
