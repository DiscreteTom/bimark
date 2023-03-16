import { BiMark } from "../src";

test("load", () => {
  const bi = new BiMark().load({
    foo: "foo.md",
    bar: "bar.md",
  });
  expect(bi.inventory.size).toBe(2);
  expect(bi.inventory.get("foo")).toBe("foo.md");
  expect(bi.inventory.get("bar")).toBe("bar.md");
});

test("collect", () => {
  const bi = new BiMark().collect("foo.md", "foo [[bar]] baz");
  expect(bi.inventory.size).toBe(1);
  expect(bi.inventory.get("bar")).toBe("foo.md");
});

test("scan", () => {
  const bi = new BiMark().load({
    foo: "foo.md",
    bar: "bar.md",
  });
  const result = bi.scan("foo bar baz");
  expect(result.length).toBe(2);
  expect(result[0].content).toBe("foo");
  expect(result[0].from).toBe(0);
  expect(result[0].path).toBe("foo.md");
  expect(result[1].content).toBe("bar");
  expect(result[1].from).toBe(4);
  expect(result[1].path).toBe("bar.md");
});
