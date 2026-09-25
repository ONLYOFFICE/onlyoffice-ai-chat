import type { ContextFolder, RoomSkill } from "../../storage";
import type { ContextEngineDeps } from "./types";

/**
 * Context orchestrator: the rooms a host offers as chat context and the
 * skills configured inside them. Both reads are optional on
 * `StorageAdapter`, and this is the one place that knows it — callers
 * (the composer's clouds store, a host's HTTP controller) always get an
 * array back, never `undefined is not a function`.
 *
 * It exists as an engine rather than a direct storage read so the call
 * crosses the `ServerAPI` bridge like every other read: in server mode the
 * browser holds a stub adapter and the real one lives behind HTTP.
 */
export class ContextEngine {
  private readonly deps: ContextEngineDeps;

  constructor(deps: ContextEngineDeps) {
    this.deps = deps;
  }

  /**
   * Rooms grouped by cloud account, in the host's order. Empty when the
   * adapter does not implement `getContextFolders`.
   */
  async getContextFolders(): Promise<ContextFolder[]> {
    const { storage } = this.deps;
    if (!storage.getContextFolders) return [];
    return storage.getContextFolders();
  }

  /**
   * Skills of one room, identified the way `getContextFolders` named it.
   * Empty when the adapter does not implement `getRoomSkills`.
   */
  async getRoomSkills(cloud: string, roomId: string): Promise<RoomSkill[]> {
    const { storage } = this.deps;
    if (!storage.getRoomSkills) return [];
    return storage.getRoomSkills(cloud, roomId);
  }

  /**
   * One skill's body. `null` when the adapter does not implement
   * `getRoomSkill` — the caller (the `read_skill` tool) turns that into a
   * readable answer for the model rather than a thrown error.
   */
  async getRoomSkill(
    cloud: string,
    roomId: string,
    skillId: string
  ): Promise<string | null> {
    const { storage } = this.deps;
    if (!storage.getRoomSkill) return null;
    return storage.getRoomSkill(cloud, roomId, skillId);
  }
}
