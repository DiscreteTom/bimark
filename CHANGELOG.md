# CHANGELOG

## v0.1.6

- Language specific characters are allowed in the name/alias/id of a definition.
  - Characters allowed in the name/alias of a definition: `` [^$&+,/:;=?!@"'<>#%{}|\\^~[\]`\n\r] ``.
  - Characters allowed in the id of a definition: `` [^$&+,/:;=?!@ "'<>#%{}|\\^~[\]`\n\r] ``.
- BiML will collect/render `li` elements by default.

## v0.1.5

- Fix definition position. Add more tests for this.

## v0.1.4

- Fix ESM module resolution.

## v0.1.3

- Fix ESM module resolution.

## v0.1.2

- Add `BiDoc`/`BiParser` class.
- Add `out.html` option in `render` function.
- Add `BiML` to parse & render HTML.
- Optimize code.

## v0.1.1

- Add `ref.html` option in `render` function.

## v0.1.0

The initial release.

- `BiMark`
  - `collect` to collect definitions from markdown documents.
  - `render` to render a markdown document.
  - `singleFile` to collect and render a single file.
  - `getReverseRefs` to get reverse references of a definition.
