<script>
	/**
	 * PlatesElement - Barbell visualization component
	 * Port of owlcms PlatesElement.java
	 * 
	 * Displays a visual representation of weight plates loaded on a barbell
	 */
	
	export let weight = 0;           // Total weight to display
	export let barWeight = 20;       // Bar weight (20kg men, 15kg women)
	export let platform = null;      // Platform configuration with plate counts
	export let lightBar = false;     // Whether using a light bar
	
	// Reactive plate calculation
	$: plates = computePlates(weight, barWeight, platform);
	$: console.log(`[PlatesElement] weight=${weight}, barWeight=${barWeight}, platform=${!!platform}, plates=${plates.length}`);
	
	/**
	 * Compute which plates to display
	 * Matches owlcms PlatesElement.java logic exactly
	 */
	function computePlates(totalWeight, barWt, plat) {
		const result = [];
		
		if (!totalWeight || totalWeight <= 0 || !plat) {
			console.log(`[PlatesElement] Early return: totalWeight=${totalWeight}, plat=${!!plat}`);
			return result;
		}
		
		let remainingWeight = totalWeight;
		const nonBarWeight = totalWeight - barWt;
		
		if (nonBarWeight < 0) {
			return result;
		}
		
		// Add bar
		result.push({ class: 'bar', barColor: getBarColor(barWt, lightBar) });
		result.push({ class: 'barInner', barColor: getBarColor(barWt, lightBar) });
		
		remainingWeight -= barWt;
		
		// Check collar availability
		const collarAvailable = plat.nbC_2_5 || 0;
		let useCollar = collarAvailable > 0;
		
		if (useCollar) {
			// Reserve weight for collar
			remainingWeight -= 5;
		}
		
		// Track if we've used any large plate
		let subtractedWeight = 0;
		
		// Large plates (in order of weight)
		subtractedWeight += addPlatesCalc(result, plat.nbL_25 || 0, 'L_25', 50, remainingWeight);
		remainingWeight -= subtractedWeight;
		
		let delta = addPlatesCalc(result, plat.nbL_20 || 0, 'L_20', 40, remainingWeight);
		subtractedWeight += delta;
		remainingWeight -= delta;
		
		delta = addPlatesCalc(result, plat.nbL_15 || 0, 'L_15', 30, remainingWeight);
		subtractedWeight += delta;
		remainingWeight -= delta;
		
		delta = addPlatesCalc(result, plat.nbL_10 || 0, 'L_10', 20, remainingWeight);
		subtractedWeight += delta;
		remainingWeight -= delta;
		
		// Only use L_5 if no larger plate used AND nonBarWeight >= 10
		if (subtractedWeight === 0 && (nonBarWeight - (useCollar ? 5 : 0)) >= 10) {
			delta = addPlatesCalc(result, plat.nbL_5 || 0, 'L_5', 10, remainingWeight);
			subtractedWeight += delta;
			remainingWeight -= delta;
		}
		
		// Only use L_2_5 if no larger plate used AND nonBarWeight >= 5
		if (subtractedWeight === 0 && (nonBarWeight - (useCollar ? 5 : 0)) >= 5) {
			delta = addPlatesCalc(result, plat.nbL_2_5 || 0, 'L_2_5', 5, remainingWeight);
			subtractedWeight += delta;
			remainingWeight -= delta;
		}
		
		// Small plates before collar
		delta = addPlatesCalc(result, plat.nbS_5 || 0, 'S_5', 10, remainingWeight);
		remainingWeight -= delta;
		
		delta = addPlatesCalc(result, plat.nbS_2_5 || 0, 'S_2_5', 5, remainingWeight);
		remainingWeight -= delta;
		
		// Add collar
		if (useCollar) {
			result.push({ class: 'C_2_5' });
		}
		
		// Remaining small plates after collar (only if there's remaining weight)
		if (remainingWeight >= 4) {
			delta = addPlatesCalc(result, plat.nbS_2 || 0, 'S_2', 4, remainingWeight);
			remainingWeight -= delta;
		}
		
		if (remainingWeight >= 3) {
			delta = addPlatesCalc(result, plat.nbS_1_5 || 0, 'S_1_5', 3, remainingWeight);
			remainingWeight -= delta;
		}
		
		if (remainingWeight >= 2) {
			delta = addPlatesCalc(result, plat.nbS_1 || 0, 'S_1', 2, remainingWeight);
			remainingWeight -= delta;
		}
		
		if (remainingWeight >= 1) {
			delta = addPlatesCalc(result, plat.nbS_0_5 || 0, 'S_0_5', 1, remainingWeight);
			remainingWeight -= delta;
		}
		
		// Add bar outer end
		result.push({ class: 'barOuter', barColor: getBarColor(barWt, lightBar) });
		
		return result;
	}
	
	/**
	 * Add plates to the result array
	 * Returns weight subtracted
	 */
	function addPlatesCalc(result, available, plateClass, pairWeight, remaining) {
		let subtracted = 0;
		let count = available;
		
		while (count > 0 && remaining >= pairWeight) {
			result.push({ class: plateClass });
			remaining -= pairWeight;
			subtracted += pairWeight;
			count--;
		}
		
		return subtracted;
	}
	
	/**
	 * Get bar color based on weight (for light bars)
	 */
	function getBarColor(barWt, isLightBar) {
		if (!isLightBar) return null;
		
		if (barWt < 5) return 'brown';
		if (barWt <= 5) return 'white';
		if (barWt < 10) return 'brown';
		if (barWt <= 10) return 'limegreen';
		if (barWt <= 15) return 'yellow';
		if (barWt <= 20) return 'blue';
		return null;
	}
</script>

<div class="plates-element dark">
	{#each plates as plate}
		<div 
			class="plate-item {plate.class}"
			class:plate={!plate.class.startsWith('bar') && !plate.class.startsWith('C')}
			style={plate.barColor ? `background-color: ${plate.barColor}` : ''}
		></div>
	{/each}
</div>

<style>
	.plates-element {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		font-size: 2em; /* Scale up all em/ex based sizes proportionally */
	}
	
	.plate-item {
		margin: 2px;
	}
	
	/* Plate border styling */
	.plate {
		border-color: white;
		border-width: 1px;
		border-style: solid;
		border-radius: 0.5em;
		overflow: hidden;
	}
	
	/* Bar sections */
	.bar {
		height: 1.5ex;
		width: 2.5em;
		background-color: grey;
	}
	
	.barInner {
		height: 4.5ex;
		width: 1em;
		background-color: grey;
		border-radius: 0.2em;
	}
	
	.barOuter {
		height: 2.5ex;
		width: 1.5em;
		background-color: grey;
	}
	
	/* Large plates (bumper plates) */
	.L_25 {
		height: 12em;
		width: 1.70em;
		background-color: red;
	}
	
	.L_20 {
		height: 12em;
		width: 1.60em;
		background-color: blue;
	}
	
	.L_15 {
		height: 12em;
		width: 1.50em;
		background-color: yellow;
	}
	
	.L_10 {
		height: 12em;
		width: 1.40em;
		background-color: green;
	}
	
	.L_5 {
		height: 12em;
		width: 1.30em;
		background-color: white;
	}
	
	.L_2_5 {
		height: 12em;
		width: 1.20em;
		background-color: red;
	}
	
	/* Collar */
	.C_2_5 {
		height: 5ex;
		width: 1.5em;
		background-color: black;
		border-color: white;
		border-width: 2px;
		border-style: solid;
		border-radius: 0.1em;
	}
	
	/* Small plates (change plates) */
	.S_5 {
		height: 7em;
		width: 0.65em;
		background-color: white;
	}
	
	.S_2_5 {
		height: 6em;
		width: 0.65em;
		background-color: red;
	}
	
	.S_2 {
		height: 5.5em;
		width: 0.65em;
		background-color: blue;
	}
	
	.S_1_5 {
		height: 5em;
		width: 0.65em;
		background-color: yellow;
	}
	
	.S_1 {
		height: 4.5em;
		width: 0.65em;
		background-color: green;
	}
	
	.S_0_5 {
		height: 4em;
		width: 0.65em;
		background-color: white;
	}
</style>
