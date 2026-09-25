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
 * A skill configured inside a room — a named instruction set the host makes
 * available to the model once the room is connected. `id` is the host's own
 * identifier and is only ever passed back.
 */
export type RoomSkill = {
  id: string;
  name: string;
};
