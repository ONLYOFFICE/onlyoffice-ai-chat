import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { searchParams: Promise<Record<string, string>> };

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

async function handleThreads(req: NextRequest, params: Params) {
  const sp = await params.searchParams;

  if (req.method === "GET") {
    if (sp.id) {
      const t = await prisma.thread.findUnique({ where: { id: sp.id } });
      return NextResponse.json(t);
    }
    const all = await prisma.thread.findMany({
      orderBy: { lastEditDate: "desc" },
    });
    return NextResponse.json(
      all.map((t) => ({
        ...t,
        lastEditDate: t.lastEditDate ? Number(t.lastEditDate) : undefined,
      }))
    );
  }

  if (req.method === "POST") {
    const body = await req.json();
    await prisma.thread.create({
      data: {
        id: body.threadId,
        title: body.title,
        lastEditDate: BigInt(Date.now()),
        provider: body.provider ?? undefined,
        model: body.model ?? undefined,
        profileId: body.profileId,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (req.method === "PATCH") {
    const body = await req.json();
    const data: Record<string, unknown> = {
      lastEditDate: BigInt(Date.now()),
    };
    if (body.title !== undefined) data.title = body.title;
    if (body.provider !== undefined) data.provider = body.provider;
    if (body.model !== undefined) data.model = body.model;
    if (body.profileId !== undefined) data.profileId = body.profileId;
    await prisma.thread.update({ where: { id: sp.id }, data });
    return NextResponse.json({ ok: true });
  }

  if (req.method === "DELETE") {
    await prisma.thread.delete({ where: { id: sp.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

async function handleMessages(req: NextRequest, params: Params) {
  const sp = await params.searchParams;

  if (req.method === "GET") {
    if (sp.id && sp.threadId) {
      const m = await prisma.message.findUnique({ where: { id: sp.id } });
      return NextResponse.json(m?.message ?? null);
    }
    if (sp.threadId) {
      const msgs = await prisma.message.findMany({
        where: { threadId: sp.threadId },
        orderBy: { timestamp: "asc" },
        ...(sp.limit ? { take: Number(sp.limit) } : {}),
      });
      return NextResponse.json(msgs.map((m) => m.message));
    }
    if (sp.search) {
      const all = await prisma.message.findMany();
      const q = sp.search.toLowerCase();
      const results = all
        .filter((m) => JSON.stringify(m.message).toLowerCase().includes(q))
        .map((m) => ({ threadId: m.threadId, message: m.message }));
      return NextResponse.json(results);
    }
    return NextResponse.json([]);
  }

  if (req.method === "POST") {
    const body = await req.json();
    await prisma.message.create({
      data: {
        id: body.id,
        threadId: body.threadId,
        message: body.message,
        timestamp: BigInt(Date.now()),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (req.method === "PATCH") {
    const body = await req.json();
    await prisma.message.update({
      where: { id: sp.id },
      data: { message: body.message, timestamp: BigInt(Date.now()) },
    });
    return NextResponse.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (sp.threadId && !sp.id) {
      await prisma.message.deleteMany({ where: { threadId: sp.threadId } });
    } else if (sp.id) {
      await prisma.message.delete({ where: { id: sp.id } });
    }
    return NextResponse.json({ ok: true });
  }

  if (req.method === "PUT") {
    const body = await req.json();
    const threadId = sp.threadId;
    await prisma.message.deleteMany({ where: { threadId } });
    const now = Date.now();
    for (let i = 0; i < body.messages.length; i++) {
      await prisma.message.create({
        data: {
          id: `${threadId}-${i}-${now}`,
          threadId,
          message: body.messages[i],
          timestamp: BigInt(now + i),
        },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

async function handleProfiles(req: NextRequest, params: Params) {
  const sp = await params.searchParams;

  if (req.method === "GET") {
    if (sp.id) {
      const p = await prisma.profile.findUnique({ where: { id: sp.id } });
      return NextResponse.json(p?.data ?? null);
    }
    const all = await prisma.profile.findMany();
    return NextResponse.json(all.map((p) => p.data));
  }

  if (req.method === "POST") {
    const body = await req.json();
    const profiles = Array.isArray(body) ? body : [body];
    for (const p of profiles) {
      await prisma.profile.create({ data: { id: p.id, data: p } });
    }
    return NextResponse.json({ ok: true });
  }

  if (req.method === "PATCH") {
    const body = await req.json();
    await prisma.profile.update({
      where: { id: body.id },
      data: { data: body },
    });
    return NextResponse.json({ ok: true });
  }

  if (req.method === "DELETE") {
    await prisma.profile.delete({ where: { id: sp.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

async function handlePrompts(req: NextRequest, params: Params) {
  const sp = await params.searchParams;

  if (req.method === "GET") {
    if (sp.id) {
      const p = await prisma.prompt.findUnique({ where: { id: sp.id } });
      return NextResponse.json(
        p
          ? {
              ...p,
              createdAt: Number(p.createdAt),
              updatedAt: Number(p.updatedAt),
            }
          : null
      );
    }
    const all = await prisma.prompt.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      all.map((p) => ({
        ...p,
        createdAt: Number(p.createdAt),
        updatedAt: Number(p.updatedAt),
      }))
    );
  }

  if (req.method === "POST") {
    const body = await req.json();
    await prisma.prompt.create({
      data: {
        id: body.id,
        name: body.name,
        text: body.text,
        folderId: body.folderId ?? null,
        createdAt: BigInt(body.createdAt ?? Date.now()),
        updatedAt: BigInt(body.updatedAt ?? Date.now()),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (req.method === "PATCH") {
    const body = await req.json();
    const data: Record<string, unknown> = { updatedAt: BigInt(Date.now()) };
    if (body.name !== undefined) data.name = body.name;
    if (body.text !== undefined) data.text = body.text;
    if (body.folderId !== undefined) data.folderId = body.folderId;
    await prisma.prompt.update({ where: { id: sp.id }, data });
    return NextResponse.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (sp.folderId) {
      await prisma.prompt.deleteMany({ where: { folderId: sp.folderId } });
    } else {
      await prisma.prompt.delete({ where: { id: sp.id } });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}

// ---------------------------------------------------------------------------
// Prompt Folders
// ---------------------------------------------------------------------------

async function handleFolders(req: NextRequest, params: Params) {
  const sp = await params.searchParams;

  if (req.method === "GET") {
    if (sp.id) {
      const f = await prisma.promptFolder.findUnique({ where: { id: sp.id } });
      return NextResponse.json(
        f
          ? {
              ...f,
              createdAt: Number(f.createdAt),
              updatedAt: Number(f.updatedAt),
            }
          : null
      );
    }
    const all = await prisma.promptFolder.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      all.map((f) => ({
        ...f,
        createdAt: Number(f.createdAt),
        updatedAt: Number(f.updatedAt),
      }))
    );
  }

  if (req.method === "POST") {
    const body = await req.json();
    await prisma.promptFolder.create({
      data: {
        id: body.id,
        name: body.name,
        createdAt: BigInt(body.createdAt ?? Date.now()),
        updatedAt: BigInt(body.updatedAt ?? Date.now()),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (req.method === "PATCH") {
    const body = await req.json();
    await prisma.promptFolder.update({
      where: { id: sp.id },
      data: { name: body.name, updatedAt: BigInt(Date.now()) },
    });
    return NextResponse.json({ ok: true });
  }

  if (req.method === "DELETE") {
    await prisma.prompt.deleteMany({ where: { folderId: sp.id } });
    await prisma.promptFolder.delete({ where: { id: sp.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const handlers: Record<
  string,
  (req: NextRequest, params: Params) => Promise<NextResponse>
> = {
  threads: handleThreads,
  messages: handleMessages,
  profiles: handleProfiles,
  prompts: handlePrompts,
  folders: handleFolders,
};

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  if (!entity || !handlers[entity]) {
    return NextResponse.json({ error: "unknown entity" }, { status: 400 });
  }
  return handlers[entity](req, {
    searchParams: Promise.resolve(
      Object.fromEntries(url.searchParams.entries())
    ),
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
