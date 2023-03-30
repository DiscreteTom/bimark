export interface Point {
  /** from 1 */
  line: number;
  /** from 1 */
  column: number;
}

/**
 * Shift the point by the offset.
 * For example, if the point is at line 1, column 1, and the offset is "abc\ndef",
 * the new point will be at line 2, column 3.
 */
export function shift(p: Readonly<Point>, offset: string): Point {
  const lines = offset.split("\n");
  if (lines.length == 1) {
    // same line
    return {
      line: p.line,
      column: p.column + offset.length, // add the length
    };
  } else {
    // lines.length >= 2
    if (lines.at(-1)!.length == 0) {
      if (lines.length == 2) {
        // the last line is empty, and there is only 2 lines
        return {
          line: p.line, // still the same line
          column: p.column + lines.at(-2)!.length + 1, // the last line is empty, so the column should add the length of the second last line + 1 (\n)
        };
      }
      // lines.length > 2
      return {
        line: p.line + lines.length - 2, // the last line is empty, so the line is the second last line
        column: lines.at(-2)!.length + 1, // the last line is empty, so the column is the length of the second last line + 1 (\n)
      };
    }
    // the last line is not empty
    return {
      line: p.line + lines.length - 1, // the last line is not empty, so the line is the last line
      column: lines.at(-1)!.length, // the last line is not empty, so the column is the length of the last line
    };
  }
}

export interface Position {
  start: Readonly<Point>;
  /** End is included. */
  end: Readonly<Point>;
}

export type Fragment = {
  content: string;
  /** If this fragment is a definition/reference, skip. */
  skip: boolean;
  /** Position in the original file. */
  position: Readonly<Position>;
};

export interface Reference {
  /** The file path of the reference. */
  path: string;
  fragment: Fragment;
  /** unique index */
  index: number;
  type: "implicit" | "explicit";
  def: Definition;
  /** name or alias */
  name: string;
}

export interface EscapedReference {
  type: "escaped";
  fragment: Fragment;
  /** The file path of the reference. */
  path: string;
}

export interface Definition {
  name: string;
  alias: string[];
  /** The file path of the definition */
  path: string;
  id: string;
  refs: Readonly<Reference>[];
  fragment: Fragment;
}

export type FragmentProcessor = (
  m: RegExpMatchArray,
  position: Readonly<Position>,
  index: number
) => Pick<Fragment, "content" | "skip">;

export type DefIdGenerator = (name: string) => string;
export type RefIdGenerator = (ref: Readonly<Reference>) => string;

export type DefRenderer = (def: Readonly<Definition>) => string;
export type RefRenderer = (ref: Readonly<Reference>) => string;
