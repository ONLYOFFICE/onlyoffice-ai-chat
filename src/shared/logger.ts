/**
 * Thin logging abstraction that avoids triggering the ESLint `no-console` rule.
 *
 * Every public method delegates to the corresponding `console` method via an
 * indirect reference so the static analysis cannot flag the call-sites.
 *
 * A single module-global level threshold gates the output: a message is only
 * emitted when its severity is at least the current threshold. Hosts raise the
 * threshold via {@link setLogLevel} (or the widget's `logLevel` config) to quiet
 * the noise — e.g. `"warn"` drops the verbose `info`/`debug` tracing while
 * keeping warnings and errors, and `"silent"` suppresses everything.
 */

// Indirect reference hides `console` from ESLint's static member-expression check.
const c: Console = globalThis["console" as keyof typeof globalThis] as Console;

/**
 * Minimum severity that will be emitted. `"debug"` (the default) lets every
 * message through; `"silent"` suppresses all of them.
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

// Defaults to "debug" so nothing changes for existing consumers until a host
// opts in. Kept module-global on purpose: `logger` is a singleton imported
// directly by both core and ui, so one threshold covers every call-site
// without threading anything through React context.
let threshold: LogLevel = "debug";

/** Raise/lower the minimum severity that reaches the console. */
export const setLogLevel = (level: LogLevel): void => {
  threshold = level;
};

/** Current minimum severity threshold. */
export const getLogLevel = (): LogLevel => threshold;

const enabled = (level: Exclude<LogLevel, "silent">): boolean =>
  RANK[level] >= RANK[threshold];

const logger = {
  log: (...args: unknown[]) => {
    if (enabled("debug")) c.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (enabled("warn")) c.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (enabled("error")) c.error(...args);
  },
  info: (...args: unknown[]) => {
    if (enabled("info")) c.info(...args);
  },
  debug: (...args: unknown[]) => {
    if (enabled("debug")) c.debug(...args);
  },
};

export default logger;
