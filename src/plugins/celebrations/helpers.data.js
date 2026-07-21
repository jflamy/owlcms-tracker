import { competitionHub } from '$lib/server/competition-hub.js';
import { extractTimerAndDecisionState } from '$lib/server/timer-decision-helpers.js';
import { buildCelebrationsMediaUrls, resolveVisibleDecisionVideo } from '$lib/celebrations-video-urls.js';
import { registerCelebrationsMediaDirectory } from '$lib/server/celebrations-media.js';

export function resolveDecisionVideo(displayMode, decision) {
	return resolveVisibleDecisionVideo(displayMode, decision);
}

function buildDecisionToken(fopName, fopUpdate, decision) {
	return [
		fopName,
		fopUpdate?.decisionTimestamp || '',
		fopUpdate?.fullName || '',
		fopUpdate?.liftTypeKey || '',
		fopUpdate?.attemptNumber || '',
		decision?.type || '',
		decision?.recordKind || '',
		decision?.ref1 || '',
		decision?.ref2 || '',
		decision?.ref3 || ''
	].join('|');
}

export function getScoreboardData(fopName, options = {}) {
	const fopUpdate = competitionHub.getFopUpdate({ fopName });
	const { decision, displayMode } = extractTimerAndDecisionState(fopUpdate);
	const decisionVideo = resolveDecisionVideo(displayMode, decision);
	const localMediaSource = registerCelebrationsMediaDirectory(options.localVideoDirectory);
	const videoUrls = buildCelebrationsMediaUrls(localMediaSource);

	return {
		options,
		fopUpdate,
		decision,
		displayMode,
		videoUrls,
		decisionVideo,
		decisionToken: decisionVideo ? buildDecisionToken(fopName, fopUpdate, decision) : null
	};
}

export default getScoreboardData;