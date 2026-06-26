import { json } from "@codemirror/lang-json";
import { EditorState } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";
import { basicSetup, EditorView } from "codemirror";
import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { usePlatform } from "../../../providers/PlatformProvider/context";
import { useStores } from "../../../store/context";
import { useComponents } from "../../../providers/ComponentsProvider";

import "./ConfigEditor.css";

type ConfigEditorProps = {
  /** When `true`, the editor panel renders inline on the page. */
  open: boolean;
  onClose: () => void;
};

/**
 * Inline MCP-config editor. Renders the former config-dialog content
 * directly inside the MCP servers page (no modal overlay): a header with a
 * close button, the JSON editor, and the Cancel / Save footer.
 */
const ConfigEditor = ({ open, onClose }: ConfigEditorProps) => {
  const { Button } = useComponents();
  const { t, isRTL } = useI18n();
  const platform = usePlatform();
  const { useServersStore } = useStores();
  const saveConfig = useServersStore((s) => s.saveConfig);
  const getConfig = useServersStore((s) => s.getConfig);
  const setMcpConfigDirty = useServersStore((s) => s.setMcpConfigDirty);

  const editorRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  // The document as last loaded / saved — compared against the live value
  // to flag unsaved edits (the tab-leave discard guard).
  const initialDocRef = React.useRef("");
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState("");
  const [isValidJson, setIsValidJson] = React.useState(true);

  const validateJson = React.useCallback(
    (jsonString: string) => {
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.mcpServers) {
          if (
            !platform?.process?.isAvailable() &&
            Object.values(
              parsed.mcpServers as Record<string, Record<string, unknown>>
            ).some((config) => typeof config.url !== "string")
          ) {
            setIsValidJson(false);
            setError(t("LocalServersNotSupportedInWebEditor"));
            return false;
          }

          setIsValidJson(true);
          setError("");
          return true;
        }

        setIsValidJson(false);
        setError(t("ConfigurationError"));

        return false;
      } catch (err) {
        setError(
          `Invalid JSON format\n ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
        setIsValidJson(false);
        return false;
      }
    },
    [t, platform?.process]
  );

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const initializeEditor = async () => {
      if (cancelled) return;
      if (editorRef.current && !viewRef.current) {
        const mcpServers = (await getConfig()) ?? {};
        if (cancelled) return;
        const initialDoc = JSON.stringify({ mcpServers }, null, 2);

        initialDocRef.current = initialDoc;
        setValue(initialDoc);
        validateJson(initialDoc);
        setMcpConfigDirty(false);

        const state = EditorState.create({
          doc: initialDoc,
          extensions: [
            basicSetup,
            json(),
            EditorView.updateListener.of((update: ViewUpdate) => {
              if (update.docChanged) {
                const newValue = update.state.doc.toString();
                setValue(newValue);
                validateJson(newValue);
                setMcpConfigDirty(newValue !== initialDocRef.current);
              }
            }),
            EditorView.theme({
              ".cm-content": {
                minHeight: "215px",
                padding: "10px",
              },
              ".cm-focused": {
                outline: "none",
              },
              ".cm-scroller": {
                fontFamily: "monospace",
                // No fixed height: the editor grows vertically with its
                // content (the page scrolls), but long lines scroll
                // horizontally inside the editor. `overflow-y` must be
                // non-`visible` for `overflow-x: auto` to take effect;
                // `hidden` never clips here since there is no height cap.
                overflowX: "auto",
                overflowY: "hidden",
              },
              ".cm-gutters": {
                minHeight: "215px",
              },
            }),
          ],
        });

        viewRef.current = new EditorView({
          state,
          parent: editorRef.current,
        });
      } else if (!cancelled) {
        timerId = setTimeout(initializeEditor, 100);
      }
    };

    timerId = setTimeout(initializeEditor, 50);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [open, validateJson, getConfig, setMcpConfigDirty]);

  // Clear the dirty flag whenever the editor is closed (Cancel / Save) or
  // unmounted — there are no unsaved edits once it's gone.
  React.useEffect(() => {
    if (!open) setMcpConfigDirty(false);
    return () => setMcpConfigDirty(false);
  }, [open, setMcpConfigDirty]);

  const onSubmitAction = React.useCallback(() => {
    if (!isValidJson) return;
    saveConfig(JSON.parse(value));
    onClose();
  }, [isValidJson, saveConfig, value, onClose]);

  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && document.activeElement?.id === "config-editor") {
        e.preventDefault();
        onSubmitAction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onSubmitAction]);

  if (!open) return null;

  return (
    <div
      id="config-editor"
      data-testid="config-editor"
      dir={isRTL ? "rtl" : "ltr"}
      className="flex flex-col w-full py-[8px] mb-[8px] rounded-[8px] border border-[var(--servers-edit-config-buttons-border-color)] bg-[var(--modal-dialog-background-color)] select-text"
    >
      <div className="flex items-center justify-between ps-[16px] pe-[8px] mb-[8px]">
        <p className="font-bold text-fs-12 leading-[var(--lh-18)] text-[var(--settings-header-color)]">
          {t("EditConfiguration")}
        </p>
        {/* <IconButton iconName="btn-close" size={24} onClick={onClose} /> */}
      </div>
      <div className="px-[16px]">
        <div className="flex flex-col gap-[8px] pb-[8px]">
          <div className="flex flex-col gap-[8px] min-h-[256px] p-[8px] bg-[var(--servers-edit-config-json-background-color)] rounded-[4px]">
            <div className="flex flex-row justify-between">
              <p className=" text-[var(--servers-edit-config-json-header-color)]">
                {t("EnterYourJSONConfiguration")}
              </p>
              <p className="font-normal text-[var(--servers-edit-config-json-lang-color)]">
                json
              </p>
            </div>
            <div
              ref={editorRef}
              className="border border-[var(--servers-edit-config-json-editor-border-color)] bg-[var(--servers-edit-config-json-editor-background-color)] rounded-[4px]"
            />
            {error ? (
              <p className="text-[var(--text-negative)] font-normal whitespace-pre-line">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-row items-center justify-end gap-[8px] h-[24px]  mx-[-16px] px-[16px]">
          <Button onClick={onClose} variant="default">
            {t("Cancel")}
          </Button>
          <Button disabled={!isValidJson} onClick={onSubmitAction}>
            {t("Save")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfigEditor;
