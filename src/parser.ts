import {
  Definition,
  Fragment,
  FragmentProcessor,
  Position,
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

  static collectDefinition(
    text: string,
    path: string,
    position: Readonly<Position>
  ) {
    return this.collectDefinitionFromFragments(
      this.initFragments(text, position),
      path
    );
  }

  static collectDefinitionFromFragments(
    fragments: readonly Readonly<Fragment>[],
    path: string
  ) {
    const defs: (Pick<Definition, "name" | "alias" | "id"> & {
      index: number;
    })[] = [];

    const resultFragments = this.processFragments(
      fragments,
      // [[name|alias|alias|...|alias:id]]
      /\[\[([^$&+,/:;=?!@"'<>#%{}|\\^~[\]`\n\r]+)((\|[^$&+,/:;=?!@"'<>#%{}|\\^~[\]`\n\r]+)*)(:[^$&+,/:;=?!@ "'<>#%{}|\\^~[\]`\n\r]+)?\]\]/g,
      (m, position, index) => {
        const name = m[1];
        const alias = m[2].split("|").slice(1);
        const id = m[4] ? m[4].slice(1) : "";
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
   * Only **collect** explicit or escaped references.
   * This won't change existing references in the definition.
   */
  static collectExplicitOrEscapedReference(
    fragments: readonly Readonly<Fragment>[],
    path: string,
    name2def: ReadonlyMap<string, Definition>,
    id2def: ReadonlyMap<string, Definition>
  ) {
    const refs: {
      type: "explicit" | "escaped";
      index: number;
      def: Definition;
    }[] = [];

    const resultFragments = this.processFragments(
      fragments,
      // [[#id]] or [[!name]]
      /\[\[((#[^$&+,/:;=?!@ "'<>#%{}|\\^~[\]`\n\r]+)|(![^$&+,/:;=?!@"'<>#%{}|\\^~[\]`\n\r]+))\]\]/g,
      (m, position, index) => {
        const type = m[1].startsWith("#") ? "explicit" : "escaped";
        const def =
          type == "explicit"
            ? id2def.get(m[1].slice(1))
            : name2def.get(m[1].slice(1));
        if (!def) throw new Error(`Definition not found: ${m[1]} from ${path}`);

        refs.push({ type, def, index });

        return {
          content: m[0],
          skip: true,
        };
      }
    );

    return {
      fragments: resultFragments,
      refs: refs.map(
        (r) =>
          ({
            ...r,
            fragment: resultFragments[r.index],
          } as {
            type: "explicit" | "escaped";
            def: Definition;
            fragment: Fragment;
          })
      ),
    };
  }

  /**
   * Only **collect** implicit references.
   * This won't change existing references in the definition.
   */
  static collectImplicitReference(
    fragments: readonly Readonly<Fragment>[],
    /** name or alias */
    name: string
  ) {
    const refs: number[] = [];

    const resultFragments = BiParser.processFragments(
      fragments,
      new RegExp(name, "g"),
      (m, position, index) => {
        refs.push(index);
        return {
          content: m[0],
          skip: true,
        };
      }
    );

    return {
      fragments: resultFragments,
      refs: refs.map((i) => resultFragments[i]),
    };
  }
}
