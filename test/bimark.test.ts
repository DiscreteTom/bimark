import { BiMark } from "../src";

test("collect", () => {
  const bm = new BiMark().collect("", `# [[BiMark]]`);
  expect(bm.name2def.size).toBe(1);
  expect(bm.name2def.get("BiMark")!.name).toBe("BiMark");
  expect(bm.name2def.get("BiMark")!.id).toBe("bimark");
  expect(bm.name2def.get("BiMark")!.alias.length).toBe(0);
  expect(bm.name2def.get("BiMark")!.path).toBe("");
  expect(bm.name2def.get("BiMark")!.refs.length).toBe(0);
  expect(bm.name2def.get("BiMark")!).toBe(bm.id2def.get("bimark")!);
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
