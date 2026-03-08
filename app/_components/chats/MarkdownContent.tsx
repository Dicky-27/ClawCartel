"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/app/_libs/utils";

const markdownClasses = {
  root: "chat-markdown break-words [&>*+*]:mt-2 [&>*:first-child]:mt-0",
  p: "text-foreground font-pp-neue-montreal-book text-sm leading-relaxed",
  h1: "font-pp-neue-montreal-bold text-base mt-3 mb-1",
  h2: "font-pp-neue-montreal-bold text-[15px] mt-3 mb-1",
  h3: "font-pp-neue-montreal-bold text-sm mt-2 mb-0.5",
  ul: "list-disc pl-5 space-y-0.5 my-2",
  ol: "list-decimal pl-5 space-y-0.5 my-2",
  li: "text-sm font-pp-neue-montreal-book",
  code: "font-pixeloid-mono text-xs bg-muted/60 text-foreground rounded px-1.5 py-0.5 border border-border/50",
  pre: "overflow-x-auto rounded-lg border border-border/50 bg-muted/40 p-3 my-2 text-sm font-mono",
  blockquote: "border-l-2 border-muted-foreground/50 pl-3 my-2 text-muted-foreground italic text-sm",
  a: "text-primary underline underline-offset-2 hover:opacity-80",
  strong: "font-pp-neue-montreal-bold",
  hr: "border-border my-3",
  table: "w-full border-collapse text-sm my-2",
  th: "border border-border bg-muted/50 px-2 py-1.5 text-left font-pp-neue-montreal-bold",
  td: "border border-border px-2 py-1.5 font-pp-neue-montreal-book",
};

export function MarkdownContent({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  if (!children) return null;

  return (
    <div className={cn(markdownClasses.root, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p: ({ children }) => <p className={markdownClasses.p}>{children}</p>,
        h1: ({ children }) => <h1 className={markdownClasses.h1}>{children}</h1>,
        h2: ({ children }) => <h2 className={markdownClasses.h2}>{children}</h2>,
        h3: ({ children }) => <h3 className={markdownClasses.h3}>{children}</h3>,
        ul: ({ children }) => <ul className={markdownClasses.ul}>{children}</ul>,
        ol: ({ children }) => <ol className={markdownClasses.ol}>{children}</ol>,
        li: ({ children }) => <li className={markdownClasses.li}>{children}</li>,
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className={markdownClasses.code} {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className={cn(markdownClasses.code, "block p-2")} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className={markdownClasses.pre}>{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className={markdownClasses.blockquote}>{children}</blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className={markdownClasses.a}>
            {children}
          </a>
        ),
        strong: ({ children }) => <strong className={markdownClasses.strong}>{children}</strong>,
        hr: () => <hr className={markdownClasses.hr} />,
        table: ({ children }) => <table className={markdownClasses.table}>{children}</table>,
        th: ({ children }) => <th className={markdownClasses.th}>{children}</th>,
        td: ({ children }) => <td className={markdownClasses.td}>{children}</td>,
      }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
