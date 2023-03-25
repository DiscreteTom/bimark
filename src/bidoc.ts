import uslug from "uslug";
import {
  Definition,
  DefIdGenerator,
  RefIdGenerator,
  Position,
  Fragment,
  DefRenderer,
  RefRenderer,
  Reference,
} from "./model.js";
import { BiParser } from "./parser.js";

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
      ((ref) => `${ref.def.id}-ref-${ref.index + 1}`);

    this.name2def = new Map();
    this.id2def = new Map();
  }

  /**
   * Parse definitions from the text, and store them in `this.name2def` and `this.id2def`.
   * Throw error if there are duplicate definitions.
   */
  protected collectDefinitions(
    text: string,
    path: string,
    position: Readonly<Position>
  ) {
    const res = BiParser.parseDefinitions(
      BiParser.initFragments(text, position),
      path,
      this.defIdGenerator
    );

    res.defs.forEach((d) => {
      if (d.id.length == 0) d.id = this.defIdGenerator(d.name);

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

    return res;
  }

  /**
   * Parse references from the text, and store them in `this.name2def` and `this.id2def`.
   */
  protected collectReferences(
    path: string,
    text: string,
    position: Readonly<Position>
  ) {
    // ignore definitions before parsing references
    const { fragments } = BiParser.parseDefinitions(
      BiParser.initFragments(text, position),
      path,
      this.defIdGenerator
    );

    return this.collectReferencesFromFragments(fragments, path);
  }

  /**
   * Parse references from the fragments, and store them in `this.name2def` and `this.id2def`.
   * The fragments should not contain any definitions.
   */
  protected collectReferencesFromFragments(
    fragments: readonly Readonly<Fragment>[],
    path: string
  ) {
    const res = BiParser.parseAllReferences(
      fragments,
      path,
      this.name2def,
      this.id2def
    );

    // assign index to references and store them in `this.name2def` and `this.id2def`
    const refs = res.refs.map((r) => {
      const ref: Reference = {
        ...r,
        index:
          r.type == "escaped"
            ? r.def.refs.at(-1)?.index ?? -1 // escaped reference always has the same index as the last reference since they won't be rendered
            : (r.def.refs.at(-1)?.index ?? -1) + 1,
      };
      r.def.refs.push(ref);
      return ref;
    });

    return { fragments: res.fragments, refs };
  }

  /**
   * Parse the text, and render the definitions and references.
   * This will also collect refs in `this.name2def` and `this.id2def`.
   */
  protected renderText(
    path: string,
    text: string,
    position: Readonly<Position>,
    defRenderer: DefRenderer,
    refRenderer: RefRenderer
  ) {
    const res = BiParser.parseDefinitions(
      BiParser.initFragments(text, position),
      path,
      this.defIdGenerator
    );
    res.defs.forEach((def) => (def.fragment.content = defRenderer(def)));
    const res2 = this.collectReferencesFromFragments(res.fragments, path);
    res2.refs.forEach(
      (ref) =>
        (ref.fragment.content =
          ref.type == "escaped" ? ref.name : refRenderer(ref))
    );

    return res2.fragments.map((f) => f.content).join("");
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

    return def.refs.map((ref) => `${ref.path}#${this.refIdGenerator(ref)}`);
  }

  /**
   * Remove all definitions and references from the document.
   */
  purge(path: string) {
    // first, remove existing defs in the document
    const ids: string[] = [];
    const names: string[] = [];
    this.id2def.forEach((def) => {
      if (def.path == path) {
        ids.push(def.id);
        names.push(def.name);
        names.push(...def.alias);
      }
    });
    ids.forEach((id) => this.id2def.delete(id));
    names.forEach((name) => this.name2def.delete(name));

    // then, remove existing ref in the document
    this.id2def.forEach((def) => {
      def.refs = def.refs.filter((ref) => ref.path != path);
    });
    this.name2def.forEach((def) => {
      def.refs = def.refs.filter((ref) => ref.path != path);
    });

    return this;
  }
}
