import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  getPendingSyncOperations,
  removeSyncOperation,
  updateSyncOperationRetry,
  getSyncQueueCount,
  onOnlineStatusChange,
  isOnline,
  SyncOperation,
  removeCachedDemand,
} from '@/lib/offlineStorage';

const MAX_RETRIES = 3;

export function useSyncManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isSyncing = useRef(false);

  const processSyncOperation = useCallback(async (operation: SyncOperation): Promise<boolean> => {
    const { type, table, data } = operation;

    try {
      switch (type) {
        case 'create': {
          // Extract offline tracking fields before inserting
          const { _offlineId, ...insertData } = data;
          
          const { data: result, error } = await supabase
            .from(table as 'demands')
            .insert(insertData as any)
            .select()
            .single();
          
          if (error) throw error;
          
          // If this was an offline demand, remove the temporary cached version
          if (_offlineId && typeof _offlineId === 'string') {
            await removeCachedDemand(_offlineId);
            console.log('Removed offline demand from cache:', _offlineId);
          }
          break;
        }
        case 'update': {
          const { id, ...updateData } = data;
          const { error } = await supabase
            .from(table as 'demands')
            .update(updateData as any)
            .eq('id', id as string);
          if (error) throw error;
          break;
        }
        case 'delete': {
          const { error } = await supabase
            .from(table as 'demands')
            .delete()
            .eq('id', data.id as string);
          if (error) throw error;
          break;
        }
      }
      return true;
    } catch (error) {
      console.error(`Sync operation failed for ${type} on ${table}:`, error);
      return false;
    }
  }, []);

  const syncPendingOperations = useCallback(async () => {
    if (isSyncing.current || !isOnline()) return;

    isSyncing.current = true;
    const operations = await getPendingSyncOperations();

    if (operations.length === 0) {
      isSyncing.current = false;
      return;
    }

    console.log(`Syncing ${operations.length} pending operations...`);
    let successCount = 0;
    let failCount = 0;

    // Sort by timestamp to process in order
    const sortedOperations = [...operations].sort((a, b) => a.timestamp - b.timestamp);

    for (const operation of sortedOperations) {
      if (!isOnline()) {
        console.log('Lost connection during sync, stopping...');
        break;
      }

      const success = await processSyncOperation(operation);

      if (success) {
        await removeSyncOperation(operation.id!);
        successCount++;
      } else {
        const newRetryCount = operation.retryCount + 1;
        if (newRetryCount >= MAX_RETRIES) {
          // Remove operation after max retries
          await removeSyncOperation(operation.id!);
          failCount++;
          console.error(`Operation exceeded max retries, removing:`, operation);
        } else {
          await updateSyncOperationRetry(operation.id!, newRetryCount);
        }
      }
    }

    // Invalidate queries to refresh data
    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      queryClient.invalidateQueries({ queryKey: ['demand-interactions'] });
    }

    // Show notification
    if (successCount > 0 && failCount === 0) {
      toast.success(t('sync.success', { count: successCount }), {
        description: t('sync.successDescription'),
      });
    } else if (failCount > 0) {
      toast.warning(t('sync.partial', { success: successCount, failed: failCount }));
    }

    isSyncing.current = false;
  }, [processSyncOperation, queryClient, t]);

  // Listen for online status changes
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      if (online) {
        console.log('Connection restored, starting sync...');
        // Delay a bit to ensure connection is stable
        setTimeout(() => {
          syncPendingOperations();
        }, 2000);
      }
    });

    // Sync on mount if online and there are pending operations
    if (isOnline()) {
      getSyncQueueCount().then((count) => {
        if (count > 0) {
          syncPendingOperations();
        }
      });
    }

    return unsubscribe;
  }, [syncPendingOperations]);

  return {
    syncNow: syncPendingOperations,
    isSyncing: isSyncing.current,
  };
}
