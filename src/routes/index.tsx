import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">SwarmDrop</h1>
        <p className="mt-2 text-muted-foreground">
          Drop files anywhere. No cloud. No limits.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-muted-foreground/25 p-12">
        <div className="text-center text-muted-foreground">
          <p>拖拽文件到这里</p>
          <p className="text-sm">或点击选择</p>
        </div>
        <Button>选择文件</Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted-foreground">或</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="输入分享码"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button variant="secondary">接收</Button>
      </div>
    </div>
  );
}
