import { useState, useEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

const TABLET_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

function getBreakpoint(width: number): Breakpoint {
  if (width < TABLET_BREAKPOINT) return "mobile";
  if (width < DESKTOP_BREAKPOINT) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window !== "undefined"
      ? getBreakpoint(window.innerWidth)
      : "desktop"
  );

  useEffect(() => {
    const tabletMql = window.matchMedia(
      `(min-width: ${TABLET_BREAKPOINT}px) and (max-width: ${DESKTOP_BREAKPOINT - 1}px)`
    );
    const mobileMql = window.matchMedia(
      `(max-width: ${TABLET_BREAKPOINT - 1}px)`
    );

    const onChange = () => {
      setBreakpoint(getBreakpoint(window.innerWidth));
    };

    tabletMql.addEventListener("change", onChange);
    mobileMql.addEventListener("change", onChange);
    onChange();

    return () => {
      tabletMql.removeEventListener("change", onChange);
      mobileMql.removeEventListener("change", onChange);
    };
  }, []);

  return breakpoint;
}
