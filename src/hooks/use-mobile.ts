import { useBreakpoint } from "@/hooks/use-breakpoint";

export function useIsMobile() {
  return useBreakpoint() === "mobile";
}
