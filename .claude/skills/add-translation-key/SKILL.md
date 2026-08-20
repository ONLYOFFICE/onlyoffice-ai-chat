---
name: add-translation-key
description: Add, rename, or remove a UI translation key. All 41 locale files must stay in lockstep and the TranslationKey type is generated from en.json — nothing enforces either mechanically. Load whenever a user-visible string changes.
---

# Translation keys

## The invariant

`src/translations/` holds **41 locale files with 136 keys each, currently
in perfect lockstep** — no locale has a missing or extra key. No test,
lint rule, or CI check enforces this. Keep it true by hand.

`en.json` is the source of truth: `TranslationKey` and `Translations` in
`src/ui/providers/LocalesProvider/generated-types.ts` are generated from
it. `fallbackLng: "en"` means a key missing from a translation silently
renders the English text — so drift is invisible at runtime and only
shows up as an untranslated UI.

## Adding a key

1. Add it to `src/translations/en.json`.
2. Add it to **all 40 other locale files**. Translate where you can; if
   you can't, use the English string as a placeholder rather than
   omitting the key — an omission is what causes drift.
3. Regenerate the type:
   ```
   npm run generate:i18n
   ```
   This rewrites `generated-types.ts` from `en.json`. Never hand-edit
   that file — it carries an `AUTO-GENERATED` header and `prebuild`
   regenerates it on every build.
4. Use it in the UI:
   ```ts
   const { t } = useI18n();   // ui/providers/LocalesProvider
   …
   {t("YourKey")}
   ```

## Renaming or removing

Do it across all 41 files in the same change, regenerate, then
`npm run typecheck` — the generated union turns every stale `t("OldKey")`
call site into a compile error, which is the only automated safety net
you get here.

## Checking parity

Before committing any translation change:

```
python3 - <<'PY'
import json,glob,os
en=json.load(open('src/translations/en.json'))
for f in sorted(glob.glob('src/translations/*.json')):
    d=json.load(open(f))
    miss,extra=set(en)-set(d),set(d)-set(en)
    if miss or extra:
        print(os.path.basename(f),'missing',sorted(miss),'extra',sorted(extra))
PY
```

Silence means all 41 are in lockstep.

## Notes

- **JSON values are never nested** — the file is one flat object of
  string values, so there is no `keySeparator` traversal to worry about.
- Most keys are PascalCase (`AIModels`, `MCPServers`, `WebSearch`). Six
  keys use a dotted prefix with a snake_case tail for error families:
  `ChatError.auth`, `ChatError.model_not_found`, `ChatError.rate_limit`,
  `ChatError.timeout`, `ChatError.network`, `ChatError.aborted`. These are
  flat string keys that merely *contain* a dot — follow that pattern for a
  new error family, PascalCase for everything else.
- Hosts can override any subset of strings at runtime and register whole
  new locales; that surface is documented in
  `docs/ui/providers/locales.md` and is separate from adding a key here.
