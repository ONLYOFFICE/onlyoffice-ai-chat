import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useEffect, useState } from "react";
import { useApi } from "../../providers/ApiProvider";
import { useI18n } from "../../providers/LocalesProvider";
import { useToolsContext } from "../../tools/context";
import { Icon } from "../icon";
import { IconButton } from "../icon-button";
import { Loader } from "../loader";
import useCopyToClipboard from "../markdown/hooks/useCopyToClipboard";

const TOOL_CALL_COLOR = "var(--chat-message-tool-call-name-color)";
export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
}) => {
  const { t, isRTL } = useI18n();
  const api = useApi();
  const { servers: serversInstance } = useToolsContext();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { isCopied: isArgsCopied, copyToClipboard: copyArgs } =
    useCopyToClipboard({ copiedDuration: 2000 });
  const { isCopied: isResultCopied, copyToClipboard: copyResult } =
    useCopyToClipboard({ copiedDuration: 2000 });

  const type = serversInstance.getServerType(toolName);
  const name = type ? toolName.replace(`${type}_`, "") : toolName;

  const isLoading = result === undefined;

  const isWebSearch = name === "web_search";
  const isWebCrawling = name === "web_crawling";
  const isImageGeneration = name === "generate_image";

  let webSearchName = "";

  let argsTextFinal = argsText;

  try {
    const parsedArgs = JSON.parse(argsTextFinal);

    if (parsedArgs.args) {
      argsTextFinal = JSON.stringify(parsedArgs.args);
    }

    webSearchName = argsTextFinal
      ? isWebSearch
        ? JSON.parse(argsTextFinal).query
        : isWebCrawling
          ? JSON.parse(argsTextFinal).urls[0]
          : ""
      : "";
  } catch {
    //ignore
  }

  let parsedResult = result;
  try {
    parsedResult = typeof result === "string" ? JSON.parse(result) : result;
  } catch {
    // ignore
  }

  const imageBase64: string | undefined =
    isImageGeneration &&
    parsedResult &&
    typeof parsedResult === "object" &&
    "data" in parsedResult &&
    parsedResult.data &&
    typeof parsedResult.data === "object" &&
    "base64" in parsedResult.data &&
    typeof parsedResult.data.base64 === "string"
      ? (parsedResult.data.base64 as string)
      : undefined;

  // Newer threads store the generated image in `storage.attachments` and
  // keep only a lightweight `{ data: { ref } }` marker in the message —
  // so the megabyte-scale base64 isn't re-sent to the model every turn.
  // Hydrate it through `api.attachments`, which routes in-process or over
  // HTTP depending on the deployment mode. Legacy inline `base64` results
  // still render directly via the branch above.
  const imageRef: string | undefined =
    isImageGeneration &&
    parsedResult &&
    typeof parsedResult === "object" &&
    "data" in parsedResult &&
    parsedResult.data &&
    typeof parsedResult.data === "object" &&
    "ref" in parsedResult.data &&
    typeof parsedResult.data.ref === "string"
      ? (parsedResult.data.ref as string)
      : undefined;

  const [refImageBase64, setRefImageBase64] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (!imageRef) {
      setRefImageBase64(undefined);
      return;
    }
    let cancelled = false;
    api.attachments
      .get(imageRef)
      .then((record) => {
        if (!cancelled) setRefImageBase64(record?.base64 ?? undefined);
      })
      .catch(() => {
        if (!cancelled) setRefImageBase64(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [api, imageRef]);

  const imageData = imageBase64 ?? refImageBase64;

  return (
    <div className="my-[8px] flex w-full flex-col gap-[8px]">
      <div
        className="flex items-center gap-[10px] cursor-pointer"
        onClick={() => {
          if (isWebCrawling) {
            window.open(webSearchName, "_blank");
            return;
          }

          if (isWebSearch && result === undefined) {
            return;
          }

          setIsCollapsed(!isCollapsed);
        }}
      >
        {!isLoading ? (
          <Icon
            name={parsedResult?.data?.error ? "status.error" : "tool.called"}
            size={16}
            noColor
          />
        ) : (
          <Loader size={16} />
        )}
        <span className="flex items-center gap-[8px] rounded-[4px] ps-[4px] pe-[8px] font-normal text-[var(--chat-message-tool-call-name-color)] bg-[var(--chat-message-tool-call-name-background-color)] min-w-0 w-fit">
          {isWebSearch ? (
            <Icon name="btn-web-search" size={24} color={TOOL_CALL_COLOR} />
          ) : !isWebCrawling ? (
            <Icon name="code" size={24} color={TOOL_CALL_COLOR} isStroke />
          ) : null}
          <span className="truncate">
            {isWebSearch
              ? webSearchName
              : isWebCrawling
                ? `${name} | ${webSearchName}`
                : name}
          </span>
        </span>
        {isWebCrawling ? (
          <Icon
            name="btn-external"
            size={16}
            color={TOOL_CALL_COLOR}
            isStroke
          />
        ) : isWebSearch && result === undefined ? null : (
          <span className={isRTL && isCollapsed ? "rotate-180" : ""}>
            <Icon
              name={!isCollapsed ? "arrow.bottom" : "arrow.right"}
              size={16}
              width={8}
              height={8}
              color={TOOL_CALL_COLOR}
              isStroke
            />
          </span>
        )}
      </div>
      {!isCollapsed ? (
        <div className="flex flex-col gap-[8px] mt-[8px] px-[12px] py-[8px] bg-[var(--chat-message-tool-call-body-background-color)] rounded-[12px]">
          {isWebSearch ? null : (
            <div className="">
              <p className="flex flex-row items-center justify-between text-[var(--chat-message-tool-call-header-color)] font-bold">
                {t("ToolCallArguments")}
                <span
                  onClick={() => copyArgs(argsTextFinal ? argsTextFinal : "{}")}
                  className="cursor-pointer"
                >
                  <Icon
                    name={isArgsCopied ? "checked" : "btn-copy"}
                    size={24}
                    color={TOOL_CALL_COLOR}
                    isStroke={isArgsCopied}
                  />
                </span>
              </p>
              <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[var(--chat-message-tool-call-pre-color)] border border-[var(--chat-message-tool-call-pre-border-color)] bg-[var(--chat-message-tool-call-pre-background-color)] px-[8px] py-[2px] rounded-[4px]">
                {argsTextFinal ? argsTextFinal : "{}"}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div className="">
              {isWebSearch ? (
                <div>
                  {(() => {
                    try {
                      // Check if there's an error in the result

                      if (parsedResult?.data?.error) {
                        return (
                          <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[var(--chat-message-tool-call-pre-color)] border border-[var(--chat-message-tool-call-pre-border-color)] bg-[var(--chat-message-tool-call-pre-background-color)] px-[8px] py-[2px] rounded-[4px]">
                            {typeof parsedResult === "string"
                              ? result
                              : parsedResult?.data?.error}
                          </pre>
                        );
                      }

                      const searchResults = parsedResult?.data || [];

                      return searchResults.length > 0 ? (
                        <div className="flex flex-col gap-[10px]">
                          {searchResults.map(
                            (item: {
                              id: string;
                              title: string;
                              url: string;
                              publishedDate?: string;
                              author?: string;
                            }) => (
                              <div
                                key={item.id}
                                className="group h-[36px] px-[8px] rounded-[4px] flex flex-row items-center justify-between cursor-pointer hover:bg-[var(--drop-down-menu-item-hover-color)] transition-colors"
                                onClick={() => window.open(item.url, "_blank")}
                              >
                                <div className="flex flex-row items-center gap-[8px] min-w-0 flex-1">
                                  <IconButton
                                    iconName="btn-web-search"
                                    size={24}
                                    disableHover
                                  />
                                  <h4 className="font-normal text-[var(--chat-message-tool-call-pre-color)] truncate">
                                    {item.title}
                                  </h4>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <IconButton
                                    iconName="btn-external"
                                    size={24}
                                    disableHover
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[var(--chat-message-tool-call-pre-color)] border border-[var(--chat-message-tool-call-pre-border-color)] bg-[var(--chat-message-tool-call-pre-background-color)] px-[8px] py-[2px] rounded-[4px]">
                          {typeof result === "string"
                            ? result
                            : JSON.stringify(result, null, 2)}
                        </pre>
                      );
                    } catch {
                      return (
                        <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[var(--chat-message-tool-call-pre-color)] border border-[var(--chat-message-tool-call-pre-border-color)] bg-[var(--chat-message-tool-call-pre-background-color)] px-[8px] py-[2px] rounded-[4px]">
                          {typeof result === "string"
                            ? result
                            : JSON.stringify(result, null, 2)}
                        </pre>
                      );
                    }
                  })()}
                </div>
              ) : (
                <>
                  <p className="flex flex-row items-center justify-between text-[var(--chat-message-tool-call-header-color)] font-bold">
                    {t("ToolCallResult")}
                    <span
                      onClick={() =>
                        copyResult(
                          typeof result === "string"
                            ? result
                            : JSON.stringify(result, null, 2)
                        )
                      }
                      className="cursor-pointer"
                    >
                      <Icon
                        name={isResultCopied ? "checked" : "btn-copy"}
                        size={24}
                        color={TOOL_CALL_COLOR}
                        isStroke={isResultCopied}
                      />
                    </span>
                  </p>
                  <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[var(--chat-message-tool-call-pre-color)] border border-[var(--chat-message-tool-call-pre-border-color)] bg-[var(--chat-message-tool-call-pre-background-color)] px-[8px] py-[2px] rounded-[4px]">
                    {typeof result === "string"
                      ? result
                      : JSON.stringify(result, null, 2)}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
      {isImageGeneration && imageData ? (
        <img
          src={
            imageData.startsWith("data:")
              ? imageData
              : `data:image/png;base64,${imageData}`
          }
          alt={t("ToolCallResult")}
          className="block max-w-full rounded-[8px]"
        />
      ) : null}
    </div>
  );
};
