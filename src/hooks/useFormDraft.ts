import { useEffect, useRef, useCallback } from "react";

interface UseFormDraftOptions {
  formId: string;
  fields: Record<string, any>;
  setters: Record<string, (value: any) => void>;
  debounceMs?: number;
}

const DRAFT_PREFIX = "form-draft-";

export function useFormDraft({
  formId,
  fields,
  setters,
  debounceMs = 500,
}: UseFormDraftOptions) {
  const initialLoadDone = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialFieldsRef = useRef<Record<string, any>>({});

  // Get storage key for this form
  const storageKey = `${DRAFT_PREFIX}${formId}`;

  // Restore draft on mount
  useEffect(() => {
    if (initialLoadDone.current) return;

    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([key, value]) => {
          if (setters[key]) {
            setters[key](value);
          }
        });
      }
    } catch (error) {
      console.error("Error restoring form draft:", error);
    }

    // Store initial values for dirty checking
    initialFieldsRef.current = { ...fields };
    initialLoadDone.current = true;
  }, [storageKey, setters]);

  // Save draft with debounce
  useEffect(() => {
    if (!initialLoadDone.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(fields));
      } catch (error) {
        console.error("Error saving form draft:", error);
      }
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [storageKey, fields, debounceMs]);

  // Check if form has unsaved changes
  const isDirty = useCallback(() => {
    return Object.entries(fields).some(([key, value]) => {
      const initial = initialFieldsRef.current[key];
      // For arrays, compare by JSON
      if (Array.isArray(value) && Array.isArray(initial)) {
        return JSON.stringify(value) !== JSON.stringify(initial);
      }
      // For strings, trim and compare
      if (typeof value === "string" && typeof initial === "string") {
        return value.trim() !== initial.trim();
      }
      return value !== initial;
    });
  }, [fields]);

  // Check if form has any content (for navigation blocking)
  const hasContent = useCallback(() => {
    return Object.values(fields).some((value) => {
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return value != null && value !== "";
    });
  }, [fields]);

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Error clearing form draft:", error);
    }
  }, [storageKey]);

  return {
    isDirty,
    hasContent,
    clearDraft,
  };
}
