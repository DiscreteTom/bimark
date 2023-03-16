import { marked } from "marked";
import { parse, HTMLElement } from "node-html-parser";

export class BiMark {
  readonly includeTags: readonly string[];
  /** content => path */
  readonly inventory: Map<string, string>;

  constructor(options?: { includeTags?: string[] }) {
    this.inventory = new Map();
    this.includeTags = (
      options?.includeTags ?? ["p", "h1", "h2", "h3", "h4", "h5", "h6"]
    ).map((t) => t.toUpperCase());
  }

  /**
   * Load a mapping of content to path.
   * This is useful when you want to load a pre-existing inventory.
   * @example
   * ```
   * const bi = new BiMark().load({
   *  'foo': 'foo.md',
   *  'bar': 'bar.md',
   * });
   * ```
   */
  load(
    /** content => path */
    mapping: Record<string, string>
  ) {
    Object.entries(mapping).forEach(([content, path]) => {
      this.inventory.set(content, path);
    });
    return this;
  }

  /**
   * Collect definitions from a markdown document.
   */
  collect(path: string, md: string) {
    const html = marked.parse(md);
    const root = parse(html);
    this.collectFromElement(path, root);
    return this;
  }

  private collectFromElement(path: string, e: HTMLElement) {
    if (e.tagName && this.includeTags.includes(e.tagName.toUpperCase())) {
      [...e.rawText.matchAll(/\[\[(.*?)\]\]/g)].forEach((m) => {
        this.inventory.set(
          m[0].slice(2, -2), // remove `[[` and `]]`
          path
        );
      });
    }

    // Recursively collect from child elements.
    e.childNodes.forEach((c) => {
      if (c instanceof HTMLElement) {
        this.collectFromElement(path, c);
      }
    });
  }

  /**
   * Scan a markdown document for definitions.
   */
  scan(s: string) {
    const result: { content: string; from: number; path: string }[] = [];
    this.inventory.forEach((path, content) => {
      [...s.matchAll(new RegExp(content, "g"))].forEach((m) => {
        result.push({
          content: m[0],
          from: m.index!,
          path,
        });
      });
    });
    return result;
  }
}
