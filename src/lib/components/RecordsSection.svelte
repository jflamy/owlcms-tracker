<script>
	// Records section component - shared across all grid-based scoreboards
	// Displays records grid organized by federation and category
	
	export let records = [];
	export let translations = {};
	
	// Get all unique categories across all federations
	function getAllRecordCategories(recordsData) {
		if (!recordsData || recordsData.length === 0) return [];
		const categoryMap = new Map(); // key → displayName
		
		for (const fedData of recordsData) {
			if (fedData.records) {
				for (const [categoryKey, categoryData] of Object.entries(fedData.records)) {
					if (!categoryMap.has(categoryKey)) {
						categoryMap.set(categoryKey, categoryData.displayName || categoryKey);
					}
				}
			}
		}
		
		// Return sorted array of keys
		return Array.from(categoryMap.keys()).sort();
	}

	// Get display name for a category key
	function getCategoryDisplayName(recordsData, categoryKey) {
		if (!recordsData || recordsData.length === 0) return categoryKey;
		
		for (const fedData of recordsData) {
			if (fedData.records?.[categoryKey]?.displayName) {
				return fedData.records[categoryKey].displayName;
			}
		}
		
		return categoryKey;
	}

	// Get record cell for a specific federation, category, and lift type
	function getRecordCell(federationData, category, liftType) {
		if (!federationData?.records?.[category]?.[liftType]) {
			return { value: '-', highlight: null };
		}
		return federationData.records[category][liftType];
	}
	
	$: categories = getAllRecordCategories(records);
	$: hasRecords = records && records.length > 0;
</script>

{#if hasRecords}
	<div class="records-section">
		<!-- Single unified grid container -->
		<div class="records-table-grid" style="--num-categories: {categories.length}">
			<!-- Row 1: Category headers with title in top-left -->
			<div class="records-title-cell">{translations.RECORDS || 'RECORDS'}</div>
			{#each categories as category, idx}
				<div class="records-category-header" class:first-col={idx === 0} class:last-col={idx === categories.length - 1} style="grid-column: span 3">
					{getCategoryDisplayName(records, category)}
				</div>
			{/each}
			
			<!-- Row 2: Sub-headers (S/CJ/T) -->
			<div class="records-subheader-cell"></div>
			{#each categories as category, idx}
				<div class="records-subheader first" class:first-row-col={idx === 0} class:last-row-col={idx === categories.length - 1}>S</div>
				<div class="records-subheader">CJ</div>
				<div class="records-subheader last" class:last-row-col={idx === categories.length - 1}>T</div>
			{/each}
			
			<!-- Data rows: one per federation -->
			{#each records as federationData, rowIdx}
				<div class="records-federation-cell" class:last-row={rowIdx === records.length - 1}>{federationData.federation}</div>
				{#each categories as category, colIdx}
					<div class="records-cell first-col" class:highlighted={getRecordCell(federationData, category, 'S').highlight} class:first-row-col={colIdx === 0} class:last-row={rowIdx === records.length - 1}>
						{getRecordCell(federationData, category, 'S').value ?? '-'}
					</div>
					<div class="records-cell" class:highlighted={getRecordCell(federationData, category, 'CJ').highlight} class:last-row={rowIdx === records.length - 1}>
						{getRecordCell(federationData, category, 'CJ').value ?? '-'}
					</div>
					<div class="records-cell last-col" class:highlighted={getRecordCell(federationData, category, 'T').highlight} class:last-row-col={colIdx === categories.length - 1} class:last-row={rowIdx === records.length - 1}>
						{getRecordCell(federationData, category, 'T').value ?? '-'}
					</div>
				{/each}
			{/each}
		</div>
	</div>
{/if}

<style>
	/* Records Section - Below Grid */
	.records-section {
		padding: 2rem;
		background: #000;
		overflow-x: auto;
	}

	/* Unified grid with dynamic columns: 1 federation column + (3 * num_categories) data columns */
	.records-table-grid {
		display: grid;
		grid-template-columns: minmax(120px, auto) repeat(calc(var(--num-categories) * 3), 1fr);
		gap: 0;
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 4px;
		overflow: hidden;
	}

	/* Title cell in top-left corner */
	.records-title-cell {
		grid-column: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		background: #2a2a2a;
		font-weight: bold;
		font-size: 0.9rem;
		color: #e0e0e0;
		border-bottom: 2px solid #444;
		border-right: 1px solid #333;
		min-height: 2.5rem;
	}

	/* Row 1: Category headers - each spans 3 columns (S, CJ, T) */
	.records-category-header {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		background: #2a2a2a;
		font-weight: bold;
		font-size: 0.85rem;
		color: #e0e0e0;
		border-bottom: 2px solid #444;
		border-right: 1px solid #333;
		min-height: 2.5rem;
	}

	/* First data column */
	.records-category-header.first-col {
		border-left: 2px solid #444;
	}

	/* Last data column */
	.records-category-header.last-col {
		border-right: 2px solid #444;
	}

	/* Row 2: Sub-headers (S, CJ, T) */
	.records-subheader-cell {
		grid-column: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: #2a2a2a;
		border-bottom: 1px solid #333;
		border-right: 1px solid #333;
		min-height: 2rem;
	}

	.records-subheader {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: #2a2a2a;
		font-weight: bold;
		font-size: 0.8rem;
		color: #e0e0e0;
		border-bottom: 1px solid #333;
		border-right: 1px solid #333;
		min-height: 2rem;
	}

	/* First subheader in each category group */
	.records-subheader.first {
		border-left: none;
	}

	/* Last subheader in each category group */
	.records-subheader.last {
		border-right: none;
	}

	/* First column gets full left border */
	.records-subheader.first-row-col {
		border-left: 2px solid #444;
	}

	/* Last column gets full right border */
	.records-subheader.last-row-col {
		border-right: 2px solid #444;
	}

	/* Data rows */
	.records-federation-cell {
		grid-column: 1;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding: 0.75rem;
		background: #1a1a1a;
		font-weight: bold;
		font-size: 0.9rem;
		color: #fbbf24;
		border-right: 1px solid #333;
		border-bottom: 1px solid #333;
		min-height: 2.25rem;
	}

	/* Federation cells should NOT have borders */

	.records-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		background: #1a1a1a;
		font-size: 0.9rem;
		color: #e0e0e0;
		border-right: 1px solid #333;
		border-bottom: 1px solid #333;
		min-height: 2.25rem;
		font-weight: 600;
	}

	/* First cell in each category group */
	.records-cell.first-col {
		border-left: none;
	}

	/* Last cell in each category group */
	.records-cell.last-col {
		border-right: none;
	}

	/* First column gets full left border */
	.records-cell.first-row-col {
		border-left: 2px solid #444;
	}

	/* Last column gets full right border */
	.records-cell.last-row-col {
		border-right: 2px solid #444;
	}

	/* Bottom row gets thick bottom border */
	.records-cell.last-row {
		border-bottom: 2px solid #444;
	}

	/* Ensure federation cell last row has matching bottom border */
	.records-federation-cell:nth-last-child(-n+3) {
		border-bottom: 2px solid #444;
	}

	/* Better: use last-of-type for last federation cell */
	.records-federation-cell:last-of-type {
		border-bottom: 2px solid #444;
	}

	.records-cell.highlighted {
		background: #2a4a2a;
		color: #4ade80;
		font-weight: bold;
	}
</style>
