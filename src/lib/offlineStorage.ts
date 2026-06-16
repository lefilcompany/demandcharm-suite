const DB_NAME = 'soma-offline-db';
const DB_VERSION = 2;

interface OfflineStore {
  demands: 'demands';
  demandStatuses: 'demandStatuses';
  syncQueue: 'syncQueue';
  teams: 'teams';
  boards: 'boards';
  profiles: 'profiles';
  services: 'services';
  cacheMetadata: 'cacheMetadata';
}

const STORES: OfflineStore = {
  demands: 'demands',
  demandStatuses: 'demandStatuses',
  syncQueue: 'syncQueue',
  teams: 'teams',
  boards: 'boards',
  profiles: 'profiles',
  services: 'services',
  cacheMetadata: 'cacheMetadata',
};

let dbInstance: IDBDatabase | null = null;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for demands
      if (!db.objectStoreNames.contains(STORES.demands)) {
        const demandsStore = db.createObjectStore(STORES.demands, { keyPath: 'id' });
        demandsStore.createIndex('board_id', 'board_id', { unique: false });
        demandsStore.createIndex('team_id', 'team_id', { unique: false });
      }

      // Store for demand statuses
      if (!db.objectStoreNames.contains(STORES.demandStatuses)) {
        db.createObjectStore(STORES.demandStatuses, { keyPath: 'id' });
      }

      // Store for sync queue (pending operations when offline)
      if (!db.objectStoreNames.contains(STORES.syncQueue)) {
        db.createObjectStore(STORES.syncQueue, { keyPath: 'id', autoIncrement: true });
      }

      // Store for teams
      if (!db.objectStoreNames.contains(STORES.teams)) {
        db.createObjectStore(STORES.teams, { keyPath: 'id' });
      }

      // Store for boards
      if (!db.objectStoreNames.contains(STORES.boards)) {
        const boardsStore = db.createObjectStore(STORES.boards, { keyPath: 'id' });
        boardsStore.createIndex('team_id', 'team_id', { unique: false });
      }

      // Store for profiles
      if (!db.objectStoreNames.contains(STORES.profiles)) {
        db.createObjectStore(STORES.profiles, { keyPath: 'id' });
      }

      // Store for services
      if (!db.objectStoreNames.contains(STORES.services)) {
        const servicesStore = db.createObjectStore(STORES.services, { keyPath: 'id' });
        servicesStore.createIndex('team_id', 'team_id', { unique: false });
      }

      // Store for cache metadata
      if (!db.objectStoreNames.contains(STORES.cacheMetadata)) {
        db.createObjectStore(STORES.cacheMetadata, { keyPath: 'key' });
      }
    };
  });
};

// Generic save function
export const saveToStore = async <T>(storeName: string, data: T[]): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    // Clear existing data and add new
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    for (const item of data) {
      store.put(item);
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error(`Failed to save to ${storeName}:`, error);
  }
};

// Generic get all function
export const getAllFromStore = async <T>(storeName: string): Promise<T[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Failed to get from ${storeName}:`, error);
    return [];
  }
};

// Get by index
export const getByIndex = async <T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);

    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Failed to get by index from ${storeName}:`, error);
    return [];
  }
};

// Get single item
export const getFromStore = async <T>(storeName: string, id: string): Promise<T | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result as T | null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Failed to get item from ${storeName}:`, error);
    return null;
  }
};

// Specific functions for demands
export const saveDemands = async (demands: unknown[]): Promise<void> => {
  await saveToStore(STORES.demands, demands);
};

export const getCachedDemands = async (): Promise<unknown[]> => {
  return getAllFromStore(STORES.demands);
};

export const getCachedDemandsByBoard = async (boardId: string): Promise<unknown[]> => {
  return getByIndex(STORES.demands, 'board_id', boardId);
};

export const getCachedDemand = async (id: string): Promise<unknown | null> => {
  return getFromStore(STORES.demands, id);
};

// Add a single demand to cache (for offline creation)
export const addCachedDemand = async (demand: Record<string, unknown>): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.demands, 'readwrite');
    const store = transaction.objectStore(STORES.demands);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(demand);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    console.log('Added demand to cache:', demand.id);
  } catch (error) {
    console.error('Failed to add demand to cache:', error);
  }
};

// Generate a temporary offline ID
export const generateOfflineId = (): string => {
  return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Update a single cached demand (for offline status changes)
export const updateCachedDemand = async (
  demandId: string,
  updates: Record<string, unknown>
): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.demands, 'readwrite');
    const store = transaction.objectStore(STORES.demands);

    const existingDemand = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const request = store.get(demandId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (existingDemand) {
      const updatedDemand = { ...existingDemand, ...updates };
      await new Promise<void>((resolve, reject) => {
        const request = store.put(updatedDemand);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log('Updated cached demand:', demandId);
    }
  } catch (error) {
    console.error('Failed to update cached demand:', error);
  }
};

// Remove a cached demand (for cleaning up after sync)
export const removeCachedDemand = async (demandId: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.demands, 'readwrite');
    const store = transaction.objectStore(STORES.demands);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(demandId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    console.log('Removed demand from cache:', demandId);
  } catch (error) {
    console.error('Failed to remove demand from cache:', error);
  }
};

// Specific functions for statuses
export const saveDemandStatuses = async (statuses: unknown[]): Promise<void> => {
  await saveToStore(STORES.demandStatuses, statuses);
};

export const getCachedDemandStatuses = async (): Promise<unknown[]> => {
  return getAllFromStore(STORES.demandStatuses);
};

// Sync Queue types and functions
export interface SyncOperation {
  id?: number;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

// Add operation to sync queue
export const addToSyncQueue = async (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.syncQueue, 'readwrite');
    const store = transaction.objectStore(STORES.syncQueue);

    const syncOp: Omit<SyncOperation, 'id'> = {
      ...operation,
      timestamp: Date.now(),
      retryCount: 0,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(syncOp);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('Added to sync queue:', operation.type, operation.table);
  } catch (error) {
    console.error('Failed to add to sync queue:', error);
  }
};

// Get all pending sync operations
export const getPendingSyncOperations = async (): Promise<SyncOperation[]> => {
  return getAllFromStore<SyncOperation>(STORES.syncQueue);
};

// Remove operation from sync queue
export const removeSyncOperation = async (id: number): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.syncQueue, 'readwrite');
    const store = transaction.objectStore(STORES.syncQueue);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to remove sync operation:', error);
  }
};

// Update retry count for failed operation
export const updateSyncOperationRetry = async (id: number, retryCount: number): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.syncQueue, 'readwrite');
    const store = transaction.objectStore(STORES.syncQueue);

    const operation = await new Promise<SyncOperation | undefined>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (operation) {
      operation.retryCount = retryCount;
      await new Promise<void>((resolve, reject) => {
        const request = store.put(operation);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.error('Failed to update sync operation:', error);
  }
};

// Clear all sync operations
export const clearSyncQueue = async (): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.syncQueue, 'readwrite');
    const store = transaction.objectStore(STORES.syncQueue);

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to clear sync queue:', error);
  }
};

// Get sync queue count
export const getSyncQueueCount = async (): Promise<number> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.syncQueue, 'readonly');
    const store = transaction.objectStore(STORES.syncQueue);

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get sync queue count:', error);
    return 0;
  }
};

// Check if we're online - uses navigator.onLine as initial check
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Verify actual connectivity by making a lightweight request
export const checkRealConnectivity = async (): Promise<boolean> => {
  if (!navigator.onLine) {
    return false;
  }
  
  try {
    // Try to fetch a small resource to verify actual connectivity
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('/favicon.png', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    // If fetch fails but navigator says we're online, trust navigator
    // This handles cases where the app is running locally or favicon isn't available
    return navigator.onLine;
  }
};

// Listen for online/offline events with real connectivity check
export const onOnlineStatusChange = (callback: (online: boolean) => void): (() => void) => {
  const handleOnline = async () => {
    // When browser says online, verify with actual request
    const isReallyOnline = await checkRealConnectivity();
    callback(isReallyOnline);
  };
  
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial check on mount
  checkRealConnectivity().then(callback);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

// ============= Teams Cache =============
export const saveTeams = async (teams: unknown[]): Promise<void> => {
  await saveToStore(STORES.teams, teams);
  await setCacheTimestamp('teams');
};

export const getCachedTeams = async (): Promise<unknown[]> => {
  return getAllFromStore(STORES.teams);
};

// ============= Boards Cache =============
export const saveBoards = async (boards: unknown[]): Promise<void> => {
  await saveToStore(STORES.boards, boards);
  await setCacheTimestamp('boards');
};

export const getCachedBoards = async (): Promise<unknown[]> => {
  return getAllFromStore(STORES.boards);
};

export const getCachedBoardsByTeam = async (teamId: string): Promise<unknown[]> => {
  return getByIndex(STORES.boards, 'team_id', teamId);
};

// ============= Profiles Cache =============
export const saveProfiles = async (profiles: unknown[]): Promise<void> => {
  await saveToStore(STORES.profiles, profiles);
  await setCacheTimestamp('profiles');
};

export const getCachedProfiles = async (): Promise<unknown[]> => {
  return getAllFromStore(STORES.profiles);
};

export const getCachedProfile = async (id: string): Promise<unknown | null> => {
  return getFromStore(STORES.profiles, id);
};

// ============= Services Cache =============
export const saveServices = async (services: unknown[]): Promise<void> => {
  await saveToStore(STORES.services, services);
  await setCacheTimestamp('services');
};

export const getCachedServices = async (): Promise<unknown[]> => {
  return getAllFromStore(STORES.services);
};

export const getCachedServicesByTeam = async (teamId: string): Promise<unknown[]> => {
  return getByIndex(STORES.services, 'team_id', teamId);
};

// ============= Cache Metadata =============
interface CacheMetadata {
  key: string;
  timestamp: number;
}

export const setCacheTimestamp = async (key: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.cacheMetadata, 'readwrite');
    const store = transaction.objectStore(STORES.cacheMetadata);

    const metadata: CacheMetadata = { key, timestamp: Date.now() };
    await new Promise<void>((resolve, reject) => {
      const request = store.put(metadata);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to set cache timestamp:', error);
  }
};

export const getCacheTimestamp = async (key: string): Promise<number | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.cacheMetadata, 'readonly');
    const store = transaction.objectStore(STORES.cacheMetadata);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result as CacheMetadata | undefined;
        resolve(result?.timestamp ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get cache timestamp:', error);
    return null;
  }
};

export const isCacheStale = async (key: string, maxAgeMs: number = 30 * 60 * 1000): Promise<boolean> => {
  const timestamp = await getCacheTimestamp(key);
  if (!timestamp) return true;
  return Date.now() - timestamp > maxAgeMs;
};

export const getLastCacheUpdate = async (): Promise<Date | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORES.cacheMetadata, 'readonly');
    const store = transaction.objectStore(STORES.cacheMetadata);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as CacheMetadata[];
        if (results.length === 0) {
          resolve(null);
          return;
        }
        const latestTimestamp = Math.max(...results.map(r => r.timestamp));
        resolve(new Date(latestTimestamp));
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get last cache update:', error);
    return null;
  }
};
