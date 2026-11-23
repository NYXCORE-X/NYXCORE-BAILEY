/**
 * Group status: post a status that lives inside a group (uses the socket's own sendGroupStatus).
 */
import type { AnySock } from './shared'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const makeGroupStatus = (sock: AnySock) => {
	/** text status inside a group. options: { backgroundColor, font } */
	const postGroupTextStatus = (
		groupJid: string,
		text: string,
		options: { backgroundColor?: string; font?: number } = {}
	) => sock.sendGroupStatus(groupJid, { text }, options)

	/** image / video / audio status inside a group, e.g. { image: buffer, caption: 'hi' } */
	const postGroupMediaStatus = (groupJid: string, media: Record<string, unknown>) =>
		sock.sendGroupStatus(groupJid, media as any)

	return { postGroupTextStatus, postGroupMediaStatus }
}
