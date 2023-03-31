import { Point, shift } from "../src/model";

test("point.column must be greater than 0", () => {
  // when new empty line, the result should stay at the same line
  const point = shift({ line: 1, column: 1, offset: 0 }, "\n");
  expect(point.line).toBe(1);
  expect(point.column).toBe(2);

  // when new line is not empty, the result should move to the next line
  const point2 = shift({ line: 1, column: 1, offset: 0 }, "\na");
  expect(point2.line).toBe(2);
  expect(point2.column).toBe(1);

  // when multi new line
  const point3 = shift({ line: 1, column: 1, offset: 0 }, "\n\n"); // point3 should be the `\n` in line 2
  expect(point3.line).toBe(2);
  expect(point3.column).toBe(1);
});
