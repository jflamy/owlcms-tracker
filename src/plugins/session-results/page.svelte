<script>
	/**
	 * Session Results Scoreboard
	 * Uses shared StandardScoreboard component
	 */
	import StandardScoreboard from '$lib/components/StandardScoreboard.svelte';
	
	export let data = {};
</script>

<StandardScoreboard {data} />
