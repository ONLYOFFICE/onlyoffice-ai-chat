/**
 * A room the user can pull into the conversation as context. `id` is the
 * host's own identifier — the widget only passes it back, never parses it.
 */
export type ContextRoom = {
  id: string;
  name: string;
};

/**
 * One cloud account's rooms, as listed in the composer's settings menu. `cloud`
 * is the account label the host wants shown as the group heading.
 */
export type ContextFolder = {
  cloud: string;
  rooms: ContextRoom[];
};

/**
 * A skill configured inside a room — an Agent Skills Markdown file the host
 * makes available to the model once the room is connected. This is the
 * file's frontmatter only: `name` and `description` go into the model's
 * skill index, the body is read on demand through
 * `StorageAdapter.getRoomSkill`. `id` is the host's own identifier and is
 * only ever passed back.
 */
export type RoomSkill = {
  id: string;
  name: string;
  description: string;
};

/**
 * The room a round runs with as context, as the composer sends it in
 * `ActionArgs.contextRoom`: the cloud and room id from `getContextFolders`,
 * plus the skills the round may use — the frontmatter the clouds store read
 * once through `getRoomSkills` when the room was connected, minus the ones
 * the user switched off. The engine builds the skill index and the
 * `read_skill` tool from this list without another read; only a skill's
 * body is fetched on demand, through `getRoomSkill`.
 */
export type ContextRoomRef = {
  cloud: string;
  id: string;
  skills?: RoomSkill[];
};
