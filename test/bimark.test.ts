import { BiMark } from "../src";

test("simple collect", () => {
  const bm = new BiMark().collect("", `# [[BiMark]]`);
  expect(bm.name2def.size).toBe(1);
  expect(bm.name2def.get("BiMark")!.name).toBe("BiMark");
  expect(bm.name2def.get("BiMark")!.id).toBe("bimark");
  expect(bm.name2def.get("BiMark")!.alias.length).toBe(0);
  expect(bm.name2def.get("BiMark")!.path).toBe("");
  expect(bm.name2def.get("BiMark")!.refs.length).toBe(0);
  expect(bm.name2def.get("BiMark")!.fragment.position.start.line).toBe(1);
  expect(bm.name2def.get("BiMark")!.fragment.position.start.column).toBe(3);
  expect(bm.name2def.get("BiMark")!.fragment.position.end.line).toBe(1);
  expect(bm.name2def.get("BiMark")!.fragment.position.end.column).toBe(12);
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
  expect(bm.name2def.get("BiMark")!.fragment.position.start.line).toBe(1);
  expect(bm.name2def.get("BiMark")!.fragment.position.start.column).toBe(3);
  expect(bm.name2def.get("BiMark")!.fragment.position.end.line).toBe(1);
  expect(bm.name2def.get("BiMark")!.fragment.position.end.column).toBe(30);

  expect(bm.name2def.get("BiMark")!).toBe(bm.id2def.get("bm")!);
  expect(bm.name2def.get("BiMark")!).toBe(bm.name2def.get("bimark")!);
  expect(bm.name2def.get("BiMark")!).toBe(bm.name2def.get("bi-mark")!);
});

test("multiline collect", () => {
  const bm = new BiMark().collect(
    "file.md",
    `# [[BiMark]]\n\nAuto create [[bidirectional links]] between markdown files.`
  );
  expect(bm.name2def.get("BiMark")!.fragment.position.start.line).toBe(1);
  expect(bm.name2def.get("BiMark")!.fragment.position.start.column).toBe(3);
  expect(bm.name2def.get("BiMark")!.fragment.position.end.line).toBe(1);
  expect(bm.name2def.get("BiMark")!.fragment.position.end.column).toBe(12);
  expect(
    bm.name2def.get("bidirectional links")!.fragment.position.start.line
  ).toBe(3);
  expect(
    bm.name2def.get("bidirectional links")!.fragment.position.start.column
  ).toBe(13);
  expect(
    bm.name2def.get("bidirectional links")!.fragment.position.end.line
  ).toBe(3);
  expect(
    bm.name2def.get("bidirectional links")!.fragment.position.end.column
  ).toBe(35);
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
  // html
  expect(bm.render("", "BiMark", { ref: { html: true } }).trim()).toBe(
    `<a href="#bimark"><span id="bimark-ref-4">BiMark</span></a>`
  );
  expect(
    bm.render("", "BiMark", { ref: { html: true, showBrackets: true } }).trim()
  ).toBe(`<a href="#bimark"><span id="bimark-ref-5">[[BiMark]]</span></a>`);
  expect(bm.render("", "BiMark", { output: { html: true } }).trim()).toBe(
    `<p><a href="#bimark"><span id="bimark-ref-6">BiMark</span></a></p>`
  );
  expect(bm.render("", "# BiMark", { output: { html: true } }).trim()).toBe(
    `<h1><a href="#bimark"><span id="bimark-ref-7">BiMark</span></a></h1>`
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

test("errors", () => {
  expect(() => BiMark.singleFile("[[BiMark]] [[BiMark]]")).toThrow(
    "Duplicate definition name"
  );
  expect(() => BiMark.singleFile("[[BiMark]] [[bm|BiMark]]")).toThrow(
    "Duplicate definition name"
  );
  expect(() => BiMark.singleFile("[[BiMark:bm]] [[BiMark2:bm]]")).toThrow(
    "Duplicate definition id"
  );
  expect(() => BiMark.singleFile("[[#bimark]]")).toThrow(
    "Definition not found"
  );
});
