<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import gsap from 'gsap';
	import { translations } from '$lib/stores.js';
	
	// Import background images for plugin autonomy
	import bgImage from './StandingResults/Background/bg.jpg';
	import topImage from './StandingResults/Background/top.jpg';
	import yellowImage from './StandingResults/Background/yellow.jpg';
	import weightliftingImage from './StandingResults/Elements/WEIGHTLIFTING.jpg';
	
	export let data = {};
	
	// Current translations object (populated from store)
	let t = {};
	const unsubscribeTranslations = translations.subscribe(trans => {
		t = trans || {};
	});
	
	let currentCategoryIndex = 0;
	let currentPageWithinCategory = 0;
	let pageInterval = 5000; // milliseconds
	let blankSlateInterval = 50; // milliseconds - minimal pause between cycles
	let pageTimer = null;
	let rowElements = [];
	let isAnimating = false;
	let showGrid = true; // Controls grid visibility for clean slate transitions
	let isFirstRun = true; // Skip page increment on first display
	let showPageIndicator = false; // Controls page indicator visibility
	
	// Athletes per page (8 rows to match StandingResults sp1-sp8)
	const ATHLETES_PER_PAGE = 8;
	
	// Helper function to check if flag should render
	function shouldRenderFlag(url) {
		return url && !url.startsWith('data:');
	}
	
	// Get score box CSS class based on status
	function getScoreClass(score) {
		if (score.status === 'good') return 'score-good'; // White background
		if (score.status === 'fail') return 'score-fail'; // Red background
		if (score.status === 'best') return 'score-best'; // Transparent, white text
		return 'score-empty'; // Transparent with border
	}
	
	$: pageInterval = (data.pageInterval || 5) * 1000;
	
	// Calculate category groups with pages within each category
	// Major sequence: categories
	// Minor sequence: pages within each category
	$: categorySequence = (() => {
		if (!data.athletes || data.athletes.length === 0) return [];
		
		const categoriesMap = new Map();
		
		// Group athletes by category
		for (const athlete of data.athletes) {
			const category = athlete.categoryName || athlete.category || '';
			if (!categoriesMap.has(category)) {
				categoriesMap.set(category, []);
			}
			categoriesMap.get(category).push(athlete);
		}
		
		// Convert to array maintaining order, then break each category into pages
		const result = [];
		for (const [categoryName, athletes] of categoriesMap) {
			const pagesInCategory = [];
			for (let i = 0; i < athletes.length; i += ATHLETES_PER_PAGE) {
				pagesInCategory.push(athletes.slice(i, i + ATHLETES_PER_PAGE));
			}
			result.push({ categoryName, pages: pagesInCategory });
		}
		
		return result;
	})();
	
	$: totalCategories = categorySequence.length;
	$: totalPagesInCurrentCategory = categorySequence[currentCategoryIndex]?.pages.length || 0;
	
	// Get current category name
	$: currentCategoryName = categorySequence[currentCategoryIndex]?.categoryName || '';
	
	// Get current page athletes
	$: currentPageAthletes = categorySequence[currentCategoryIndex]?.pages[currentPageWithinCategory] || [];
	
	// Determine number of score columns (varies by modality: 3 for snatch/cj, 1 for total)
	$: numScoreColumns = currentPageAthletes.length > 0 ? (currentPageAthletes[0]?.scores?.length || 0) : 0;
	$: showScoreHeader = numScoreColumns > 1; // Only show 1ST/2ND/3RD if multiple columns
	
	// Pad with empty rows if needed
	$: displayAthletes = [
		...currentPageAthletes,
		...Array(ATHLETES_PER_PAGE - currentPageAthletes.length).fill(null)
	];
	
	// Get athlete ranking per category (use OWLCMS precomputed rank)
	function getRanking(athlete) {
		if (!athlete) return '';
		// Use totalRank from OWLCMS (already computed per category)
		return athlete.totalRank || athlete.rank || '';
	}
	
	async function animatePageTransition() {
		// Immediately hide current rows to prevent flash of new content
		if (rowElements && rowElements.length > 0) {
			gsap.set(rowElements, { opacity: 0 });
		}
		
		// Wait for Svelte to update the DOM with new athletes
		await tick();
		
		if (!rowElements || rowElements.length === 0) {
			isAnimating = false;
			return;
		}
		
		// Kill any existing animations on these elements to prevent conflicts
		gsap.killTweensOf(rowElements);
		
		// Stagger animation for each row revealing from top to bottom
		const tl = gsap.timeline({
			onComplete: () => {
				isAnimating = false;
			}
		});
		
		// Start from hidden state with slight upward offset
		tl.fromTo(rowElements, 
			{
				opacity: 0,
				y: -15
			},
			{
				opacity: 1,
				y: 0,
				duration: 0.5,
				stagger: 0.1,
				overwrite: 'auto'
			}
		);
		
		// Safety timeout: Force unlock after 2 seconds if something goes wrong
		setTimeout(() => {
			if (isAnimating) {
				isAnimating = false;
			}
		}, 2000);
	}
	
	function startPaging() {
		if (totalCategories === 0) return;
		
		function scheduleNext(delay) {
			console.log('[scheduleNext] Scheduling next timeout with delay:', delay, 'ms');
			pageTimer = setTimeout(() => {
				console.log('[Timer fired] categoryIndex:', currentCategoryIndex, 'pageWithinCategory:', currentPageWithinCategory, 'showGrid:', showGrid, 'isAnimating:', isAnimating);
				
				// Only advance if animation is not currently playing
				if (!isAnimating) {
					// If we're showing blank slate, bring back the grid
					if (!showGrid) {
						console.log('[Blank slate] Restoring grid and page indicator');
						showGrid = true;
						showPageIndicator = true; // Restore page indicator
						isAnimating = true;
						// Wait for Svelte to re-render the grid before animating
						(async () => {
							await tick();
							animatePageTransition();
						})();
						scheduleNext(pageInterval); // Normal interval for pages
						return;
					}
					
					isAnimating = true; // Lock immediately
					
					// Check if this is the last page of the last category BEFORE advancing
					const isLastPageOfLastCategory = 
						(currentPageWithinCategory + 1 >= totalPagesInCurrentCategory) &&
						(currentCategoryIndex + 1 >= totalCategories);
					
					console.log('[Before advance] isLastPageOfLastCategory:', isLastPageOfLastCategory);
					
					// Advance to next page within current category
					currentPageWithinCategory++;
					console.log('[After increment] pageWithinCategory:', currentPageWithinCategory, 'totalPagesInCurrentCategory:', totalPagesInCurrentCategory);
					
					// If we've shown all pages in this category, move to next category
					if (currentPageWithinCategory >= totalPagesInCurrentCategory) {
						currentPageWithinCategory = 0;
						currentCategoryIndex = (currentCategoryIndex + 1) % totalCategories;
						console.log('[Category change] New categoryIndex:', currentCategoryIndex, 'totalCategories:', totalCategories);
						
						// If we've cycled back to the first category, show blank slate immediately
						if (currentCategoryIndex === 0) {
							console.log('[End of cycle] Going to blank slate');
							showGrid = false;
							showPageIndicator = false; // Hide page indicator during blank
							isAnimating = false; // Unlock - blank slate has no animation
							scheduleNext(blankSlateInterval); // Minimal interval to restart
							return;
						}
					}
					
					console.log('[Animating] categoryIndex:', currentCategoryIndex, 'pageWithinCategory:', currentPageWithinCategory);
					animatePageTransition();
					console.log('[Next delay] Using', isLastPageOfLastCategory ? 'blankSlateInterval' : 'pageInterval');
					scheduleNext(isLastPageOfLastCategory ? blankSlateInterval : pageInterval);
				} else {
					// If still animating, try again soon
					console.log('[Still animating] Retrying in 500ms');
					scheduleNext(500);
				}
			}, delay);
		}
		
		scheduleNext(pageInterval);
	}
	
	onMount(async () => {
		if (data.status === 'ready' && totalCategories > 0) {
			console.log('[onMount] Starting - totalCategories:', totalCategories);
			console.log('[onMount] Initial state - categoryIndex:', currentCategoryIndex, 'pageWithinCategory:', currentPageWithinCategory);
			
			// Wait for DOM to be ready
			await tick();
			
			// Show first page immediately without waiting for timer
			isFirstRun = false; // Mark first run as done
			showPageIndicator = true; // Show page indicator immediately
			isAnimating = true; // Lock before starting animation
			
			console.log('[onMount] Animating first page immediately');
			
			// Animate the first page immediately (don't wait for timer)
			await animatePageTransition();
			
			console.log('[onMount] First page shown, starting paging timer for subsequent pages');
			
			// Start the paging timer for subsequent pages
			startPaging();
		}
	});
	
	onDestroy(() => {
		if (pageTimer) {
			clearTimeout(pageTimer);
		}
		// Kill any running animations
		gsap.killTweensOf(rowElements);
		// Unsubscribe from translations store
		unsubscribeTranslations();
	});

</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="lower-third-container">
	{#if data.status === 'ready' && displayAthletes.length > 0}
		<svg 
			class="ranking-box"
			viewBox="0 0 1920 1080"
			width="1920"
			height="1080"
			preserveAspectRatio="none"
			xmlns="http://www.w3.org/2000/svg"
			xmlns:xlink="http://www.w3.org/1999/xlink"
		>
			<defs>
				<!-- Clip paths for each section -->
				<path id="cutb1Path" d="M1473.6,302.32v131.94c0,1.02-0.01,2.03-0.03,3.04H493.81v-7.35c0-4.18,0.21-8.35,0.69-12.5c5.21-44.54,21.43-78.52,48.35-98.5c14.84-11.01,33-16.63,51.48-16.63H1473.6z"/>
				<clipPath id="cutb1Clip">
					<use xlink:href="#cutb1Path" style="overflow:visible;"/>
				</clipPath>
				
				<path id="cutb2Path" d="M493.81,437.3h898.91c-5.42,19.47-14.04,35.4-27.94,45.47c-8.93,6.47-19.82,9.68-30.85,9.68H493.81V437.3z"/>
				<clipPath id="cutb2Clip">
					<use xlink:href="#cutb2Path" style="overflow:visible;"/>
				</clipPath>
				
				<path id="cutb3Path" d="M1275.92,1018.49h-783V437.3h980.68v383.51C1473.6,929.98,1385.09,1018.49,1275.92,1018.49z"/>
				<clipPath id="cutb3Clip">
					<use xlink:href="#cutb3Path" style="overflow:visible;"/>
				</clipPath>
				
				<rect id="dataAreaRect" x="532.47" y="521.34" width="819.9" height="459.77"/>
				<clipPath id="dataAreaClip">
					<use xlink:href="#dataAreaRect" style="overflow:visible;"/>
				</clipPath>
			</defs>
			
			<!-- TOP SECTION (cutb1) - Title and logo area -->
			<g style="clip-path:url(#cutb1Clip);">
				<image style="overflow:visible;" width="1028" height="211" xlink:href={topImage} transform="matrix(1 0 0 1 466.7872 268.3989)"/>
				<!-- Pictogram -->
				<defs>
					<rect id="pictogramRect" x="1338.53" y="302.32" width="134.98" height="134.98"/>
				</defs>
				<clipPath id="pictogramClip">
					<use xlink:href="#pictogramRect" style="overflow:visible;"/>
				</clipPath>
				<g style="clip-path:url(#pictogramClip);">
					<image style="overflow:visible;" width="1489" height="1489" xlink:href={weightliftingImage} transform="matrix(0.0907 0 0 0.0907 1338.5327 302.2393)"/>
				</g>
				<!-- Title text -->
				<text transform="matrix(1 0 0 1 557.376 369.6324)" style="fill:#FFFFFF; font-family:'Albert Sans', sans-serif; font-size:49px; font-weight:bold;">WEIGHTLIFTING</text>
			</g>
			
			<!-- BOTTOM SECTION (cutb3) - Data area background -->
			<g style="clip-path:url(#cutb3Clip);">
				<image style="overflow:visible;" width="1031" height="625" xlink:href={bgImage} transform="matrix(1 0 0 1 467.6277 413.6489)"/>
			</g>
			
			<!-- YELLOW BAR (cutb2) - Plain yellow solid background -->
			<g id="b2" style="clip-path:url(#cutb2Clip);">
				<rect x="493.81" y="437.3" width="913.96" height="54.85" style="fill:#FFFF00;"/>
			</g>
			
			<!-- ForeignObject grid for athlete data (overlays data area) -->
			{#if showGrid}
			<foreignObject
				x="532.47"
				y="437.3"
				width="819.9"
				height="583.47"
			>
			<div class="grid-container" xmlns="http://www.w3.org/1999/xhtml">
				<!-- Header Row 1 - Category name, ranking label, and modality labels (Snatch/C&J/Total) -->
				<div class="grid-row grid-header header-row-1">
					<div class="cell-rank"></div>
					<div class="cell-category-group">{currentCategoryName || ''} {t['Scoreboard.RANKING'] || 'RANKING'}</div>
					<div class="score-box best">{t.Snatch || 'Snatch'}</div>
					<div class="score-box best">{t.Clean_and_Jerk || 'C&J'}</div>
					<div class="score-box best">{t.TOTAL || 'Total'}</div>
				</div>
				
				<!-- Header Row 2 - Score column headers (dynamic based on modality) -->
				<div class="grid-row grid-header header-row-2">
					<div class="cell-rank"></div>
					<div class="cell-flag"></div>
					<div class="cell-country"></div>
					<div class="cell-name"></div>
					
					{#if data.modality === 'snatch' || data.modality === 'cj'}
						<!-- Snatch/C&J modality: four score columns -->
						<div class="score-box best">1</div>
						<div class="score-box best">2</div>
						<div class="score-box best">3</div>
						<div class="score-box best">{t.Best || '✔'}</div>
					{/if}
				</div>
				
				<!-- Data Rows -->
					{#each displayAthletes as athlete, idx}
						<div 
							class="grid-row"
							bind:this={rowElements[idx]}
						>
							<div class="cell-rank">
								{athlete ? getRanking(athlete) : ''}
							</div>
							<div class="cell-flag">
								{#if athlete?.flagUrl && shouldRenderFlag(athlete.flagUrl)}
									<img src={athlete.flagUrl} alt="{athlete?.countryCode || ''}" class="flag-img" />
								{/if}
							</div>
							<div class="cell-country">
								{athlete?.countryCode || ''}
							</div>
							<div class="cell-name">
								{athlete?.fullName || ''}
							</div>
							
							<!-- Score boxes - dynamically sized based on modality -->
							{#each athlete?.scores || [] as score}
								<div class="score-box {getScoreClass(score)}">
									{score.value}
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</foreignObject>
			{/if}
		</svg>
		
		{#if showPageIndicator && (totalCategories > 1 || totalPagesInCurrentCategory > 1)}
			<div class="page-indicator">
				Category {currentCategoryIndex + 1}/{totalCategories} - Page {currentPageWithinCategory + 1}/{totalPagesInCurrentCategory}
			</div>
		{/if}
	{:else if data.status === 'waiting'}
		<div class="waiting">
			<p>Waiting for competition data...</p>
		</div>
	{:else}
		<div class="empty">
			<p>No athletes to display</p>
		</div>
	{/if}
</div>

<style>
	.lower-third-container {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 1920px;
		height: 1080px;
		pointer-events: none;
		display: block;
		padding: 0;
		box-sizing: border-box;
		overflow: hidden;
		background: transparent;
	}
	
	.ranking-box {
		width: 1920px;
		height: 1080px;
		display: block;
		filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.5));
	}
	
	.page-indicator {
		position: fixed;
		bottom: 35px;
		right: 40px;
		font-size: 14px;
		color: rgba(255, 255, 255, 0.6);
		font-family: 'Albert Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		pointer-events: none;
		font-weight: 500;
		background: rgba(15, 20, 25, 0.8);
		padding: 8px 16px;
		border-radius: 4px;
		border: 1px solid rgba(255, 215, 0, 0.2);
		display: none;
	}
	
	/* Grid Container (inside foreignObject) */
	:global(.grid-container) {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		font-family: 'Albert Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		color: white;
		box-sizing: border-box;
		padding: 2px 4px;
		margin: 0;
		overflow: hidden;
		gap: 1px;
	}
	
	/* Grid Row for each athlete */
	:global(.grid-row) {
		display: grid;
		grid-template-columns: 32px 70px 36px minmax(350px, 1fr) repeat(auto-fit, minmax(8px, 1fr));
		gap: 2px;
		padding: 2px 4px;
		align-items: center;
		font-size: 25px;
		font-weight: 500;
		height: 56px;
		opacity: 0;
		transform: translateY(-5px);
	}
	
	/* Header Row - Static, dark blue text on transparent background (yellow bar shows through) */
	:global(.grid-header) {
		display: grid;
		grid-template-columns: 32px 70px 36px minmax(350px, 1fr) repeat(auto-fit, minmax(8px, 1fr));
		gap: 2px;
		padding: 2px 4px;
		align-items: center;
		height: 56px;
		background-color: transparent;
		color: #2A535A;
		flex-shrink: 0;
		opacity: 1;
		transform: none;
	}
	
	/* Header Row 1 - Category and modality labels (taller for better spacing) */
	:global(.header-row-1) {
		height: 40px;
		align-items: flex-end;
		padding-top: 8px;
		padding-bottom: 4px;
	}
	
	/* Header Row 2 - Column numbers (normal height) */
	:global(.header-row-2) {
		height: 32px;
		align-items: center;
		padding: 2px 4px;
	}
	
	/* Category group cell - spans flag, code, and name columns */
	:global(.cell-category-group) {
		grid-column: span 3;
		color: #2A535A;
		font-weight: 700;
		font-size: 28px;
		text-align: left;
		padding-left: 12px;
	}
	
	/* Rank cell - matches StandingResults styling */
	:global(.cell-rank) {
		text-align: center;
		color: #FFFFFF;
		font-weight: 700;
		font-size: 22px;
		min-width: 32px;
		background: transparent;
		border-radius: 2px;
		padding: 1px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	/* Rank cell in header - dark blue text */
	:global(.grid-header .cell-rank) {
		color: #2A535A;
	}
	
	/* Flag cell - shows country flag image */
	:global(.cell-flag) {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 70px;
		height: 28px;
		padding: 2px 2px;
	}
	
	:global(.flag-img) {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	
	/* Country code cell */
	:global(.cell-country) {
		text-align: center;
		color: #FFFFFF;
		font-weight: 600;
		font-size: 20px;
		min-width: 36px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px 6px;
		text-transform: uppercase;
	}
	
	/* Country code cell in header - dark blue text */
	:global(.grid-header .cell-country) {
		color: #2A535A;
		font-size: 22px;
		font-weight: 700;
	}
	
	/* Athlete name cell */
	:global(.cell-name) {
		text-align: left;
		color: #FFFFFF;
		font-weight: 400;
		font-size: 22px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding-left: 12px;
		height: 28px;
		display: flex;
		align-items: center;
	}
	
	/* Athlete name cell in header - dark blue text */
	:global(.grid-header .cell-name) {
		color: #2A535A;
		font-weight: 700;
	}
	
	/* Score boxes - dynamically displayed */
	:global(.score-box) {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 8px;
		height: 28px;
		border-radius: 2px;
		font-weight: 700;
		font-size: 22px;
		border: 1px solid transparent;
	}
	
	/* Score box in header - dark blue text and styling */
	:global(.grid-header .score-box) {
		color: #2A535A;
		background: transparent;
		border: none;
		font-size: 18px;
		font-weight: 700;
		height: auto;
		padding: 4px 8px;
	}
	
	/* Score boxes in header row 1 - modality labels (larger font) */
	:global(.header-row-1 .score-box) {
		font-size: 24px;
		font-weight: 700;
		height: auto;
		padding: 4px 8px;
	}
	
	/* Score boxes in header row 2 - column numbers (smaller font) */
	:global(.header-row-2 .score-box) {
		font-size: 18px;
		font-weight: 700;
		height: auto;
		padding: 2px 4px;
	}
	
	/* Score box states */
	:global(.score-good) {
		background: #FFFFFF;
		color: #0F1419;
	}
	
	:global(.score-fail) {
		background: #F44336;
		color: #FFFFFF;
	}
	
	:global(.score-empty) {
		background: transparent;
		color: #FFFFFF;
		border: 2px solid rgba(255, 255, 255, 0.3);
	}
	
	:global(.score-best) {
		background: transparent;
		color: #FFFFFF;
		border: none;
		font-weight: 700;
	}
	
	.waiting {
		padding: 40px;
		color: rgba(255, 255, 255, 0.6);
		font-size: 18px;
		font-family: 'Albert Sans', sans-serif;
	}
	
	.empty {
		padding: 40px;
		color: rgba(255, 255, 255, 0.6);
		font-size: 18px;
		font-family: 'Albert Sans', sans-serif;
	}
</style>
