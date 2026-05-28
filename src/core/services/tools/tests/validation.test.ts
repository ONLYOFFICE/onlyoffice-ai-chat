import { describe, expect, it } from "vitest";
import { validateServerName, validateTransportConfig } from "../validation";

describe("validateServerName", () => {
  it("rejects empty names", () => {
    expect(validateServerName("")?.message).toBe("Server name is required");
  });

  it("rejects names containing underscore", () => {
    expect(validateServerName("with_underscore")?.message).toMatch(
      /reserved for tool-token format/
    );
  });

  it("returns null for valid names", () => {
    expect(validateServerName("good-name")).toBeNull();
    expect(validateServerName("alpha")).toBeNull();
  });
});

describe("validateTransportConfig", () => {
  it("rejects non-object configs", () => {
    expect(
      validateTransportConfig(null as unknown as Record<string, unknown>)
        ?.message
    ).toBe("Server config must be an object");
    expect(
      validateTransportConfig("string" as unknown as Record<string, unknown>)
        ?.message
    ).toBe("Server config must be an object");
  });

  it("rejects configs with both url and command", () => {
    expect(
      validateTransportConfig({ url: "http://x", command: "node" })?.message
    ).toMatch(/not both/);
  });

  it("rejects configs with neither url nor command", () => {
    expect(validateTransportConfig({})?.message).toMatch(
      /'url' \(HTTP\) or 'command' \(STDIO\)/
    );
  });

  it("accepts a minimal HTTP config", () => {
    expect(validateTransportConfig({ url: "http://x" })).toBeNull();
  });

  it("accepts a minimal STDIO config", () => {
    expect(validateTransportConfig({ command: "node" })).toBeNull();
  });

  it("accepts HTTP config with valid headers", () => {
    expect(
      validateTransportConfig({
        url: "http://x",
        headers: { Authorization: "Bearer t" },
      })
    ).toBeNull();
  });

  it("rejects HTTP config with non-string-map headers", () => {
    expect(
      validateTransportConfig({
        url: "http://x",
        headers: { x: 1 } as unknown as Record<string, string>,
      })?.message
    ).toMatch(/'headers' must be a string-to-string map/);
  });

  it("rejects HTTP config when headers is not an object", () => {
    expect(
      validateTransportConfig({
        url: "http://x",
        headers: "x" as unknown as Record<string, string>,
      })?.message
    ).toMatch(/'headers' must be a string-to-string map/);
  });

  it("accepts STDIO config with valid args + env", () => {
    expect(
      validateTransportConfig({
        command: "node",
        args: ["-v"],
        env: { K: "v" },
      })
    ).toBeNull();
  });

  it("rejects STDIO config with non-string-array args", () => {
    expect(
      validateTransportConfig({
        command: "node",
        args: [1] as unknown as string[],
      })?.message
    ).toMatch(/'args' must be an array of strings/);
  });

  it("rejects STDIO config when args is not an array", () => {
    expect(
      validateTransportConfig({
        command: "node",
        args: "x" as unknown as string[],
      })?.message
    ).toMatch(/'args' must be an array of strings/);
  });

  it("rejects STDIO config when env contains non-string values", () => {
    expect(
      validateTransportConfig({
        command: "node",
        env: { x: 1 } as unknown as Record<string, string>,
      })?.message
    ).toMatch(/'env' must be a string-to-string map/);
  });

  it("rejects empty url", () => {
    expect(validateTransportConfig({ url: "" })?.message).toMatch(
      /'url' \(HTTP\) or 'command' \(STDIO\)/
    );
  });
});
