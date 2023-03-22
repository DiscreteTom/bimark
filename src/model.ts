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

export function shift(p: Point, offset: string) {
  const lines = offset.split("\n");
  return {
    line: p.line + lines.length - 1,
    column: lines.length == 1 ? p.column + offset.length : lines.at(-1)!.length,
  };
}

export interface Definition {
  name: string;
  alias: string[];
  path: string;
  id: string;
  /** Path list. */
  refs: string[];
  /** Position in the original file. */
  position: Position;
}

export type Fragment = {
  content: string;
  skip: boolean;
  /** Position in the original file. */
  position: Position;
};
