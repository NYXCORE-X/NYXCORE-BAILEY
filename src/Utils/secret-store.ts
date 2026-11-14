import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import type { proto } from '../../WAProto/index.js'
import { normalizeMessageContent } from './messages'

export type StoredSecret = {
	/** base64 of the message's messageSecret */
	s: string
	/** poll option names (so votes can be turned back into names) */
	p?: string[]
	/** event name, if the message was an event */
	e?: string
}

export type SecretStoreOptions = {
	/** file to persist to (JSON lines). Leave out to keep secrets in memory only. */
	path?: string
	/** how many messages to remember (default 20000, oldest are dropped) */
	max?: number
}

export type SecretStore = ReturnType<typeof makeSecretStore>

/**
 * Remembers each message's messageSecret (and poll options) so edits, poll votes and event
 * responses can still be decrypted after a restart. Optionally persisted to a JSONL file.
 */
export const makeSecretStore = (opts: SecretStoreOptions = {}) => {
	const max = opts.max && opts.max > 0 ? opts.max : 20_000
	const map = new Map<string, StoredSecret>()
	let fileLines = 0

	const put = (id: string, v: StoredSecret) => {
		map.delete(id)
		map.set(id, v)
		while (map.size > max) map.delete(map.keys().next().value as string)
	}

	if (opts.path) {
		try {
			if (existsSync(opts.path)) {
				for (const line of readFileSync(opts.path, 'utf8').split('\n')) {
					if (!line) continue
					fileLines++
					try {
						const { i, ...rest } = JSON.parse(line)
						if (i && rest.s) put(i, rest)
					} catch {}
				}
			}

			mkdirSync(dirname(opts.path), { recursive: true })
			// compact the file when it grew far past what we keep
			if (fileLines > map.size * 2 + 1000) {
				writeFileSync(opts.path, [...map].map(([i, v]) => JSON.stringify({ i, ...v })).join('\n') + '\n')
				fileLines = map.size
			}
		} catch {}
	}

	const set = (id: string, v: StoredSecret) => {
		if (!id || !v.s) return
		const old = map.get(id)
		if (old && old.s === v.s && (old.p?.length || 0) >= (v.p?.length || 0)) return
		put(id, v)
		if (opts.path) {
			try {
				appendFileSync(opts.path, JSON.stringify({ i: id, ...v }) + '\n')
				fileLines++
			} catch {}
		}
	}

	/** pull the secret (+ poll options) out of any message shape and remember it */
	const remember = (msg: proto.IWebMessageInfo | undefined | null) => {
		const id = msg?.key?.id
		const m = msg?.message
		if (!id || !m) return
		// the secret can sit on the outer message (own-phone messages) or on the unwrapped one
		const inner = normalizeMessageContent(m)
		const secret =
			m.messageContextInfo?.messageSecret ||
			inner?.messageContextInfo?.messageSecret ||
			m.deviceSentMessage?.message?.messageContextInfo?.messageSecret
		if (!secret || !secret.length) return
		const poll = inner?.pollCreationMessage || inner?.pollCreationMessageV2 || inner?.pollCreationMessageV3
		const names = (poll?.options || []).map(o => o.optionName!).filter(Boolean)
		set(id, {
			s: Buffer.from(secret).toString('base64'),
			...(names.length ? { p: names } : {}),
			...(inner?.eventMessage?.name ? { e: inner.eventMessage.name } : {})
		})
	}

	return {
		remember,
		set,
		get: (id: string | null | undefined) => (id ? map.get(id) : undefined),
		getSecret: (id: string | null | undefined) => {
			const v = id ? map.get(id) : undefined
			return v ? new Uint8Array(Buffer.from(v.s, 'base64')) : undefined
		},
		get size() {
			return map.size
		},
		get persistent() {
			return !!opts.path
		},
		path: opts.path
	}
}
