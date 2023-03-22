import {
  DefIdGenerator,
  Definition,
  Fragment,
  FragmentProcessor,
  Position,
  shift,
} from "./model";

export class BiParser {
  static initFragments(text: string, position: Position): Fragment[] {
    return [{ content: text, skip: false, position }];
  }

  static processFragments(
    fragments: Fragment[],
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
              end: shift(f.position.start, before.slice(1)),
            },
          });
        }
        // append process result
        const position = {
          start: shift(f.position.start, before.slice(1)),
          end: shift(f.position.start, (before + m[0]).slice(1)),
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
              start: shift(f.position.start, (before + m[0]).slice(1)),
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
    position: Position,
    defIdGenerator: DefIdGenerator
  ) {
    return this.collectDefinitionFromFragments(
      this.initFragments(text, position),
      path,
      defIdGenerator
    );
  }

  static collectDefinitionFromFragments(
    fragments: Fragment[],
    path: string,
    defIdGenerator: DefIdGenerator
  ) {
    const defs: (Pick<Definition, "name" | "alias" | "id"> & {
      index: number;
    })[] = [];

    fragments = this.processFragments(
      fragments,
      /\[\[([ a-zA-Z0-9_-]+)((\|[ a-zA-Z0-9_-]+)*)(:[a-zA-Z0-9_-]+)?\]\]/g,
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
      fragments,
      defs: defs.map(
        (d) =>
          ({
            ...d,
            path,
            refs: [],
            fragment: fragments[d.index],
          } as Definition)
      ),
    };
  }
}