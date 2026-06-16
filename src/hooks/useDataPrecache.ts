import { useEffect, useCallback, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  saveDemands,
  saveDemandStatuses,
  saveTeams,
  saveBoards,
  saveProfiles,
  saveServices,
} from "@/lib/offlineStorage";
import { useSyncManager } from "@/hooks/useSyncManager";

const CACHE_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MIN_PRECACHE_INTERVAL = 2 * 60 * 1000; // 2 minutes minimum between runs

export function useDataPrecache() {
  const { user } = useAuth();
  const [isPrecaching, setIsPrecaching] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { syncNow } = useSyncManager();
  const isRunningRef = useRef(false);
  const lastRunRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const precacheUserData = useCallback(async () => {
    if (!user || !navigator.onLine) return;
    
    // Hard lock: only one execution at a time
    if (isRunningRef.current) return;
    
    // Enforce minimum interval between runs
    const now = Date.now();
    if (now - lastRunRef.current < MIN_PRECACHE_INTERVAL) return;

    isRunningRef.current = true;
    lastRunRef.current = now;
    setIsPrecaching(true);
    setError(null);

    try {
      await syncNow();

      const [
        statusesResult,
        teamsResult,
        boardsResult,
        demandsResult,
        servicesResult,
        profilesResult,
      ] = await Promise.all([
        supabase.from('demand_statuses').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('boards').select('*'),
        supabase
          .from('demands')
          .select(`
            *,
            status:demand_statuses(*),
            service:services(*),
            creator:profiles!demands_created_by_fkey(id, full_name, avatar_url),
            assignee:profiles!demands_assigned_to_fkey(id, full_name, avatar_url)
          `)
          .eq('archived', false)
          .order('updated_at', { ascending: false })
          .limit(500),
        supabase.from('services').select('*'),
        supabase.from('profiles').select('id, full_name, avatar_url, email'),
      ]);

      const savePromises: Promise<void>[] = [];
      if (statusesResult.data) savePromises.push(saveDemandStatuses(statusesResult.data));
      if (teamsResult.data) savePromises.push(saveTeams(teamsResult.data));
      if (boardsResult.data) savePromises.push(saveBoards(boardsResult.data));
      if (demandsResult.data) savePromises.push(saveDemands(demandsResult.data));
      if (servicesResult.data) savePromises.push(saveServices(servicesResult.data));
      if (profilesResult.data) savePromises.push(saveProfiles(profilesResult.data));

      await Promise.all(savePromises);

      const updateTime = new Date();
      setLastUpdate(updateTime);
      console.log('Data precache completed at', updateTime.toISOString());
    } catch (err) {
      console.error('Failed to precache data:', err);
      setError('Falha ao carregar dados offline');
    } finally {
      setIsPrecaching(false);
      isRunningRef.current = false;
    }
  }, [user, syncNow]);

  // Debounced version to coalesce rapid trigger events
  const debouncedPrecache = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      precacheUserData();
    }, 500);
  }, [precacheUserData]);

  // Initial precache on mount (once)
  useEffect(() => {
    if (user) {
      // Small delay to avoid competing with auth/initial queries
      const timer = setTimeout(() => precacheUserData(), 5000);
      return () => clearTimeout(timer);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic refresh (every 5 minutes)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (navigator.onLine) debouncedPrecache();
    }, CACHE_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [user?.id, debouncedPrecache]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh when coming back online
  useEffect(() => {
    const handleOnline = () => debouncedPrecache();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [debouncedPrecache]);


  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return {
    isPrecaching,
    lastUpdate,
    error,
    refresh: () => precacheUserData(),
  };
}
