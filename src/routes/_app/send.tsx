/**
 * Send Route Config
 * 发送页面路由配置 — 校验 searchParams
 */

import { createFileRoute } from "@tanstack/react-router";

interface SendSearch {
  peerId: string;
}

export const Route = createFileRoute("/_app/send")({
  validateSearch: (search: Record<string, unknown>): SendSearch => ({
    peerId: (search.peerId as string) ?? "",
  }),
});
