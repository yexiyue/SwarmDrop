/**
 * Pairing Layout Route
 * 配对路由组布局（纯透传）
 *
 * 作用：
 * - 作为所有配对相关子路由的父布局（pairing/index, pairing/input, pairing/generate）
 * - 保留扩展点：将来可在此添加配对流程的全局状态或 UI（如进度条、步骤指示器等）
 * - 当前无额外逻辑，仅透传 Outlet
 *
 * 注意：不要删除此文件，否则子路由的 URL 结构会改变
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/pairing")({
  component: () => <Outlet />,
});
