import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface TypingUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export function useTypingIndicator(demandId?: string) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Broadcast typing state
  const setTyping = useCallback((isTyping: boolean) => {
    if (!channelRef.current || !user || isTypingRef.current === isTyping) return;
    
    isTypingRef.current = isTyping;
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.id,
        isTyping
      }
    });
  }, [user]);

  // Handle input change - set typing with debounce
  const handleInputChange = useCallback(() => {
    setTyping(true);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  }, [setTyping]);

  // Stop typing (for blur or submit)
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTyping(false);
  }, [setTyping]);

  useEffect(() => {
    if (!demandId || !user) return;

    const fetchUserProfile = async (userId: string): Promise<TypingUser | null> => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', userId)
        .single();
      
      if (data) {
        return {
          id: data.id,
          name: data.full_name,
          avatarUrl: data.avatar_url
        };
      }
      return null;
    };

    console.log('Setting up typing indicator for demand:', demandId);

    const channel = supabase
      .channel(`typing-${demandId}`)
      .on('broadcast', { event: 'typing' }, async (payload) => {
        const { userId, isTyping } = payload.payload as { userId: string; isTyping: boolean };
        
        // Ignore own typing events
        if (userId === user.id) return;
        
        if (isTyping) {
          // Add user to typing list if not already there
          const profile = await fetchUserProfile(userId);
          if (profile) {
            setTypingUsers(prev => {
              if (prev.some(u => u.id === userId)) return prev;
              return [...prev, profile];
            });
          }
        } else {
          // Remove user from typing list
          setTypingUsers(prev => prev.filter(u => u.id !== userId));
        }
      })
      .subscribe((status) => {
        console.log('Typing indicator subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('Cleaning up typing indicator for demand:', demandId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Send stop typing before leaving
      if (isTypingRef.current) {
        channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            userId: user.id,
            isTyping: false
          }
        });
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [demandId, user]);

  // Auto-remove users after 5 seconds (in case stop typing wasn't received)
  useEffect(() => {
    if (typingUsers.length === 0) return;

    const timer = setTimeout(() => {
      setTypingUsers([]);
    }, 5000);

    return () => clearTimeout(timer);
  }, [typingUsers]);

  return {
    typingUsers,
    handleInputChange,
    stopTyping,
    isAnyoneTyping: typingUsers.length > 0
  };
}
