// Re-export surface only. The canonical definitions live in `shared/` —
// `CapabilitiesUI` and `inferCapabilities` were previously copied verbatim
// into this file and `src/capabilities.ts`, so any change to the heuristic
// had to be applied identically in three places or the copies silently
// desynced.
export { CapabilitiesUI } from "../shared/capabilities-ui";
export type { Capabilities } from "../shared/capabilities";
export { inferCapabilities } from "../shared/infer-capabilities";

// Re-export the canonical ActionType (with `Default`) from `shared/`.
// Internal storage and assignments rely on the `Default` member, so the
// public surface must include it.
export { ActionType } from "../shared/action-type";
