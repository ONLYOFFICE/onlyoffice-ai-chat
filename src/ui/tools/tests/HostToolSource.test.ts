import { beforeEach, describe, expect, it } from "vitest";
import { HostToolSource } from "../sources/HostToolSource";
import type { HostToolGroup } from "../types";

describe("HostToolSource", () => {
  let source: HostToolSource;

  const mockHandler = async (args: Record<string, unknown>) =>
    JSON.stringify(args);

  const makeGroups = (): HostToolGroup[] => [
    {
      id: "desktop-editor",
      name: "Desktop Editor",
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
          },
          handler: mockHandler,
        },
        {
          name: "write_file",
          description: "Write to a file",
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
          },
          handler: mockHandler,
        },
      ],
    },
    {
      id: "crm",
      name: "CRM Tools",
      tools: [
        {
          name: "find_contact",
          description: "Find a contact",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
          },
          handler: mockHandler,
          requireApproval: true,
        },
      ],
    },
  ];

  beforeEach(() => {
    source = new HostToolSource();
  });

  // ==========================================================================
  // setGroups / getGroupIds
  // ==========================================================================

  describe("setGroups", () => {
    it("should start with no groups", () => {
      expect(source.getGroupIds()).toEqual([]);
    });

    it("should set groups and return their IDs", () => {
      source.setGroups(makeGroups());

      expect(source.getGroupIds()).toEqual(["desktop-editor", "crm"]);
    });

    it("should replace existing groups", () => {
      source.setGroups(makeGroups());
      source.setGroups([{ id: "new", name: "New", tools: [] }]);

      expect(source.getGroupIds()).toEqual(["new"]);
    });
  });

  // ==========================================================================
  // getToolsByGroup
  // ==========================================================================

  describe("getToolsByGroup", () => {
    it("should return empty object when no groups", () => {
      expect(source.getToolsByGroup()).toEqual({});
    });

    it("should return tools keyed by group id", () => {
      source.setGroups(makeGroups());
      const result = source.getToolsByGroup();

      expect(Object.keys(result)).toEqual(["desktop-editor", "crm"]);
      expect(result["desktop-editor"]).toHaveLength(2);
      expect(result.crm).toHaveLength(1);
    });

    it("should map tools to TMCPItem format (no handler)", () => {
      source.setGroups(makeGroups());
      const tool = source.getToolsByGroup()["desktop-editor"][0];

      expect(tool).toEqual({
        name: "desktop-editor_read_file",
        displayName: "read_file",
        description: "Read a file",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
        },
      });
      expect(tool).not.toHaveProperty("handler");
    });
  });

  // ==========================================================================
  // getAllTools
  // ==========================================================================

  describe("getAllTools", () => {
    it("should return empty array when no groups", () => {
      expect(source.getAllTools()).toEqual([]);
    });

    it("should return flat list of all tools from all groups", () => {
      source.setGroups(makeGroups());

      expect(source.getAllTools()).toHaveLength(3);
    });
  });

  // ==========================================================================
  // callTool
  // ==========================================================================

  describe("callTool", () => {
    it("should call the correct handler by name", async () => {
      source.setGroups(makeGroups());

      const result = await source.callTool("read_file", { path: "/test.txt" });

      expect(result).toBe(JSON.stringify({ path: "/test.txt" }));
    });

    it("should find tool across different groups", async () => {
      source.setGroups(makeGroups());

      const result = await source.callTool("find_contact", {
        query: "John",
      });

      expect(result).toBe(JSON.stringify({ query: "John" }));
    });

    it("should return '{}' for unknown tool", async () => {
      source.setGroups(makeGroups());

      const result = await source.callTool("nonexistent", {});

      expect(result).toBe("{}");
    });

    it("should return '{}' when no groups set", async () => {
      const result = await source.callTool("anything", {});

      expect(result).toBe("{}");
    });
  });

  // ==========================================================================
  // isAutoAllow
  // ==========================================================================

  describe("isAutoAllow", () => {
    it("should return true for tools without requireApproval (default)", () => {
      source.setGroups(makeGroups());

      expect(source.isAutoAllow("desktop-editor", "read_file")).toBe(true);
    });

    it("should return false for tools with requireApproval: true", () => {
      source.setGroups(makeGroups());

      expect(source.isAutoAllow("crm", "find_contact")).toBe(false);
    });

    it("should return false for unknown group", () => {
      source.setGroups(makeGroups());

      expect(source.isAutoAllow("unknown", "read_file")).toBe(false);
    });

    it("should return false for unknown tool in valid group", () => {
      source.setGroups(makeGroups());

      expect(source.isAutoAllow("desktop-editor", "nonexistent")).toBe(false);
    });
  });

  // ==========================================================================
  // getGroupDisplayName
  // ==========================================================================

  describe("getGroupDisplayName", () => {
    it("returns the group's name when set", () => {
      source.setGroups(makeGroups());
      expect(source.getGroupDisplayName("desktop-editor")).toBe(
        "Desktop Editor"
      );
    });

    it("falls back to the group id when name is missing", () => {
      source.setGroups([
        { id: "no-name", tools: [] } as unknown as HostToolGroup,
      ]);
      expect(source.getGroupDisplayName("no-name")).toBe("no-name");
    });

    it("returns the requested id when group is unknown", () => {
      source.setGroups(makeGroups());
      expect(source.getGroupDisplayName("missing")).toBe("missing");
    });
  });

  // ==========================================================================
  // callTool — non-string handler results
  // ==========================================================================

  describe("callTool result normalisation", () => {
    const makeGroupWithHandler = (
      handler: (args: Record<string, unknown>) => unknown
    ): HostToolGroup[] => [
      {
        id: "g",
        name: "G",
        tools: [
          {
            name: "t",
            description: "",
            inputSchema: {},
            handler: handler as (
              args: Record<string, unknown>
            ) => Promise<unknown>,
          },
        ],
      },
    ];

    it("returns '{}' when handler resolves with undefined", async () => {
      source.setGroups(makeGroupWithHandler(() => undefined));
      expect(await source.callTool("t", {})).toBe("{}");
    });

    it("returns '{}' when handler resolves with null", async () => {
      source.setGroups(makeGroupWithHandler(() => null));
      expect(await source.callTool("t", {})).toBe("{}");
    });

    it("JSON-stringifies non-string handler results", async () => {
      source.setGroups(makeGroupWithHandler(() => ({ a: 1, b: [2, 3] })));
      expect(await source.callTool("t", {})).toBe(
        JSON.stringify({ a: 1, b: [2, 3] })
      );
    });

    it("returns serialisation-error payload when result has cycles", async () => {
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      source.setGroups(makeGroupWithHandler(() => cyclic));

      const result = await source.callTool("t", {});

      expect(JSON.parse(result as string)).toEqual({
        error: "Tool result is not serialisable.",
      });
    });

    it("returns stringified error when handler throws an Error", async () => {
      source.setGroups(
        makeGroupWithHandler(() => {
          throw new Error("boom");
        })
      );

      const result = await source.callTool("t", {});

      expect(JSON.parse(result as string)).toEqual({ error: "boom" });
    });

    it("returns stringified error when handler throws a non-Error value", async () => {
      source.setGroups(
        makeGroupWithHandler(() => {
          throw "raw-string";
        })
      );

      const result = await source.callTool("t", {});

      expect(JSON.parse(result as string)).toEqual({ error: "raw-string" });
    });
  });
});
