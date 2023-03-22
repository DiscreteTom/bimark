import { remark } from "remark";
import { visit } from "unist-util-visit";
import uslug from "uslug";
import {
  DefIdGenerator,
  Definition,
  Fragment,
  Position,
  RefIdGenerator,
} from "./model";
import { BiParser } from "./parser";

export class BiMark {
  /** name/alias => Definition */
  readonly name2def: Map<string, Definition>;
  /** id => Definition */
  readonly id2def: Map<string, Definition>;
  readonly defIdGenerator: DefIdGenerator;
  readonly refIdGenerator: RefIdGenerator;

  constructor(
    options?: Partial<Pick<BiMark, "refIdGenerator" | "defIdGenerator">>
  ) {
    this.defIdGenerator = options?.defIdGenerator ?? ((name) => uslug(name));
    this.refIdGenerator =
      options?.refIdGenerator ??
      ((_, def, index) => `${def.id}-ref-${index + 1}`);

    this.name2def = new Map();
    this.id2def = new Map();
  }

  /**
   * Collect definitions from a markdown document.
   */
  collect(path: string, md: string) {
    const ast = remark.parse(md);
    visit(ast, (node) => {
      if (node.type == "text") {
        BiParser.collectDefinition(
          node.value,
          path,
          node.position!,
          this.defIdGenerator
        ).defs.forEach((d) => {
          // check name/alias/id duplication
          if (this.name2def.has(d.name))
            throw new Error(
              `Duplicate definition name: ${d.name} in file ${path}`
            );
          if (this.id2def.has(d.id))
            throw new Error(`Duplicate definition id: ${d.id} in file ${path}`);
          d.alias.forEach((a) => {
            if (this.name2def.has(a))
              throw new Error(
                `Duplicate definition name: ${a} in file ${path}`
              );
          });

          this.name2def.set(d.name, d);
          this.id2def.set(d.id, d);
          d.alias.forEach((a) => {
            this.name2def.set(a, d);
          });
        });
      }
    });
    return this;
  }

  private renderDefinition(
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

  private renderExplicitOrEscapedReference(
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

  private renderImplicitReference(
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

  private renderText(
    path: string,
    s: string,
    position: Position,
    options: {
      def: { showAlias: boolean; showBrackets: boolean };
      ref: { showBrackets: boolean; html: boolean };
    }
  ) {
    let fragments: Fragment[] = [{ content: s, skip: false, position }];

    fragments = this.renderDefinition(path, fragments, {
      showAlias: options.def.showAlias,
      showBrackets: options.def.showBrackets,
    });
    fragments = this.renderExplicitOrEscapedReference(path, fragments, {
      showBrackets: options.ref.showBrackets,
      html: options.ref.html,
    });

    this.name2def.forEach((def, content) => {
      fragments = this.renderImplicitReference(path, fragments, def, content, {
        showBrackets: options.ref.showBrackets,
        html: options.ref.html,
      });
    });

    return fragments.map((f) => f.content).join("");
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

  /**
   * Get the references of a definition.
   * Return an array of link address to the references.
   */
  getReverseRefs(options: { id: string } | { name: string }) {
    const def =
      "id" in options
        ? this.id2def.get(options.id)
        : this.name2def.get(options.name);

    if (!def)
      throw new Error(`Definition not found: ${JSON.stringify(options)}`);

    return def.refs.map((p, i) => `${p}#${this.refIdGenerator(p, def, i)}`);
  }
}
