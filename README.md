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
bimark intro.md
```

Output:

```md
# <span id="BiMark">BiMark</span>

[BiMark](./intro.md#BiMark) is a tool to auto create <span id="bidirectional-link">bidirectional link</span> between markdown files.

Once the [bidirectional link](./intro.md#bidirectional-link) is created, you can use it to navigate between markdown files.
```
