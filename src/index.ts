import { remark } from "remark";
import { visit } from "unist-util-visit";

export type Definition = {
  name: string;
  alias: string[];
  path: string;
  id: string;
  refcount: number;
};

type Fragment = { content: string; skip: boolean };

export class BiMark {
  /** name => Definition */
  readonly name2def: Map<string, Definition>;
  /** id => Definition */
  readonly id2def: Map<string, Definition>;

  constructor() {
    this.name2def = new Map();
    this.id2def = new Map();
  }

  /**
   * Load a list of definition.
   * This is useful when you want to load a pre-existing inventory.
   */
  // load(defs: Definition[] | Map<string, Definition>) {
  //   defs.forEach((d) => {
  //     this.name2def.set(d.name, d);
  //     this.id2def.set(d.id, d);
  //   });
  //   return this;
  // }

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
          const id = m[4] ? m[4].slice(1) : name;
          const def = { path, name, id, alias, refcount: 0 };
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
    options: { showBorder: boolean; showAlias: boolean }
  ) {
    const result: Fragment[] = [];
    fragments.forEach((f) => {
      if (f.skip) {
        result.push(f);
        return;
      }

      [
        ...f.content.matchAll(
          // [[name|alias1|alias2:ID]]
          /\[\[([ a-zA-Z0-9_-]+)((\|[ a-zA-Z0-9_-]+)*)(:[a-zA-Z0-9_-]+)?\]\]/g
        ),
      ].forEach((m, i, all) => {
        const name = m[1];
        const alias = m[2].split("|").slice(1);
        const id = m[4] ? m[4].slice(1) : name;
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
            (options.showBorder ? "[[" : "") +
            name +
            (options.showAlias && alias.length > 0
              ? "|" + alias.join("|")
              : "") +
            (options.showBorder ? "]]" : "")
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
    });
    return result;
  }

  private processExplicitOrEscapedReference(
    fragments: Fragment[],
    options: { showBorder: boolean }
  ) {
    const result: Fragment[] = [];
    fragments.forEach((f) => {
      if (f.skip) {
        result.push(f);
        return;
      }

      [
        ...f.content.matchAll(
          // [[#id]] or [[!name]]
          /\[\[((#[a-zA-Z0-9_-]+)|(![ a-zA-Z0-9_-]+))\]\]/g
        ),
      ].forEach((m, i, all) => {
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
          def.refcount++;
          result.push({
            // for a explicit reference, show the name with a link
            content: `[<span id="${def.id}-ref-${def.refcount}">${
              (options.showBorder ? "[[" : "") +
              def.name +
              (options.showBorder ? "]]" : "")
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
    });
    return result;
  }

  private processImplicitReference(
    fragments: Fragment[],
    def: Definition,
    options: { showBorder: boolean }
  ) {
    const result: Fragment[] = [];
    fragments.forEach((f) => {
      if (f.skip) {
        result.push(f);
        return;
      }

      [...f.content.matchAll(new RegExp(def.name, "g"))].forEach(
        (m, i, all) => {
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
          def.refcount++;
          result.push({
            content: `[<span id="${def.id}-ref-${def.refcount}">${
              (options.showBorder ? "[[" : "") +
              def.name +
              (options.showBorder ? "]]" : "")
            }</span>](${def.path}#${def.id})`,
            skip: true,
          });
          // append after to result if this is the last match
          if (i == all.length - 1 && after.length > 0)
            result.push({
              content: after,
              skip: false,
            });
        }
      );
    });
    return result;
  }

  private processText(s: string) {
    let fragments: { content: string; skip: boolean }[] = [
      { content: s, skip: false },
    ];

    fragments = this.processDefinition(fragments, {
      showAlias: true,
      showBorder: true,
    });
    fragments = this.processExplicitOrEscapedReference(fragments, {
      showBorder: true,
    });

    this.name2def.forEach((def) => {
      fragments = this.processImplicitReference(fragments, def, {
        showBorder: false,
      });
    });

    return fragments.map((f) => f.content).join("");
  }

  render(md: string) {
    const ast = remark.parse(md);
    visit(ast, (node) => {
      if ("children" in node) {
        node.children = node.children.map((c) => {
          if (c.type == "text") {
            const { type, value, ...rest } = c;
            return {
              type: "html", // use html node to avoid escaping
              value: this.processText(c.value),
              ...rest,
            };
          } else return c;
        });
      }
    });
    return remark.stringify(ast);
  }
}
