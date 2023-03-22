import uslug from "uslug";
import {
  Definition,
  DefIdGenerator,
  RefIdGenerator,
  Position,
  Fragment,
  DefRenderer,
  RefRenderer,
} from "./model";
import { BiParser } from "./parser";

export class BiDoc {
  /** name/alias => Definition */
  readonly name2def: Map<string, Definition>;
  /** id => Definition */
  readonly id2def: Map<string, Definition>;
  readonly defIdGenerator: DefIdGenerator;
  readonly refIdGenerator: RefIdGenerator;

  constructor(
    options?: Partial<Pick<BiDoc, "refIdGenerator" | "defIdGenerator">>
  ) {
    this.defIdGenerator = options?.defIdGenerator ?? ((name) => uslug(name));
    this.refIdGenerator =
      options?.refIdGenerator ??
      ((_, def, index) => `${def.id}-ref-${index + 1}`);

    this.name2def = new Map();
    this.id2def = new Map();
  }

  protected collectDefinition(text: string, path: string, position: Position) {
    return BiParser.collectDefinition(
      text,
      path,
      position,
      this.defIdGenerator
    ).defs.forEach((d) => {
      // check name/alias/id duplication
      if (this.name2def.has(d.name))
        throw new Error(`Duplicate definition name: ${d.name} in file ${path}`);
      if (this.id2def.has(d.id))
        throw new Error(`Duplicate definition id: ${d.id} in file ${path}`);
      d.alias.forEach((a) => {
        if (this.name2def.has(a))
          throw new Error(`Duplicate definition name: ${a} in file ${path}`);
      });

      this.name2def.set(d.name, d);
      this.id2def.set(d.id, d);
      d.alias.forEach((a) => {
        this.name2def.set(a, d);
      });
    });
  }

  private renderDefinition(
    path: string,
    fragments: Fragment[],
    renderer: DefRenderer
  ) {
    const res = BiParser.collectDefinitionFromFragments(
      fragments,
      path,
      this.defIdGenerator
    );
    res.defs.forEach((d) => {
      d.fragment.content = renderer(d);
    });

    return res.fragments;
  }

  private renderExplicitOrEscapedReference(
    path: string,
    fragments: Fragment[],
    renderer: RefRenderer
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
          return {
            // for a explicit reference, show the name with a link
            content: renderer(def, def.name),
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
    name: string,
    renderer: RefRenderer
  ) {
    return BiParser.processFragments(fragments, new RegExp(name, "g"), (m) => {
      def.refs.push(path);
      return {
        content: renderer(def, name),
        skip: true,
      };
    });
  }

  protected renderText(
    path: string,
    s: string,
    position: Position,
    defRenderer: DefRenderer,
    refRenderer: RefRenderer
  ) {
    let fragments: Fragment[] = [{ content: s, skip: false, position }];

    fragments = this.renderDefinition(path, fragments, defRenderer);
    fragments = this.renderExplicitOrEscapedReference(
      path,
      fragments,
      refRenderer
    );

    this.name2def.forEach((def, content) => {
      fragments = this.renderImplicitReference(
        path,
        fragments,
        def,
        content,
        refRenderer
      );
    });

    return fragments.map((f) => f.content).join("");
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
