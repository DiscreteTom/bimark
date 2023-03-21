import { remark } from "remark";
import { visit } from "unist-util-visit";
import uslug from "uslug";

export type Definition = {
  name: string;
  alias: string[];
  path: string;
  id: string;
  /** Path list. */
  refs: string[];
};

type Fragment = { content: string; skip: boolean };

export class BiMark {
  /** name => Definition */
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
          const def = { path, name, id, alias, refs: [] };
          // TODO: check name/alias/id duplication
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

  private processDefinition(
    fragments: Fragment[],
    options: { showBrackets: boolean; showAlias: boolean }
  ) {
    const result: Fragment[] = [];
    fragments.forEach((f) => {
      if (f.skip) {
        result.push(f);
        return;
      }

      const matches = [
        ...f.content.matchAll(
          // [[name|alias1|alias2:ID]]
          /\[\[([ a-zA-Z0-9_-]+)((\|[ a-zA-Z0-9_-]+)*)(:[a-zA-Z0-9_-]+)?\]\]/g
        ),
      ];
      matches.forEach((m, i, all) => {
        const name = m[1];
        const alias = m[2].split("|").slice(1);
        const id = m[4] ? m[4].slice(1) : this.defIdGenerator(name);
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
        // append definition to result
        result.push({
          content: `<span id="${id}">${
            (options.showBrackets ? "[[" : "") +
            name +
            (options.showAlias && alias.length > 0
              ? "|" + alias.join("|")
              : "") +
            (options.showBrackets ? "]]" : "")
          }</span>`,
          skip: true,
        });
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

  private processExplicitOrEscapedReference(
    path: string,
    fragments: Fragment[],
    options: { showBrackets: boolean }
  ) {
    const result: Fragment[] = [];
    fragments.forEach((f) => {
      if (f.skip) {
        result.push(f);
        return;
      }

      const matches = [
        ...f.content.matchAll(
          // [[#id]] or [[!name]]
          /\[\[((#[a-zA-Z0-9_-]+)|(![ a-zA-Z0-9_-]+))\]\]/g
        ),
      ];
      matches.forEach((m, i, all) => {
        const def = m[1].startsWith("#")
          ? this.id2def.get(m[1].slice(1))!
          : this.name2def.get(m[1].slice(1))!; // TODO: check existence
        const escaped = m[1].startsWith("!");
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
        // append reference to result
        if (escaped)
          result.push({
            // for an escaped reference, just show the name
            content: def.name,
            skip: true,
          });
        else {
          def.refs.push(path);
          result.push({
            // for a explicit reference, show the name with a link
            content: `[<span id="${this.refIdGenerator(
              path,
              def,
              def.refs.length - 1
            )}">${
              (options.showBrackets ? "[[" : "") +
              def.name +
              (options.showBrackets ? "]]" : "")
            }</span>](${def.path}#${def.id})`,
            skip: true,
          });
        }
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

  private processImplicitReference(
    path: string,
    fragments: Fragment[],
    def: Definition,
    options: { showBrackets: boolean }
  ) {
    const result: Fragment[] = [];
    fragments.forEach((f) => {
      if (f.skip) {
        result.push(f);
        return;
      }

      const matches = [...f.content.matchAll(new RegExp(def.name, "g"))];
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
        // append reference to result
        def.refs.push(path);
        result.push({
          content: `[<span id="${this.refIdGenerator(
            path,
            def,
            def.refs.length - 1
          )}">${
            (options.showBrackets ? "[[" : "") +
            def.name +
            (options.showBrackets ? "]]" : "")
          }</span>](${def.path}#${def.id})`,
          skip: true,
        });
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

  private processText(
    path: string,
    s: string,
    options: {
      def: { showAlias: boolean; showBrackets: boolean };
      ref: { showBrackets: boolean };
    }
  ) {
    let fragments: { content: string; skip: boolean }[] = [
      { content: s, skip: false },
    ];

    fragments = this.processDefinition(fragments, {
      showAlias: options.def.showAlias,
      showBrackets: options.def.showBrackets,
    });
    fragments = this.processExplicitOrEscapedReference(path, fragments, {
      showBrackets: options.ref.showBrackets,
    });

    this.name2def.forEach((def) => {
      fragments = this.processImplicitReference(path, fragments, def, {
        showBrackets: options.ref.showBrackets,
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
      ref?: { showBrackets?: boolean };
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
              value: this.processText(path, c.value, {
                def: {
                  showAlias: options?.def?.showAlias ?? false,
                  showBrackets: options?.def?.showBrackets ?? false,
                },
                ref: { showBrackets: options?.ref?.showBrackets ?? false },
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
      ref?: { showBrackets?: boolean };
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
