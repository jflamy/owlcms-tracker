import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({
	competitionHub: { getFopUpdate: vi.fn() },
	extractTimerAndDecisionState: vi.fn()
}));

vi.mock('$lib/server/competition-hub.js', () => ({
	competitionHub: mocks.competitionHub
}));

vi.mock('$lib/server/timer-decision-helpers.js', () => ({
	extractTimerAndDecisionState: mocks.extractTimerAndDecisionState
}));

import { getScoreboardData, resolveDecisionVideo } from '../helpers.data.js';
import { buildCelebrationsMediaUrls, resolveCelebrationVideoUrl, resolveVisibleDecisionVideo } from '$lib/celebrations-video-urls.js';
import { registerCelebrationsMediaDirectory } from '$lib/server/celebrations-media.js';
import { GET as getCelebrationsMedia } from '../../../routes/api/celebrations-media/[source]/[clip]/+server.js';

describe('celebrations decision videos', () => {
	beforeEach(() => {
		mocks.competitionHub.getFopUpdate.mockReset();
		mocks.extractTimerAndDecisionState.mockReset();
	});

	it('plays the good-lift video for a visible majority-good decision', () => {
		expect(resolveDecisionVideo(
			'decision',
			{ visible: true, type: 'FULL_DECISION', isSingleReferee: false, ref1: 'good', ref2: 'good', ref3: 'bad' }
		)).toBe('goodLift');
	});

	it('plays the no-lift video for a visible single-referee no-lift', () => {
		expect(resolveDecisionVideo(
			'decision',
			{ visible: true, type: 'FULL_DECISION', isSingleReferee: true, ref2: 'bad' }
		)).toBe('noLift');
	});

	it('does not trigger a clip before the decision is visible', () => {
		expect(resolveDecisionVideo(
			'decision',
			{ visible: true, type: 'DOWN_SIGNAL', isSingleReferee: false, ref1: null, ref2: null, ref3: null }
		)).toBeNull();
	});

	it('plays the new-record video for a visible full decision with a new record', () => {
		mocks.competitionHub.getFopUpdate.mockReturnValue({
			fopState: 'DECISION_VISIBLE',
			fullName: 'Lifter',
			attemptNumber: '3',
			liftTypeKey: 'Snatch',
			recordKind: 'new'
		});
		mocks.extractTimerAndDecisionState.mockReturnValue({
			displayMode: 'decision',
			decision: {
				visible: true,
				type: 'FULL_DECISION',
				recordKind: 'new',
				isSingleReferee: false,
				ref1: 'good',
				ref2: 'good',
				ref3: 'bad'
			}
		});

		const data = getScoreboardData('Platform_A', { videoNewRecordUrl: '/clips/record.mp4' });

		expect(data.decisionVideo).toBe('newRecord');
		expect(data.options.videoNewRecordUrl).toBe('/clips/record.mp4');
	});

	it('uses the local video directory before the separate video URLs', () => {
		const localMediaUrls = buildCelebrationsMediaUrls('test-source');
		const options = {
			videoGoodLiftUrl: 'https://media.example/good.mp4',
			videoNoLiftUrl: 'https://media.example/no-lift.mp4',
			videoNewRecordUrl: 'https://media.example/new-record.mp4'
		};

		expect(resolveCelebrationVideoUrl('goodLift', options, localMediaUrls)).toBe('/api/celebrations-media/test-source/good-lift');
		expect(resolveCelebrationVideoUrl('noLift', options, localMediaUrls)).toBe('/api/celebrations-media/test-source/no-lift');
		expect(resolveCelebrationVideoUrl('newRecord', options, localMediaUrls)).toBe('/api/celebrations-media/test-source/new-record');
		expect(resolveCelebrationVideoUrl('goodLift', options)).toBe('https://media.example/good.mp4');
	});

	it('streams the good-lift clip from a configured local directory', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'celebrations-media-'));
		await writeFile(join(directory, 'goodLift.mp4'), Buffer.from('test video'));

		try {
			const source = registerCelebrationsMediaDirectory(directory);
			const response = await getCelebrationsMedia({
				params: { source, clip: 'good-lift' },
				request: new Request(`http://tracker.test/api/celebrations-media/${source}/good-lift`)
			});

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('video/mp4');
			expect(Number(response.headers.get('Content-Length'))).toBeGreaterThan(0);
			await response.body?.cancel();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('uses a visible full-decision SSE payload as the video trigger', () => {
		expect(resolveVisibleDecisionVideo('decision', {
			visible: true,
			type: 'FULL_DECISION',
			isSingleReferee: false,
			ref1: 'good',
			ref2: 'bad',
			ref3: 'good'
		})).toBe('goodLift');

		expect(resolveVisibleDecisionVideo('decision', {
			visible: true,
			type: 'FULL_DECISION',
			recordKind: 'new',
			isSingleReferee: false,
			ref1: 'good',
			ref2: 'bad',
			ref3: 'good'
		})).toBe('newRecord');

		expect(resolveVisibleDecisionVideo('decision', {
			visible: true,
			type: 'DOWN_SIGNAL',
			isSingleReferee: false,
			ref1: null,
			ref2: null,
			ref3: null
		})).toBeNull();
	});
});