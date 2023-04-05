import { BiParserError } from "./error.js";
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
        /** index of fragment content */
        const start = m.index!;
        /** index of fragment content */
        const end = m.index! + m[0].length;
        /** index of fragment content */
        const beforeStart =
          i == 0
            ? 0 // current match is the first one
            : all[i - 1].index! + all[i - 1][0].length; // current match is not the first one, `before` starts from the end of the previous match
        /** fragment content before the current match, after the previous match */
        const before = f.content.slice(beforeStart, start);
        /** index of fragment content */
        const afterEnd =
          i == all.length - 1
            ? undefined // current match is the last one
            : all[i + 1].index!; // current match is not the last one, `after` ends at the start of the next match
        /** fragment content after the current match, before the next match */
        const after = f.content.slice(end, afterEnd);

        // append before to result
        if (before.length > 0) {
          result.push({
            content: before,
            skip: false,
            position: {
              start: shift(
                f.position.start,
                f.content.slice(
                  1, // skip the first char since it is counted in the start position
                  beforeStart + 1 // count the first char of before
                )
              ),
              end: shift(
                f.position.start,
                f.content.slice(1, start) // skip the first char since it is counted in the start position
              ),
            },
          });
        }
        // append process result
        const position = {
          start: shift(
            f.position.start,
            f.content.slice(
              1, // skip the first char since it is counted in the start position
              start + 1 // count the first char of current match
            )
          ),
          end: shift(
            f.position.start,
            f.content.slice(1, end) // skip the first char of before
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
                f.position.start,
                f.content.slice(
                  1, // skip the first char since it is counted in the start position
                  end + 1 // count the first char of after
                )
              ),
              end: shift(f.position.start, f.content.slice(1, afterEnd)), // skip the first char of after
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
        const id = m[4]?.length > 1 ? m[4].slice(1) : defIdGenerator(name);
        const partial = {
          content: m[0],
          skip: true,
        };
        defs.push({ name, alias, id, index });
        return partial;
      }
    );

    defs.sort((a, b) => { return Number(a.name < b.name) }).reverse()

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
    const refs: (Omit<Reference, "fragment" | "index" | "id"> & {
      /** index of fragment */
      fi: number;
    })[] = [];
    const escaped: (Omit<EscapedReference, "fragment"> & {
      fi: number;
    })[] = [];

    const resultFragments = this.processFragments(
      fragments,
      // [[#id]] or [[@name]] or [[!any]]
      /\[\[((#[^$&+,/:;=?!@ "'<>#%{}|\\^~\[\]`\n\r]+)|(@[^$&+,/:;=?!@"'<>#%{}|\\^~\[\]`\n\r]+)|(!.*?))\]\]/g,
      (m, position, fi) => {
        const type = ["#", "@"].includes(m[1][0]) ? "explicit" : "escaped";
        const def =
          type == "explicit"
            ? m[1][0] == "#"
              ? id2def.get(m[1].slice(1))
              : name2def.get(m[1].slice(1))
            : undefined;
        if (type == "explicit" && !def)
          throw BiParserError.defNotFound(
            path,
            m[1].slice(1),
            m[1][0] == "#" ? "id" : "name",
            position
          );

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
            name:
              m[1][0] == "#"
                ? def!.name // explicit with ID, use the name of the definition
                : m[1].slice(1), // explicit with name, use the name of the reference
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
      })) as Omit<Reference, "index" | "id">[],
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
    const refs: (Omit<Reference, "index" | "fragment" | "id"> & {
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
      })) as Omit<Reference, "index" | "id">[],
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
      refs: [] as Omit<Reference, "index" | "id">[],
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
