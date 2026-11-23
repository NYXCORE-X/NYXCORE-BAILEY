/**
 * Status (stories): post text or media, view and react.
 */
import type { AnySock } from './shared'
/* eslint-disable @typescript-eslint/no-explicit-any */

export const makeStatus = (sock: AnySock) => {
	// ── status shortcuts ──
	const ownJid = () => String(sock.authState?.creds?.me?.id || '')

	/** Post a text status. recipients = jids that may see it (your own number is added automatically). */
	const postTextStatus = async (
		text: string,
		recipients: string[] = [],
		opts: { backgroundColor?: string; font?: number } = {}
	) => sock.sendStatus({ text }, { statusJidList: recipients, ...opts })

	/** Post an image or video status. media = { image: Buffer|{url} } or { video: … } with optional caption. */
	const postMediaStatus = async (media: Record<string, unknown>, recipients: string[] = []) =>
		sock.sendStatus(media, { statusJidList: recipients })

	/** Mark someone's status as viewed. key = the status message key. */
	const viewStatus = async (key: { remoteJid?: string | null; id?: string | null; participant?: string | null }) =>
		sock.readMessages([key])

	/** React to someone's status with an emoji. */
	const reactToStatus = async (
		key: { remoteJid?: string | null; id?: string | null; participant?: string | null },
		emoji: string
	) => {
		const author = key.participant || key.remoteJid
		return sock.sendMessage(
			'status@broadcast',
			{ react: { text: emoji, key } },
			{ statusJidList: [author, ownJid()].filter(Boolean) }
		)
	}


	return {
		postTextStatus,
		postMediaStatus,
		viewStatus,
		reactToStatus,
	}
}
