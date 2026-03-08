"use client";

import { readDir } from "@/app/_libs/webcontainer/core";
import { FolderIcon, FileIcon } from "@/app/_components/Icons";
import { useCallback, useEffect, useState } from "react";

export type FileTreeNode = {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
};

const IGNORE_DIRS = new Set(["node_modules", ".next", ".git"]);

async function loadTree(path: string): Promise<FileTreeNode[]> {
  const dir = path === "" ? "." : path;
  const entries = await readDir(dir);
  const nodes: FileTreeNode[] = [];
  for (const e of entries) {
    if (e.isDirectory && IGNORE_DIRS.has(e.name)) continue;
    const fullPath = path ? `${path}/${e.name}` : e.name;
    if (e.isDirectory) {
      const children = await loadTree(fullPath);
      nodes.push({
        name: e.name,
        path: fullPath,
        isDirectory: true,
        children,
      });
    } else {
      nodes.push({ name: e.name, path: fullPath, isDirectory: false });
    }
  }
  return nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

type FileTreeProps = {
  isReady: boolean;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onTreeLoad?: (tree: FileTreeNode[]) => void;
  /** When this value changes, the tree will refresh (e.g. after codegen writes new files). */
  refreshTrigger?: number;
};

function TreeItem({
  node,
  selectedPath,
  onSelectFile,
  level,
}: {
  node: FileTreeNode;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  level: number;
}) {
  const [open, setOpen] = useState(true);
  const isSelected = selectedPath === node.path;

  if (node.isDirectory) {
    return (
      <div className="select-none">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="hover:bg-primary/10 flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          <span className="text-muted-foreground" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          <span className="text-foreground" aria-hidden>
            <FolderIcon className="text-foreground size-5" />
          </span>
          <span className="text-foreground truncate font-medium">{node.name}</span>
        </button>
        {open && node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.path)}
      className={`hover:bg-primary/10 flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm ${
        isSelected ? "bg-primary/10 text-foreground" : "text-foreground"
      }`}
      style={{ paddingLeft: `${level * 12 + 8}px` }}
    >
      <span className="text-muted-foreground w-4" aria-hidden>
        {" "}
      </span>
      <span className="text-foreground" aria-hidden>
        <FileIcon className="text-foreground size-5" />
      </span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree({
  isReady,
  selectedPath,
  onSelectFile,
  onTreeLoad,
  refreshTrigger,
}: FileTreeProps) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    setError(null);
    try {
      const root = await loadTree("");
      setTree(root);
      onTreeLoad?.(root);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tree");
    } finally {
      setLoading(false);
    }
  }, [isReady, onTreeLoad]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (isReady && refreshTrigger != null && refreshTrigger > 0) {
      refresh();
    }
  }, [isReady, refreshTrigger, refresh]);

  if (!isReady) {
    return (
      <div className="flex h-full flex-col rounded-lg">
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-4 text-center text-sm">
          Start the environment to see the file tree.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg">
      <div className="flex-1 overflow-auto py-1">
        {error && <p className="text-destructive px-3 py-2 text-sm">{error}</p>}
        {loading && tree.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-sm">Loading…</p>
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              level={0}
            />
          ))
        )}
      </div>
    </div>
  );
}
