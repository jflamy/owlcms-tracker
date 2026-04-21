<script>
	import { onMount, tick } from 'svelte';
	import weightlifterIconWhite from './icons/wl_white.png';

	export let data = {};
	export let options = {};

	let videoElement;
	let replaysViewerElement;
	let timelinePanelElement;
	let timelineLayoutElement;
	let timelinePopoverElement;
	let cameraButtonsElement;
	let replaysStatusSocket;
	let replaysStatusReconnectTimer;
	let replayUrl = '';
	let errorMessage = '';
	let statusMessage = 'Ready to load the latest replay from cameras 1 to 4.';
	let liveStatusMessage = '';
	let liveStatusCode = null;
	let liveStatusAthlete = '';
	let liveStatusLiftType = '';
	let liveStatusAttempt = null;
	let liveStatusSession = '';
	let reviewedAthlete = '';
	let reviewedLiftType = '';
	let reviewedAttempt = null;
	let reviewedSession = '';
	let isLoading = false;
	let isPlaying = false;
	let isSeeking = false;
	let showTimelinePopover = false;
	let timelinePopoverX = 0;
	let timelinePopoverY = 0;
	let timelinePopoverBaseY = 0;
	let timelinePopoverAlign = 'center';
	let cameraPopoverPending = false;
	let currentTime = 0;
	let duration = 0;
	let activeCameraNumber = 1;
	let selectedPlaybackMode = 'normal';
	let mounted = false;
	let configuredStatusSocketUrl = '';
	let initialReplayLoadKey = '';
	let replayStateCameras = [];
	let isFullscreen = false;
	let replayStateSessionId = '';
	let showReplayPicker = false;
	let replayPickerLoading = false;
	let replayPickerError = '';
	let replayPickerSort = 'time';
	let replayPickerSessions = [];
	let selectedReplaySessionId = '';
	let replayPickerLifts = [];

	const cameraNumbers = [1, 2, 3, 4];

	$: replayServerBaseUrl = options?.replaysBaseUrl || data?.options?.replaysBaseUrl || '';
	$: hasConfiguredServer = replayServerBaseUrl.trim().length > 0;
	$: visibleCameraNumbers = replayStateCameras.some((selection) => selection?.available)
		? replayStateCameras
			.filter((selection) => selection?.available)
			.map((selection) => Number(selection.camera))
			.filter((cameraNumber) => Number.isInteger(cameraNumber) && cameraNumber > 0)
			.sort((left, right) => left - right)
		: cameraNumbers;
	$: canShowTimelinePopover = Boolean(replayUrl) && (!isLoading || cameraPopoverPending);
	$: displayedStatusHeadline = reviewedAthlete || liveStatusAthlete || liveStatusMessage || statusMessage;
	$: displayedStatusIsAthlete = Boolean(reviewedAthlete || liveStatusAthlete);
	$: displayedStatusMessage = buildDisplayedStatusMessage();
	$: overlayAthleteName = reviewedAthlete || liveStatusAthlete || '';
	$: overlayLiftType = reviewedLiftType || (!reviewedAthlete ? liveStatusLiftType : '');
	$: overlayAttempt = reviewedAttempt ?? (!reviewedAthlete ? liveStatusAttempt : null);
	$: overlayAttemptSummary = formatLiftSummary(overlayLiftType, overlayAttempt);
	$: displayedStatusTone =
		errorMessage && !reviewedAthlete
			? 'error'
			: reviewedAthlete
				? 'ready'
				: liveStatusCode === 1
					? 'recording'
					: liveStatusCode === 2
						? 'trimming'
						: liveStatusCode === 3
							? 'error'
							: liveStatusCode === 0
								? 'ready'
								: 'neutral';
	$: if (!canShowTimelinePopover) {
		showTimelinePopover = false;
	}
	$: if (showTimelinePopover && timelineLayoutElement && timelinePopoverElement) {
		clampTimelinePopoverWithinLayout();
	}
	$: if (replayPickerSessions.length === 0 && Array.isArray(data?.trackerSessions) && data.trackerSessions.length > 0) {
		replayPickerSessions = data.trackerSessions
			.filter((session) => session?.id)
			.map((session) => ({
				...session,
				id: normalizeReplaySessionId(session.id || session.name || session.displayName || '')
			}));
	}
	$: if (mounted) {
		const nextStatusSocketUrl = buildStatusSocketUrl(replayServerBaseUrl);
		if (nextStatusSocketUrl !== configuredStatusSocketUrl) {
			configuredStatusSocketUrl = nextStatusSocketUrl;
			clearReplaysStatusSocket(true);
			if (configuredStatusSocketUrl) {
				connectReplaysStatusSocket(configuredStatusSocketUrl);
			}
		}
	}
	$: if (!hasConfiguredServer) {
		initialReplayLoadKey = '';
	}
	$: if (mounted && hasConfiguredServer) {
		const nextInitialReplayLoadKey = ensureAbsoluteUrl(replayServerBaseUrl);
		if (nextInitialReplayLoadKey && nextInitialReplayLoadKey !== initialReplayLoadKey) {
			initialReplayLoadKey = nextInitialReplayLoadKey;
			void initializeReplayState();
		}
	}

	onMount(() => {
		mounted = true;

		const handleFullscreenChange = () => {
			isFullscreen = Boolean(document.fullscreenElement);
		};

		handleFullscreenChange();
		document.addEventListener('fullscreenchange', handleFullscreenChange);

		return () => {
			mounted = false;
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			clearReplaysStatusSocket(true);
		};
	});

	function ensureAbsoluteUrl(rawUrl) {
		const trimmed = String(rawUrl || '').trim();
		if (!trimmed) {
			return '';
		}

		return /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
			? trimmed
			: `http://${trimmed}`;
	}

	function cameraLabel(cameraNumber = activeCameraNumber) {
		return `camera ${cameraNumber}`;
	}

	function normalizePlaybackMode(mode) {
		return mode === 'slow' ? 'slow' : 'normal';
	}

	function playbackRateForMode(mode) {
		return normalizePlaybackMode(mode) === 'slow' ? 0.5 : 1;
	}

	function normalizeLogText(value, maxLength = 240) {
		if (value === null || value === undefined) {
			return '';
		}

		const normalized = String(value).replace(/\s+/g, ' ').trim();
		if (!normalized) {
			return '';
		}

		return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
	}

	function roundLogNumber(value) {
		return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
	}

	function describeReadyState(value) {
		switch (value) {
			case 0:
				return 'HAVE_NOTHING';
			case 1:
				return 'HAVE_METADATA';
			case 2:
				return 'HAVE_CURRENT_DATA';
			case 3:
				return 'HAVE_FUTURE_DATA';
			case 4:
				return 'HAVE_ENOUGH_DATA';
			default:
				return '';
		}
	}

	function describeNetworkState(value) {
		switch (value) {
			case 0:
				return 'NETWORK_EMPTY';
			case 1:
				return 'NETWORK_IDLE';
			case 2:
				return 'NETWORK_LOADING';
			case 3:
				return 'NETWORK_NO_SOURCE';
			default:
				return '';
		}
	}

	function describeMediaErrorCode(value) {
		switch (value) {
			case 1:
				return 'MEDIA_ERR_ABORTED';
			case 2:
				return 'MEDIA_ERR_NETWORK';
			case 3:
				return 'MEDIA_ERR_DECODE';
			case 4:
				return 'MEDIA_ERR_SRC_NOT_SUPPORTED';
			default:
				return '';
		}
	}

	function buildReplayPlaybackFailurePayload(error, playbackRate, blockedStatusMessage, blockedErrorMessage, context = {}) {
		const playErrorName = normalizeLogText(error?.name || error?.constructor?.name || 'UnknownError', 80);
		const playErrorMessage = normalizeLogText(error?.message || error?.toString?.() || '', 320);
		const mediaErrorCode = videoElement?.error?.code ?? null;
		const mode = normalizePlaybackMode(context?.mode || selectedPlaybackMode);

		return {
			source: 'jury-replays',
			category: 'media.play',
			message: `Replay play() failed during ${normalizeLogText(context?.action || 'playback', 80) || 'playback'}: ${playErrorName}${playErrorMessage ? ` - ${playErrorMessage}` : ''}`,
			details: {
				action: normalizeLogText(context?.action || 'playback', 80),
				mode,
				cameraNumber: Number.isInteger(activeCameraNumber) ? activeCameraNumber : null,
				playbackRate: roundLogNumber(playbackRate),
				replayUrl: normalizeLogText(replayUrl, 320),
				currentSrc: normalizeLogText(videoElement?.currentSrc || '', 320),
				pageUrl: normalizeLogText(window?.location?.href || '', 320),
				documentVisibility: normalizeLogText(document?.visibilityState || '', 40),
				playErrorName,
				playErrorMessage,
				mediaErrorCode,
				mediaErrorLabel: describeMediaErrorCode(mediaErrorCode),
				readyState: videoElement?.readyState ?? null,
				readyStateLabel: describeReadyState(videoElement?.readyState),
				networkState: videoElement?.networkState ?? null,
				networkStateLabel: describeNetworkState(videoElement?.networkState),
				paused: Boolean(videoElement?.paused),
				ended: Boolean(videoElement?.ended),
				currentTime: roundLogNumber(videoElement?.currentTime),
				duration: roundLogNumber(videoElement?.duration),
				muted: Boolean(videoElement?.muted),
				volume: roundLogNumber(videoElement?.volume),
				statusMessage: normalizeLogText(blockedStatusMessage, 200),
				uiErrorMessage: normalizeLogText(blockedErrorMessage, 200),
				athlete: normalizeLogText(reviewedAthlete || liveStatusAthlete || '', 120),
				liftType: normalizeLogText(reviewedLiftType || liveStatusLiftType || '', 40),
				attempt: overlayAttempt ?? null,
				session: normalizeLogText(reviewedSession || liveStatusSession || replayStateSessionId || selectedReplaySessionId || '', 120),
				userAgent: normalizeLogText(navigator?.userAgent || '', 320)
			}
		};
	}

	async function reportReplayPlaybackFailure(error, playbackRate, blockedStatusMessage, blockedErrorMessage, context = {}) {
		if (typeof window === 'undefined' || typeof fetch !== 'function') {
			return;
		}

		const payload = buildReplayPlaybackFailurePayload(
			error,
			playbackRate,
			blockedStatusMessage,
			blockedErrorMessage,
			context
		);

		try {
			await fetch('/api/client-log', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload),
				keepalive: true
			});
		} catch (loggingError) {
			console.warn('[Replays] Failed to report play() rejection to tracker logs:', loggingError, payload);
		}
	}

	function normalizeReplaySessionId(value) {
		return String(value || '')
			.trim()
			.replaceAll(' ', '_');
	}

	function buildStatusSocketUrl(baseUrl) {
		const normalized = ensureAbsoluteUrl(baseUrl);
		if (!normalized) {
			return '';
		}

		try {
			const url = new URL(normalized);
			url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
			if (/\/replay\/\d+(\.mp4)?$/.test(url.pathname)) {
				url.pathname = url.pathname.replace(/\/replay\/\d+(\.mp4)?$/, '/ws');
			} else {
				const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
				url.pathname = `${basePath}/ws`;
			}
			url.search = '';
			url.hash = '';
			return url.toString();
		} catch {
			return '';
		}
	}

	function buildReplayStateUrl(baseUrl) {
		const normalized = ensureAbsoluteUrl(baseUrl);
		if (!normalized) {
			return { error: 'Provide the replays server URL in the tracker home page before opening this plugin.' };
		}

		try {
			const url = new URL(normalized);
			if (/\/replay\/\d+(\.mp4)?$/.test(url.pathname)) {
				url.pathname = url.pathname.replace(/\/replay\/\d+(\.mp4)?$/, '/api/replay-state');
			} else {
				const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
				url.pathname = `${basePath}/api/replay-state`;
			}
			url.search = '';
			url.hash = '';
			return { url: url.toString() };
		} catch {
			return { error: 'The replays server URL is not valid. Use a full URL such as http://192.168.1.50:8091.' };
		}
	}

	function buildReplaySessionsUrl(baseUrl) {
		const normalized = ensureAbsoluteUrl(baseUrl);
		if (!normalized) {
			return { error: 'Provide the replays server URL in the tracker home page before opening this plugin.' };
		}

		try {
			const url = new URL(normalized);
			const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
			url.pathname = `${basePath}/api/sessions`;
			url.search = '';
			url.hash = '';
			return { url: url.toString() };
		} catch {
			return { error: 'The replays server URL is not valid. Use a full URL such as http://192.168.1.50:8091.' };
		}
	}

	function buildReplaySessionLiftsUrl(baseUrl, sessionId, sortMode = 'time') {
		const normalized = ensureAbsoluteUrl(baseUrl);
		const normalizedSessionId = normalizeReplaySessionId(sessionId);
		if (!normalized) {
			return { error: 'Provide the replays server URL in the tracker home page before opening this plugin.' };
		}
		if (!normalizedSessionId) {
			return { error: 'Choose a session before loading replay history.' };
		}

		try {
			const url = new URL(normalized);
			const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
			url.pathname = `${basePath}/api/sessions/${encodeURIComponent(normalizedSessionId)}/lifts`;
			url.search = '';
			url.hash = '';
			url.searchParams.set('sort', sortMode === 'athlete' ? 'athlete' : 'time');
			return { url: url.toString() };
		} catch {
			return { error: 'The replays server URL is not valid. Use a full URL such as http://192.168.1.50:8091.' };
		}
	}

	function resetLiveStatus() {
		liveStatusMessage = '';
		liveStatusCode = null;
		liveStatusAthlete = '';
		liveStatusLiftType = '';
		liveStatusAttempt = null;
		liveStatusSession = '';
	}

	function formatLiftType(liftType) {
		if (!liftType) {
			return '';
		}

		if (liftType === 'CLEANJERK') {
			return 'Clean & Jerk';
		}

		if (liftType === 'SNATCH') {
			return 'Snatch';
		}

		return String(liftType)
			.toLowerCase()
			.replace(/(^|\s)\S/g, (match) => match.toUpperCase());
	}

	function formatLiftSummary(liftType, attemptNumber) {
		const parts = [];
		const formattedLiftType = formatLiftType(liftType);

		if (formattedLiftType) {
			parts.push(formattedLiftType);
		}

		if (Number.isInteger(attemptNumber) && attemptNumber > 0) {
			parts.push(`attempt ${attemptNumber}`);
		}

		return parts.join(' ');
	}

	function buildDisplayedStatusMessage() {
		const detailParts = [];
		const statusAthlete = reviewedAthlete || liveStatusAthlete;
		const statusLiftType = reviewedLiftType || (!reviewedAthlete ? liveStatusLiftType : '');
		const statusAttempt = reviewedAttempt ?? (!reviewedAthlete ? liveStatusAttempt : null);
		const statusSession = reviewedSession || (!reviewedAthlete ? liveStatusSession : '');
		const liftSummary = formatLiftSummary(statusLiftType, statusAttempt);
		const displaySession = statusSession ? statusSession.replaceAll('_', ' ') : '';

		if (statusAthlete) {
			if (liftSummary) {
				detailParts.push(liftSummary);
			}

			if (displaySession) {
				detailParts.push(`Session ${displaySession}`);
			}
		} else if (liveStatusMessage || statusMessage) {
			detailParts.push(liveStatusMessage || statusMessage);
		}

		return detailParts.join('  ·  ');
	}

	function updateReviewedReplayInfo(statusCode, athleteName, liftType, attemptNumber, session) {
		if (statusCode !== 0) {
			return;
		}

		const nextAthlete = typeof athleteName === 'string' ? athleteName.trim() : '';
		const nextLiftType = typeof liftType === 'string' ? liftType.trim() : '';
		const nextSession = typeof session === 'string' ? session.trim() : '';
		const parsedAttempt = Number(attemptNumber);

		if (nextAthlete) {
			reviewedAthlete = nextAthlete;
		}

		if (nextLiftType) {
			reviewedLiftType = nextLiftType;
		}

		if (Number.isInteger(parsedAttempt) && parsedAttempt > 0) {
			reviewedAttempt = parsedAttempt;
		}

		if (nextSession) {
			reviewedSession = nextSession;
		}
	}

	function applyReplaySelectionMetadata(selection) {
		if (!selection || typeof selection !== 'object') {
			return;
		}

		updateReviewedReplayInfo(
			0,
			selection.athleteName,
			selection.liftType,
			selection.attemptNumber,
			selection.session
		);
	}

	function clearReplaysStatusSocket(resetStatus = false) {
		if (replaysStatusReconnectTimer) {
			clearTimeout(replaysStatusReconnectTimer);
			replaysStatusReconnectTimer = null;
		}

		if (replaysStatusSocket) {
			const socket = replaysStatusSocket;
			replaysStatusSocket = null;
			socket.onopen = null;
			socket.onmessage = null;
			socket.onerror = null;
			socket.onclose = null;
			socket.close();
		}

		if (resetStatus) {
			resetLiveStatus();
		}
	}

	function scheduleReplaysStatusReconnect(socketUrl) {
		if (!mounted || !socketUrl || replaysStatusReconnectTimer) {
			return;
		}

		replaysStatusReconnectTimer = setTimeout(() => {
			replaysStatusReconnectTimer = null;
			if (mounted && configuredStatusSocketUrl === socketUrl && !replaysStatusSocket) {
				connectReplaysStatusSocket(socketUrl);
			}
		}, 1000);
	}

	function connectReplaysStatusSocket(socketUrl) {
		if (!mounted || !socketUrl || typeof WebSocket === 'undefined') {
			return;
		}

		const socket = new WebSocket(socketUrl);
		replaysStatusSocket = socket;

		socket.onmessage = (event) => {
			if (replaysStatusSocket !== socket) {
				return;
			}

			try {
				const message = JSON.parse(event.data);
				if (!message || typeof message.text !== 'string') {
					return;
				}

				liveStatusMessage = message.text;
				const nextStatusCode = Number.isFinite(message.code) ? Number(message.code) : null;
				liveStatusCode = nextStatusCode;
				liveStatusAthlete = typeof message.athleteName === 'string' ? message.athleteName : '';
				liveStatusLiftType = typeof message.liftType === 'string' ? message.liftType : '';
				const nextAttempt = Number(message.attemptNumber);
				liveStatusAttempt = Number.isInteger(nextAttempt) && nextAttempt > 0 ? nextAttempt : null;
				liveStatusSession = typeof message.session === 'string' ? message.session : '';
				updateReviewedReplayInfo(
					nextStatusCode,
					message.athleteName,
					message.liftType,
					message.attemptNumber,
					message.session
				);
			} catch {
				// Ignore malformed status packets from the replays server.
			}
		};

		socket.onerror = () => {
			if (replaysStatusSocket !== socket) {
				return;
			}

			socket.close();
		};

		socket.onclose = () => {
			if (replaysStatusSocket !== socket) {
				return;
			}

			replaysStatusSocket = null;
			scheduleReplaysStatusReconnect(socketUrl);
		};
	}

	function buildReplayUrl(baseUrl, cameraNumber = activeCameraNumber, cacheBust = Date.now()) {
		const normalized = ensureAbsoluteUrl(baseUrl);
		if (!normalized) {
			return { error: 'Provide the replays server URL in the tracker home page before opening this plugin.' };
		}

		try {
			const url = new URL(normalized);
			if (/\/replay\/\d+(\.mp4)?$/.test(url.pathname)) {
				url.pathname = url.pathname.replace(/\/replay\/\d+(\.mp4)?$/, `/replay/${cameraNumber}`);
			} else {
				const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
				url.pathname = `${basePath}/replay/${cameraNumber}`;
			}

			url.searchParams.set('_t', String(cacheBust));
			return { url: url.toString() };
		} catch {
			return { error: 'The replays server URL is not valid. Use a full URL such as http://192.168.1.50:8091.' };
		}
	}

	function buildExactReplayUrl(baseUrl, videoPath, cacheBust = Date.now()) {
		const normalized = ensureAbsoluteUrl(baseUrl);
		if (!normalized || !videoPath) {
			return { error: 'Replay metadata is missing a playable video path.' };
		}

		try {
			const url = new URL(videoPath, normalized.endsWith('/') ? normalized : `${normalized}/`);
			url.searchParams.set('_t', String(cacheBust));
			return { url: url.toString() };
		} catch {
			return { error: 'Unable to build the exact replay URL from the replays server state.' };
		}
	}

	async function fetchReplayState(baseUrl) {
		const replayStateTarget = buildReplayStateUrl(baseUrl);
		if (replayStateTarget.error) {
			return null;
		}

		try {
			const response = await fetch(replayStateTarget.url, { cache: 'no-store' });
			if (!response.ok) {
				return null;
			}

			const replayState = await response.json();
			replayStateSessionId = normalizeReplaySessionId(replayState?.resolvedSession || replayState?.activeSession || '');
			replayStateCameras = Array.isArray(replayState?.cameras) ? replayState.cameras : [];
			return replayState;
		} catch {
			return null;
		}
	}

	async function fetchReplaySessions(baseUrl) {
		const replaySessionsTarget = buildReplaySessionsUrl(baseUrl);
		if (replaySessionsTarget.error) {
			return [];
		}

		try {
			const response = await fetch(replaySessionsTarget.url, { cache: 'no-store' });
			if (!response.ok) {
				return [];
			}

			const payload = await response.json();
			const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
			const activeSessionId = normalizeReplaySessionId(payload?.activeSession || '');
			if (!replayStateSessionId && activeSessionId) {
				replayStateSessionId = activeSessionId;
			}
			return sessions
				.map((session) => {
					const id = normalizeReplaySessionId(session?.id || session?.name || '');
					return id
						? {
							id,
							name: session?.name || session?.id || id,
							displayName: session?.name || session?.id || id,
							platformName: '',
							active: Boolean(session?.active) || id === activeSessionId
						}
						: null;
				})
				.filter(Boolean);
		} catch {
			return [];
		}
	}

	function formatReplayPickerTimestamp(timestamp) {
		const match = String(timestamp || '').match(/^(\d{4}-\d{2}-\d{2})_(\d{2})h(\d{2})m(\d{2})s$/);
		if (!match) {
			return String(timestamp || '').replace('_', ' ');
		}

		return `${match[1]} ${match[2]}:${match[3]}:${match[4]}`;
	}

	function formatReplayPickerLiftSummary(lift) {
		const liftSummary = formatLiftSummary(lift?.liftType, lift?.attempt);
		return liftSummary || 'Replay';
	}

	function formatReplayPickerSessionLabel(session) {
		const parts = [session?.displayName || session?.name || session?.id || ''];
		if (session?.platformName) {
			parts.push(session.platformName);
		}
		return parts.filter(Boolean).join('  ·  ');
	}

	async function ensureReplayPickerSessions() {
		if (replayPickerSessions.length > 0) {
			return replayPickerSessions;
		}

		const sessions = await fetchReplaySessions(replayServerBaseUrl);
		replayPickerSessions = sessions;
		return sessions;
	}

	async function loadReplayPickerLifts(sessionId) {
		const normalizedSessionId = normalizeReplaySessionId(sessionId);
		selectedReplaySessionId = normalizedSessionId;
		replayPickerError = '';
		replayPickerLoading = true;

		const replayLiftsTarget = buildReplaySessionLiftsUrl(replayServerBaseUrl, normalizedSessionId, replayPickerSort);
		if (replayLiftsTarget.error) {
			replayPickerLoading = false;
			replayPickerLifts = [];
			replayPickerError = replayLiftsTarget.error;
			return;
		}

		try {
			const response = await fetch(replayLiftsTarget.url, { cache: 'no-store' });
			if (!response.ok) {
				throw new Error(response.status === 404 ? 'No replay history is available for that session yet.' : 'Unable to load replay history from the replays server.');
			}

			const payload = await response.json();
			replayPickerLifts = Array.isArray(payload?.lifts) ? payload.lifts : [];
		} catch (error) {
			replayPickerLifts = [];
			replayPickerError = error?.message || 'Unable to load replay history from the replays server.';
		} finally {
			replayPickerLoading = false;
		}
	}

	function getReplaySelectionForCamera(replayState, cameraNumber) {
		const replaySelections = Array.isArray(replayState?.cameras) ? replayState.cameras : [];
		return replaySelections.find((selection) =>
			Number(selection?.camera) === cameraNumber &&
			selection?.available &&
			typeof selection?.videoPath === 'string' &&
			selection.videoPath.length > 0
		);
	}

	function formatTime(seconds) {
		if (!Number.isFinite(seconds) || seconds < 0) {
			return '00:00';
		}

		const totalSeconds = Math.floor(seconds);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const secs = totalSeconds % 60;

		if (hours > 0) {
			return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
		}

		return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}

	function updatePlaybackState() {
		if (!videoElement) {
			return;
		}

		if (!isSeeking) {
			currentTime = videoElement.currentTime || 0;
		}

		if (Number.isFinite(videoElement.duration)) {
			duration = videoElement.duration;
		}

		isPlaying = !videoElement.paused && !videoElement.ended;
	}

	async function loadReplaySelection(selection, preservePopover = false, autoPlay = true) {
		const cameraNumber = Number(selection?.camera);
		const replayTarget = buildExactReplayUrl(replayServerBaseUrl, selection?.videoPath);
		if (!Number.isInteger(cameraNumber) || replayTarget.error) {
			errorMessage = replayTarget.error || 'Replay selection is not valid.';
			statusMessage = 'Replay selection unavailable.';
			return false;
		}

		activeCameraNumber = cameraNumber;
		isLoading = true;
		isPlaying = false;
		isSeeking = false;
		if (!preservePopover) {
			showTimelinePopover = false;
		}
		errorMessage = '';
		statusMessage = `Loading replay from ${cameraLabel(cameraNumber)}...`;
		currentTime = 0;
		duration = 0;
		selectedPlaybackMode = 'normal';
		replayUrl = replayTarget.url;
		applyReplaySelectionMetadata(selection);

		await tick();

		if (!videoElement) {
			isLoading = false;
			errorMessage = 'Video player is not available.';
			statusMessage = 'Unable to initialize the replay player.';
			return false;
		}

		videoElement.pause();
		videoElement.load();
		videoElement.playbackRate = 1;

		if (!autoPlay) {
			statusMessage = `Replay from ${cameraLabel(cameraNumber)} loaded and ready to play.`;
			return true;
		}

		await playReplayAtMode(
			'normal',
			`Playing replay from ${cameraLabel(cameraNumber)}.`,
			'Replay loaded. Press play if your browser blocked autoplay.',
			'The browser blocked playback. Click the video or retry after loading again.',
			{ action: 'selection-autoplay' }
		);

		return true;
	}

	async function initializeReplayState() {
		const replaySelection = await syncReplayState({
			preferredCamera: 1,
			showPopover: true,
			autoPlay: false,
			preservePopover: true
		});
		if (replaySelection) {
			return;
		}

		cameraPopoverPending = true;
		const loadPromise = loadLatestReplay(1, true, false);
		await tick();
		showTimelinePopoverAboveCameras();
		await loadPromise;

		if (!replayUrl) {
			cameraPopoverPending = false;
			showTimelinePopover = false;
		}
	}

	async function loadLatestReplay(cameraNumber = activeCameraNumber, preservePopover = false, autoPlay = true) {
		activeCameraNumber = cameraNumber;
		const replayTarget = buildReplayUrl(replayServerBaseUrl, cameraNumber);
		if (replayTarget.error) {
			errorMessage = replayTarget.error;
			statusMessage = 'Replay server URL required.';
			return;
		}

		isLoading = true;
		isPlaying = false;
		isSeeking = false;
		if (!preservePopover) {
			showTimelinePopover = false;
		}
		errorMessage = '';
		statusMessage = `Loading latest replay from ${cameraLabel(cameraNumber)}...`;
		currentTime = 0;
		duration = 0;
		selectedPlaybackMode = 'normal';
		replayUrl = replayTarget.url;

		await tick();

		if (!videoElement) {
			isLoading = false;
			errorMessage = 'Video player is not available.';
			statusMessage = 'Unable to initialize the replay player.';
			return;
		}

		videoElement.pause();
		videoElement.load();
		videoElement.playbackRate = 1;

		if (!autoPlay) {
			statusMessage = `Latest replay from ${cameraLabel(cameraNumber)} loaded and ready to play.`;
			return;
		}

		await playReplayAtMode(
			'normal',
			`Playing latest replay from ${cameraLabel(cameraNumber)}.`,
			'Replay loaded. Press play if your browser blocked autoplay.',
			'The browser blocked playback. Click the video or retry after loading again.',
			{ action: 'latest-autoplay' }
		);
	}

	async function syncReplayState({ preferredCamera = 1, showPopover = false, autoPlay = false, preservePopover = false } = {}) {
		const replayState = await fetchReplayState(replayServerBaseUrl);
		const replaySelection = getReplaySelectionForCamera(replayState, preferredCamera);
		if (!replaySelection) {
			return null;
		}

		cameraPopoverPending = showPopover;
		const didLoadReplay = await loadReplaySelection(replaySelection, preservePopover || showPopover, autoPlay);
		if (didLoadReplay && showPopover) {
			await tick();
			showTimelinePopoverAboveCameras();
		}

		return replaySelection;
	}

	async function toggleFullscreen() {
		if (!replaysViewerElement || typeof document === 'undefined') {
			return;
		}

		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
				return;
			}

			if (typeof replaysViewerElement.requestFullscreen === 'function') {
				await replaysViewerElement.requestFullscreen();
			}
		} catch {
			errorMessage = 'Unable to toggle full screen in this browser.';
		}
	}

	function closeReplayPicker() {
		showReplayPicker = false;
		replayPickerError = '';
	}

	async function openReplayPicker() {
		showReplayPicker = true;
		replayPickerError = '';
		const sessions = await ensureReplayPickerSessions();
		if (sessions.length === 0) {
			replayPickerLifts = [];
			replayPickerError = 'No sessions are available from tracker or the replays server.';
			return;
		}

		const preferredSessionId =
			sessions.find((session) => session.id === selectedReplaySessionId)?.id ||
			sessions.find((session) => session.id === replayStateSessionId)?.id ||
			sessions.find((session) => session.active)?.id ||
			sessions[0]?.id ||
			'';

		if (!preferredSessionId) {
			replayPickerLifts = [];
			replayPickerError = 'No sessions are available from tracker or the replays server.';
			return;
		}

		await loadReplayPickerLifts(preferredSessionId);
	}

	async function handleReplayPickerSessionChange(event) {
		await loadReplayPickerLifts(event.currentTarget.value);
	}

	async function setReplayPickerSort(sortMode) {
		const nextSortMode = sortMode === 'athlete' ? 'athlete' : 'time';
		if (replayPickerSort === nextSortMode) {
			return;
		}

		replayPickerSort = nextSortMode;
		if (selectedReplaySessionId) {
			await loadReplayPickerLifts(selectedReplaySessionId);
		}
	}

	async function handleReplayPickerSelect(lift, replay) {
		const didLoadReplay = await loadReplaySelection(
			{
				camera: replay?.camera,
				videoPath: replay?.url,
				athleteName: lift?.athlete,
				liftType: lift?.liftType,
				attemptNumber: lift?.attempt,
				session: selectedReplaySessionId
			},
			false,
			false
		);

		if (!didLoadReplay) {
			return;
		}

		closeReplayPicker();
		await tick();
		showTimelinePopoverAboveCameras();
	}

	function handleWindowKeydown(event) {
		if (event.key === 'Escape' && showReplayPicker) {
			closeReplayPicker();
		}
	}

	async function playReplayAtSpeed(
		playbackRate = 1,
		successMessage = `Playing latest replay from ${cameraLabel()}.`,
		blockedStatusMessage = 'Replay loaded. Press play if your browser blocked autoplay.',
		blockedErrorMessage = 'The browser blocked playback. Click the video or retry after loading again.',
		playContext = {}
	) {
		if (!videoElement || !replayUrl) {
			return false;
		}

		videoElement.playbackRate = playbackRate;

		try {
			await videoElement.play();
			errorMessage = '';
			statusMessage = successMessage;
			return true;
		} catch (error) {
			void reportReplayPlaybackFailure(error, playbackRate, blockedStatusMessage, blockedErrorMessage, playContext);
			statusMessage = blockedStatusMessage;
			errorMessage = blockedErrorMessage;
			return false;
		}
	}

	async function playReplayAtMode(
		mode = 'normal',
		successMessage = `Playing latest replay from ${cameraLabel()}.`,
		blockedStatusMessage = 'Replay loaded. Press play if your browser blocked autoplay.',
		blockedErrorMessage = 'The browser blocked playback. Click the video or retry after loading again.',
		playContext = {}
	) {
		selectedPlaybackMode = normalizePlaybackMode(mode);
		return playReplayAtSpeed(
			playbackRateForMode(selectedPlaybackMode),
			successMessage,
			blockedStatusMessage,
			blockedErrorMessage,
			{
				action: `play-${selectedPlaybackMode}`,
				...playContext,
				mode: selectedPlaybackMode
			}
		);
	}

	async function togglePlayback() {
		if (!videoElement || !replayUrl) {
			return;
		}

		if (videoElement.paused || videoElement.ended) {
			await playReplayAtMode(
				'normal',
				`Playing latest replay from ${cameraLabel()}.`,
				'Replay loaded. Press play if your browser blocked autoplay.',
				'The browser blocked playback. Click the video or retry after loading again.',
				{ action: 'toggle-play' }
			);
			return;
		}

		videoElement.pause();
		statusMessage = 'Replay paused.';
	}

	function handleLoadedMetadata() {
		isLoading = false;
		cameraPopoverPending = false;
		updatePlaybackState();
		statusMessage = 'Replay ready.';
	}

	function handleVideoError() {
		const keepCameraPopoverVisible = cameraPopoverPending;
		isLoading = false;
		cameraPopoverPending = false;
		isPlaying = false;
		if (!keepCameraPopoverVisible) {
			showTimelinePopover = false;
		}
		errorMessage = `Unable to load the replay video. Verify the server URL and confirm ${cameraLabel()} has a replay available.`;
		statusMessage = 'Replay load failed.';
	}

	function handleTimeUpdate() {
		updatePlaybackState();
	}

	function pauseFromTimelineArea(message = 'Replay paused from slider area.') {
		if (!videoElement) {
			return;
		}

		if (!videoElement.paused && !videoElement.ended) {
			videoElement.pause();
			statusMessage = message;
		}
	}

	function handleSeekStart() {
		if (!videoElement) {
			return;
		}

		isSeeking = true;
		showTimelinePopover = false;
		pauseFromTimelineArea('Replay paused for scrubbing.');
	}

	function clamp(value, min, max) {
		return Math.min(Math.max(value, min), max);
	}

	function timelinePopoverVerticalGapPx() {
		if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') {
			return timelinePopoverAlign === 'left' ? 9 : 14;
		}

		const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
		const remSize = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
		return (timelinePopoverAlign === 'left' ? 0.55 : 0.9) * remSize;
	}

	function clampTimelinePopoverWithinLayout() {
		if (!timelineLayoutElement || !timelinePopoverElement) {
			return;
		}

		const edgePadding = 8;
		const layoutBounds = timelineLayoutElement.getBoundingClientRect();
		const popoverBounds = timelinePopoverElement.getBoundingClientRect();
		timelinePopoverY = timelinePopoverBaseY;

		if (timelinePopoverAlign === 'left') {
			const maxLeft = Math.max(edgePadding, layoutBounds.width - popoverBounds.width - edgePadding);
			timelinePopoverX = clamp(timelinePopoverX, edgePadding, maxLeft);
			return;
		}

		const halfWidth = popoverBounds.width / 2;
		const minCenter = halfWidth + edgePadding;
		const maxCenter = Math.max(minCenter, layoutBounds.width - halfWidth - edgePadding);
		timelinePopoverX = clamp(timelinePopoverX, minCenter, maxCenter);

		if (!cameraButtonsElement) {
			return;
		}

		const lastButton = cameraButtonsElement.lastElementChild;
		if (!(lastButton instanceof HTMLElement)) {
			return;
		}

		const lastButtonBounds = lastButton.getBoundingClientRect();
		const lastButtonRight = lastButtonBounds.right - layoutBounds.left;
		const lastButtonTop = lastButtonBounds.top - layoutBounds.top;
		const popoverLeft = timelinePopoverX - halfWidth;

		if (popoverLeft <= lastButtonRight) {
			const liftedY = Math.max(12, lastButtonTop + timelinePopoverVerticalGapPx());
			timelinePopoverY = Math.min(timelinePopoverBaseY, liftedY);
		}
	}

	function showTimelinePopoverAtClientPoint(clientX, clientY, align = 'center') {
		if (!timelineLayoutElement) {
			return;
		}

		const bounds = timelineLayoutElement.getBoundingClientRect();
		timelinePopoverAlign = align;

		if (align === 'left') {
			timelinePopoverX = clamp(clientX - bounds.left, 4, Math.max(4, bounds.width - 4));
		} else {
			timelinePopoverX = clamp(clientX - bounds.left, 4, Math.max(4, bounds.width - 4));
		}

		timelinePopoverBaseY = Math.max(12, clientY - bounds.top);
		timelinePopoverY = timelinePopoverBaseY;
		showTimelinePopover = true;
	}

	function showTimelinePopoverAt(event) {
		showTimelinePopoverAtClientPoint(event.clientX, event.clientY, 'center');
	}

	function showTimelinePopoverAboveCameras() {
		if (!timelineLayoutElement || !cameraButtonsElement) {
			return;
		}

		const layoutBounds = timelineLayoutElement.getBoundingClientRect();
		const panelBounds = timelinePanelElement?.getBoundingClientRect() || layoutBounds;
		const cameraBounds = cameraButtonsElement.getBoundingClientRect();
		timelinePopoverAlign = 'left';
		timelinePopoverX = panelBounds.left - layoutBounds.left;
		timelinePopoverBaseY = Math.max(12, cameraBounds.top - layoutBounds.top + 4);
		timelinePopoverY = timelinePopoverBaseY;
		showTimelinePopover = true;
	}

	async function handleCameraButtonClick(cameraNumber) {
		if (cameraNumber === activeCameraNumber && replayUrl && !isLoading) {
			showTimelinePopoverAboveCameras();
			await handleTimelinePopoverRestart();
			return;
		}

		const replaySelection = await syncReplayState({
			preferredCamera: cameraNumber,
			showPopover: true,
			autoPlay: true,
			preservePopover: true
		});
		if (replaySelection) {
			return;
		}

		cameraPopoverPending = true;
		showTimelinePopoverAboveCameras();
		const loadPromise = loadLatestReplay(cameraNumber, true, true);
		await loadPromise;

		if (!replayUrl) {
			cameraPopoverPending = false;
			showTimelinePopover = false;
		}
	}

	function handleTimelineAreaPointerDown(event) {
		if (event.target instanceof Element && (event.target.closest('.timeline-popover') || event.target.closest('.timeline'))) {
			return;
		}

		pauseFromTimelineArea();
		showTimelinePopoverAt(event);
	}

	function handleSeekInput(event) {
		handleSeekStart();
		currentTime = Number(event.currentTarget.value);
	}

	function showTimelinePopoverAboveSliderPosition(sliderElement, value) {
		if (!sliderElement) {
			return;
		}

		const bounds = sliderElement.getBoundingClientRect();
		const min = Number(sliderElement.min || 0);
		const max = Number(sliderElement.max || 0);
		const range = max - min;
		const ratio = range > 0 ? clamp((value - min) / range, 0, 1) : 0;
		const clientX = bounds.left + bounds.width * ratio;
		const clientY = bounds.top + bounds.height / 2;

		showTimelinePopoverAtClientPoint(clientX, clientY, 'center');
	}

	function handleSeekChange(event) {
		if (!videoElement) {
			isSeeking = false;
			return;
		}

		const nextTime = Number(event.currentTarget.value);
		videoElement.currentTime = nextTime;
		currentTime = nextTime;
		isSeeking = false;
		showTimelinePopoverAboveSliderPosition(event.currentTarget, nextTime);
		statusMessage = 'Replay paused at selected position.';
	}

	async function handleTimelinePopoverPlay() {
		if (!videoElement || !replayUrl) {
			return;
		}

		if (isPlaying && selectedPlaybackMode === 'normal') {
			videoElement.pause();
			selectedPlaybackMode = 'normal';
			statusMessage = 'Replay paused.';
			return;
		}

		await playReplayAtMode(
			'normal',
			`Playing latest replay from ${cameraLabel()}.`,
			'Replay loaded. Press play if your browser blocked autoplay.',
			'The browser blocked playback. Click the video or retry after loading again.',
			{ action: 'timeline-play' }
		);
	}

	async function handleTimelinePopoverPlayHalfSpeed() {
		if (!videoElement || !replayUrl) {
			return;
		}

		if (isPlaying && selectedPlaybackMode === 'slow') {
			videoElement.pause();
			selectedPlaybackMode = 'slow';
			statusMessage = 'Replay paused.';
			return;
		}

		await playReplayAtMode(
			'slow',
			`Playing latest replay from ${cameraLabel()} at 50% speed.`,
			'Replay loaded. Press 50% if your browser blocked half-speed playback.',
			'The browser blocked playback. Click the video or retry with 50%.',
			{ action: 'timeline-play-half-speed' }
		);
	}

	async function handleTimelinePopoverTogglePlayback() {
		await togglePlayback();
	}

	function handleTimelinePopoverBackTwo() {
		if (!videoElement) {
			return;
		}

		const nextTime = Math.max(0, (videoElement.currentTime || currentTime || 0) - 2);
		videoElement.pause();
		isPlaying = false;
		videoElement.currentTime = nextTime;
		currentTime = nextTime;
		statusMessage = 'Replay moved back 2 seconds and paused.';
	}

	async function handleTimelinePopoverRestart() {
		if (!videoElement || !replayUrl) {
			return;
		}

		videoElement.currentTime = 0;
		currentTime = 0;

		const restartMode = normalizePlaybackMode(selectedPlaybackMode);
		await playReplayAtMode(
			restartMode,
			restartMode === 'slow'
				? `Replay restarted from the beginning at 50% speed.`
				: 'Replay restarted from the beginning.',
			restartMode === 'slow'
				? 'Replay reset to the beginning. Press 50% to continue.'
				: 'Replay reset to the beginning. Press play to continue.',
			restartMode === 'slow'
				? 'The browser blocked playback. Click the video or press 50% to continue.'
				: 'The browser blocked playback. Click the video or press Play to continue.',
			{ action: 'timeline-restart' }
		);
	}

	function handleTimelinePopoverStop() {
		pauseFromTimelineArea('Replay paused.');
	}

	function handlePlay() {
		isPlaying = true;
		errorMessage = '';
	}

	function handlePause() {
		isPlaying = false;
	}

	function handleEnded() {
		isPlaying = false;
		currentTime = duration;
		statusMessage = 'Replay ended.';
	}
</script>

<svelte:head>
	<title>Replays Viewer</title>
</svelte:head>

<svelte:window on:keydown={handleWindowKeydown} />

<div bind:this={replaysViewerElement} class="replays-viewer">
	<section class="video-shell" class:is-empty={!replayUrl}>
		<div class="video-stage">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={videoElement}
				class="replay-video"
				src={replayUrl}
				playsinline
				preload="metadata"
				on:loadedmetadata={handleLoadedMetadata}
				on:timeupdate={handleTimeUpdate}
				on:play={handlePlay}
				on:pause={handlePause}
				on:ended={handleEnded}
				on:error={handleVideoError}
			></video>

			{#if overlayAthleteName}
				<div class="video-athlete-overlay">
					<div class="video-athlete-name">{overlayAthleteName}</div>
					{#if overlayAttemptSummary}
						<div class="video-athlete-attempt">{overlayAttemptSummary}</div>
					{/if}
				</div>
			{/if}

			{#if errorMessage}
				<div class="video-error-overlay">{errorMessage}</div>
			{/if}

			{#if !hasConfiguredServer || !replayUrl}
				<div class="empty-state">
					{#if !hasConfiguredServer}
						<p>Replays server not configured.</p>
						<span>Open this plugin with <code>?replaysBaseUrl=http://host:8091</code> or set the Replays Server URL on the tracker landing page.</span>
					{:else}
						<p>No replay loaded.</p>
						<span>Use buttons 1 to 4 below to load the latest replay for a camera.</span>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<section bind:this={timelinePanelElement} class="timeline-panel">
		<div bind:this={timelineLayoutElement} class="timeline-layout">
			<div bind:this={cameraButtonsElement} class="camera-buttons">
				{#each visibleCameraNumbers as cameraNumber}
					<button
						class="camera-button"
						class:is-active-camera={cameraNumber === activeCameraNumber && Boolean(replayUrl) && !errorMessage}
						type="button"
						on:click={() => handleCameraButtonClick(cameraNumber)}
						disabled={!hasConfiguredServer || isLoading}
					>
						{cameraNumber}
					</button>
				{/each}

				<button
					class="camera-button fullscreen-button"
					class:is-active-fullscreen={isFullscreen}
					type="button"
					on:click={toggleFullscreen}
					title={isFullscreen ? 'Exit full page' : 'Toggle full page'}
					aria-label={isFullscreen ? 'Exit full page' : 'Toggle full page'}
				>
					<span class="fullscreen-button-icon">⛶</span>
				</button>

				<button
					class="camera-button replay-select-button"
					type="button"
					on:click={openReplayPicker}
					title="select a replay"
					aria-label="select a replay"
					disabled={!hasConfiguredServer}
				>
					<img class="replay-select-button-icon" src={weightlifterIconWhite} alt="" />
				</button>
			</div>

			<div class="timeline-content" on:pointerdown={handleTimelineAreaPointerDown}>
				<div class="time-row">
					<span>{formatTime(currentTime)}</span>
					<span>{formatTime(duration)}</span>
				</div>
				<div class="slider-zone">
					<input
						type="range"
						class="timeline"
						min="0"
						max={duration || 0}
						step="0.01"
						value={currentTime}
						disabled={!replayUrl || duration <= 0}
						on:input={handleSeekInput}
						on:change={handleSeekChange}
					/>

					{#if replayUrl && isPlaying}
						<div class="timeline-stop-hint">Click in slider area to move</div>
					{/if}
				</div>
			</div>

			{#if showTimelinePopover && canShowTimelinePopover}
				<div
					bind:this={timelinePopoverElement}
					class="timeline-popover"
					class:is-left-aligned={timelinePopoverAlign === 'left'}
					style:left="{timelinePopoverX}px"
					style:top="{timelinePopoverY}px"
				>
					<button class="timeline-popover-btn timeline-popover-restart" type="button" on:click={handleTimelinePopoverRestart}>
						<span class="timeline-popover-restart-icon">↺</span>
						<span>Restart</span>
					</button>
					<button class="timeline-popover-btn timeline-popover-back" type="button" on:click={handleTimelinePopoverBackTwo}>
						<span class="timeline-popover-back-icon">↶</span>
						<span>Back 2s</span>
					</button>
					<button
						class="timeline-popover-btn timeline-popover-toggle"
						class:is-primary={selectedPlaybackMode === 'normal'}
						type="button"
						on:click={handleTimelinePopoverPlay}
						aria-label={isPlaying && selectedPlaybackMode === 'normal' ? 'Stop replay' : 'Play replay'}
					>
						{#if isPlaying && selectedPlaybackMode === 'normal'}
							<span class="timeline-popover-stop-icon">&#9632;</span>
							<span>Stop</span>
						{:else}
							<span class="timeline-popover-play-icon">&#9654;</span>
							<span>Play</span>
						{/if}
					</button>
					<button
						class="timeline-popover-btn timeline-popover-slow"
						class:is-primary={selectedPlaybackMode === 'slow'}
						type="button"
						on:click={handleTimelinePopoverPlayHalfSpeed}
						aria-label={isPlaying && selectedPlaybackMode === 'slow' ? 'Stop replay' : 'Play replay at 50 percent speed'}
					>
						{#if isPlaying && selectedPlaybackMode === 'slow'}
							<span class="timeline-popover-stop-icon">&#9632;</span>
							<span>Stop</span>
						{:else}
							<span class="timeline-popover-slow-icon">&#9655;</span>
							<span>50%</span>
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</section>

	{#if showReplayPicker}
		<div class="replay-picker-overlay">
			<button class="replay-picker-backdrop" type="button" on:click={closeReplayPicker} aria-label="Close replay picker"></button>
			<div class="replay-picker-modal" role="dialog" aria-modal="true" aria-label="Select a replay" tabindex="-1">
				<div class="replay-picker-header">
					<div>
						<h2>Select A Replay</h2>
						<p>Choose a session from tracker, then load a replay from the selected session.</p>
					</div>
					<button class="replay-picker-close" type="button" on:click={closeReplayPicker} aria-label="Close replay picker">×</button>
				</div>

				<div class="replay-picker-toolbar">
					<label class="replay-picker-field">
						<span>Session</span>
						<select value={selectedReplaySessionId} on:change={handleReplayPickerSessionChange} disabled={replayPickerLoading || replayPickerSessions.length === 0}>
							{#each replayPickerSessions as session}
								<option value={session.id}>{formatReplayPickerSessionLabel(session)}</option>
							{/each}
						</select>
					</label>

					<div class="replay-picker-sort" role="group" aria-label="Replay sort order">
						<button class="replay-picker-sort-btn" class:is-active-sort={replayPickerSort === 'time'} type="button" on:click={() => setReplayPickerSort('time')}>Time</button>
						<button class="replay-picker-sort-btn" class:is-active-sort={replayPickerSort === 'athlete'} type="button" on:click={() => setReplayPickerSort('athlete')}>Athlete</button>
					</div>
				</div>

				<div class="replay-picker-body">
					{#if replayPickerLoading}
						<div class="replay-picker-empty">Loading replay history...</div>
					{:else if replayPickerError}
						<div class="replay-picker-empty replay-picker-error">{replayPickerError}</div>
					{:else if replayPickerLifts.length === 0}
						<div class="replay-picker-empty">No replays are available for the selected session.</div>
					{:else}
						<div class="replay-picker-list">
							{#each replayPickerLifts as lift}
								<div class="replay-picker-row">
									<div class="replay-picker-row-main">
										<div class="replay-picker-athlete">{lift.athlete}</div>
										<div class="replay-picker-meta">{formatReplayPickerLiftSummary(lift)}  ·  {formatReplayPickerTimestamp(lift.timestamp)}</div>
									</div>
									<div class="replay-picker-cameras">
										{#each lift.replays || [] as replay}
											<button class="replay-picker-camera" class:is-active-picker-camera={Number(replay.camera) === activeCameraNumber} type="button" on:click={() => handleReplayPickerSelect(lift, replay)}>
												Cam {replay.camera}
											</button>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
	}

	.replays-viewer {
		--bg-top: #101820;
		--bg-bottom: #05080c;
		--panel: rgba(9, 18, 27, 0.84);
		--panel-border: rgba(115, 144, 168, 0.22);
		--text: #f3f8fb;
		--muted: #9fb3c3;
		--accent: #ff6b35;
		--accent-soft: #37c9ff;
		height: 100dvh;
		min-height: 100dvh;
		padding: 0;
		box-sizing: border-box;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		gap: 0;
		background:
			radial-gradient(circle at top left, rgba(255, 107, 53, 0.18), transparent 32%),
			radial-gradient(circle at top right, rgba(55, 201, 255, 0.16), transparent 28%),
			linear-gradient(180deg, var(--bg-top), var(--bg-bottom));
		color: var(--text);
		font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
	}

	.timeline-panel {
		background: var(--panel);
		border: 1px solid var(--panel-border);
		backdrop-filter: blur(12px);
	}

	button {
		border: 1px solid transparent;
		padding: 0.85rem 1.3rem;
		font: inherit;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		cursor: pointer;
		transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
	}

	button:hover:enabled {
		transform: translateY(-1px);
	}

	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.video-shell {
		position: relative;
		min-height: 0;
		padding: 1rem 1rem 0;
		box-sizing: border-box;
		display: grid;
		place-items: center;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent),
			rgba(0, 0, 0, 0.72);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}

	.video-stage {
		position: relative;
		width: auto;
		height: 100%;
		max-height: 100%;
		max-width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border: 1px solid rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}

	.timeline-panel {
		padding: 0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid var(--panel-border);
	}

	.timeline-layout {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: end;
		gap: 1rem;
	}

	.camera-buttons {
		display: flex;
		gap: 0.55rem;
		align-items: center;
	}

	.camera-button {
		width: 3rem;
		height: 3rem;
		padding: 0;
		border-color: rgba(255, 255, 255, 0.14);
		border-radius: 0.45rem;
		background: rgba(8, 17, 26, 0.95);
		color: var(--text);
		font-size: 1rem;
		line-height: 1;
		text-transform: none;
		letter-spacing: 0;
	}

	.fullscreen-button {
		margin-left: 0.2rem;
		font-size: 1.1rem;
	}

	.replay-select-button {
		padding: 0.35rem;
	}

	.fullscreen-button-icon {
		display: inline-block;
		font-size: 1.2rem;
		line-height: 1;
		transform: translateY(-0.02em);
	}

	.replay-select-button-icon {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.replay-picker-overlay {
		position: fixed;
		inset: 0;
		z-index: 8;
		padding: 2rem;
		display: grid;
		place-items: center;
		background: rgba(3, 6, 10, 0.74);
		backdrop-filter: blur(10px);
	}

	.replay-picker-backdrop {
		position: absolute;
		inset: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		letter-spacing: 0;
		text-transform: none;
	}

	.replay-picker-modal {
		position: relative;
		z-index: 1;
		width: min(72rem, 100%);
		max-height: min(85dvh, 52rem);
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 1.2rem;
		background: linear-gradient(180deg, rgba(10, 20, 30, 0.98), rgba(5, 11, 17, 0.98));
		box-shadow: 0 22px 70px rgba(0, 0, 0, 0.45);
		overflow: hidden;
	}

	.replay-picker-header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.2rem 1.25rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.replay-picker-header h2 {
		margin: 0;
		font-size: 1.2rem;
		letter-spacing: 0.02em;
	}

	.replay-picker-header p {
		margin: 0.3rem 0 0;
		color: var(--muted);
		font-size: 0.92rem;
		line-height: 1.35;
	}

	.replay-picker-close {
		width: 2.6rem;
		height: 2.6rem;
		padding: 0;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		font-size: 1.35rem;
		line-height: 1;
		letter-spacing: 0;
		text-transform: none;
	}

	.replay-picker-toolbar {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		align-items: end;
		flex-wrap: wrap;
	}

	.replay-picker-field {
		display: grid;
		gap: 0.4rem;
		min-width: min(24rem, 100%);
		color: var(--muted);
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.replay-picker-field select {
		min-height: 2.8rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.8rem;
		padding: 0 0.9rem;
		background: rgba(8, 17, 26, 0.95);
		color: var(--text);
		font: inherit;
	}

	.replay-picker-sort {
		display: inline-flex;
		gap: 0.45rem;
		padding: 0.3rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.03);
	}

	.replay-picker-sort-btn {
		padding: 0.65rem 0.95rem;
		border-radius: 999px;
		background: transparent;
		font-size: 0.82rem;
		line-height: 1;
		letter-spacing: 0.02em;
		text-transform: none;
	}

	.replay-picker-sort-btn.is-active-sort {
		background: linear-gradient(135deg, rgba(55, 201, 255, 0.92), rgba(117, 223, 255, 0.92));
		border-color: rgba(117, 223, 255, 0.65);
		color: #081018;
	}

	.replay-picker-body {
		min-height: 0;
		overflow: auto;
		padding: 1rem 1.25rem 1.25rem;
	}

	.replay-picker-list {
		display: grid;
		gap: 0.8rem;
	}

	.replay-picker-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: center;
		padding: 0.95rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 0.95rem;
		background: rgba(255, 255, 255, 0.035);
	}

	.replay-picker-row-main {
		min-width: 0;
	}

	.replay-picker-athlete {
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.replay-picker-meta {
		margin-top: 0.28rem;
		color: var(--muted);
		font-size: 0.84rem;
		line-height: 1.35;
	}

	.replay-picker-cameras {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: end;
	}

	.replay-picker-camera {
		padding: 0.7rem 0.85rem;
		border-radius: 0.75rem;
		background: rgba(8, 17, 26, 0.95);
		border-color: rgba(255, 255, 255, 0.12);
		font-size: 0.8rem;
		line-height: 1;
		letter-spacing: 0.02em;
		text-transform: none;
	}

	.replay-picker-camera.is-active-picker-camera {
		background: linear-gradient(135deg, var(--accent), #ff8a5b);
		border-color: rgba(255, 138, 91, 0.72);
		color: #081018;
	}

	.replay-picker-empty {
		padding: 1.8rem 1rem;
		border: 1px dashed rgba(255, 255, 255, 0.12);
		border-radius: 0.95rem;
		text-align: center;
		color: var(--muted);
	}

	.replay-picker-error {
		border-color: rgba(255, 104, 104, 0.22);
		color: #ffd8d8;
		background: rgba(58, 13, 18, 0.32);
	}

	.is-active-camera {
		background: linear-gradient(135deg, var(--accent), #ff8a5b);
		border-color: rgba(255, 138, 91, 0.8);
		color: #081018;
	}

	.is-active-fullscreen {
		background: linear-gradient(135deg, rgba(55, 201, 255, 0.92), rgba(117, 223, 255, 0.92));
		border-color: rgba(117, 223, 255, 0.65);
		color: #081018;
	}

	.timeline-content {
		position: relative;
	}

	.slider-zone {
		position: relative;
		min-height: 2rem;
		padding: 0.02rem 0 0.25rem;
		display: flex;
		align-items: end;
	}

	.timeline-stop-hint {
		position: absolute;
		left: 50%;
		top: -1rem;
		transform: translateX(-50%);
		padding: 0.18rem 0.6rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 999px;
		background: rgba(6, 12, 18, 0.44);
		backdrop-filter: blur(6px);
		color: rgba(243, 248, 251, 0.9);
		font-size: 0.72rem;
		line-height: 1.2;
		letter-spacing: 0.02em;
		pointer-events: none;
		white-space: nowrap;
	}

	.timeline-popover {
		position: absolute;
		z-index: 3;
		display: flex;
		gap: 0.65rem;
		align-items: center;
		padding: 0.65rem;
		border: 1px solid rgba(255, 255, 255, 0.24);
		border-radius: 999px;
		background: rgba(6, 12, 18, 0.82);
		backdrop-filter: blur(10px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
		pointer-events: auto;
		transform: translate(-50%, calc(-100% - 0.9rem));
	}

	.timeline-popover.is-left-aligned {
		transform: translate(0, calc(-100% - 0.55rem));
	}

	.timeline-popover-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.6rem 0.9rem;
		border-radius: 999px;
		border-color: rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.05);
		color: var(--text);
		font-size: 0.85rem;
		line-height: 1;
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.timeline-popover-restart,
	.timeline-popover-back,
	.timeline-popover-slow {
		background: rgba(8, 17, 26, 0.95);
	}

	.timeline-popover-toggle {
		background: rgba(8, 17, 26, 0.95);
	}

	.timeline-popover-btn.is-primary {
		background: linear-gradient(135deg, rgba(255, 107, 53, 0.95), rgba(255, 138, 91, 0.95));
		border-color: rgba(255, 138, 91, 0.34);
		color: #081018;
	}

	.timeline-popover-play-icon {
		font-size: 1rem;
		text-shadow: 0 0 18px rgba(55, 201, 255, 0.35);
	}

	.timeline-popover-slow-icon {
		font-size: 0.98rem;
		line-height: 1;
		color: rgba(244, 247, 250, 0.92);
	}

	.timeline-popover-restart-icon,
	.timeline-popover-back-icon {
		font-size: 1rem;
		line-height: 1;
	}

	.timeline-popover-stop-icon {
		font-size: 0.78rem;
		line-height: 1;
		color: rgba(255, 160, 160, 0.94);
	}

	.timeline-popover-btn.is-primary .timeline-popover-stop-icon,
	.timeline-popover-btn.is-primary .timeline-popover-play-icon,
	.timeline-popover-btn.is-primary .timeline-popover-slow-icon {
		color: #081018;
		text-shadow: none;
	}

	.replay-video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}

	.video-shell.is-empty .replay-video {
		visibility: hidden;
	}

	.empty-state {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		text-align: center;
		padding: 2rem;
		color: var(--muted);
	}

	.empty-state p {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
	}

	.empty-state span {
		display: block;
		margin-top: 0.5rem;
		max-width: 40rem;
		line-height: 1.45;
	}

	.empty-state code {
		font-family: 'Consolas', 'Courier New', monospace;
	}

	.video-error-overlay {
		position: absolute;
		left: 50%;
		bottom: 1rem;
		transform: translateX(-50%);
		width: min(90%, 46rem);
		padding: 0.75rem 1rem;
		border: 1px solid rgba(255, 104, 104, 0.35);
		border-radius: 0.9rem;
		background: rgba(58, 13, 18, 0.82);
		backdrop-filter: blur(8px);
		color: #ffd8d8;
		font-size: 0.92rem;
		line-height: 1.35;
		text-align: center;
		z-index: 2;
		pointer-events: none;
	}

	.video-athlete-overlay {
		position: absolute;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		width: min(92%, 72rem);
		z-index: 2;
		pointer-events: none;
		text-align: center;
		color: #fff;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.65);
	}

	.video-athlete-name {
		font-size: clamp(1.35rem, 2.45vw, 2.8rem);
		font-weight: 800;
		letter-spacing: 0.02em;
		line-height: 1.05;
	}

	.video-athlete-attempt {
		margin-top: 0.25rem;
		font-size: clamp(0.95rem, 1.5vw, 1.45rem);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.time-row {
		display: flex;
		justify-content: space-between;
		position: relative;
		top: 0.2rem;
		margin-bottom: -0.06rem;
		font-variant-numeric: tabular-nums;
	}

	.timeline {
		width: 100%;
		margin: 0;
		height: 1.4rem;
		background: transparent;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
	}

	.timeline:focus {
		outline: none;
	}

	.timeline:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	.timeline::-webkit-slider-runnable-track {
		height: 0.3rem;
		border-radius: 999px;
		background: linear-gradient(90deg, rgba(255, 107, 53, 0.95), rgba(255, 138, 91, 0.9));
	}

	.timeline::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 0.78rem;
		height: 1.15rem;
		margin-top: -0.425rem;
		border: 1px solid rgba(255, 255, 255, 0.34);
		border-radius: 0.18rem;
		background: linear-gradient(180deg, rgba(255, 244, 238, 0.98), rgba(255, 214, 196, 0.94));
		box-shadow: 0 0.18rem 0.45rem rgba(0, 0, 0, 0.28);
	}

	.timeline::-moz-range-track {
		height: 0.3rem;
		border: none;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.16);
	}

	.timeline::-moz-range-progress {
		height: 0.3rem;
		border-radius: 999px;
		background: linear-gradient(90deg, rgba(255, 107, 53, 0.95), rgba(255, 138, 91, 0.9));
	}

	.timeline::-moz-range-thumb {
		width: 0.78rem;
		height: 1.15rem;
		border: 1px solid rgba(255, 255, 255, 0.34);
		border-radius: 0.18rem;
		background: linear-gradient(180deg, rgba(255, 244, 238, 0.98), rgba(255, 214, 196, 0.94));
		box-shadow: 0 0.18rem 0.45rem rgba(0, 0, 0, 0.28);
	}

	@media (max-width: 900px) {
		.replays-viewer {
			height: 100dvh;
		}

		.video-shell {
			padding: 0.75rem 0.75rem 0;
		}

		.replay-video {
			min-height: 0;
		}

		.timeline-stop-hint {
			top: -0.9rem;
			font-size: 0.67rem;
		}

		.video-athlete-overlay {
			top: 0.7rem;
			width: min(94%, 44rem);
		}

		.video-athlete-name {
			font-size: clamp(1.05rem, 4.4vw, 1.75rem);
		}

		.video-athlete-attempt {
			font-size: clamp(0.82rem, 2.8vw, 1.1rem);
		}

		.video-error-overlay {
			bottom: 0.7rem;
			width: min(94%, 32rem);
			padding: 0.65rem 0.85rem;
			font-size: 0.82rem;
		}

		.replay-picker-overlay {
			padding: 0.8rem;
		}

		.replay-picker-modal {
			max-height: min(90dvh, 100%);
		}

		.replay-picker-toolbar {
			align-items: stretch;
		}

		.replay-picker-field {
			min-width: 100%;
		}

		.replay-picker-row {
			grid-template-columns: 1fr;
		}

		.replay-picker-cameras {
			justify-content: start;
		}
	}
</style>