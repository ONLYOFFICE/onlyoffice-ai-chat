import { useState } from "react";
import { usePlatform } from "../../../providers/PlatformProvider";

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const { copyToClipboard: platformCopy } = usePlatform();

  const copyToClipboard = (value: string) => {
    if (!value) return;

    const writer = platformCopy
      ? () => Promise.resolve(platformCopy(value))
      : () => navigator.clipboard.writeText(value);

    writer().then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

export default useCopyToClipboard;
