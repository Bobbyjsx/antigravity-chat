
// Audio helper for Ringtone (Incoming)
export const playRingtone = () => {
    try {
      const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioContext) return null;
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
  
      osc.connect(gain);
      gain.connect(ctx.destination);
  
      // Digital Phone Ring pattern (higher pitch, faster)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(960, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
  
      osc.start();
      
      const interval = setInterval(() => {
          if (ctx.state === 'closed') { clearInterval(interval); return; }
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.setValueAtTime(960, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      }, 2000);
  
      return { ctx, osc, interval };
    } catch (e) {
      return null;
    }
  };
  
  // Audio helper for Dial Tone (Outgoing)
  export const playDialTone = () => {
      try {
        const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
        if (!AudioContext) return null;
        
        const ctx = new AudioContext();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
    
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
    
        // US Ringback Tone (440Hz + 480Hz)
        osc1.frequency.value = 440;
        osc2.frequency.value = 480;
        
        gain.gain.value = 0.1; 
    
        osc1.start();
        osc2.start();
        
        // 2s on, 4s off pattern
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime + 2);
        
        const interval = setInterval(() => {
            if (ctx.state === 'closed') { clearInterval(interval); return; }
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.setValueAtTime(0, ctx.currentTime + 2);
        }, 6000);
    
        return { ctx, osc: osc1, interval }; // We just return one osc to track, but cleanup cleans context
      } catch (e) {
        return null;
      }
    };
