# `ContextEngine`

> Source: [`src/core/services/context/`](../../../src/core/services/context)

`ContextEngine` exposes the two optional context reads of
[`StorageAdapter`](../storage/storage.md#getcontextfolders-optional) —
`getContextFolders` and `getRoomSkills` — as engine methods, so they
cross the `ServerAPI` bridge like every other read. That is the whole
reason it exists: in server mode the browser holds a stub adapter and
the real one answers over HTTP, so a direct `storage.getContextFolders`
call from the widget would never reach the host.

The engine also absorbs the optionality. A host that implements neither
method gets an empty array from both calls — callers never see
`undefined is not a function`.

`core/` runs on both server and client; this engine has no DOM /
browser APIs.

---

## Construction

```ts
import { ContextEngine } from "@onlyoffice/ai-chat";

const engine = new ContextEngine({ storage });
```

```ts
type ContextEngineDeps = {
  storage: StorageAdapter;
};
```

---

## Methods

```ts
getContextFolders(): Promise<ContextFolder[]>;
getRoomSkills(cloud: string, roomId: string): Promise<RoomSkill[]>;
```

| Method | Delegates to | Without the storage method |
| --- | --- | --- |
| `getContextFolders` | `storage.getContextFolders()` | resolves `[]` |
| `getRoomSkills(cloud, roomId)` | `storage.getRoomSkills(cloud, roomId)` | resolves `[]` |

Results are passed through untouched — no filtering, no reordering. The
composer's clouds store drops clouds without rooms on its side; a host
controller returns exactly what its storage said.

Storage failures propagate as rejections. The widget's store logs and
falls back to an empty list; a host controller turns them into an HTTP
error like any other engine failure.

---

## Routes

```ts
DEFAULT_CONTEXT_ROUTES = {
  getContextFolders: { method: "GET", path: "context/get-context-folders" },
  getRoomSkills: {
    method: "GET",
    path: "context/get-room-skills",
    params: ["cloud", "roomId"],
  },
};
```

Both are `GET`; `getRoomSkills` serializes its two positional arguments
as the `cloud` and `roomId` query parameters. Registered under the
`context` key of `DEFAULT_SERVER_API_ROUTES`, `ServerAPIEngines` and
`ServerAPI`.

A host that serves the widget in server mode needs a controller bound
to these two routes that calls the same engine over its own storage:

```ts
const engine = new ContextEngine({ storage });

getContextFolders: async (req, res) => res.json(await engine.getContextFolders()),
getRoomSkills: async (req, res) =>
  res.json(await engine.getRoomSkills(String(req.query.cloud), String(req.query.roomId))),
```

---

## Who calls it

The composer's clouds store (`fetchContextFolders`, `fetchRoomSkills`)
via `api.context`. The store reads the context folders when the
settings menu mounts and the skills whenever the connected room changes.
