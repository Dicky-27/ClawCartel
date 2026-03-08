import type { Agent } from "@/app/_data/agents";
import { cn, getAgentColorByName } from "@/app/_libs/utils";
import Image from "next/image";
import { TypewriterText } from "./TypewriterText";
import { MarkdownContent } from "./MarkdownContent";
import { CollapsibleMessage } from "./CollapsibleMessage";

export function ChatBubble({
  name,
  date,
  imagePath,
  content,
  isUser,
  agent,
  onAvatarClick,
}: {
  name: string;
  date: string;
  imagePath: string;
  content: string;
  isUser: boolean;
  agent?: Agent | null;
  onAvatarClick?: () => void;
}) {
  const agentColor = getAgentColorByName(name);
  const safeContent = content || "";
  const isAvatarClickable = !isUser && agent != null && onAvatarClick != null;

  const messageBody = isUser ? (
    <MarkdownContent>{safeContent}</MarkdownContent>
  ) : (
    <TypewriterText text={safeContent} enabled={!!safeContent}>
      {(visible) => <MarkdownContent>{visible}</MarkdownContent>}
    </TypewriterText>
  );

  const avatarNode = (
    <Image
      src={imagePath}
      alt={isUser ? "You" : agent?.name ?? "Agent"}
      width={32}
      height={32}
      className={cn("size-8 object-contain", isAvatarClickable && "cursor-pointer")}
    />
  );

  return (
    <div className={cn("flex w-full flex-col items-start", isUser && "items-end")}>
      <div className={cn("flex items-center justify-between", isUser && "flex-row-reverse")}>
        {isAvatarClickable ? (
          <button
            type="button"
            onClick={onAvatarClick}
            className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`View ${agent?.name ?? name} profile`}
          >
            {avatarNode}
          </button>
        ) : (
          avatarNode
        )}
        <p className="font-pp-neue-montreal-book text-muted-foreground text-lg">{date}</p>
      </div>

      <div className={cn("ml-1 min-w-0 max-w-full", isUser && "text-right")}>
        <h1 className="font-pp-neue-montreal-bold mt-1 text-lg" style={{ color: agentColor }}>
          {name}
        </h1>
        <div className="font-pp-neue-montreal-book text-foreground min-w-0 wrap-break-word text-sm">
          <CollapsibleMessage contentLength={safeContent.length}>
            {messageBody}
          </CollapsibleMessage>
        </div>
      </div>
    </div>
  );
}
