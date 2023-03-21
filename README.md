# [[BiMark]]

[![npm](https://img.shields.io/npm/v/bimark?style=flat-square)](https://www.npmjs.com/package/bimark)
![license](https://img.shields.io/github/license/DiscreteTom/bimark?style=flat-square)

Auto create [[bidirectional links]] between markdown files.

## Installation

```bash
# for API usage
npm install bimark

# for CLI usage, see https://github.com/DiscreteTom/bimark-cli
npm install -g bimark-cli
```

## Usage

### Basic

Create definitions in markdown documents with `[[name]]`:

```md
# [[BiMark]]

BiMark is a tool to auto create [[bidirectional links]] between markdown files.

Once bidirectional links are created, you can use it to navigate between markdown files.
```

In the above example, `BiMark` and `bidirectional link` are definitions.

After rendering, all definitions and references will be modified to add an id, and all references will be automatically replaced with links:

```md
# <span id="bimark">BiMark</span>

[<span id="bimark-ref-1">BiMark</span>](#bimark) is a tool to auto create <span id="bidirectional-links">bidirectional links</span> between markdown files.

Once the [<span id="bidirectional-links-ref-1">bidirectional links</span>](#bidirectional-links) is created, you can use it to navigate between markdown files.
```

### Explicit Reference

You can create references explicitly using `[[#id]]`:

```md
# [[BiMark]]

[[#bimark]] is a tool to auto create [[bidirectional links]] between markdown files.

Once the [[#bidirectional-links]] is created, you can use it to navigate between markdown files.
```

### Advanced Definition

- You can use `[[name:id]]` to specify the id of the definition.
- If there are aliases for a definition, you can use `[[name|alias1|alias2]]`.
  - If you don't specify the id, the name will be used to calculate the id.

```md
# [[BiMark|bi-mark|bimark]]

# [[BiMark|bi-mark|bimark:bimark]]
```

### Escaped Reference

You can escape a reference using `[[!name]]`:

```md
# [[BiMark]]

[[!BiMark]] is a tool to auto create [[bidirectional link]] between markdown files.
```

The escaped reference will not be replaced with a link, and will not be assigned an id.

### API

```ts
import { BiMark } from "bimark";

// collect from and render a single file, return the rendered content
BiMark.singleFile("# [[BiMark]]");

// collect definitions
const bm = new BiMark().collect("file1.md", content1);

// render files
bm.render("file1.md", content1);
bm.render("file2.md", content2);

// list reverse links
bm.getReverseRefs({ name: "BiMark" }); // => ['file1.md#bimark-ref-1', 'file2.md#bimark-ref-2']
```

## FAQ

- Where can I make a definition/reference?
  - Texts(e.g. headings, paragraphs, lists).
- How to solve the problem of duplicate ids?
  - You can use `[[name:id]]` to specify the id of a definition.
- What characters are allowed in the name of a definition?
  - Regex: `[ a-zA-Z0-9_-]`.
  - Yes, spaces are allowed.
- What characters are allowed in the id of a definition?
  - Regex: `[a-zA-Z0-9_-]`.
  - No, spaces are not allowed.

## [CHANGELOG](https://github.com/DiscreteTom/bimark/blob/main/CHANGELOG.md)
