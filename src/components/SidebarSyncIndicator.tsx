import { RefreshCw, Database, CheckCircle2, AlertCircle, Cloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getSyncQueueCount } from '@/lib/offlineStorage';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useTranslation } from 'react-i18next';
import { useDataPrecache } from '@/hooks/useDataPrecache';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';

interface SidebarSyncIndicatorProps {
  isCollapsed?: boolean;
}

export function SidebarSyncIndicator({ isCollapsed = false }: SidebarSyncIndicatorProps) {
  const { t } = useTranslation();
  const { isOffline } = useOfflineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const { isSyncing } = useSyncManager();
  const { isPrecaching, error: cacheError } = useDataPrecache();
  const [showSuccess, setShowSuccess] = useState(false);
  const [wasProcessing, setWasProcessing] = useState(false);

  // Check for pending operations
  useEffect(() => {
    const checkPending = async () => {
      const count = await getSyncQueueCount();
      setPendingCount(count);
    };

    checkPending();
    const interval = setInterval(checkPending, 3000);
    return () => clearInterval(interval);
  }, []);

  // Show success indicator briefly after sync/precache completes
  useEffect(() => {
    const isProcessing = isSyncing || isPrecaching;
    
    if (wasProcessing && !isProcessing && !cacheError) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
    
    setWasProcessing(isProcessing);
  }, [isSyncing, isPrecaching, cacheError, wasProcessing]);

  // Don't show anything if offline (OfflineIndicator handles that) or nothing to show
  if (isOffline) return null;

  const isProcessing = isSyncing || isPrecaching;
  const hasError = !!cacheError;
  const hasPending = pendingCount > 0;

  // Only show if there's something to report
  if (!isProcessing && !hasError && !hasPending && !showSuccess) {
    return null;
  }

  const getStatusInfo = () => {
    if (isProcessing) {
      return {
        icon: isSyncing ? RefreshCw : Database,
        text: isSyncing ? t('sync.syncing') : t('cache.precaching'),
        className: 'text-primary animate-pulse',
        iconClassName: isSyncing ? 'animate-spin' : 'animate-pulse'
      };
    }
    if (hasError) {
      return {
        icon: AlertCircle,
        text: t('cache.error'),
        className: 'text-amber-500',
        iconClassName: ''
      };
    }
    if (hasPending) {
      return {
        icon: Cloud,
        text: t('sync.pending', { count: pendingCount }),
        className: 'text-muted-foreground',
        iconClassName: ''
      };
    }
    if (showSuccess) {
      return {
        icon: CheckCircle2,
        text: t('cache.ready'),
        className: 'text-green-500',
        iconClassName: ''
      };
    }
    return null;
  };

  const status = getStatusInfo();
  if (!status) return null;

  const IconComponent = status.icon;

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center justify-center p-2 rounded-md',
            status.className
          )}>
            <IconComponent className={cn('h-4 w-4', status.iconClassName)} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs">{status.text}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-all duration-300',
      status.className
    )}>
      <IconComponent className={cn('h-3.5 w-3.5 flex-shrink-0', status.iconClassName)} />
      <span className="truncate">{status.text}</span>
    </div>
  );
}
