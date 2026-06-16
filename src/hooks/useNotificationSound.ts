import { useCallback, useRef } from 'react';

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const currentTime = audioContext.currentTime;
      
      // Create a punchy, memorable two-tone "ding-ding" sound
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine';
        
        // Punchy attack, quick decay - LOUD
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.8, startTime + 0.01); // Fast attack, LOUD
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
        
        oscillator.onended = () => {
          oscillator.disconnect();
          gainNode.disconnect();
        };
      };
      
      // First tone - high pitched "ding" (C6)
      playTone(1047, currentTime, 0.12);
      
      // Second tone - even higher "ding" (G6) - creates memorable interval
      playTone(1568, currentTime + 0.08, 0.15);
      
      // Third quick accent tone (E7) - makes it stick in memory
      playTone(2637, currentTime + 0.14, 0.1);
      
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, []);

  return { playNotificationSound };
}
