# CHANGELOG

## Next

- Feat: optimize error class, add `BiParserError` and `BiDocError`.

## v0.3.1

- Feat: add `Point.offset`.
- Feat: add `Reference.id`.

## v0.3.0

- **Breaking Change**: extract type `EscapedReference` from `Reference`.
  - Escaped reference will not check if the definition exists: `[[!any]]`
- **Breaking Change**: add `BiDoc.escaped` to get escaped references.
  - You could not use `name2def/id2def.refs` to get escaped references any more.
- Feat: explicit reference support `[[@name]]`.
- Feat: add `BiMark/BiML.findTextNodes`.
- Feat: add `BiMark/BiML.collectDefs` to get the newly collected definitions.
- Feat: add `BiMark/BiML.collectRefs` to get the newly collected references.
- Feat: add `BiML.BiMLCollectOptions`.
- Fix: definition/reference position.
- Fix: `Point.column` must be greater than 0.

## v0.2.0

- Add interface `Reference`.
- Add `BiDoc.purge`.
- **Breaking Change**: `Definition.refs` will be `Reference[]` instead of `string[]`.
- **Breaking Change**: `RefIdGenerator` is `(ref: Reference) => string`.
- **Breaking Change**: `RefRenderer` is `(ref: Reference) => string`.
- **Breaking Change**: re-write `BiParser`.
- **Breaking Change**: rename `BiDoc.collectDefinition` to `BiDoc.collectDefinitions`.
- Fix: escaped reference for alias will be rendered as the alias instead of the name.

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
