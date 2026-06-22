<script>
    /**
     * Generic countdown timer component
     * Manages its own state completely independently - no parent re-renders
     * 
     * Props:
     * - timerData: { state: 'running'|'stopped'|'set', timeRemaining: ms, displayText?: string }
     * - color: CSS color for the timer text (default: green)
    * - warningColor: CSS color when the active timer enters its warning threshold (default: yellow)
     * 
     * If timerData.displayText is set (e.g., "STOP" or "STOPP"), it overrides the countdown display
     */
    import { onMount, onDestroy } from 'svelte';
    import { isTimerInWarning } from '$lib/timer-logic.js';

    export let timerData = null;
    export let color = '#4ade80';  // Green for athlete timer
    export let warningColor = '#fbbf24';  // Yellow/orange for warning

    // Private timer state - completely isolated from parent
    let seconds = 0;
    let isRunning = false;
    let isWarning = false;
    let display = '0:00';
    let displayText = null;  // Backend-provided text override (e.g., "STOP", "STOPP")

    // Internal countdown state
    let timerInterval = null;
    let startTime = null;
    let initialRemaining = 0;
    let lastSyncedState = null;
    let currentTimerData = null;

    function formatTime(totalSeconds) {
        if (totalSeconds <= 0) return '0:00';
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    function updateDisplay() {
        // If backend provided displayText, use it instead of countdown
        if (displayText) {
            display = displayText;
            return;
        }

        if (!isRunning || startTime === null) {
            // Not running - show static time
            display = formatTime(seconds);
            return;
        }

        // Running - calculate elapsed and remaining
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, initialRemaining - elapsed);
        seconds = Math.ceil(remaining / 1000);
        isWarning = isTimerInWarning(currentTimerData, remaining);
        display = formatTime(seconds);
    }

    // Reseed the countdown from the server-computed remaining value. Called on mount
    // and whenever timerData changes - this is the "resync on reload" point: the
    // shared helper has already recomputed remaining = start anchor + wall clock,
    // so the client only counts down from that authoritative value.
    function syncWithServer(data) {
        if (!data) return;

        currentTimerData = data;

        // Check for backend-provided display text (e.g., "STOP", "STOPP")
        displayText = data.displayText || null;

        // Create a state key to detect actual changes
        const stateKey = `${data.state}-${data.timeRemaining}-${data.endTimeMillis ?? ''}-${data.duration ?? data.timeAllowed ?? ''}-${data.initialWarningMillis ?? data.athleteInitialWarningMillis ?? ''}-${data.finalWarningMillis ?? data.athleteFinalWarningMillis ?? ''}-${data.displayText || ''}`;
        if (stateKey === lastSyncedState) return;
        lastSyncedState = stateKey;

        if (data.state === 'running') {
            // Start or re-sync countdown with server's computed remaining time
            startTime = Date.now();
            // Prefer the absolute end anchor when available: data.timeRemaining is a
            // snapshot that the API response cache freezes between OWLCMS messages, so
            // on reload it can be stale (e.g. show the full break duration). endTimeMillis
            // is the wall-clock instant the timer hits zero and stays correct, letting the
            // client recompute the true remaining time at the moment it (re)syncs.
            if (data.endTimeMillis && data.endTimeMillis > 0) {
                initialRemaining = Math.max(0, data.endTimeMillis - Date.now());
            } else {
                initialRemaining = Math.max(0, data.timeRemaining || 0);
            }
            isRunning = true;
        } else {
            // Stopped or set - show static time
            isRunning = false;
            startTime = null;
            seconds = Math.max(0, Math.ceil((data.timeRemaining || 0) / 1000));
        }

        isWarning = isTimerInWarning(data, (data.timeRemaining || 0));
        updateDisplay();
    }

    onMount(() => {
        // Initial sync
        if (timerData) {
            syncWithServer(timerData);
        }

        // Start 100ms update interval
        timerInterval = setInterval(() => {
            updateDisplay();  // Always update to catch initial state
        }, 100);
    });

    onDestroy(() => {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    });

    // Sync when timerData prop changes
    $: if (timerData) {
        syncWithServer(timerData);
    } else {
        currentTimerData = null;
        lastSyncedState = null;
        displayText = null;
        startTime = null;
        initialRemaining = 0;
        seconds = 0;
        isRunning = false;
        isWarning = false;
        display = '0:00';
    }
</script>

<span 
    class="timer-display"
    class:warning={isWarning}
    style="color: {isWarning ? warningColor : color};"
>{display}</span>

<style>
    .timer-display {
        font-size: var(--timer-font-size, inherit);
        line-height: 1;
        font-family: 'Courier New', monospace;
        letter-spacing: 2px;
        text-align: center;
        white-space: nowrap;
    }
</style>
