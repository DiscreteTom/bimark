import { remark } from "remark";
import { visit } from "unist-util-visit";
import { BiDoc } from "./bidoc";

export class BiMark extends BiDoc {
  constructor(
    options?: Partial<Pick<BiMark, "refIdGenerator" | "defIdGenerator">>
  ) {
    super(options);
  }

  /**
   * Collect definitions from a markdown document.
   */
  collect(path: string, content: string) {
    const ast = remark.parse(content);
    visit(ast, (node) => {
      if (node.type == "text")
        this.collectDefinition(node.value, path, node.position!);
    });
    return this;
  }

  /**
   * Render a markdown file based on the collected definitions.
   */
  render(
    path: string,
    md: string,
    options?: {
      def?: { showAlias?: boolean; showBrackets?: boolean };
      ref?: { showBrackets?: boolean; html?: boolean };
    }
  ) {
    const ast = remark.parse(md);
    visit(ast, (node) => {
      if ("children" in node) {
        node.children = node.children.map((c) => {
          if (c.type == "text") {
            const { type, value, ...rest } = c;
            return {
              type: "html", // use html node to avoid escaping
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
                (def, name) => {
                  const span = `<span id="${this.refIdGenerator(
                    path,
                    def,
                    def.refs.length - 1
                  )}">${
                    (options?.ref?.showBrackets ? "[[" : "") +
                    name + // don't use def.name here, because it may be an alias
                    (options?.ref?.showBrackets ? "]]" : "")
                  }</span>`;
                  return options?.ref?.html
                    ? `<a href="${def.path}#${def.id}">${span}</a>`
                    : `[${span}](${def.path}#${def.id})`;
                }
              ),
              ...rest,
            };
          } else return c;
        });
      }
    });
    return remark.stringify(ast);
  }

  /**
   * Collect definitions from a markdown file then render it.
   */
  static singleFile(
    md: string,
    options?: {
      path?: string;
      def?: { showAlias?: boolean; showBrackets?: boolean };
      ref?: { showBrackets?: boolean; html?: boolean };
    }
  ) {
    const path = options?.path ?? "";
    return new BiMark().collect(path, md).render(path, md, options);
  }
}
