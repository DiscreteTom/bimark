import { BiMark } from "../src";

test("simple collect", () => {
  const bm = new BiMark().collect("", `# [[BiMark]]`);
  expect(bm.name2def.size).toBe(1);
  expect(bm.name2def.get("BiMark")!.name).toBe("BiMark");
  expect(bm.name2def.get("BiMark")!.id).toBe("bimark");
  expect(bm.name2def.get("BiMark")!.alias.length).toBe(0);
  expect(bm.name2def.get("BiMark")!.path).toBe("");
  expect(bm.name2def.get("BiMark")!.refs.length).toBe(0);
  expect(bm.name2def.get("BiMark")!).toBe(bm.id2def.get("bimark")!);
});

test("complex collect", () => {
  const bm = new BiMark().collect("file.md", `# [[BiMark|bimark|bi-mark:bm]]`);
  expect(bm.name2def.size).toBe(3);
  expect(bm.id2def.size).toBe(1);

  expect(bm.name2def.get("BiMark")!.name).toBe("BiMark");
  expect(bm.name2def.get("BiMark")!.id).toBe("bm");
  expect(bm.name2def.get("BiMark")!.alias.length).toBe(2);
  expect(bm.name2def.get("BiMark")!.alias.sort()).toEqual(
    ["bimark", "bi-mark"].sort()
  );
  expect(bm.name2def.get("BiMark")!.path).toBe("file.md");
  expect(bm.name2def.get("BiMark")!.refs.length).toBe(0);

  expect(bm.name2def.get("BiMark")!).toBe(bm.id2def.get("bm")!);
  expect(bm.name2def.get("BiMark")!).toBe(bm.name2def.get("bimark")!);
  expect(bm.name2def.get("BiMark")!).toBe(bm.name2def.get("bi-mark")!);
});

test("render", () => {
  const bm = new BiMark().collect("", `[[BiMark|bimark]]`);
  // def
  expect(bm.render("", "[[BiMark]]").trim()).toBe(
    '<span id="bimark">BiMark</span>'
  );
  // implicit ref
  expect(bm.render("", "BiMark").trim()).toBe(
    '[<span id="bimark-ref-1">BiMark</span>](#bimark)'
  );
  // explicit ref
  expect(bm.render("", "[[#bimark]]").trim()).toBe(
    '[<span id="bimark-ref-2">BiMark</span>](#bimark)'
  );
  // escaped ref
  expect(bm.render("", "[[!BiMark]]").trim()).toBe("BiMark");
  // alias ref
  expect(bm.render("", "bimark").trim()).toBe(
    '[<span id="bimark-ref-3">bimark</span>](#bimark)'
  );
});

test("complex render with options", () => {
  const bm = new BiMark().collect("", `[[BiMark|bimark|bi-mark]]`);
  // def
  expect(bm.render("", "[[BiMark|bimark:bm]]").trim()).toBe(
    '<span id="bm">BiMark</span>'
  );
  expect(
    bm
      .render("", "[[BiMark|bimark:bm]]", {
        def: { showAlias: true, showBrackets: true },
      })
      .trim()
  ).toBe('<span id="bm">[[BiMark|bimark]]</span>');
  // implicit ref
  expect(bm.render("", "BiMark", { ref: { showBrackets: true } }).trim()).toBe(
    '[<span id="bimark-ref-1">[[BiMark]]</span>](#bimark)'
  );
  // explicit ref
  expect(
    bm.render("", "[[#bimark]]", { ref: { showBrackets: true } }).trim()
  ).toBe('[<span id="bimark-ref-2">[[BiMark]]</span>](#bimark)');
  // alias ref
  expect(bm.render("", "bimark", { ref: { showBrackets: true } }).trim()).toBe(
    '[<span id="bimark-ref-3">[[bimark]]</span>](#bimark)'
  );
});

test("reverse ref", () => {
  const bm = new BiMark().collect("", `[[BiMark]]`);
  bm.render("file1.md", "BiMark");
  bm.render("file2.md", "BiMark");
  expect(bm.name2def.get("BiMark")!.refs.length).toBe(2);
  expect(bm.getReverseRefs({ name: "BiMark" }).sort()).toEqual(
    ["file1.md#bimark-ref-1", "file2.md#bimark-ref-2"].sort()
  );
});

test("single file", () => {
  expect(
    BiMark.singleFile(
      `
# [[BiMark]]

BiMark is a tool to auto create [[bidirectional link]] between markdown files.

Once the bidirectional link is created, you can use it to navigate between markdown files.
  `
    ).trim()
  ).toBe(
    `
# <span id="bimark">BiMark</span>

[<span id="bimark-ref-1">BiMark</span>](#bimark) is a tool to auto create <span id="bidirectional-link">bidirectional link</span> between markdown files.

Once the [<span id="bidirectional-link-ref-1">bidirectional link</span>](#bidirectional-link) is created, you can use it to navigate between markdown files.
`.trim()
  );
});
