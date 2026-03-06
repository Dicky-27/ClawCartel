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
}: {
  name: string;
  date: string;
  imagePath: string;
  content: string;
  isUser: boolean;
}) {
  const agentColor = getAgentColorByName(name);
  const safeContent = content || "";

  const messageBody = isUser ? (
    <MarkdownContent>{safeContent}</MarkdownContent>
  ) : (
    <TypewriterText text={safeContent} enabled={!!safeContent}>
      {(visible, showCursor) => (
        <>
          <MarkdownContent>{visible}</MarkdownContent>
          {showCursor && (
            <span
              className="typing-cursor ml-0.5 inline-block h-4 w-0.5 shrink-0 bg-current align-middle"
              aria-hidden
            />
          )}
        </>
      )}
    </TypewriterText>
  );

  return (
    <div className={cn("flex w-full flex-col items-start", isUser && "items-end")}>
      <div className={cn("flex items-center justify-between", isUser && "flex-row-reverse")}>
        <Image
          src={imagePath}
          alt="agent"
          width={32}
          height={32}
          className="size-8 object-contain"
        />
        <p className="font-pp-neue-montreal-book text-muted-foreground text-lg">{date}</p>
      </div>

      <div className={cn("ml-1", isUser && "text-right")}>
        <h1 className="font-pp-neue-montreal-bold mt-1 text-lg" style={{ color: agentColor }}>
          {name}
        </h1>
        <div className="font-pp-neue-montreal-book text-foreground text-sm">
          <CollapsibleMessage contentLength={safeContent.length}>
            {messageBody}
          </CollapsibleMessage>
        </div>
      </div>
    </div>
  );
}
