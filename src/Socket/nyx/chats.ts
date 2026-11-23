/**
 * Chat tools: archive, unarchive, lock, clear, delete, pin, mute, mark read, disappearing messages,
 * and pinning messages inside a chat. Works for private chats and groups.
 *
 * Archive / clear / delete / mark-read need "the last message" of the chat. Pass it as `last` when you have it
 * (a message, or a list of messages, newest first). If you do not, the current time is used, which is what
 * WhatsApp needs to apply the change to everything up to now.
 */
import { proto } from '../../../WAProto/index.js'
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

export interface ChatToolsOptions {
	/** how long to wait for your phone to send a missing app-state key, ms (default 30000) */
	keyWaitMs?: number
}

export const makeChatTools = (sock: AnySock, opts: ChatToolsOptions = {}) => {
	/**
	 * Archive, lock, clear, pin and mute are synced through WhatsApp's app state, which needs the app-state key.
	 * If that key is missing, ask the phone for it and wait a little instead of failing straight away.
	 */
	// works on any socket: uses the socket's own helpers when it has them, otherwise the auth state directly
	const hasKey = async (id: string) => {
		try {
			if (typeof sock.getAppStateSyncKey === 'function') return !!(await sock.getAppStateSyncKey(id))
			const res = await sock.authState?.keys?.get('app-state-sync-key', [id])
			return !!res?.[id]
		} catch {
			return false
		}
	}

	const askPhone = async (id: string) => {
		if (typeof sock.ensureAppStateKey === 'function') return sock.ensureAppStateKey({ force: true })
		if (typeof sock.relayMessage !== 'function' || !sock.user?.id) return
		const me = `${String(sock.user.id).split(':')[0]!.split('@')[0]}@s.whatsapp.net`
		await sock.relayMessage(
			me,
			{
				protocolMessage: {
					type: proto.Message.ProtocolMessage.Type.APP_STATE_SYNC_KEY_REQUEST,
					appStateSyncKeyRequest: { keyIds: [{ keyId: Buffer.from(id, 'base64') }] }
				}
			},
			{
				additionalAttributes: { category: 'peer', push_priority: 'high_force' },
				additionalNodes: [{ tag: 'meta', attrs: { appdata: 'default' } }]
			}
		)
	}

	const ensureKey = async () => {
		const id = sock.authState?.creds?.myAppStateKeyId
		if (!id) throw new Error('Not ready yet: the first app-state sync has not finished. Wait a minute and retry.')
		if (await hasKey(id)) return
		await askPhone(id)
		const until = Date.now() + (opts.keyWaitMs ?? 30_000)
		while (Date.now() < until) {
			await new Promise(r => setTimeout(r, 1000))
			if (await hasKey(id)) return
		}

		throw new Error(
			'App-state key is missing and your phone did not send it. Open WhatsApp on the phone and try again; if it keeps failing, re-link the device.'
		)
	}

	const modify = async (mod: any, jid: string) => {
		await ensureKey()
		return sock.chatModify(mod, jid)
	}

	/** "up to now" range, or the message(s) you give */
	const range = (last?: any) => {
		if (last && (Array.isArray(last) || last.lastMessageTimestamp !== undefined || last.messages)) return last
		if (last?.key) return [last]
		return { lastMessageTimestamp: Math.floor(Date.now() / 1000) }
	}

	const archiveChat = (jid: string, last?: any) => modify({ archive: true, lastMessages: range(last) }, jid)
	const unarchiveChat = (jid: string, last?: any) => modify({ archive: false, lastMessages: range(last) }, jid)
	/** lock / unlock a chat (the "Locked chats" folder). Needs a WhatsApp version that supports chat lock. */
	const lockChat = (jid: string) => modify({ lock: true }, jid)
	const unlockChat = (jid: string) => modify({ lock: false }, jid)
	const clearChat = (jid: string, last?: any) => modify({ clear: true, lastMessages: range(last) }, jid)
	const deleteChat = (jid: string, last?: any) => modify({ delete: true, lastMessages: range(last) }, jid)
	const pinChat = (jid: string) => modify({ pin: true }, jid)
	const unpinChat = (jid: string) => modify({ pin: false }, jid)
	/** mute for `ms` milliseconds (e.g. 8 * 3600 * 1000) */
	const muteChat = (jid: string, ms: number) => modify({ mute: Date.now() + ms }, jid)
	const unmuteChat = (jid: string) => modify({ mute: null }, jid)
	const markChatRead = (jid: string, last?: any) => modify({ markRead: true, lastMessages: range(last) }, jid)
	const markChatUnread = (jid: string, last?: any) => modify({ markRead: false, lastMessages: range(last) }, jid)

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
