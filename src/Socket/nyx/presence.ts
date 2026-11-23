/**
 * Presence: keep the account looking online or offline.
 */
import type { AnySock } from './shared'
/* eslint-disable @typescript-eslint/no-explicit-any */

export const makePresence = (sock: AnySock) => {
	// ── presence (always online / always offline) ──
	/**
	 * Keep the account looking online or offline.
	 *  - 'online'  : sends "available" on connect, every `intervalMs`, and again after each incoming message
	 *  - 'offline' : sends "unavailable" the same way, so the account does not show as online while the bot works
	 *    (WhatsApp flips an account to online whenever it receives a message, so offline mode re-asserts it right after).
	 * Returns { stop, set } : stop() ends it, set(mode) switches mode without restarting.
	 */
	const keepPresence = (
		mode: 'online' | 'offline' = 'online',
		opts: { intervalMs?: number; settleMs?: number } = {}
	) => {
		const intervalMs = Math.max(5000, opts.intervalMs ?? 25_000)
		const settleMs = Math.max(0, opts.settleMs ?? 1500)
		let current = mode
		let stopped = false
		let settle: ReturnType<typeof setTimeout> | undefined
		const apply = () => {
			if (stopped) return
			Promise.resolve(sock.sendPresenceUpdate(current === 'online' ? 'available' : 'unavailable')).catch(
				() => undefined
			)
		}

		const timer = setInterval(apply, intervalMs)
		const onUpdate = (u: any) => {
			if (u?.connection === 'open') setTimeout(apply, 2000)
		}

		const onMessages = () => {
			if (settle) clearTimeout(settle)
			settle = setTimeout(apply, settleMs)
		}

		sock.ev?.on('connection.update', onUpdate)
		sock.ev?.on('messages.upsert', onMessages)
		apply()
		return {
			set(next: 'online' | 'offline') {
				current = next
				apply()
			},
			get mode() {
				return current
			},
			stop() {
				stopped = true
				clearInterval(timer)
				if (settle) clearTimeout(settle)
				sock.ev?.off('connection.update', onUpdate)
				sock.ev?.off('messages.upsert', onMessages)
			}
		}
	}

	return {
		keepPresence
	}
}
