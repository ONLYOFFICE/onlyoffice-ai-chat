import { useCallback, useEffect, useRef, useState } from "react";
import { usePlatform } from "../../../providers/PlatformProvider";
import type { CopyFormat } from "../../../providers/PlatformProvider";

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const { copyToClipboard: platformCopy } = usePlatform();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const copyToClipboard = useCallback(
    (value: string, format: CopyFormat = "text") => {
      if (!value) return;

      const writer = platformCopy
        ? () => Promise.resolve(platformCopy(value, { format }))
        : () => navigator.clipboard.writeText(value);

      writer().then(() => {
        setIsCopied(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setIsCopied(false), copiedDuration);
      });
    },
    [platformCopy, copiedDuration]
  );

  return { isCopied, copyToClipboard };
};

export default useCopyToClipboard;
