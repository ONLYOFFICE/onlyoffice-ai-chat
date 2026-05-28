import { describe, expect, it, vi } from "vitest";
import type { Attachment, StorageAdapter } from "../../../storage";
import { AttachmentsEngine } from "../engine";

const makeStorage = () => {
  let counter = 0;
  const create = vi.fn(async (input: Omit<Attachment, "id" | "createdAt">) => ({
    ...input,
    id: `att-${++counter}`,
    createdAt: 1,
  }));
  const createMany = vi.fn(
    async (inputs: Omit<Attachment, "id" | "createdAt">[]) =>
      inputs.map((input) => ({
        ...input,
        id: `att-${++counter}`,
        createdAt: 1,
      }))
  );
  return {
    create,
    createMany,
    readById: vi.fn(),
    readManyByIds: vi.fn(),
    update: vi.fn(async () => undefined),
    updateManyByIds: vi.fn(async () => undefined),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    deleteByMessage: vi.fn(),
    deleteByThread: vi.fn(),
  };
};

const engineWith = (attachments: ReturnType<typeof makeStorage>) =>
  new AttachmentsEngine({
    storage: { attachments } as unknown as StorageAdapter,
  });

describe("AttachmentsEngine.saveFilesMany", () => {
  it("delegates to storage.createMany in a single call", async () => {
    const storage = makeStorage();
    const engine = engineWith(storage);

    const out = await engine.saveFilesMany(
      [
        { path: "a.txt", content: "1", type: 0 },
        { path: "b.txt", content: "2", type: 0 },
        { path: "c.txt", content: "3", type: 0 },
      ],
      "ent-1"
    );

    expect(storage.createMany).toHaveBeenCalledTimes(1);
    expect(storage.create).not.toHaveBeenCalled();
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.path)).toEqual(["a.txt", "b.txt", "c.txt"]);
    // All records share the entityId we passed in.
    const calledWith = storage.createMany.mock.calls[0][0];
    expect(calledWith.every((r) => r.entityId === "ent-1")).toBe(true);
  });

  it("returns an empty array without hitting storage when given no inputs", async () => {
    const storage = makeStorage();
    const engine = engineWith(storage);
    const out = await engine.saveFilesMany([]);
    expect(out).toEqual([]);
    expect(storage.createMany).not.toHaveBeenCalled();
  });

  it("derives a default title from the path when title is omitted", async () => {
    const storage = makeStorage();
    const engine = engineWith(storage);
    await engine.saveFilesMany([
      { path: "/tmp/x/y/report.docx", content: "", type: 0 },
    ]);
    expect(storage.createMany.mock.calls[0][0][0].title).toBe("report.docx");
  });
});

describe("AttachmentsEngine.saveImagesMany", () => {
  it("delegates to storage.createMany in a single call", async () => {
    const storage = makeStorage();
    const engine = engineWith(storage);

    const out = await engine.saveImagesMany([
      { name: "img1", base64: "data:1" },
      { name: "img2", base64: "data:2" },
    ]);

    expect(storage.createMany).toHaveBeenCalledTimes(1);
    expect(storage.create).not.toHaveBeenCalled();
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.kind === "image")).toBe(true);
  });
});

describe("AttachmentsEngine.linkToMessage", () => {
  it("issues exactly one storage.updateManyByIds call with the shared patch", async () => {
    const storage = makeStorage();
    const engine = engineWith(storage);

    await engine.linkToMessage(["a1", "a2", "a3"], "m-1", "t-1");

    expect(storage.updateManyByIds).toHaveBeenCalledTimes(1);
    expect(storage.update).not.toHaveBeenCalled();
    expect(storage.updateManyByIds).toHaveBeenCalledWith(["a1", "a2", "a3"], {
      messageId: "m-1",
      threadId: "t-1",
    });
  });

  it("is a no-op without touching storage when ids[] is empty", async () => {
    const storage = makeStorage();
    const engine = engineWith(storage);
    await engine.linkToMessage([], "m", "t");
    expect(storage.updateManyByIds).not.toHaveBeenCalled();
  });
});

describe("AttachmentsEngine.saveFile / saveImage (single)", () => {
  it("single saveFile routes through saveFilesMany (one createMany call)", async () => {
    const storage = makeStorage();
    const engine = engineWith(storage);

    const rec = await engine.saveFile({
      path: "a.txt",
      content: "ok",
      type: 0,
    });

    expect(storage.createMany).toHaveBeenCalledTimes(1);
    expect(storage.create).not.toHaveBeenCalled();
    expect(rec.path).toBe("a.txt");
  });

  it("single saveImage routes through saveImagesMany", async () => {
    const storage = makeStorage();
    const engine = engineWith(storage);

    const rec = await engine.saveImage({ name: "img", base64: "data:..." });

    expect(storage.createMany).toHaveBeenCalledTimes(1);
    expect(rec.base64).toBe("data:...");
  });
});
