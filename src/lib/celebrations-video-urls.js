const CLIP_PATHS = {
	goodLift: 'good-lift',
	noLift: 'no-lift',
	newRecord: 'new-record'
};

export function buildCelebrationsMediaUrls(source) {
	if (!source) return {};

	return Object.fromEntries(
		Object.entries(CLIP_PATHS).map(([clip, path]) => [clip, `/api/celebrations-media/${source}/${path}`])
	);
}

export function resolveCelebrationVideoUrl(clip, options = {}, localMediaUrls = {}) {
	if (Object.keys(localMediaUrls).length > 0) {
		return localMediaUrls[clip] || '';
	}

	if (clip === 'goodLift') return String(options.videoGoodLiftUrl || '').trim();
	if (clip === 'noLift') return String(options.videoNoLiftUrl || '').trim();
	if (clip === 'newRecord') return String(options.videoNewRecordUrl || '').trim();
	return '';
}

export function resolveVisibleDecisionVideo(displayMode, decision) {
	if (displayMode !== 'decision'
		|| decision?.visible !== true
		|| decision?.type !== 'FULL_DECISION') {
		return null;
	}

	if (decision.recordKind === 'new') {
		return 'newRecord';
	}

	if (decision.isSingleReferee) {
		return decision.ref2 === 'good' ? 'goodLift' : 'noLift';
	}

	const refereeDecisions = [decision.ref1, decision.ref2, decision.ref3];
	const goodVotes = refereeDecisions.filter((value) => value === 'good').length;
	const badVotes = refereeDecisions.filter((value) => value === 'bad').length;
	if (goodVotes === 0 && badVotes === 0) {
		return null;
	}

	return goodVotes > badVotes ? 'goodLift' : 'noLift';
}