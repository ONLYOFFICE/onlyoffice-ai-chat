import type { TErrorData } from "../../../shared/error-data";
import type { McpServerConfig } from "../../storage";
import type { McpTransportConfig } from "./types";

/**
 * Validate an MCP server name. Names must be non-empty and may not
 * contain `_` because the live tool system uses `${type}_${name}` as
 * a token format for `allowAlways` and tool-call dispatch.
 */
export function validateServerName(name: string): TErrorData | null {
  if (!name) return { field: "name", message: "Server name is required" };
  if (name.includes("_")) {
    return {
      field: "name",
      message: "Server name cannot contain '_' — reserved for tool-token format",
    };
  }
  return null;
}

/**
 * Validate that `config` matches one of the two supported MCP
 * transport shapes (HTTP `{ url }` or STDIO `{ command }`). Returns
 * `null` on success, a field-scoped error otherwise.
 */
export function validateTransportConfig(
  config: McpServerConfig
): TErrorData | null {
  if (typeof config !== "object" || config === null) {
    return { field: "url", message: "Server config must be an object" };
  }

  const hasUrl = typeof config.url === "string" && config.url.length > 0;
  const hasCommand =
    typeof config.command === "string" && config.command.length > 0;

  if (hasUrl && hasCommand) {
    return {
      field: "url",
      message: "Server config must be HTTP (url) or STDIO (command), not both",
    };
  }
  if (!hasUrl && !hasCommand) {
    return {
      field: "url",
      message: "Server config requires either 'url' (HTTP) or 'command' (STDIO)",
    };
  }

  if (hasUrl) {
    if (config.headers !== undefined && !isStringMap(config.headers)) {
      return {
        field: "url",
        message: "'headers' must be a string-to-string map",
      };
    }
  } else {
    if (config.args !== undefined && !isStringArray(config.args)) {
      return {
        field: "url",
        message: "'args' must be an array of strings",
      };
    }
    if (config.env !== undefined && !isStringMap(config.env)) {
      return {
        field: "url",
        message: "'env' must be a string-to-string map",
      };
    }
  }

  return null;
}

/** True when `value` is a `Record<string, string>` at runtime. */
function isStringMap(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

/** True when `value` is a `string[]`. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export type { McpTransportConfig };
