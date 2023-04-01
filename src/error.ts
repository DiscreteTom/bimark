import { Position } from "./model";

export type BiParserErrorType = "DEF_NOT_FOUND";
export class BiParserError extends Error {
  type: BiParserErrorType;
  defName?: string;
  defId?: string;
  defPath?: string;
  position?: Position;

  constructor(type: BiParserErrorType, msg: string) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, BiParserError.prototype);
  }

  static defNotFound(
    path: string,
    content: string,
    type: "id" | "name",
    position: Position
  ) {
    const err = new BiParserError(
      "DEF_NOT_FOUND",
      `Definition not found at ${position.start.line}-${position.start.column}: ${type}=${content} from ${path}`
    );
    if (type == "id") err.defId = content;
    else err.defName = content;
    err.defPath = path;
    err.position = position;
    return err;
  }
}

export type BiDocErrorType = "DUP_DEF_NAME" | "DUP_DEF_ID" | "DEF_NOT_FOUND";

export class BiDocError extends Error {
  type: BiDocErrorType;
  defName?: string;
  defId?: string;
  defPath?: string;
  position?: Position;

  constructor(type: BiDocErrorType, msg: string) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, BiDocError.prototype);
  }

  static duplicatedDefName(path: string, name: string, position: Position) {
    const err = new BiDocError(
      "DUP_DEF_NAME",
      `Duplicate definition name at ${position.start.line}-${position.start.column}: ${name} in file ${path}`
    );
    err.defName = name;
    err.defPath = path;
    err.position = position;
    return err;
  }

  static duplicatedDefId(path: string, id: string, position: Position) {
    const err = new BiDocError(
      "DUP_DEF_ID",
      `Duplicate definition id at ${position.start.line}-${position.start.column}: ${id} in file ${path}`
    );
    err.defId = id;
    err.defPath = path;
    err.position = position;
    return err;
  }

  static defNotFound(options: { id: string } | { name: string }) {
    if ("id" in options) {
      const err = new BiDocError(
        "DEF_NOT_FOUND",
        `Definition not found: id=${JSON.stringify(options)}`
      );
      err.defId = options.id;
      return err;
    }
    // else, name in options
    const err = new BiDocError(
      "DEF_NOT_FOUND",
      `Definition not found: name=${JSON.stringify(options)}`
    );
    err.defName = options.name;
    return err;
  }
}
