export default function Builder() {
  return (
    <div className="border-border/50 bg-muted/30 flex h-full flex-col border-l">
      <div className="border-border/50 text-muted-foreground border-b px-3 py-2 text-xs font-medium">
        OUTLINE
      </div>
      <div className="text-muted-foreground flex-1 overflow-auto p-2 text-sm">
        <div>IdeLayout</div>
        <div className="ml-2">IdeLayoutProps</div>
        <div className="ml-2">left, children, right</div>
      </div>
    </div>
  );
}
