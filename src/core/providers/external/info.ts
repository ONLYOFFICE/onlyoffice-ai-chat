/**
 * Static metadata for the `"external"` provider. `baseUrl` is empty
 * because the host owns the transport — the URL passed to
 * `PlatformAdapter.externalFetch` is whatever the inner SDK (selected
 * via `Profile.basedOn`) builds for the request.
 */
export const externalInfo = {
  name: "External",
  baseUrl: "",
};
