<script>
    /**
     * Generic countdown timer component
     * Manages its own state completely independently - no parent re-renders
     * 
     * Props:
     * - timerData: { state: 'running'|'stopped'|'set', timeRemaining: ms, displayText?: string }
     * - color: CSS color for the timer text (default: green)
     * - warningColor: CSS color when <= 30 seconds (default: yellow)
     * 
     * If timerData.displayText is set (e.g., "STOP" or "STOPP"), it overrides the countdown display
     */
    import { onMount, onDestroy } from 'svelte';

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
        isWarning = seconds > 0 && seconds <= 30;
        display = formatTime(seconds);
    }

    function syncWithServer(data) {
        if (!data) return;

        // Check for backend-provided display text (e.g., "STOP", "STOPP")
        displayText = data.displayText || null;

        // Create a state key to detect actual changes
        const stateKey = `${data.state}-${data.timeRemaining}-${data.displayText || ''}`;
        if (stateKey === lastSyncedState) return;
        lastSyncedState = stateKey;

        if (data.state === 'running') {
            // Start or continue countdown
            if (!isRunning) {
                startTime = Date.now();
                initialRemaining = Math.max(0, data.timeRemaining || 0);
                isRunning = true;
            }
        } else {
            // Stopped or set - show static time
            isRunning = false;
            startTime = null;
            seconds = Math.max(0, Math.ceil((data.timeRemaining || 0) / 1000));
        }

        isWarning = seconds > 0 && seconds <= 30;
        updateDisplay();
    }

    onMount(() => {
        // Initial sync
        if (timerData) {
            syncWithServer(timerData);
        }

        // Start 100ms update interval
        timerInterval = setInterval(() => {
            if (isRunning) {
                updateDisplay();
            }
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
    }
</script>

<span 
    class="timer-display"
    class:warning={isWarning}
    style="color: {isWarning ? warningColor : color};"
>{display}</span>

<style>
    .timer-display {
        font-size: inherit; /* inherit from parent so outer layout controls sizing */
        line-height: 1;
        font-family: 'Courier New', monospace;
        letter-spacing: 2px;
        text-align: center;
        white-space: nowrap;
    }
</style>
