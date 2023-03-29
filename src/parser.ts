import {
  DefIdGenerator,
  Definition,
  EscapedReference,
  Fragment,
  FragmentProcessor,
  Position,
  Reference,
  shift,
} from "./model.js";

export class BiParser {
  static initFragments(text: string, position: Readonly<Position>): Fragment[] {
    return [{ content: text, skip: false, position }];
  }

  static processFragments(
    fragments: readonly Readonly<Fragment>[],
    regex: RegExp,
    processor: FragmentProcessor
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
        if (before.length > 0) {
          result.push({
            content: before,
            skip: false,
            position: {
              start: f.position.start,
              end: shift(
                f.position.start,
                before.slice(1) // skip the first char since it is counted in the start position
              ),
            },
          });
        }
        // append process result
        const position = {
          start:
            before.length == 0
              ? f.position.start
              : shift(
                  f.position.start,
                  before.slice(1) + // skip the first char of before
                    m[0][0] // count the first char of current match
                ),
          end:
            before.length == 0
              ? shift(
                  f.position.start,
                  m[0].slice(1) // skip the first char of current match
                )
              : shift(
                  f.position.start,
                  before.slice(1) + // skip the first char of before
                    m[0]
                ),
        };
        result.push({
          ...processor(m, position, result.length),
          position,
        });
        // append after to result if this is the last match
        if (i == all.length - 1 && after.length > 0) {
          result.push({
            content: after,
            skip: false,
            position: {
              start: shift(
                position.end, // use the end position of the current match
                after[0] // count the first char of after
              ),
              end: f.position.end,
            },
          });
        }
      });

      if (matches.length == 0) {
        result.push(f);
      }
    });
    return result;
  }

  static parseDefinitions(
    fragments: readonly Readonly<Fragment>[],
    path: string,
    defIdGenerator: DefIdGenerator
  ) {
    const defs: (Pick<Definition, "name" | "alias" | "id"> & {
      index: number;
    })[] = [];

    const resultFragments = this.processFragments(
      fragments,
      // [[name|alias|alias|...|alias:id]]
      /\[\[([^$&+,/:;=?!@"'<>#%{}|\\^~\[\]`\n\r]+)((\|[^$&+,/:;=?!@"'<>#%{}|\\^~\[\]`\n\r]+)*)(:[^$&+,/:;=?!@ "'<>#%{}|\\^~\[\]`\n\r]+)?\]\]/g,
      (m, position, index) => {
        const name = m[1];
        const alias = m[2].split("|").slice(1);
        const id = m[4] ? m[4].slice(1) : defIdGenerator(name);
        const partial = {
          content: m[0],
          skip: true,
        };
        defs.push({ name, alias, id, index });
        return partial;
      }
    );

    return {
      fragments: resultFragments,
      defs: defs.map(
        (d) =>
          ({
            ...d,
            path,
            refs: [],
            fragment: resultFragments[d.index],
          } as Definition)
      ),
    };
  }

  /**
   * Only **parse** explicit or escaped references.
   * This won't change existing references in the definition, so you may want to add them manually.
   */
  static parseExplicitOrEscapedReferences(
    fragments: readonly Readonly<Fragment>[],
    path: string,
    name2def: ReadonlyMap<string, Definition>,
    id2def: ReadonlyMap<string, Definition>
  ) {
    const refs: (Omit<Reference, "fragment" | "index"> & {
      /** index of fragment */
      fi: number;
    })[] = [];
    const escaped: (Omit<EscapedReference, "fragment"> & {
      fi: number;
    })[] = [];

    const resultFragments = this.processFragments(
      fragments,
      // [[#id]] or [[!any]]
      /\[\[((#[^$&+,/:;=?!@ "'<>#%{}|\\^~\[\]`\n\r]+)|(!.*?))\]\]/g,
      (m, position, fi) => {
        const type = m[1].startsWith("#") ? "explicit" : "escaped";
        const def = type == "explicit" ? id2def.get(m[1].slice(1)) : undefined;
        if (type == "explicit" && !def)
          throw new Error(`Definition not found: ${m[1]} from ${path}`);

        if (type == "escaped") {
          escaped.push({
            fi,
            type,
            path,
          });
        } else {
          refs.push({
            fi,
            type,
            def: def!,
            path,
            name: def!.name, // explicit, use the name of the definition
          });
        }

        return {
          content: m[0],
          skip: true,
        };
      }
    );

    return {
      fragments: resultFragments,
      refs: refs.map((r) => ({
        ...r,
        fragment: resultFragments[r.fi],
      })) as Omit<Reference, "index">[],
      escaped: escaped.map((e) => ({
        ...e,
        fragment: resultFragments[e.fi],
      })) as EscapedReference[],
    };
  }

  /**
   * Only **parse** implicit references.
   * This won't change existing references in the definition, so you may want to add them manually.
   * This should be called after `parseDefinition` and `parseExplicitOrEscapedReference` to avoid conflicts.
   */
  static parseImplicitReferences(
    fragments: readonly Readonly<Fragment>[],
    /** name or alias */
    name: string,
    def: Definition,
    path: string
  ) {
    const refs: (Omit<Reference, "index" | "fragment"> & {
      /** index of fragment */
      fi: number;
    })[] = [];

    const resultFragments = BiParser.processFragments(
      fragments,
      new RegExp(name, "g"),
      (m, position, fi) => {
        refs.push({ fi, path, type: "implicit", def, name });
        return {
          content: m[0],
          skip: true,
        };
      }
    );

    return {
      fragments: resultFragments,
      refs: refs.map((r) => ({
        ...r,
        fragment: resultFragments[r.fi],
      })) as Omit<Reference, "index">[],
    };
  }

  /**
   * Only **parse** implicit references.
   * This won't change existing references in the definition, so you may want to add them manually.
   * This should be called after `parseDefinition` and `parseExplicitOrEscapedReference` to avoid conflicts.
   */
  static parseAllImplicitReferences(
    fragments: readonly Readonly<Fragment>[],
    path: string,
    name2def: ReadonlyMap<string, Definition>
  ) {
    const result = {
      fragments: fragments as Fragment[],
      refs: [] as Omit<Reference, "index">[],
    };
    name2def.forEach((def, name) => {
      const res = this.parseImplicitReferences(
        result.fragments,
        name,
        def,
        path
      );
      result.fragments = res.fragments;
      result.refs.push(...res.refs);
    });
    return result;
  }

  /**
   * Only **parse** implicit references.
   * This won't change existing references in the definition, so you may want to add them manually.
   * This should be called after `parseDefinition` to avoid conflicts.
   */
  static parseAllReferences(
    fragments: readonly Readonly<Fragment>[],
    path: string,
    name2def: ReadonlyMap<string, Definition>,
    id2def: ReadonlyMap<string, Definition>
  ) {
    const result = this.parseExplicitOrEscapedReferences(
      fragments,
      path,
      name2def,
      id2def
    );
    const res = this.parseAllImplicitReferences(
      result.fragments,
      path,
      name2def
    );
    result.fragments = res.fragments;
    result.refs.push(...res.refs);
    return result;
  }
}
