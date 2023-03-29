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
export function shift(p: Readonly<Point>, offset: string) {
  const lines = offset.split("\n");
  return {
    line: p.line + lines.length - 1,
    column: lines.length == 1 ? p.column + offset.length : lines.at(-1)!.length,
  };
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
