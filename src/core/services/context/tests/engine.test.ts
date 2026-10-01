import { describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "../../../storage";
import { ContextEngine } from "../engine";
import { DEFAULT_CONTEXT_ROUTES } from "../types";

const makeStorage = (methods: Partial<StorageAdapter> = {}) =>
  methods as unknown as StorageAdapter;

describe("ContextEngine", () => {
  describe("getContextFolders", () => {
    it("returns [] when the adapter has no getContextFolders", async () => {
      const engine = new ContextEngine({ storage: makeStorage() });
      await expect(engine.getContextFolders()).resolves.toEqual([]);
    });

    it("returns the adapter's list untouched, called as a method", async () => {
      const folders = [
        { cloud: "a.example.com", rooms: [{ id: "r1", name: "Room 1" }] },
        { cloud: "empty.example.com", rooms: [] },
      ];
      const storage = makeStorage({
        getContextFolders: vi.fn(function (this: unknown) {
          expect(this).toBe(storage);
          return Promise.resolve(folders);
        }),
      });
      const engine = new ContextEngine({ storage });
      // No filtering here — the UI decides what an empty cloud means.
      await expect(engine.getContextFolders()).resolves.toBe(folders);
    });

    it("lets an adapter failure propagate", async () => {
      const storage = makeStorage({
        getContextFolders: vi.fn().mockRejectedValue(new Error("boom")),
      });
      const engine = new ContextEngine({ storage });
      await expect(engine.getContextFolders()).rejects.toThrow("boom");
    });
  });

  describe("getRoomSkills", () => {
    it("returns [] when the adapter has no getRoomSkills", async () => {
      const engine = new ContextEngine({ storage: makeStorage() });
      await expect(engine.getRoomSkills("a", "r1")).resolves.toEqual([]);
    });

    it("forwards cloud and room id and returns the list untouched", async () => {
      const skills = [{ id: "s1", name: "Skill 1" }];
      const getRoomSkills = vi.fn().mockResolvedValue(skills);
      const engine = new ContextEngine({
        storage: makeStorage({ getRoomSkills }),
      });
      await expect(engine.getRoomSkills("a.example.com", "r1")).resolves.toBe(
        skills
      );
      expect(getRoomSkills).toHaveBeenCalledWith("a.example.com", "r1");
    });

    it("lets an adapter failure propagate", async () => {
      const engine = new ContextEngine({
        storage: makeStorage({
          getRoomSkills: vi.fn().mockRejectedValue(new Error("boom")),
        }),
      });
      await expect(engine.getRoomSkills("a", "r1")).rejects.toThrow("boom");
    });
  });

  describe("getRoomSkill", () => {
    it("returns null when the adapter has no getRoomSkill", async () => {
      const engine = new ContextEngine({ storage: makeStorage() });
      await expect(engine.getRoomSkill("a", "r1", "s1")).resolves.toBeNull();
    });

    it("forwards cloud, room and skill ids and returns the body", async () => {
      const getRoomSkill = vi.fn().mockResolvedValue("# Skill\n\nDo this.");
      const engine = new ContextEngine({
        storage: makeStorage({ getRoomSkill }),
      });
      await expect(
        engine.getRoomSkill("a.example.com", "r1", "s1")
      ).resolves.toBe("# Skill\n\nDo this.");
      expect(getRoomSkill).toHaveBeenCalledWith("a.example.com", "r1", "s1");
    });
  });

  describe("DEFAULT_CONTEXT_ROUTES", () => {
    it("declares a GET route per engine method, room skills keyed by cloud + roomId", () => {
      expect(Object.keys(DEFAULT_CONTEXT_ROUTES).sort()).toEqual([
        "getContextFolders",
        "getRoomSkill",
        "getRoomSkills",
      ]);
      expect(DEFAULT_CONTEXT_ROUTES.getRoomSkill).toEqual({
        method: "GET",
        path: "context/get-room-skill",
        params: ["cloud", "roomId", "skillId"],
      });
      expect(DEFAULT_CONTEXT_ROUTES.getContextFolders).toEqual({
        method: "GET",
        path: "context/get-context-folders",
      });
      expect(DEFAULT_CONTEXT_ROUTES.getRoomSkills).toEqual({
        method: "GET",
        path: "context/get-room-skills",
        params: ["cloud", "roomId"],
      });
    });
  });
});
