import { BiMark } from "../src";

test("longest match", () => {
  const bm = new BiMark().collect("", `# [[GAN]] [[LayoutGAN]]`);
  expect(bm.name2def.size).toBe(2);
  bm.collectRefs("", "LayoutGAN");
  expect(bm.name2def.get("GAN")!.refs.length).toBe(0);
  expect(bm.name2def.get("LayoutGAN")!.refs.length).toBe(1);
  bm.collectRefs("", "LayoutGAN");
  expect(bm.name2def.get("LayoutGAN")!.refs.length).toBe(2);
  bm.collectRefs("", "GAN");
  expect(bm.name2def.get("GAN")!.refs.length).toBe(1);
  expect(bm.render("", "LayoutGAN").trim()).toBe(
    '[<span id="layoutgan-ref-3">LayoutGAN</span>](#layoutgan)'
  );
  expect(bm.render("", "GAN").trim()).toBe(
    '[<span id="gan-ref-2">GAN</span>](#gan)'
  );
});
