# BiMark

Auto create bidirectional link between markdown files.

## Usage

### Basic

Create definitions in markdown documents with `[[name]]`:

```md
# [[BiMark]]

BiMark is a tool to auto create [[bidirectional link]] between markdown files.

Once the bidirectional link is created, you can use it to navigate between markdown files.
```

In the above example, `BiMark` and `bidirectional link` are definitions.

Then, run `bimark <file>` to render the markdown documents:

```sh
bimark file.md
```

All definitions and references will be modified to add an id, and all references will be automatically replaced with links:

```md
# <span id="bimark">BiMark</span>

[<span id="bimark-ref-1">BiMark</span>](#bimark) is a tool to auto create <span id="bidirectional-link">bidirectional link</span> between markdown files.

Once the [<span id="bidirectional-link-ref-1">bidirectional link</span>](#bidirectional-link) is created, you can use it to navigate between markdown files.
```

### Explicit Reference

You can create references explicitly using `[[#id]]`:

```md
# [[BiMark]]

[[#bimark]] is a tool to auto create [[bidirectional link]] between markdown files.

Once the [[#bidirectional-link]] is created, you can use it to navigate between markdown files.
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

## FAQ

- Where can I make a definition/reference?
  - Texts in headings, paragraphs, and lists are supported.
  - Code blocks, inline code, links, and images are not supported.
- How to solve the problem of duplicate ids?
  - You can use `[[name:id]]` to specify the id of a definition.
