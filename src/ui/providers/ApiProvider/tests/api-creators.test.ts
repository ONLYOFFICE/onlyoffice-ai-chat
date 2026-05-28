import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../fetcher", () => ({
  callRoute: vi.fn((..._args: unknown[]) => "result"),
}));

import { callRoute } from "../fetcher";
import { createAIApi } from "../ai";
import { createAssignmentsApi } from "../assignments";
import { createPreferencesApi } from "../preferences";
import { createProfilesApi } from "../profiles";
import { createPromptsApi } from "../prompts";
import { createThreadsApi } from "../threads";
import { createToolsApi } from "../tools";
import { createWebSearchApi } from "../web-search";
import { DEFAULT_SERVER_API_ROUTES, type ServerAPIConfig } from "../index";

const config: ServerAPIConfig = {
  origin: "https://api.example.com",
  baseUrl: "/v1",
  routes: DEFAULT_SERVER_API_ROUTES,
};

const engines = {} as never;
const mockedCallRoute = vi.mocked(callRoute);

beforeEach(() => {
  mockedCallRoute.mockClear();
  mockedCallRoute.mockReturnValue("result" as never);
});

function expectCall(
  index: number,
  service: string,
  method: string,
  args: unknown[]
) {
  expect(mockedCallRoute).toHaveBeenNthCalledWith(
    index,
    config,
    service,
    method,
    args,
    engines
  );
}

describe("createAIApi", () => {
  it("wires every method to callRoute", () => {
    const api = createAIApi(config, engines);
    api.send({ a: 1 } as never);
    api.sendCustom({ b: 2 } as never);
    api.sendWithStream({ c: 3 } as never);
    api.approveToolCall({ d: 4 } as never);
    api.denyToolCall({ e: 5 } as never);
    expectCall(1, "ai", "send", [{ a: 1 }]);
    expectCall(2, "ai", "sendCustom", [{ b: 2 }]);
    expectCall(3, "ai", "sendWithStream", [{ c: 3 }]);
    expectCall(4, "ai", "approveToolCall", [{ d: 4 }]);
    expectCall(5, "ai", "denyToolCall", [{ e: 5 }]);
    expect(mockedCallRoute).toHaveBeenCalledTimes(5);
  });
});

describe("createAssignmentsApi", () => {
  it("wires every method to callRoute", () => {
    const api = createAssignmentsApi(config, engines);
    api.resolveForAction("Chat" as never);
    api.tryResolveForAction("Chat" as never);
    api.assign("Chat" as never, "p1");
    api.unassign("Chat" as never);
    api.bulkAssign([{ a: 1 }] as never);
    api.getAssignment("Chat" as never);
    api.getAllAssignments();
    api.cascadeProfileDelete("p1");
    expectCall(1, "assignments", "resolveForAction", ["Chat", undefined]);
    expectCall(2, "assignments", "tryResolveForAction", ["Chat", undefined]);
    expectCall(3, "assignments", "assign", ["Chat", "p1"]);
    expectCall(4, "assignments", "unassign", ["Chat"]);
    expectCall(5, "assignments", "bulkAssign", [[{ a: 1 }]]);
    expectCall(6, "assignments", "getAssignment", ["Chat"]);
    expectCall(7, "assignments", "getAllAssignments", []);
    expectCall(8, "assignments", "cascadeProfileDelete", ["p1"]);
  });
});

describe("createPreferencesApi", () => {
  it("wires every method to callRoute", () => {
    const api = createPreferencesApi(config, engines);
    api.getDeepMode();
    api.setDeepMode(true as never);
    api.clearDeepMode();
    api.isDeepModeSet();
    expectCall(1, "preferences", "getDeepMode", [undefined]);
    expectCall(2, "preferences", "setDeepMode", [true, undefined]);
    expectCall(3, "preferences", "clearDeepMode", [undefined]);
    expectCall(4, "preferences", "isDeepModeSet", [undefined]);
  });
});

describe("createProfilesApi", () => {
  it("wires every method to callRoute", () => {
    const api = createProfilesApi(config, engines);
    api.create({ name: "p" } as never);
    api.update({ id: "1" } as never);
    api.delete("1");
    api.listModels("1");
    api.testConnection("1");
    api.getById("1");
    api.list();
    expectCall(1, "profiles", "create", [{ name: "p" }]);
    expectCall(2, "profiles", "update", [{ id: "1" }]);
    expectCall(3, "profiles", "delete", ["1"]);
    expectCall(4, "profiles", "listModels", ["1"]);
    expectCall(5, "profiles", "testConnection", ["1"]);
    expectCall(6, "profiles", "getById", ["1"]);
    expectCall(7, "profiles", "list", []);
  });
});

describe("createPromptsApi", () => {
  it("wires every method to callRoute", () => {
    const api = createPromptsApi(config, engines);
    api.create({ title: "t" } as never);
    api.update("1", { title: "x" } as never);
    api.move("1", "f1");
    api.delete("1");
    api.list("f1");
    api.createFolder("folder");
    api.renameFolder("f1", "renamed");
    api.deleteFolder("f1");
    api.listFolders();
    api.export();
    api.importBundle({ items: [] } as never, { mode: "merge" } as never);
    api.getById("1");
    api.getFolderById("f1");
    expectCall(1, "prompts", "create", [{ title: "t" }]);
    expectCall(2, "prompts", "update", ["1", { title: "x" }]);
    expectCall(3, "prompts", "move", ["1", "f1"]);
    expectCall(4, "prompts", "delete", ["1"]);
    expectCall(5, "prompts", "list", ["f1"]);
    expectCall(6, "prompts", "createFolder", ["folder"]);
    expectCall(7, "prompts", "renameFolder", ["f1", "renamed"]);
    expectCall(8, "prompts", "deleteFolder", ["f1"]);
    expectCall(9, "prompts", "listFolders", []);
    expectCall(10, "prompts", "export", []);
    expectCall(11, "prompts", "importBundle", [
      { items: [] },
      { mode: "merge" },
    ]);
    expectCall(12, "prompts", "getById", ["1"]);
    expectCall(13, "prompts", "getFolderById", ["f1"]);
  });
});

describe("createThreadsApi", () => {
  it("wires every method to callRoute", () => {
    const api = createThreadsApi(config, engines);
    api.create({ title: "t" } as never);
    api.openOrCreate({ profile: "p" } as never);
    api.appendUserMessage("t1", { role: "user" } as never, "p1");
    api.touch("t1", "p1");
    api.rename("t1", "Title");
    api.delete("t1");
    api.clearMessages("t1");
    api.regenerateTitle("t1", { id: "p1" } as never);
    api.list();
    api.readMessages("t1", 10, 0);
    api.getById("t1");
    api.getMessageById("m1");
    api.updateMessage("m1", { role: "user" } as never);
    api.deleteMessage("m1");
    expectCall(1, "threads", "create", [{ title: "t" }]);
    expectCall(2, "threads", "openOrCreate", [{ profile: "p" }]);
    expectCall(3, "threads", "appendUserMessage", [
      "t1",
      { role: "user" },
      "p1",
    ]);
    expectCall(4, "threads", "touch", ["t1", "p1"]);
    expectCall(5, "threads", "rename", ["t1", "Title"]);
    expectCall(6, "threads", "delete", ["t1"]);
    expectCall(7, "threads", "clearMessages", ["t1"]);
    expectCall(8, "threads", "regenerateTitle", ["t1", { id: "p1" }]);
    expectCall(9, "threads", "list", [undefined]);
    expectCall(10, "threads", "readMessages", ["t1", 10, 0]);
    expectCall(11, "threads", "getById", ["t1"]);
    expectCall(12, "threads", "getMessageById", ["m1"]);
    expectCall(13, "threads", "updateMessage", ["m1", { role: "user" }]);
    expectCall(14, "threads", "deleteMessage", ["m1"]);
  });
});

describe("createToolsApi", () => {
  it("wires every method to callRoute", () => {
    const api = createToolsApi(config, engines);
    const cfg = { transport: "http" } as never;
    api.addCustomServer("s", cfg);
    api.updateCustomServer("s", cfg);
    api.removeCustomServer("s");
    api.getCustomServer("s");
    api.listCustomServers();
    api.replaceAllCustomServers({ s: cfg } as never);
    api.setDisabled("custom" as never, ["t1"]);
    api.getDisabled();
    api.isToolDisabled("custom" as never, "t1");
    api.setAllowAlways("custom" as never, "t1", true);
    api.getAllowAlways();
    api.isAllowAlways("custom" as never, "t1");
    expectCall(1, "tools", "addCustomServer", ["s", cfg, undefined]);
    expectCall(2, "tools", "updateCustomServer", ["s", cfg, undefined]);
    expectCall(3, "tools", "removeCustomServer", ["s", undefined]);
    expectCall(4, "tools", "getCustomServer", ["s", undefined]);
    expectCall(5, "tools", "listCustomServers", [undefined]);
    expectCall(6, "tools", "replaceAllCustomServers", [{ s: cfg }, undefined]);
    expectCall(7, "tools", "setDisabled", ["custom", ["t1"], undefined]);
    expectCall(8, "tools", "getDisabled", [undefined]);
    expectCall(9, "tools", "isToolDisabled", ["custom", "t1", undefined]);
    expectCall(10, "tools", "setAllowAlways", [
      "custom",
      "t1",
      true,
      undefined,
    ]);
    expectCall(11, "tools", "getAllowAlways", [undefined]);
    expectCall(12, "tools", "isAllowAlways", ["custom", "t1", undefined]);
  });
});

describe("createWebSearchApi", () => {
  it("wires every method to callRoute", () => {
    const api = createWebSearchApi(config, engines);
    api.getActiveConfig();
    api.isConfigured();
    api.testConnection({ apiKey: "k" } as never);
    api.configure({ apiKey: "k" } as never);
    api.clear();
    expectCall(1, "webSearch", "getActiveConfig", [undefined]);
    expectCall(2, "webSearch", "isConfigured", [undefined]);
    expectCall(3, "webSearch", "testConnection", [{ apiKey: "k" }]);
    expectCall(4, "webSearch", "configure", [{ apiKey: "k" }, undefined]);
    expectCall(5, "webSearch", "clear", [undefined]);
  });
});

describe("creators without engines", () => {
  it("forwards undefined engines argument", () => {
    const api = createAIApi(config);
    api.send({} as never);
    expect(mockedCallRoute).toHaveBeenCalledWith(
      config,
      "ai",
      "send",
      [{}],
      undefined
    );
  });
});
