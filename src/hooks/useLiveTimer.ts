import { useState, useEffect } from "react";

export function formatTimeDisplay(totalSeconds: number): string | null {
  if (totalSeconds <= 0) return null;
  
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  // If there are days, show them separately with "d" suffix
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  
  // Otherwise, just show hours:minutes:seconds
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function getTotalTimeSinceCreation(createdAt?: string, endAt?: string): string | null {
  if (!createdAt) return null;
  const endDate = endAt ? new Date(endAt) : new Date();
  const diffMs = endDate.getTime() - new Date(createdAt).getTime();
  if (diffMs < 0) return null;
  return formatTimeDisplay(Math.floor(diffMs / 1000));
}

export function getExecutionTimeDisplay(timeInProgressSeconds?: number | null): string | null {
  return formatTimeDisplay(timeInProgressSeconds || 0);
}

interface UseLiveTimerOptions {
  isActive: boolean;
  baseSeconds: number;
  lastStartedAt?: string | null;
}

export function useLiveTimer({ isActive, baseSeconds, lastStartedAt }: UseLiveTimerOptions): string | null {
  const [currentTime, setCurrentTime] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) {
      // Not in "Fazendo", just show base time
      setCurrentTime(formatTimeDisplay(baseSeconds));
      return;
    }

    // Calculate initial time including elapsed since last_started_at
    const calculateElapsed = () => {
      let totalSeconds = baseSeconds;
      if (lastStartedAt) {
        const elapsedMs = Date.now() - new Date(lastStartedAt).getTime();
        totalSeconds += Math.floor(elapsedMs / 1000);
      }
      return totalSeconds;
    };

    setCurrentTime(formatTimeDisplay(calculateElapsed()));

    // Update every second
    const interval = setInterval(() => {
      setCurrentTime(formatTimeDisplay(calculateElapsed()));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, baseSeconds, lastStartedAt]);

  return currentTime;
}
