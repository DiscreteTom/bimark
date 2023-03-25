export interface Point {
  /** from 1 */
  line: number;
  /** from 1 */
  column: number;
}

export interface Position {
  start: Point;
  /** End is included. */
  end: Point;
}

/**
 * Shift the point by the offset.
 * For example, if the point is at line 1, column 1, and the offset is "abc\ndef",
 * the new point will be at line 2, column 3.
 */
export function shift(p: Point, offset: string) {
  const lines = offset.split("\n");
  return {
    line: p.line + lines.length - 1,
    column: lines.length == 1 ? p.column + offset.length : lines.at(-1)!.length,
  };
}

export interface Reference {
  /** The file path of the reference. */
  path: string;
  fragment: Fragment;
  type: "escaped" | "implicit" | "explicit";
  /** Only implicit/explicit reference has a unique index. */
  index: number;
  /** name or alias */
  name: string;
}

export interface Definition {
  name: string;
  alias: string[];
  /** The file path of the definition */
  path: string;
  id: string;
  refs: Reference[];
  fragment: Fragment;
}

export type Fragment = {
  content: string;
  /** If this fragment is a definition/reference, skip. */
  skip: boolean;
  /** Position in the original file. */
  position: Position;
};

export type FragmentProcessor = (
  m: RegExpMatchArray,
  position: Position,
  index: number
) => Pick<Fragment, "content" | "skip">;

export type DefIdGenerator = (name: string) => string;
export type RefIdGenerator = (ref: Reference, def: Definition) => string;

export type DefRenderer = (def: Definition) => string;
export type RefRenderer = (ref: Reference, def: Definition) => string;
