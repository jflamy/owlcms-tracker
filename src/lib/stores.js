import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Translation Map Store - Receives translations from SSE
 * Stores translations keyed by locale (e.g., 'en', 'fr', 'es')
 * Initially populated with 'en' locale from server
 */
export function createTranslationStore() {
  const { subscribe, set, update } = writable({
    en: {} // Initialize with empty 'en' locale
  });

  return {
    subscribe,
    setLocale: (locale, translationMap) => {
      update(translations => ({
        ...translations,
        [locale]: translationMap
      }));
    },
    getTranslation: (key, locale = 'en') => {
      let result;
      subscribe(translations => {
        result = translations[locale]?.[key] || translations.en?.[key] || key;
      })();
      return result;
    }
  };
}

// Export singleton instance for app-wide use
export const translations = createTranslationStore();

/**
 * Competition state store with SSE connection to SvelteKit hub
 * Receives updates from OWLCMS via the hub
 * 
 * NOTE: This legacy store system is deprecated.
 * New scoreboards should use the plugin system with individual SSE connections.
 * SSE connection disabled to prevent duplicate connections.
 */
function createCompetitionStore() {
  const state = writable({});
  const status = writable('connecting');
  
  // LEGACY SYSTEM - SSE connection disabled
  // New scoreboard system uses per-component SSE in [scoreboard]/+page.svelte
  if (browser && false) { // Disabled
    const eventSource = new EventSource('/api/client-stream');

    eventSource.onopen = () => {
      console.log('[Store] SSE connection opened');
      status.set('connecting');
    };

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'init':
        case 'state_update':
          // Handle both init and state_update as initial/full state
          console.log('[Store] Received state from hub:', message.type);
          if (message.data) {
            state.set(message.data);
            status.set('ready');
          } else if (message.payload) {
            state.set(message.payload);
            status.set('ready');
          } else {
            console.warn('[Store] State update has no data or payload:', message);
          }
          break;
          
        case 'competition_update':
          console.log('[Store] Received competition update');
          state.update(currentState => ({
            ...currentState,
            ...message.payload
          }));
          break;
        
        case 'fop_update':
          console.log('[Store] Received FOP update for:', message.fop);
          // Store raw FOP update - plugins can fetch processed data via API
          state.update(currentState => ({
            ...currentState,
            fopUpdates: {
              ...(currentState.fopUpdates || {}),
              [message.fop]: message.data
            },
            lastUpdate: message.timestamp
          }));
          status.set('ready');
          break;
          
        case 'waiting':
          console.log('[Store] Hub waiting for OWLCMS data');
          status.set('waiting');
          break;
          
        case 'keepalive':
          // Ignore keepalive messages
          break;

        default:
          console.warn('[Store] Unknown message type:', message.type);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[Store] SSE error:', error);
      status.set('error');
    };

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        eventSource.close();
      });
    }
  }

  return {
    subscribe: state.subscribe,
    status: { subscribe: status.subscribe }
  };
}

export const competition = createCompetitionStore();

// Derived stores for convenience - adapted for OWLCMS data structure
export const athletes = derived(competition, $c => $c.athletes ?? []);

export const timer = derived(competition, $c => {
  const timer = $c.timer ?? { state: 'stopped' };
  
  // Convert OWLCMS timer format to our expected format
  if (timer.timeAllowed && timer.timeRemaining !== undefined) {
    return {
      state: timer.timeRemaining > 0 ? 'running' : 'stopped',
      startTime: timer.timeRemaining > 0 ? Date.now() - (timer.timeAllowed - timer.timeRemaining) : null,
      duration: timer.timeAllowed,
      indefinite: timer.indefinite || false
    };
  }
  
  return timer;
});

export const currentAttempt = derived(competition, $c => {
  const attempt = $c.currentAttempt;
  if (!attempt) return null;
  
  // Convert OWLCMS format to our expected format
  return {
    athleteName: attempt.athleteName,
    teamName: attempt.teamName,
    startNumber: attempt.startNumber,
    categoryName: attempt.categoryName,
    lift: attempt.attempt === 'snatch1' || attempt.attempt === 'snatch2' || attempt.attempt === 'snatch3' 
      ? 'snatch' : 'cleanJerk',
    attemptNumber: attempt.attemptNumber,
    weight: attempt.weight
  };
});

export const liftingOrder = derived(competition, $c => $c.liftingOrder ?? []);

export const competitionInfo = derived(competition, $c => $c.competition ?? {});

export const sessionInfo = derived(competition, $c => $c.sessionInfo ?? {});

export const leaders = derived(competition, $c => $c.leaders ?? []);

export const displaySettings = derived(competition, $c => $c.displaySettings ?? {});

export const isBreak = derived(competition, $c => $c.isBreak ?? false);

export const breakType = derived(competition, $c => $c.breakType);

export const records = derived(competition, $c => $c.records);

// Competition status store
export const competitionStatus = competition.status;