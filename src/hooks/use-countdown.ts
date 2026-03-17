import { useState, useEffect } from "react";

/**
 * 倒计时 Hook
 * @param expiresAt Unix 时间戳（秒），为 null 时不启动倒计时
 * @returns { remainingSeconds, isExpired }
 */
export function useCountdown(expiresAt: number | null) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (expiresAt == null) return;

    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      setRemainingSeconds(Math.max(0, expiresAt - now));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // 直接从 expiresAt 判断，避免 remainingSeconds 初始为 0 时的误判
  const isExpired =
    expiresAt != null && Math.floor(Date.now() / 1000) >= expiresAt;

  return { remainingSeconds, isExpired };
}
