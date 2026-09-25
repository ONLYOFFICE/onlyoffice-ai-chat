# `ContextEngine`

> Source: [`src/core/services/context/`](../../../src/core/services/context)

`ContextEngine` exposes the optional context reads of
[`StorageAdapter`](../storage/storage.md#getcontextfolders-optional) —
`getContextFolders`, `getRoomSkills` and `getRoomSkill` — as engine
methods, so they
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
getRoomSkill(cloud: string, roomId: string, skillId: string): Promise<string | null>;
```

| Method | Delegates to | Without the storage method |
| --- | --- | --- |
| `getContextFolders` | `storage.getContextFolders()` | resolves `[]` |
| `getRoomSkills(cloud, roomId)` | `storage.getRoomSkills(cloud, roomId)` | resolves `[]` |
| `getRoomSkill(cloud, roomId, skillId)` | `storage.getRoomSkill(cloud, roomId, skillId)` | resolves `null` |

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
  getRoomSkill: {
    method: "GET",
    path: "context/get-room-skill",
    params: ["cloud", "roomId", "skillId"],
  },
};
```

All three are `GET`; the positional arguments become the `cloud`,
`roomId` and `skillId` query parameters. Registered under the
`context` key of `DEFAULT_SERVER_API_ROUTES`, `ServerAPIEngines` and
`ServerAPI`.

A host that serves the widget in server mode needs a controller bound
to these two routes that calls the same engine over its own storage:

```ts
const engine = new ContextEngine({ storage });

getContextFolders: async (req, res) => res.json(await engine.getContextFolders()),
getRoomSkills: async (req, res) =>
  res.json(await engine.getRoomSkills(String(req.query.cloud), String(req.query.roomId))),
getRoomSkill: async (req, res) =>
  res.json(
    await engine.getRoomSkill(
      String(req.query.cloud),
      String(req.query.roomId),
      String(req.query.skillId)
    )
  ),
```

---

## Who calls it

The composer's clouds store (`fetchContextFolders`, `fetchRoomSkills`)
via `api.context`. The store reads the context folders when the
settings menu mounts and the skills once, when a room is picked.

Nothing in the widget polls. A host whose clouds or rooms change at
runtime (the desktop's `onUpdateClouds`, a room edited on the portal)
refreshes through the store it already has from `useStores()`:

```ts
const { useCloudsStore } = useStores();
void useCloudsStore.getState().fetchContextFolders(); // clouds / rooms
void useCloudsStore.getState().fetchRoomSkills();     // the connected room's skills
useCloudsStore.getState().clearContextFolder();       // the room went away
```

---

## Skills in a round

The same folder holds the pieces `AIEngine` uses to put a connected
room's skills in front of the model (`src/core/services/context/skills.ts`):

| Export | Role |
| --- | --- |
| `ContextRoomRef` (in `core/storage`) | `{ cloud, id, skills? }` — what the composer sends in `actionArgs.contextRoom`: the room plus the enabled skills' frontmatter, as the clouds store read them when the room was picked |
| `resolveRoomSkills(ref)` | the shipped list, minus malformed entries; `undefined` when nothing is left. No storage read: the list travels with the request |
| `withSkillsIndex(prompt, skills)` | folds the *skill index* — one `<skill id name>description</skill>` entry per enabled skill, under a framed header — into the round's system-prompt override, after the host's own text |
| `getSkillsTools(skills)` | the built-in `read_skill` tool (`serverType: "skills"`), offered only while there are enabled skills; the ids are enumerated in its schema |
| `callSkillsTool(storage, skills, args)` | executes `read_skill`: the body via `getRoomSkill` — hidden (control, zero-width, bidi) characters stripped and capped at `SKILL_BODY_CAP` — or a JSON error string for an unknown id or a host without bodies |

The engine runs this on every path that starts or resumes a round. The
index and the tool come from the list in `actionArgs`, so a round costs
no extra host read; only `read_skill` reaches storage, and only when the
model asks for a body. `useMessages` builds `contextRoom` from the
clouds store's selection, skill list and switches. In server mode
`read_skill` runs on the host, over the host's own storage.

Names and ids in the index are escaped (`"`, `<`, `>`), never rewritten:
the id must read exactly as the `read_skill` enum spells it, and a name
is the label the user knows the skill by.

---

## The room as the round's scope (`contextRoomScopesRounds`)

By default a connected room contributes its skills and nothing else: the
round keeps the `contextEntityId` the host configured (or none), so tool
preferences, allow-always decisions and the assignment fallback stay
where they were. On a host whose rooms live in remote clouds (the
desktop editors) the room id means nothing to the local storage, and
scoping by it would only hide those preferences.

A host whose storage *does* know the room — DocSpace — turns on
`WidgetConfig.contextRoomScopesRounds`. The connected room's id then
becomes the round's `contextEntityId` for as long as it is connected:
its tools and execution scope, its allow-always preferences, its
assignment fallback, and whatever the host keys on the scope (DocSpace
appends the room's agent instruction). The thread stays under
`entityId`; disconnecting restores the configured scope.

```tsx
<WidgetConfigProvider config={{ contextRoomScopesRounds: true }}>
```

---

## The menu's hint

The context menu is headed "Add room context" with an "i" popover that
explains what connecting a room does. `WidgetConfig.roomContextHelpUrl`
adds a *Read more* button to it, opening the host's article in a new
tab; without the URL the hint is text only.
