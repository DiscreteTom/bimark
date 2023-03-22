import { remark } from "remark";
import { visit } from "unist-util-visit";
import { BiDoc } from "./bidoc";
import { Definition, Fragment, Position, RefIdGenerator } from "./model";
import { BiParser } from "./parser";

export class BiMark extends BiDoc {
  constructor(
    options?: Partial<Pick<BiMark, "refIdGenerator" | "defIdGenerator">>
  ) {
    super(options);
  }

  protected parseTextNode(
    content: string,
    cb: (text: string, position: Position) => void
  ): void {
    const ast = remark.parse(content);
    visit(ast, (node) => {
      if (node.type == "text") cb(node.value, node.position!);
    });
  }

  protected renderDefinition(
    path: string,
    fragments: Fragment[],
    options: { showBrackets: boolean; showAlias: boolean }
  ) {
    const res = BiParser.collectDefinitionFromFragments(
      fragments,
      path,
      this.defIdGenerator
    );
    res.defs.forEach((d) => {
      d.fragment.content = `<span id="${d.id}">${
        (options.showBrackets ? "[[" : "") +
        d.name +
        (options.showAlias && d.alias.length > 0
          ? "|" + d.alias.join("|")
          : "") +
        (options.showBrackets ? "]]" : "")
      }</span>`;
    });

    return res.fragments;
  }

  protected renderExplicitOrEscapedReference(
    path: string,
    fragments: Fragment[],
    options: { showBrackets: boolean; html: boolean }
  ) {
    return BiParser.processFragments(
      fragments,
      // [[#id]] or [[!name]]
      /\[\[((#[a-zA-Z0-9_-]+)|(![ a-zA-Z0-9_-]+))\]\]/g,
      (m) => {
        const def = m[1].startsWith("#")
          ? this.id2def.get(m[1].slice(1))
          : this.name2def.get(m[1].slice(1));
        // check existence
        if (!def) throw new Error(`Definition not found: ${m[1]} from ${path}`);

        const escaped = m[1].startsWith("!");

        if (escaped)
          return {
            // for an escaped reference, just show the name
            content: def.name,
            skip: true,
          };
        else {
          def.refs.push(path);
          const span = `<span id="${this.refIdGenerator(
            path,
            def,
            def.refs.length - 1
          )}">${
            (options.showBrackets ? "[[" : "") +
            def.name +
            (options.showBrackets ? "]]" : "")
          }</span>`;
          return {
            // for a explicit reference, show the name with a link
            content: options.html
              ? `<a href="${def.path}#${def.id}">${span}</a>`
              : `[${span}](${def.path}#${def.id})`,
            skip: true,
          };
        }
      }
    );
  }

  protected renderImplicitReference(
    path: string,
    fragments: Fragment[],
    def: Definition,
    /** name or alias */
    content: string,
    options: { showBrackets: boolean; html: boolean }
  ) {
    return BiParser.processFragments(
      fragments,
      new RegExp(content, "g"),
      (m) => {
        def.refs.push(path);
        const span = `<span id="${this.refIdGenerator(
          path,
          def,
          def.refs.length - 1
        )}">${
          (options.showBrackets ? "[[" : "") +
          content + // don't use def.name here, because it may be an alias
          (options.showBrackets ? "]]" : "")
        }</span>`;
        return {
          content: options.html
            ? `<a href="${def.path}#${def.id}">${span}</a>`
            : `[${span}](${def.path}#${def.id})`,
          skip: true,
        };
      }
    );
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
              value: this.renderText(path, c.value, c.position!, {
                def: {
                  showAlias: options?.def?.showAlias ?? false,
                  showBrackets: options?.def?.showBrackets ?? false,
                },
                ref: {
                  showBrackets: options?.ref?.showBrackets ?? false,
                  html: options?.ref?.html ?? false,
                },
              }),
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
