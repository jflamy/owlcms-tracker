/**
 * Extract records from OWLCMS UPDATE messages.
 * Records come as a JSON string in `fopUpdate.records`
 * Format: {"recordNames":["PanAm"],"recordCategories":["JR 86","SR 86"],"recordTable":[...]}
 * Returns: Array of objects grouped by federation with categories and lift values.
 */
export function extractRecordsFromUpdate(fopUpdate) {
	if (!fopUpdate?.records) {
		return [];
	}

	try {
		const recordsData = typeof fopUpdate.records === 'string'
			? JSON.parse(fopUpdate.records)
			: fopUpdate.records;

		// Two possible formats observed from OWLCMS:
		// 1) Index-based flat table (old): recordTable entries with catindex/fedindex/index/value/highlight
		// 2) Block-based table (newer): recordTable is array of blocks { cat, records: [ {SNATCH, CLEANJERK, TOTAL, ...}, ... ] }
		if (!recordsData) return [];

		const isBlockFormat = Array.isArray(recordsData.recordTable) && recordsData.recordTable.length > 0 && !!recordsData.recordTable[0]?.records;

		const isEmpty = (val) => !val || val === '' || (typeof val === 'string' && val.trim() === '');

		if (isBlockFormat) {
			// Normalize block format -> federation -> categories map
			const federations = Array.isArray(recordsData.recordNames) ? recordsData.recordNames : [];
			const recordsByFederation = {}; // { fed: { category: { displayName, S, CJ, T } }}

			for (const fed of federations) {
				recordsByFederation[fed] = {};
			}

			for (const block of recordsData.recordTable) {
				const category = block.cat || block.category || '';
				if (!category) continue;

				const blockRecords = Array.isArray(block.records) ? block.records : [];
				for (let fedIndex = 0; fedIndex < federations.length; fedIndex++) {
					const fedName = federations[fedIndex];
					const rec = blockRecords[fedIndex] || {};
					if (!recordsByFederation[fedName][category]) {
						recordsByFederation[fedName][category] = { displayName: category, S: { value: '-', highlight: false }, CJ: { value: '-', highlight: false }, T: { value: '-', highlight: false } };
					}

					if (!isEmpty(rec.SNATCH)) {
						recordsByFederation[fedName][category].S = { value: rec.SNATCH, highlight: !!rec.snatchHighlight };
					}
					if (!isEmpty(rec.CLEANJERK)) {
						recordsByFederation[fedName][category].CJ = { value: rec.CLEANJERK, highlight: !!rec.cjHighlight };
					}
					if (!isEmpty(rec.TOTAL)) {
						recordsByFederation[fedName][category].T = { value: rec.TOTAL, highlight: !!rec.totalHighlight };
					}
				}
			}

			// Convert to expected array format
			return Object.entries(recordsByFederation)
				.filter(([, data]) => Object.keys(data).length > 0)
				.map(([fedName, data]) => ({ federation: fedName, records: data }));
		}

		// Fallback: index-based flat table format
		if (!recordsData?.recordTable || !recordsData?.recordNames) {
			return [];
		}

		const categorySet = new Set();
		const records = [];

		for (const entry of recordsData.recordTable) {
			const category = recordsData.recordCategories?.[entry.catindex];
			const federation = recordsData.recordNames?.[entry.fedindex];

			if (!category || !federation) continue;

			categorySet.add(category);

			const liftType = entry.index % 3 === 0 ? 'S' : entry.index % 3 === 1 ? 'CJ' : 'T';
			let value = entry.value || '';
			const highlight = entry.highlight === 1 || entry.highlight === true;

			records.push({
				federation,
				category,
				liftType,
				value: isEmpty(value) ? '-' : value,
				highlight
			});
		}

		const federations = [...new Set(records.map(r => r.federation))];
		return federations.map(fed => {
			const fedRecords = records.filter(r => r.federation === fed);
			const categories = [...new Set(fedRecords.map(r => r.category))];

			return {
				federation: fed,
				records: Object.fromEntries(categories.map(cat => {
					const catRecords = fedRecords.filter(r => r.category === cat);
					return [
						cat,
						{
							displayName: cat,
							S: catRecords.find(r => r.liftType === 'S') || { value: '-', highlight: false },
							CJ: catRecords.find(r => r.liftType === 'CJ') || { value: '-', highlight: false },
							T: catRecords.find(r => r.liftType === 'T') || { value: '-', highlight: false }
						}
					];
				}))
			};
		});
	} catch (error) {
		console.error('[RecordsExtractor] Failed to parse records:', error);
		return [];
	}
}
