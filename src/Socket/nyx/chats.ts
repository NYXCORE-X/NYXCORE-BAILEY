/**
 * Chat tools: archive, unarchive, lock, clear, delete, pin, mute, mark read, disappearing messages,
 * and pinning messages inside a chat. Works for private chats and groups.
 *
 * Archive / clear / delete / mark-read need "the last message" of the chat. Pass it as `last` when you have it
 * (a message, or a list of messages, newest first). If you do not, the current time is used, which is what
 * WhatsApp needs to apply the change to everything up to now.
 */
import type { AnySock } from './shared'

/* eslint-disable @typescript-eslint/no-explicit-any */

export type DisappearingDuration = 'off' | '24h' | '7d' | '90d' | number

const DURATIONS: Record<string, number> = { off: 0, '24h': 86400, '7d': 604800, '90d': 7776000 }

/** seconds for a duration keyword, or the number itself */
export const disappearingSeconds = (d: DisappearingDuration): number => {
	if (typeof d === 'number') {
		if (!Number.isFinite(d) || d < 0) throw new Error('Duration must be a positive number of seconds.')
		return Math.floor(d)
	}

	const s = DURATIONS[String(d).toLowerCase()]
	if (s === undefined) throw new Error("Duration must be 'off', '24h', '7d', '90d' or a number of seconds.")
	return s
}

export const makeChatTools = (sock: AnySock) => {
	/** "up to now" range, or the message(s) you give */
	const range = (last?: any) => {
		if (last && (Array.isArray(last) || last.lastMessageTimestamp !== undefined || last.messages)) return last
		if (last?.key) return [last]
		return { lastMessageTimestamp: Math.floor(Date.now() / 1000) }
	}

	const archiveChat = (jid: string, last?: any) => sock.chatModify({ archive: true, lastMessages: range(last) }, jid)
	const unarchiveChat = (jid: string, last?: any) => sock.chatModify({ archive: false, lastMessages: range(last) }, jid)
	/** lock / unlock a chat (the "Locked chats" folder). Needs a WhatsApp version that supports chat lock. */
	const lockChat = (jid: string) => sock.chatModify({ lock: true }, jid)
	const unlockChat = (jid: string) => sock.chatModify({ lock: false }, jid)
	const clearChat = (jid: string, last?: any) => sock.chatModify({ clear: true, lastMessages: range(last) }, jid)
	const deleteChat = (jid: string, last?: any) => sock.chatModify({ delete: true, lastMessages: range(last) }, jid)
	const pinChat = (jid: string) => sock.chatModify({ pin: true }, jid)
	const unpinChat = (jid: string) => sock.chatModify({ pin: false }, jid)
	/** mute for `ms` milliseconds (e.g. 8 * 3600 * 1000) */
	const muteChat = (jid: string, ms: number) => sock.chatModify({ mute: Date.now() + ms }, jid)
	const unmuteChat = (jid: string) => sock.chatModify({ mute: null }, jid)
	const markChatRead = (jid: string, last?: any) => sock.chatModify({ markRead: true, lastMessages: range(last) }, jid)
	const markChatUnread = (jid: string, last?: any) =>
		sock.chatModify({ markRead: false, lastMessages: range(last) }, jid)

	/**
	 * Disappearing messages for a private chat or a group.
	 * duration: 'off' | '24h' | '7d' | '90d' | seconds
	 */
	const setDisappearing = async (jid: string, duration: DisappearingDuration) => {
		const seconds = disappearingSeconds(duration)
		if (jid.endsWith('@g.us')) return sock.groupToggleEphemeral(jid, seconds)
		return sock.sendMessage(jid, { disappearingMessagesInChat: seconds })
	}

	/** Pin a message at the top of a chat. seconds: 86400 (24h), 604800 (7d, default) or 2592000 (30d). */
	const pinMessage = (jid: string, key: any, seconds: 86400 | 604800 | 2592000 = 604800) =>
		sock.sendMessage(jid, { pin: key, type: 1, time: seconds })
	const unpinMessage = (jid: string, key: any) => sock.sendMessage(jid, { pin: key, type: 2 })

	return {
		archiveChat,
		unarchiveChat,
		lockChat,
		unlockChat,
		clearChat,
		deleteChat,
		pinChat,
		unpinChat,
		muteChat,
		unmuteChat,
		markChatRead,
		markChatUnread,
		setDisappearing,
		pinMessage,
		unpinMessage
	}
}
