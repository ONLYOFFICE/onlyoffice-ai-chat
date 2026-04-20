# Changelog

## 0.1.19

New host callbacks on `ChatCallbacks` (all optional):

- `onThreadsUpdated` — fires on any thread change (`created` / `switched` / `renamed` / `cleared` / `deleted`).
- `onProfilesUpdated` — fires on any profile inventory change (`created` / `updated` / `deleted`).
- `onProfileUpdated` — fires on `editProfile` (granular, previously missing).
- `onCurrentChatProfileUpdated` — fires when the effective chat profile changes, with `scope: "session" | "persisted"`.
- `onModelAssignmentUpdated` — fires on every task-slot assignment (`default`, `chat`, `summarization`, `translation`, `textAnalysis`, `imageGeneration`, `ocr`, `vision`).
- `onServersUpdated` — fires on MCP changes (`config-saved` / `server-deleted` / `tool-toggled` / `tool-auto-approve-changed`).
- `onWebSearchUpdated` — fires on every `setWebSearchData` (including disable).

New imperative methods on `AIChatWidgetRef` to re-sync in-memory state when the host mutates storage externally:

- `updateProfiles()` — re-reads the profile list.
- `updateThreads()` — re-reads the thread list.
- `updateCurrentChat()` — re-reads the persisted chat profile.
- `updateModelAssignment()` — re-reads `default` + 7 task profile assignments.
- `updateMCPServer()` — re-reads MCP config and rebuilds the tool list.
- `updateWebSearch()` — re-reads Web Search configuration.

New widget config flag:

- `isDialogFullscreen` — puts every built-in dialog into fullscreen mode. Per-call `<DialogContent isFullscreen>` still wins when explicitly set.

## 0.1.18

- `hideProfilePicker` — hides the `Ask <profile>` row in the composer.
- `hideSettingsButton` — hides the gear button in the header.
- `onSettingsClick` — fully overrides the settings button click (built-in toggle is skipped).
- `isSettingsActive` — forces the settings button active state (override for `currentPage === "settings"`).
- `DialogContent.isFullscreen` — renders the dialog at 100% of the portal container and hides the header close button.

All widget props live on `AIChatWidget`. In headless mode, the same flags are available via `WidgetConfigProvider`.

## 0.1.0

- Initial release: extracted from ONLYOFFICE AI Agent plugin
