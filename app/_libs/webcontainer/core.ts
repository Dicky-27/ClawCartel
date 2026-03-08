"use client";

import type { WebContainer } from "@webcontainer/api";
import { defaultProject } from "./defaultProject";

export type WebContainerStatus = "idle" | "booting" | "installing" | "starting" | "ready" | "error";

let instance: WebContainer | null = null;
let devProcess: { kill?: (signal?: string) => void } | null = null;
let previewUrl: string | null = null;
let status: WebContainerStatus = "idle";
let statusListener: ((s: WebContainerStatus) => void) | null = null;
let terminalOutput = "";
let terminalListener: ((output: string) => void) | null = null;
let pendingOnServerReady: ((url: string) => void) | null = null;
let bootInProgress = false;

function setStatus(s: WebContainerStatus) {
  status = s;
  statusListener?.(s);
}

function appendTerminal(chunk: string) {
  terminalOutput += chunk;
  terminalListener?.(terminalOutput);
}

async function pipeProcessOutput(process: { output: ReadableStream<string> }): Promise<void> {
  const reader = process.output.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      appendTerminal(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export function getStatus(): WebContainerStatus {
  return status;
}

export function getPreviewUrl(): string | null {
  return previewUrl;
}

export function getTerminalOutput(): string {
  return terminalOutput;
}

export function setStatusListener(fn: ((s: WebContainerStatus) => void) | null) {
  statusListener = fn;
}

export function setTerminalListener(fn: ((output: string) => void) | null) {
  terminalListener = fn;
  if (fn && terminalOutput) fn(terminalOutput);
}

/**
 * Ensure WebContainer is booted; if not, call init() and wait until ready/starting.
 * Use before any operation that needs the container (rebuild, writeFile, readFile, etc.).
 */
export async function ensureBooted(): Promise<void> {
  if (instance && (status === "ready" || status === "starting")) return;
  if (status === "error") throw new Error("WebContainer failed to start.");

  const bootInProgress =
    !instance && (status === "booting" || status === "installing" || status === "starting");

  if (!instance && !bootInProgress) {
    return new Promise<void>((resolve, reject) => {
      init(() => resolve()).catch(reject);
    });
  }

  for (;;) {
    const s = getStatus();
    if (s === "ready" || s === "starting") return;
    if (s === "error") throw new Error("WebContainer failed to start.");
    await new Promise((r) => setTimeout(r, 150));
  }
}

/**
 * Restart the dev server so the preview reflects the current code (no teardown, files stay as-is).
 * Resolves when the new server is ready (so the preview iframe can reload and get fresh content).
 * Auto-inits the container if not booted yet.
 */
export async function rebuild(): Promise<void> {
  await ensureBooted();
  if (!instance || (status !== "ready" && status !== "starting")) {
    throw new Error("Container not ready. Start the environment first.");
  }

  if (devProcess?.kill) {
    try {
      devProcess.kill("SIGTERM");
    } catch {
      // ignore
    }
    devProcess = null;
  }

  setStatus("starting");
  appendTerminal("\n\n--- Rebuild ---\n\n");
  terminalListener?.(terminalOutput);

  const process = await instance!.spawn("npm", ["run", "dev"]);
  devProcess = process;
  void pipeProcessOutput(process);

  return new Promise<void>((resolve) => {
    type ServerReadyHandler = (port: number, url: string) => void;
    const handler: ServerReadyHandler = (_port, url) => {
      previewUrl = url;
      setStatus("ready");
      const inst = instance;
      if (inst && typeof (inst as unknown as { off?: (e: string, h: ServerReadyHandler) => void }).off === "function") {
        (inst as unknown as { off(e: string, h: ServerReadyHandler): void }).off("server-ready", handler);
      }
      resolve();
    };
    instance!.on("server-ready", handler);
  });
}

/**
 * Run `npm install` then restart the dev server.
 * Use when codegen writes a new package.json with different dependencies.
 */
let reinstallInProgress = false;
export async function reinstallAndRestart(): Promise<void> {
  await ensureBooted();
  if (!instance) {
    throw new Error("Container not booted. Call init() first.");
  }
  if (reinstallInProgress) return;
  reinstallInProgress = true;

  try {
    // Kill current dev server
    if (devProcess?.kill) {
      try {
        devProcess.kill("SIGTERM");
      } catch {
        // ignore
      }
      devProcess = null;
    }

    setStatus("installing");
    appendTerminal("\n\n--- Installing new dependencies ---\n\n");

    const installProcess = await instance.spawn("npm", ["install"]);
    void pipeProcessOutput(installProcess);
    const exitCode = await installProcess.exit;

    if (exitCode !== 0) {
      appendTerminal("\n⚠ npm install exited with code " + exitCode + "\n");
    }

    setStatus("starting");
    appendTerminal("\n--- Restarting dev server ---\n\n");

    const process = await instance.spawn("npm", ["run", "dev"]);
    devProcess = process;
    void pipeProcessOutput(process);

    await new Promise<void>((resolve) => {
      type ServerReadyHandler = (port: number, url: string) => void;
      const handler: ServerReadyHandler = (_port, url) => {
        previewUrl = url;
        setStatus("ready");
        const inst = instance;
        if (inst && typeof (inst as unknown as { off?: (e: string, h: ServerReadyHandler) => void }).off === "function") {
          (inst as unknown as { off(e: string, h: ServerReadyHandler): void }).off("server-ready", handler);
        }
        resolve();
      };
      instance!.on("server-ready", handler);
    });
  } finally {
    reinstallInProgress = false;
  }
}

export async function init(onServerReady: (url: string) => void): Promise<void> {
  if (instance !== null) {
    if (status === "ready" && previewUrl) {
      onServerReady(previewUrl);
    } else if (status === "booting" || status === "starting" || status === "installing") {
      pendingOnServerReady = onServerReady;
    }
    return;
  }
  if (bootInProgress) {
    pendingOnServerReady = onServerReady;
    return;
  }
  bootInProgress = true;

  try {
    const { WebContainer } = await import("@webcontainer/api");

    setStatus("booting");
    instance = await WebContainer.boot();

    setStatus("installing");
    await instance.mount(defaultProject);

    const installProcess = await instance.spawn("npm", ["install"]);
    void pipeProcessOutput(installProcess);
    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      setStatus("error");
      throw new Error("npm install failed");
    }

    setStatus("starting");
    instance.on("server-ready", (_, url) => {
      previewUrl = url;
      setStatus("ready");
      onServerReady(url);
      if (pendingOnServerReady) {
        pendingOnServerReady(url);
        pendingOnServerReady = null;
      }
    });

    instance.on("error", (err) => {
      console.error("[WebContainer]", err);
      setStatus("error");
    });

    const process = await instance.spawn("npm", ["run", "dev"]);
    devProcess = process;
    void pipeProcessOutput(process);
  } catch (err) {
    instance = null;
    bootInProgress = false;
    throw err;
  }
}

export async function writeFile(path: string, contents: string): Promise<void> {
  await ensureBooted();
  if (!instance) throw new Error("WebContainer not booted. Call init() first.");
  await instance.fs.writeFile(path, contents);
}

export async function removeFile(path: string): Promise<void> {
  await ensureBooted();
  if (!instance) return;
  try {
    await instance.fs.rm(path, { recursive: true, force: true });
  } catch (err) {
    console.error(`[WebContainer] Failed to remove ${path}:`, err);
  }
}

/**
 * Create parent directories for a file path so that writeFile won't get ENOENT.
 * Uses mkdir(..., { recursive: true }).
 */
export async function ensureParentDirs(filePath: string): Promise<void> {
  await ensureBooted();
  if (!instance) throw new Error("WebContainer not booted. Call init() first.");
  const normalized = filePath.replace(/^\/+/, "").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) return;
  const dir = parts.slice(0, -1).join("/");
  await instance.fs.mkdir(dir, { recursive: true });
}

export type DirEntry = { name: string; isDirectory: boolean };

export async function readDir(path: string): Promise<DirEntry[]> {
  await ensureBooted();
  if (!instance) throw new Error("WebContainer not booted. Call init() first.");
  const dir = path === "" ? "." : path;
  const entries = await instance.fs.readdir(dir, { withFileTypes: true });
  return entries.map((e) => ({
    name: e.name,
    isDirectory: e.isDirectory(),
  }));
}

export async function readFile(path: string): Promise<string> {
  await ensureBooted();
  if (!instance) throw new Error("WebContainer not booted. Call init() first.");
  return instance.fs.readFile(path, "utf-8");
}
