"use client";

import type { WebContainerStatus } from "@/app/_libs/webcontainer/core";
import { cn } from "@/app/_libs/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import dracula from "react-syntax-highlighter/dist/esm/styles/prism/dracula";
import { FolderOpenIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { FileTree } from "./FileTree";
import { TerminalCard } from "./TerminalCard";

const EDITOR_BG = "var(--background)";
const LINE_NUM = "var(--muted-foreground)";
const CARET = "var(--foreground)";
const EDITOR_FONT_SIZE = "0.875rem";
const EDITOR_LINE_HEIGHT = "1.5rem";
const EDITOR_PADDING = {
  paddingTop: "0.5rem",
  paddingRight: "1rem",
  paddingBottom: "0.5rem",
  paddingLeft: "0.75rem",
};

function getLanguageFromPath(path: string | null): string {
  if (!path) return "text";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    css: "css",
    json: "json",
    html: "html",
    md: "markdown",
  };
  return map[ext] ?? "text";
}

export type CodeTabProps = {
  status: WebContainerStatus;
  terminalOutput: string;
  code: string;
  currentFilePath: string | null;
  error: string | null;
  onSelectFile: (path: string) => void;
  onCodeChange: (code: string) => void;
  onTreeLoad?: () => void;
};

export default function CodeTab({
  status,
  terminalOutput,
  code,
  currentFilePath,
  error,
  onSelectFile,
  onCodeChange,
  onTreeLoad,
}: CodeTabProps) {
  const isReady = status === "ready";
  const breadcrumb = currentFilePath ? currentFilePath.split("/") : [];
  const lines = code ? code.split("\n") : [];
  const [mobileFilesOpen, setMobileFilesOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden border-t md:flex-row">
        <div
          className={cn(
            "border-border flex shrink-0 flex-col border-b md:min-h-0 md:w-[220px] md:min-w-0 md:border-r md:border-b-0",
            mobileFilesOpen ? "min-h-[180px]" : "hidden min-h-0 md:flex",
          )}
        >
          <div className="border-border flex h-10 shrink-0 items-center justify-between border-b px-3 py-2 md:block">
            <h2 className="text-foreground font-geist-semi-bold text-sm font-semibold">Files</h2>
            <button
              type="button"
              onClick={() => setMobileFilesOpen(false)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground -mr-1 rounded p-1 md:hidden"
              aria-label="Close file list"
            >
              <ChevronDownIcon className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <FileTree
              isReady={isReady}
              selectedPath={currentFilePath}
              onSelectFile={(path) => {
                onSelectFile(path);
                setMobileFilesOpen(false);
              }}
              onTreeLoad={onTreeLoad}
            />
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:rounded-r-lg">
          <div className="border-border text-muted-foreground flex h-10 shrink-0 items-center gap-2 border-b px-3 py-2 font-mono text-xs">
            {/* Mobile  */}
            <button
              type="button"
              onClick={() => setMobileFilesOpen(true)}
              className="text-foreground hover:bg-muted flex items-center gap-1 rounded px-2 py-1 md:hidden"
              aria-label="Open file list"
            >
              <FolderOpenIcon className="size-3.5" />
              <span>Files</span>
            </button>
            {breadcrumb.length > 0 ? (
              breadcrumb.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-muted-foreground/60"> &gt; </span>}
                  <span className="text-foreground/90">{part}</span>
                </span>
              ))
            ) : (
              <span className={mobileFilesOpen ? "hidden md:inline" : ""}>Select a file</span>
            )}
          </div>
          <div
            className="overflow-x-hidden overflow-y-auto overscroll-contain"
            style={{ minHeight: 0, flex: "1 1 0%" }}
          >
            <div
              className="flex w-full font-mono text-sm"
              style={{
                height: `${Math.max(1, lines.length) * 1.5}rem`,
                minHeight: "100%",
                backgroundColor: EDITOR_BG,
              }}
            >
              <div
                className="shrink-0 py-2 pr-2 pl-3 text-right select-none md:pr-3 md:pl-4"
                style={{ backgroundColor: EDITOR_BG, color: LINE_NUM }}
                aria-hidden
              >
                {lines.length > 0 ? (
                  lines.map((_, i) => (
                    <div key={i} className="leading-6">
                      {i + 1}
                    </div>
                  ))
                ) : (
                  <div className="leading-6">1</div>
                )}
              </div>
              <div className="relative min-w-0 flex-1 overflow-hidden">
                <div
                  className="relative w-full"
                  style={{ minHeight: `${Math.max(1, lines.length) * 1.5}rem` }}
                >
                  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                    <SyntaxHighlighter
                      language={getLanguageFromPath(currentFilePath)}
                      style={dracula}
                      customStyle={{
                        margin: 0,
                        ...EDITOR_PADDING,
                        background: EDITOR_BG,
                        fontSize: EDITOR_FONT_SIZE,
                        lineHeight: EDITOR_LINE_HEIGHT,
                        minHeight: "100%",
                        fontFamily: "inherit",
                      }}
                      codeTagProps={{
                        style: {
                          fontFamily: "inherit",
                          fontSize: EDITOR_FONT_SIZE,
                          lineHeight: EDITOR_LINE_HEIGHT,
                          margin: 0,
                          padding: 0,
                        },
                      }}
                      showLineNumbers={false}
                      PreTag="div"
                    >
                      {code || " "}
                    </SyntaxHighlighter>
                  </div>
                  <textarea
                    className="relative block w-full min-w-0 resize-none border-0 bg-transparent font-mono placeholder:text-muted-foreground focus:ring-0 focus:outline-none overflow-hidden"
                    value={code}
                    onChange={(e) => onCodeChange(e.target.value)}
                    spellCheck={false}
                    placeholder={
                      isReady
                        ? "Select a file from the tree."
                        : "Start the environment to load files."
                    }
                    aria-label="Code editor"
                    style={{
                      ...EDITOR_PADDING,
                      fontSize: EDITOR_FONT_SIZE,
                      lineHeight: EDITOR_LINE_HEIGHT,
                      tabSize: 2,
                      minHeight: `${Math.max(1, lines.length) * 1.5}rem`,
                      color: "transparent",
                      caretColor: CARET,
                      overflow: "hidden",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {error && (
            <div className="border-border bg-destructive/10 text-destructive shrink-0 border-t px-3 py-2 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="border-border bg-muted/20 flex h-40 shrink-0 flex-col border-t md:h-[200px]">
        <TerminalCard output={terminalOutput} />
      </div>
    </div>
  );
}
