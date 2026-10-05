/**
 * Link-target sanitizer for both markdown render paths.
 *
 * Mirrors react-markdown's `defaultUrlTransform` — keep relative targets and
 * the `http(s)`, `mailto`, `irc(s)`, `xmpp` schemes, blank everything else —
 * with `file:` added to the allow-list: a desktop host renders replies that
 * point at files the assistant just wrote and reads the path off the anchor
 * to open them in the editor (Bug 83951). Reimplemented rather than imported
 * so this module can be loaded eagerly without pulling react-markdown out of
 * the lazy chunk. The schemes that stay blanked are rendered as inert
 * anchors — see the `a` component in `Markdown.utils.tsx`.
 */
const SAFE_PROTOCOL = /^(https?|ircs?|mailto|xmpp|file)$/i;

export const markdownUrlTransform = (value: string): string => {
  const colon = value.indexOf(":");
  const questionMark = value.indexOf("?");
  const numberSign = value.indexOf("#");
  const slash = value.indexOf("/");

  if (
    // No protocol: a relative target.
    colon === -1 ||
    // The first colon sits after a `/`, `?` or `#`, so it is not a protocol.
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (numberSign !== -1 && colon > numberSign) ||
    SAFE_PROTOCOL.test(value.slice(0, colon))
  ) {
    return value;
  }
  return "";
};
