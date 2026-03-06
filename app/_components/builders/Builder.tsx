"use client";

import {
  getPreviewUrl,
  getStatus,
  getTerminalOutput,
  init,
  readFile,
  setStatusListener,
  setTerminalListener,
  writeFile,
} from "@/app/_libs/webcontainer/core";
import type { WebContainerStatus } from "@/app/_libs/webcontainer/core";
import { defaultPageContent } from "@/app/_libs/webcontainer/defaultProject";
import { useCallback, useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import CodeTab from "./CodeTab";
import PreviewTab from "./PreviewTab";

const DEFAULT_OPEN_FILE = "app/page.jsx";
const WRITE_DEBOUNCE_MS = 500;

export default function Builder() {
  const [status, setStatus] = useState<WebContainerStatus>(getStatus());
  const [previewUrl, setPreviewUrl] = useState<string | null>(getPreviewUrl());
  const [code, setCode] = useState(defaultPageContent);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState(() => getTerminalOutput());
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoSelectedRef = useRef(false);

  const setPageCode = useCallback(
    (content: string) => {
      setCode(content);
      if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current);
      writeTimeoutRef.current = setTimeout(async () => {
        writeTimeoutRef.current = null;
        if (!currentFilePath) return;
        try {
          await writeFile(currentFilePath, content);
          setError(null);
        } catch (err) {
          console.error("[Builder] writeFile failed:", err);
          setError(err instanceof Error ? err.message : "Failed to update preview");
        }
      }, WRITE_DEBOUNCE_MS);
    },
    [currentFilePath],
  );

  const handleSelectFile = useCallback(async (path: string) => {
    setError(null);
    try {
      const content = await readFile(path);
      setCurrentFilePath(path);
      setCode(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file");
    }
  }, []);

  const handleTreeLoad = useCallback(() => {
    if (hasAutoSelectedRef.current) return;
    hasAutoSelectedRef.current = true;
    handleSelectFile(DEFAULT_OPEN_FILE);
  }, [handleSelectFile]);

  useEffect(() => {
    setStatusListener((s) => {
      setStatus(s);
      if (s === "ready") setPreviewUrl(getPreviewUrl());
    });
    setTerminalListener((out) => setTerminalOutput(out));
    return () => {
      setStatusListener(null);
      setTerminalListener(null);
      if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (getStatus() === "ready" || getStatus() === "starting") {
        setPreviewUrl(getPreviewUrl());
        return;
      }
      setError(null);
      try {
        await init((url) => {
          if (!cancelled) setPreviewUrl(url);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to start");
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (typeof window !== "undefined" && !window.crossOriginIsolated) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <div className="border-border bg-muted/50 rounded-lg border p-6">
          <h2 className="text-foreground font-geist-semi-bold text-lg font-semibold">
            WebContainer not supported
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            This needs cross-origin isolation. Use a supported browser (Chrome, Edge, Firefox, or
            Safari 16.4+).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="preview" className="flex h-full flex-1 flex-col gap-0 px-0">
        <h1 className="font-parabole mt-4 ml-4 text-lg lg:mt-2 lg:ml-2">Files</h1>
        <div className="shrink-0 p-2">
          <TabsList className="bg-primary/10 p-1">
            <TabsTrigger
              value="preview"
              className="data-active:bg-primary data-active:text-primary-foreground data-active:border-primary/30"
            >
              Preview
            </TabsTrigger>
            <TabsTrigger
              value="code"
              className="data-active:bg-primary data-active:text-primary-foreground data-active:border-primary/30"
            >
              Code
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="preview" className="min-h-0 flex-1 overflow-auto">
          <PreviewTab status={status} previewUrl={previewUrl} error={error} />
        </TabsContent>

        <TabsContent value="code" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CodeTab
            status={status}
            terminalOutput={terminalOutput}
            code={code}
            currentFilePath={currentFilePath}
            error={error}
            onSelectFile={handleSelectFile}
            onCodeChange={setPageCode}
            onTreeLoad={handleTreeLoad}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
