import { DisconnectReason } from '../Types/index'
import makeWASocket from './index'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ResilientOptions {
	/** called for every new socket (first one and every reconnect): attach your handlers here */
	onSocket?: (sock: ReturnType<typeof makeWASocket>, attempt: number) => void
	/** called when we stop for good (logged out, replaced, or too many failures) */
	onGiveUp?: (reason: string, statusCode?: number) => void
	/** first wait in ms (default 1000) */
	baseDelayMs?: number
	/** longest wait in ms (default 30000) */
	maxDelayMs?: number
	/** stop after this many failures in a row, 0 = never (default 0) */
	maxConsecutiveFailures?: number
}

/** status codes after which reconnecting can never help */
const FATAL = new Set<number>([
	DisconnectReason.loggedOut,
	DisconnectReason.connectionReplaced,
	DisconnectReason.forbidden
])

/** Backoff delay: 1s, 2s, 4s … capped, with a little jitter. */
export const backoffDelay = (failures: number, base = 1000, max = 30_000) =>
	Math.min(max, base * 2 ** Math.max(0, failures - 1)) + Math.floor(Math.random() * 250)

/**
 * makeWASocket + automatic reconnect. restartRequired (515) reconnects at once,
 * temporary errors reconnect with exponential backoff, fatal ones stop and call onGiveUp.
 * Returns { get sock(), stop() }.
 */
export const makeResilientSocket = (config: Parameters<typeof makeWASocket>[0], opts: ResilientOptions = {}) => {
	let stopped = false
	let failures = 0
	let attempt = 0
	let current: ReturnType<typeof makeWASocket>

	const start = () => {
		attempt++
		current = makeWASocket(config)
		opts.onSocket?.(current, attempt)
		current.ev.on('connection.update', (u: any) => {
			if (u.connection === 'open') failures = 0
			if (u.connection !== 'close' || stopped) return
			const code: number | undefined = u.lastDisconnect?.error?.output?.statusCode
			if (code !== undefined && FATAL.has(code)) {
				stopped = true
				opts.onGiveUp?.(`fatal status ${code}`, code)
				return
			}

			if (code === DisconnectReason.restartRequired) {
				setTimeout(start, 500)
				return
			}

			failures++
			const limit = opts.maxConsecutiveFailures ?? 0
			if (limit > 0 && failures >= limit) {
				stopped = true
				opts.onGiveUp?.(`too many failures (${failures})`, code)
				return
			}

			setTimeout(
				() => {
					if (!stopped) start()
				},
				backoffDelay(failures, opts.baseDelayMs, opts.maxDelayMs)
			)
		})
	}

	start()
	return {
		get sock() {
			return current
		},
		stop() {
			stopped = true
			try {
				current?.end(undefined)
			} catch {}
		}
	}
}
