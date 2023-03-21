import { remark } from "remark";
import { visit } from "unist-util-visit";
import uslug from "uslug";

export type Position = {
  /** from 1 */
  line: number;
  /** from 1 */
  column: number;
};

export type Definition = {
  name: string;
  alias: string[];
  path: string;
  id: string;
  /** Path list. */
  refs: string[];
  /** Position in the original file. */
  position: {
    start: Position;
    /** End is included. */
    end: Position;
  };
};

type Fragment = { content: string; skip: boolean };

export class BiMark {
  /** name/alias => Definition */
  readonly name2def: Map<string, Definition>;
  /** id => Definition */
  readonly id2def: Map<string, Definition>;
  readonly defIdGenerator: (name: string) => string;
  readonly refIdGenerator: (
    path: string,
    def: Definition,
    index: number
  ) => string;

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
        [
          ...node.value.matchAll(
            // [[name|alias1|alias2:ID]]
            /\[\[([ a-zA-Z0-9_-]+)((\|[ a-zA-Z0-9_-]+)*)(:[a-zA-Z0-9_-]+)?\]\]/g
          ),
        ].forEach((m) => {
          const name = m[1];
          const alias = m[2].split("|").slice(1);
          const id = m[4] ? m[4].slice(1) : this.defIdGenerator(name);
          const def: Definition = {
            path,
            name,
            id,
            alias,
            refs: [],
            position: {
              start: {
                line: node.position!.start.line,
                column: node.position!.start.column + m.index!,
              },
              end: {
                line: node.position!.start.line,
                column:
                  node.position!.start.column + m.index! + m[0].length - 1,
              },
            },
          };

          // check name/alias/id duplication
          if (this.name2def.has(name))
            throw new Error(
              `Duplicate definition name: ${name} in file ${path}`
            );
          if (this.id2def.has(id))
            throw new Error(`Duplicate definition id: ${id} in file ${path}`);
          alias.forEach((a) => {
            if (this.name2def.has(a))
              throw new Error(
                `Duplicate definition name: ${a} in file ${path}`
              );
          });

          this.name2def.set(name, def);
          this.id2def.set(id, def);
          alias.forEach((a) => {
            this.name2def.set(a, def);
          });
        });
      }
    });
    return this;
  }

  private processFragments(
    fragments: Fragment[],
    regex: RegExp,
    processor: (m: RegExpMatchArray) => Fragment
  ) {
    const result: Fragment[] = [];
    fragments.forEach((f) => {
      if (f.skip) {
        result.push(f);
        return;
      }

      const matches = [...f.content.matchAll(regex)];
      matches.forEach((m, i, all) => {
        const start = m.index!;
        const end = m.index! + m[0].length;
        const before = f.content.slice(
          i == 0
            ? 0 // current match is the first one
            : all[i - 1].index! + all[i - 1][0].length, // current match is not the first one
          start
        );
        const after = f.content.slice(
          end,
          i == all.length - 1
            ? undefined // current match is the last one
            : all[i + 1].index! + all[i + 1][0].length // current match is not the last one
        );

        // append before to result
        if (before.length > 0)
          result.push({
            content: before,
            skip: false,
          });
        // append process result
        result.push(processor(m));
        // append after to result if this is the last match
        if (i == all.length - 1 && after.length > 0)
          result.push({
            content: after,
            skip: false,
          });
      });

      if (matches.length == 0) {
        result.push(f);
      }
    });
    return result;
  }

  private renderDefinition(
    fragments: Fragment[],
    options: { showBrackets: boolean; showAlias: boolean }
  ) {
    return this.processFragments(
      fragments,
      // [[name|alias1|alias2:ID]]
      /\[\[([ a-zA-Z0-9_-]+)((\|[ a-zA-Z0-9_-]+)*)(:[a-zA-Z0-9_-]+)?\]\]/g,
      (m) => {
        const name = m[1];
        const alias = m[2].split("|").slice(1);
        const id = m[4] ? m[4].slice(1) : this.defIdGenerator(name);
        return {
          content: `<span id="${id}">${
            (options.showBrackets ? "[[" : "") +
            name +
            (options.showAlias && alias.length > 0
              ? "|" + alias.join("|")
              : "") +
            (options.showBrackets ? "]]" : "")
          }</span>`,
          skip: true,
        };
      }
    );
  }

  private renderExplicitOrEscapedReference(
    path: string,
    fragments: Fragment[],
    options: { showBrackets: boolean; html: boolean }
  ) {
    return this.processFragments(
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
    return this.processFragments(fragments, new RegExp(content, "g"), (m) => {
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
    });
  }

  private renderText(
    path: string,
    s: string,
    options: {
      def: { showAlias: boolean; showBrackets: boolean };
      ref: { showBrackets: boolean; html: boolean };
    }
  ) {
    let fragments: { content: string; skip: boolean }[] = [
      { content: s, skip: false },
    ];

    fragments = this.renderDefinition(fragments, {
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
              value: this.renderText(path, c.value, {
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
