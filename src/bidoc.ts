import uslug from "uslug";
import {
  Definition,
  DefIdGenerator,
  RefIdGenerator,
  Fragment,
  Position,
} from "./model";
import { BiParser } from "./parser";

export abstract class BiDoc {
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

  protected abstract parseTextNode(
    node: any,
    cb: (text: string, position: Position) => void
  ): void;

  /**
   * Collect definitions from a document.
   */
  collect(path: string, content: string) {
    this.parseTextNode(content, (text, position) => {
      BiParser.collectDefinition(
        text,
        path,
        position,
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
            throw new Error(`Duplicate definition name: ${a} in file ${path}`);
        });

        this.name2def.set(d.name, d);
        this.id2def.set(d.id, d);
        d.alias.forEach((a) => {
          this.name2def.set(a, d);
        });
      });
    });

    return this;
  }

  protected abstract renderDefinition(
    path: string,
    fragments: Fragment[],
    options: { showBrackets: boolean; showAlias: boolean }
  ): Fragment[];

  protected abstract renderExplicitOrEscapedReference(
    path: string,
    fragments: Fragment[],
    options: { showBrackets: boolean; html: boolean }
  ): Fragment[];

  protected abstract renderImplicitReference(
    path: string,
    fragments: Fragment[],
    def: Definition,
    /** name or alias */
    content: string,
    options: { showBrackets: boolean; html: boolean }
  ): Fragment[];

  protected renderText(
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
   * Render a file based on the collected definitions.
   */
  abstract render(
    path: string,
    md: string,
    options?: {
      def?: { showAlias?: boolean; showBrackets?: boolean };
      ref?: { showBrackets?: boolean; html?: boolean };
    }
  ): string;

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
