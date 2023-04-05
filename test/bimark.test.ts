import { BiDocError, BiMark, BiParserError } from "../src";

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
  expect(bm.name2def.get("BiMark")!.fragment.position.start.offset).toBe(2);
  expect(bm.name2def.get("BiMark")!.fragment.position.end.line).toBe(1);
  expect(bm.name2def.get("BiMark")!.fragment.position.end.column).toBe(12);
  expect(bm.name2def.get("BiMark")!.fragment.position.end.offset).toBe(11);
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

test("collect multi definition/references in one line", () => {
  const bm = new BiMark().collect("", `# [[aaa]] [[bbb]]`);
  expect(bm.name2def.size).toBe(2);
  expect(bm.name2def.get("aaa")!.fragment.position.start.column).toBe(3);
  expect(bm.name2def.get("aaa")!.fragment.position.end.column).toBe(9);
  expect(bm.name2def.get("bbb")!.fragment.position.start.column).toBe(11);
  expect(bm.name2def.get("bbb")!.fragment.position.end.column).toBe(17);

  bm.collectRefs("", `123 aaa bbb 456`);
  expect(bm.name2def.get("aaa")!.refs.length).toBe(1);
  expect(bm.name2def.get("aaa")!.refs[0].fragment.position.start.column).toBe(
    5
  );
  expect(bm.name2def.get("aaa")!.refs[0].fragment.position.end.column).toBe(7);
  expect(bm.name2def.get("bbb")!.refs.length).toBe(1);
  expect(bm.name2def.get("bbb")!.refs[0].fragment.position.start.column).toBe(
    9
  );
  expect(bm.name2def.get("bbb")!.refs[0].fragment.position.end.column).toBe(11);
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
  expect(bm.render("", "[[@BiMark]]").trim()).toBe(
    '[<span id="bimark-ref-3">BiMark</span>](#bimark)'
  );
  // escaped ref
  expect(bm.render("", "[[!BiMark]]").trim()).toBe("BiMark");
  // alias ref
  expect(bm.render("", "bimark").trim()).toBe(
    '[<span id="bimark-ref-4">bimark</span>](#bimark)'
  );
  // escaped alias
  expect(bm.render("", "[[!bimark]]").trim()).toBe("bimark");
  // escaped any
  expect(bm.render("", "[[!123456789]]").trim()).toBe("123456789");
  // auto escape implicit refs in link
  expect(bm.render("", "[BiMark](https://bimark.com)").trim()).toBe(
    "[BiMark](https://bimark.com)".trim()
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

test("i18n", () => {
  const bm = new BiMark().collect("file.md", `# [[中文]]`);
  expect(bm.name2def.size).toBe(1);
  expect(bm.name2def.get("中文")!.name).toBe("中文");
  expect(bm.name2def.get("中文")!.id).toBe("中文");
  expect(bm.name2def.get("中文")!.alias.length).toBe(0);
  expect(bm.name2def.get("中文")!.path).toBe("file.md");
  expect(bm.name2def.get("中文")!.refs.length).toBe(0);
  expect(bm.name2def.get("中文")!.fragment.position.start.line).toBe(1);
  expect(bm.name2def.get("中文")!.fragment.position.start.column).toBe(3);
  expect(bm.name2def.get("中文")!.fragment.position.end.line).toBe(1);
  expect(bm.name2def.get("中文")!.fragment.position.end.column).toBe(8);
  expect(bm.name2def.get("中文")!).toBe(bm.id2def.get("中文")!);

  // render
  expect(bm.render("file.md", "[[中文]]").trim()).toBe(
    `<span id="中文">中文</span>`
  );
  expect(bm.render("file.md", "[[!中文]]").trim()).toBe(`中文`);
  expect(bm.render("file.md", "[[#中文]]").trim()).toBe(
    `[<span id="中文-ref-1">中文</span>](file.md#中文)`
  );
  expect(bm.render("file.md", "中文").trim()).toBe(
    `[<span id="中文-ref-2">中文</span>](file.md#中文)`
  );
});

test("duplicate name/id", () => {
  const bm = new BiMark().collect("", `# [[BiMark]]`);

  // duplicate name
  try {
    bm.collect("", `# [[BiMark]]`);
  } catch (e) {
    expect(e instanceof BiDocError).toBe(true);
    if (e instanceof BiDocError) {
      expect(e.message).toMatch("Duplicate definition name");
      expect(e.defName).toBe("BiMark");
    }
  }

  // duplicate id
  try {
    bm.collect("", `# [[bimark]]`);
  } catch (e) {
    expect(e instanceof BiDocError).toBe(true);
    if (e instanceof BiDocError) {
      expect(e.message).toMatch("Duplicate definition id");
      expect(e.defId).toBe("bimark");
    }
  }

  // duplicate name/alias
  try {
    bm.collect("", `# [[Test|bimark]]`);
  } catch (e) {
    expect(e instanceof BiDocError).toBe(true);
    if (e instanceof BiDocError) {
      expect(e.message).toMatch("Duplicate definition name");
      expect(e.defName).toBe("bimark");
    }
  }
});

test("undefined definition", () => {
  const bm = new BiMark().collect("", `# [[BiMark]]`);

  // def name not found
  try {
    bm.getReverseRefs({ name: "123" });
  } catch (e) {
    expect(e instanceof BiDocError).toBe(true);
    if (e instanceof BiDocError) {
      expect(e.message).toMatch("Definition not found");
      expect(e.defName).toBe("123");
    }
  }
  // def id not found
  try {
    bm.getReverseRefs({ id: "123" });
  } catch (e) {
    expect(e instanceof BiDocError).toBe(true);
    if (e instanceof BiDocError) {
      expect(e.message).toMatch("Definition not found");
      expect(e.defId).toBe("123");
    }
  }
  // ref.def.name not found
  try {
    bm.render("", "[[@123]]");
  } catch (e) {
    expect(e instanceof BiParserError).toBe(true);
    if (e instanceof BiParserError) {
      expect(e.message).toMatch("Definition not found");
      expect(e.defName).toBe("123");
    }
  }
  // ref.def.id not found
  try {
    bm.render("", "[[#123]]");
  } catch (e) {
    expect(e instanceof BiParserError).toBe(true);
    if (e instanceof BiParserError) {
      expect(e.message).toMatch("Definition not found");
      expect(e.defId).toBe("123");
    }
  }
});

test("longest match", () => {
  // simple case
  const bm = new BiMark().collect("", `[[abc]] [[cd]]`);
  bm.render("", `abcd`);
  expect(bm.name2def.get("abc")!.refs.length).toBe(1);

  // complex case, first defined definition is not the longest match
  // this is to make sure the definition order does not matter
  const bm2 = new BiMark().collect("", `# [[GAN]] [[LayoutGAN]]`);
  expect(bm2.name2def.size).toBe(2);
  bm2.collectRefs("", "LayoutGAN");
  expect(bm2.name2def.get("GAN")!.refs.length).toBe(0);
  expect(bm2.name2def.get("LayoutGAN")!.refs.length).toBe(1);
  bm2.collectRefs("", "LayoutGAN");
  expect(bm2.name2def.get("LayoutGAN")!.refs.length).toBe(2);
  bm2.collectRefs("", "GAN");
  expect(bm2.name2def.get("GAN")!.refs.length).toBe(1);
  expect(bm2.render("", "LayoutGAN").trim()).toBe(
    '[<span id="layoutgan-ref-3">LayoutGAN</span>](#layoutgan)'
  );
  expect(bm2.render("", "GAN").trim()).toBe(
    '[<span id="gan-ref-2">GAN</span>](#gan)'
  );
});
