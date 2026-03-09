"use client";

import {
  ensureParentDirs,
  getPreviewUrl,
  getStatus,
  getTerminalOutput,
  init,
  readFile,
  rebuild,
  reinstallAndRestart,
  removeFile,
  setStatusListener,
  setTerminalListener,
  writeFile,
} from "@/app/_libs/webcontainer/core";
import type { WebContainerStatus } from "@/app/_libs/webcontainer/core";
import { defaultPageContent } from "@/app/_libs/webcontainer/defaultProject";
import { useChat } from "@/app/_providers/ChatProvider";
import { SolanaDeployService } from "@/app/_services/solanaDeploy";
import { useCallback, useEffect, useRef, useState } from "react";
import { DownloadIcon, ExternalLinkIcon, RocketIcon, RotateCwIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import CodeTab from "./CodeTab";
import PreviewTab from "./PreviewTab";

const DEFAULT_OPEN_FILES = ["src/App.tsx", "src/App.jsx", "src/main.tsx", "src/main.jsx"];
const WRITE_DEBOUNCE_MS = 500;
const CONFIG_FILES = ["package.json", "vite.config.js", "vite.config.ts", "index.html"];

// Module-level state that must survive Builder unmount/remount (mobile sheet open/close).
// If these lived in useRef, closing the preview sheet destroys Builder and resets them,
// causing removeFile("src") to re-run and wipe all codegen files.
let moduleFileCache: Record<string, string> = {};
let moduleClearedDefaults = false;
let moduleRemoveSrcPromise: Promise<void> | null = null;

/**
 * Map backend path to WebContainer project path.
 * - If path contains "frontend/", use the part after it (e.g. frontend/src/App.jsx → src/App.jsx).
 * - Otherwise treat as project-relative (e.g. src/App.jsx → src/App.jsx) so backend can send either form.
 */
function normalizeCodegenPath(backendPath: string): string | null {
  const trimmed = backendPath.replace(/^\/+/, "").replace(/\/+$/, "");
  const frontendIndex = trimmed.indexOf("frontend/");
  if (frontendIndex !== -1) {
    const relative = trimmed.slice(frontendIndex + "frontend/".length);
    return relative || null;
  }
  return trimmed || null;
}

export default function Builder() {
  const {
    codegenPendingWrites,
    hasCodegenPending,
    ackCodegenWrite,
    ackCodegenWrites,
    downloadProject,
    deployedTxHashes,
    step,
    runId,
  } = useChat();
  const [status, setStatus] = useState<WebContainerStatus>(getStatus());
  const [previewUrl, setPreviewUrl] = useState<string | null>(getPreviewUrl());
  const [code, setCode] = useState(defaultPageContent);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState(() => getTerminalOutput());
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoSelectedRef = useRef(false);
  const [treeRefreshTrigger, setTreeRefreshTrigger] = useState(0);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const switchedToCodegenRef = useRef(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const needsReinstallRef = useRef(false);
  const pendingBuildRef = useRef(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<{
    deploymentId: string;
    status: string;
  } | null>(null);

  const setPageCode = useCallback(
    (content: string) => {
      setCode(content);
      if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current);
      writeTimeoutRef.current = setTimeout(async () => {
        writeTimeoutRef.current = null;
        if (!currentFilePath) return;
        try {
          await writeFile(currentFilePath, content);
          if (moduleFileCache[currentFilePath] !== undefined) {
            moduleFileCache[currentFilePath] = content;
          }
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

  const handleTreeLoad = useCallback(async () => {
    if (hasAutoSelectedRef.current) return;
    hasAutoSelectedRef.current = true;
    for (const file of DEFAULT_OPEN_FILES) {
      try {
        await handleSelectFile(file);
        return; // Success, stop trying others
      } catch {
        // Continue trying next default
      }
    }
    // If all fail, optionally fallback to the first default just to show the error
    handleSelectFile(DEFAULT_OPEN_FILES[0]);
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

  // When codegen arrives and WebContainer isn't ready yet, start it so we can sync once ready
  useEffect(() => {
    const hasPending = Object.keys(codegenPendingWrites).length > 0;
    const current = getStatus();
    if (
      hasPending &&
      current !== "ready" &&
      current !== "error" &&
      current !== "booting" &&
      current !== "installing" &&
      current !== "starting"
    ) {
      init((url) => setPreviewUrl(url));
    }
  }, [codegenPendingWrites]);

  // Apply codegen updates: write every file (index.html, package.json, src/App.jsx, etc.) then batch-ack so preview gets full project
  useEffect(() => {
    const pending = codegenPendingWrites;
    const paths = Object.keys(pending);
    if (paths.length === 0 || status !== "ready") return;

    let cancelled = false;

    (async () => {
      // Wipe default src/ before laying down new files to avoid leftover App.jsx/App.tsx conflicts.
      // Stored in a shared ref so concurrent effect runs wait for any in-flight removal
      // before writing — prevents a late-completing rm from deleting newly written files.
      if (!moduleClearedDefaults) {
        moduleClearedDefaults = true;
        moduleRemoveSrcPromise = removeFile("src").catch(() => {});
      }
      if (moduleRemoveSrcPromise) {
        await moduleRemoveSrcPromise;
        moduleRemoveSrcPromise = null;
      }

      if (cancelled) return;

      switchedToCodegenRef.current = false;
      const writePromises: Promise<string | null>[] = [];

      for (const path of paths) {
        const content = pending[path];
        if (content === undefined) continue;

        const localPath = normalizeCodegenPath(path);
        if (!localPath) {
          ackCodegenWrite(path);
          continue;
        }

        const basename = localPath.split("/").pop() ?? "";
        if (CONFIG_FILES.includes(basename)) {
          needsReinstallRef.current = true;
        }

        const p = (async (): Promise<string | null> => {
          try {
            await ensureParentDirs(localPath);
            await writeFile(localPath, content);
            moduleFileCache[localPath] = content;

            const isCurrentFile = localPath === currentFilePath;
            const shouldSwitchToCodegen =
              !switchedToCodegenRef.current &&
              (currentFilePath === null || DEFAULT_OPEN_FILES.includes(currentFilePath));

            if (isCurrentFile) {
              if (writeTimeoutRef.current) {
                clearTimeout(writeTimeoutRef.current);
                writeTimeoutRef.current = null;
              }
              setCode(content);
            } else if (shouldSwitchToCodegen) {
              switchedToCodegenRef.current = true;
              setCurrentFilePath(localPath);
              setCode(content);
            }

            setTreeRefreshTrigger((t) => t + 1);
            return path;
          } catch (err) {
            console.error("[Builder] codegen writeFile failed:", err);
            setError(err instanceof Error ? err.message : "Failed to apply codegen");
            return null;
          }
        })();
        writePromises.push(p);
      }

      const results = await Promise.all(writePromises);
      if (cancelled) return;
      const writtenBackendPaths = results.filter((p): p is string => p != null);
      if (writtenBackendPaths.length > 0) {
        ackCodegenWrites(writtenBackendPaths);
        pendingBuildRef.current = true;
      }
    })();

    return () => { cancelled = true; };
  }, [codegenPendingWrites, status, currentFilePath, ackCodegenWrite, ackCodegenWrites]);

  // Trigger rebuild only when code generation finishes
  useEffect(() => {
    if (step === "complete" && pendingBuildRef.current && status === "ready") {
      pendingBuildRef.current = false;
      const reloadPreview = () => setPreviewReloadKey((k) => k + 1);
      if (needsReinstallRef.current) {
        needsReinstallRef.current = false;
        reinstallAndRestart()
          .then(reloadPreview)
          .catch((err) => {
            console.error("[Builder] reinstallAndRestart failed:", err);
            setError(err instanceof Error ? err.message : "Failed to reinstall dependencies");
          });
      } else {
        rebuild()
          .then(reloadPreview)
          .catch((err) => {
            console.error("[Builder] rebuild after codegen failed:", err);
          });
      }
    } else if (step === "idle") {
       moduleClearedDefaults = false;
       moduleFileCache = {};
    }
  }, [step, status]);

  const handleRebuild = useCallback(async () => {
    setIsRebuilding(true);
    setError(null);
    try {
      const cachedPaths = Object.keys(moduleFileCache);
      if (cachedPaths.length > 0) {
        try { await removeFile("src"); } catch { /* may not exist */ }
        for (const filePath of cachedPaths) {
          await ensureParentDirs(filePath);
          await writeFile(filePath, moduleFileCache[filePath]);
        }
      }
      needsReinstallRef.current = false;
      await reinstallAndRestart();
      setStatus(getStatus());
      setPreviewReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebuild failed");
    } finally {
      setIsRebuilding(false);
      setStatus(getStatus());
    }
  }, []);

  const handleDeployToDevnet = useCallback(async () => {
    if (!runId || isDeploying) return;
    setIsDeploying(true);
    setDeployStatus(null);
    try {
      const res = await SolanaDeployService.createDeployment(runId);
      const deploymentId = res.data?.id ?? (res.data as { deploymentId?: string })?.deploymentId;
      if (!deploymentId) {
        setDeployStatus({
          deploymentId: "",
          status: "Created but no deployment ID returned",
        });
        return;
      }
      const statusRes = await SolanaDeployService.getDeploymentStatus(deploymentId);
      const status = statusRes.data?.status ?? "Created";
      setDeployStatus({
        deploymentId,
        status,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deployment failed";
      setDeployStatus({
        deploymentId: "",
        status: `Failed: ${message}`,
      });
    } finally {
      setIsDeploying(false);
    }
  }, [runId, isDeploying]);

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
        <div className="flex items-center justify-between pr-2">
          <h1 className="font-parabole mt-4 ml-4 text-lg lg:mt-2 lg:ml-2">Files</h1>
          <div className="mt-4 mr-10 flex items-center gap-1.5 lg:mt-3">
            {deployedTxHashes.length > 0 && (
              <a
                href={`https://solscan.io/tx/${deployedTxHashes[deployedTxHashes.length - 1].txHash}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-parabole gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                >
                  <ExternalLinkIcon className="size-3.5" />
                  Solscan
                </Button>
              </a>
            )}
            {step === "complete" && !hasCodegenPending && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-parabole gap-1.5"
                onClick={downloadProject}
              >
                <DownloadIcon className="size-3.5" />
                Download
              </Button>
            )}
            {runId && deployedTxHashes.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-parabole gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                onClick={handleDeployToDevnet}
                disabled={isDeploying}
              >
                <RocketIcon
                  className={`size-3.5 ${isDeploying ? "animate-pulse" : ""}`}
                />
                {isDeploying ? "Creating…" : "Deploy to Devnet"}
              </Button>
            )}
            {runId && deployedTxHashes.length > 0 && deployStatus && (
              <span className="text-muted-foreground font-pp-neue-montreal-book text-xs">
                {deployStatus.status}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-parabole gap-1.5"
              onClick={handleRebuild}
              disabled={isRebuilding || (status !== "ready" && status !== "starting")}
            >
              <RotateCwIcon className={`size-3.5 ${isRebuilding ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
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
          <PreviewTab
            status={status}
            previewUrl={previewUrl}
            error={error}
            hasCodegenPending={hasCodegenPending}
            previewReloadKey={previewReloadKey}
          />
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
            treeRefreshTrigger={treeRefreshTrigger}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
