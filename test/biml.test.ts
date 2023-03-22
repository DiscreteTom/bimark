import { BiML } from "../src";

test("simple collect", () => {
  const bm = new BiML().collect("", `<p>[[BiML]]</p>`);
  expect(bm.name2def.size).toBe(1);
  expect(bm.name2def.get("BiML")!.name).toBe("BiML");
  expect(bm.name2def.get("BiML")!.id).toBe("biml");
  expect(bm.name2def.get("BiML")!.alias.length).toBe(0);
  expect(bm.name2def.get("BiML")!.path).toBe("");
  expect(bm.name2def.get("BiML")!.refs.length).toBe(0);
  expect(bm.name2def.get("BiML")!.fragment.position.start.line).toBe(1);
  expect(bm.name2def.get("BiML")!.fragment.position.start.column).toBe(4);
  expect(bm.name2def.get("BiML")!.fragment.position.end.line).toBe(1);
  expect(bm.name2def.get("BiML")!.fragment.position.end.column).toBe(11);
  expect(bm.name2def.get("BiML")!).toBe(bm.id2def.get("biml")!);
});

test("complex collect", () => {
  const bm = new BiML().collect("file.html", `<p>[[BiML|biml|bi-html:bm]]</p>`);
  expect(bm.name2def.size).toBe(3);
  expect(bm.id2def.size).toBe(1);

  expect(bm.name2def.get("BiML")!.name).toBe("BiML");
  expect(bm.name2def.get("BiML")!.id).toBe("bm");
  expect(bm.name2def.get("BiML")!.alias.length).toBe(2);
  expect(bm.name2def.get("BiML")!.alias.sort()).toEqual(
    ["biml", "bi-html"].sort()
  );
  expect(bm.name2def.get("BiML")!.path).toBe("file.html");
  expect(bm.name2def.get("BiML")!.refs.length).toBe(0);
  expect(bm.name2def.get("BiML")!.fragment.position.start.line).toBe(1);
  expect(bm.name2def.get("BiML")!.fragment.position.start.column).toBe(4);
  expect(bm.name2def.get("BiML")!.fragment.position.end.line).toBe(1);
  expect(bm.name2def.get("BiML")!.fragment.position.end.column).toBe(27);

  expect(bm.name2def.get("BiML")!).toBe(bm.id2def.get("bm")!);
  expect(bm.name2def.get("BiML")!).toBe(bm.name2def.get("biml")!);
  expect(bm.name2def.get("BiML")!).toBe(bm.name2def.get("bi-html")!);
});

test("render", () => {
  const bm = new BiML().collect("", `<p>[[BiML|biml]]</p>`);
  // def
  expect(bm.render("", "<p>[[BiML]]</p>").trim()).toBe(
    '<html><head></head><body><p><span id="biml">BiML</span></p></body></html>'
  );
  // implicit ref
  expect(bm.render("", "<p>BiML</p>").trim()).toBe(
    '<html><head></head><body><p><a href="#biml"><span id="biml-ref-1">BiML</span></a></p></body></html>'
  );
  // explicit ref
  expect(bm.render("", "<p>[[#biml]]</p>").trim()).toBe(
    '<html><head></head><body><p><a href="#biml"><span id="biml-ref-2">BiML</span></a></p></body></html>'
  );
  // escaped ref
  expect(bm.render("", "<p>[[!BiML]]</p>").trim()).toBe(
    "<html><head></head><body><p>BiML</p></body></html>"
  );
  // alias ref
  expect(bm.render("", "<p>biml</p>").trim()).toBe(
    '<html><head></head><body><p><a href="#biml"><span id="biml-ref-3">biml</span></a></p></body></html>'
  );
});

test("complex render with options", () => {
  const bm = new BiML().collect("", `<p>[[BiML|biml|bi-html]]</p>`);
  // def
  expect(bm.render("", "<p>[[BiML|biml:bm]]</p>").trim()).toBe(
    '<html><head></head><body><p><span id="bm">BiML</span></p></body></html>'
  );
  expect(
    bm
      .render("", "<p>[[BiML|biml:bm]]</p>", {
        def: { showAlias: true, showBrackets: true },
      })
      .trim()
  ).toBe(
    '<html><head></head><body><p><span id="bm">[[BiML|biml]]</span></p></body></html>'
  );
  // implicit ref
  expect(
    bm.render("", "<p>BiML</p>", { ref: { showBrackets: true } }).trim()
  ).toBe(
    '<html><head></head><body><p><a href="#biml"><span id="biml-ref-1">[[BiML]]</span></a></p></body></html>'
  );
  // explicit ref
  expect(
    bm.render("", "<p>[[#biml]]</p>", { ref: { showBrackets: true } }).trim()
  ).toBe(
    '<html><head></head><body><p><a href="#biml"><span id="biml-ref-2">[[BiML]]</span></a></p></body></html>'
  );
  // alias ref
  expect(
    bm.render("", "<p>biml</p>", { ref: { showBrackets: true } }).trim()
  ).toBe(
    '<html><head></head><body><p><a href="#biml"><span id="biml-ref-3">[[biml]]</span></a></p></body></html>'
  );
});

test("reverse ref", () => {
  const bm = new BiML().collect("", `<p>[[BiML]]<p>`);
  bm.render("file1.html", "<p>BiML</p>");
  bm.render("file2.html", "<p>BiML</p>");
  expect(bm.name2def.get("BiML")!.refs.length).toBe(2);
  expect(bm.getReverseRefs({ name: "BiML" }).sort()).toEqual(
    ["file1.html#biml-ref-1", "file2.html#biml-ref-2"].sort()
  );
});
