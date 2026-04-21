import { json } from '@sveltejs/kit';
import { logger } from '@owlcms/tracker-core';

function normalizeText(value, maxLength = 240) {
  if (value === null || value === undefined) {
    return '';
  }

  const normalized = String(value).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function normalizeNumber(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
}

function compactObject(values) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  );
}

function sanitizeDetails(details = {}) {
  return compactObject({
    action: normalizeText(details?.action, 80),
    mode: normalizeText(details?.mode, 24),
    cameraNumber: Number.isInteger(details?.cameraNumber) ? details.cameraNumber : null,
    playbackRate: normalizeNumber(details?.playbackRate),
    replayUrl: normalizeText(details?.replayUrl, 320),
    currentSrc: normalizeText(details?.currentSrc, 320),
    pageUrl: normalizeText(details?.pageUrl, 320),
    documentVisibility: normalizeText(details?.documentVisibility, 40),
    playErrorName: normalizeText(details?.playErrorName, 80),
    playErrorMessage: normalizeText(details?.playErrorMessage, 320),
    mediaErrorCode: Number.isInteger(details?.mediaErrorCode) ? details.mediaErrorCode : null,
    mediaErrorLabel: normalizeText(details?.mediaErrorLabel, 80),
    readyState: Number.isInteger(details?.readyState) ? details.readyState : null,
    readyStateLabel: normalizeText(details?.readyStateLabel, 80),
    networkState: Number.isInteger(details?.networkState) ? details.networkState : null,
    networkStateLabel: normalizeText(details?.networkStateLabel, 80),
    paused: typeof details?.paused === 'boolean' ? details.paused : null,
    ended: typeof details?.ended === 'boolean' ? details.ended : null,
    currentTime: normalizeNumber(details?.currentTime),
    duration: normalizeNumber(details?.duration),
    muted: typeof details?.muted === 'boolean' ? details.muted : null,
    volume: normalizeNumber(details?.volume),
    statusMessage: normalizeText(details?.statusMessage, 200),
    uiErrorMessage: normalizeText(details?.uiErrorMessage, 200),
    athlete: normalizeText(details?.athlete, 120),
    liftType: normalizeText(details?.liftType, 40),
    attempt: Number.isInteger(details?.attempt) ? details.attempt : null,
    session: normalizeText(details?.session, 120),
    userAgent: normalizeText(details?.userAgent, 320)
  });
}

export async function POST({ request, getClientAddress }) {
  let body;

  try {
    body = await request.json();
  } catch (error) {
    logger.warn(`[ClientLog] Invalid JSON payload: ${error.message}`);
    return json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  let clientAddress = '';
  try {
    clientAddress = typeof getClientAddress === 'function' ? normalizeText(getClientAddress(), 80) : '';
  } catch {
    clientAddress = '';
  }

  const source = normalizeText(body?.source, 80) || 'browser';
  const category = normalizeText(body?.category, 80) || 'client';
  const message = normalizeText(body?.message, 500) || 'Client log received without a message.';
  const details = sanitizeDetails(body?.details);
  const logPayload = compactObject({ clientAddress, ...details });
  const serializedDetails = Object.keys(logPayload).length > 0 ? ` ${JSON.stringify(logPayload)}` : '';

  logger.warn(`[ClientLog][${source}][${category}] ${message}${serializedDetails}`);

  return json({ success: true });
}