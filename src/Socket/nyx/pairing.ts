/**
 * Pairing: request a pairing code with waiting, retries and a timeout.
 */
import { type AnySock, formatPairingCode, normalizePhone, type SafePairingOptions, sleep } from './shared'
/* eslint-disable @typescript-eslint/no-explicit-any */

export const makePairing = (sock: AnySock) => {
	/** Resolves once the socket is ready to accept a pairing request (first QR emitted or connecting). */
	const waitUntilReady = (timeoutMs: number) =>
		new Promise<void>((resolve, reject) => {
			if (sock.authState?.creds?.registered) {
				reject(new Error('This device is already registered.'))
				return
			}

			let settled = false
			const finish = (err?: Error) => {
				if (settled) return
				settled = true
				clearTimeout(timer)
				sock.ev.off('connection.update', onUpdate)
				err ? reject(err) : resolve()
			}

			const onUpdate = (u: any) => {
				if (u.qr || u.connection === 'open') finish()
				if (u.connection === 'close') finish(new Error('Connection closed before a code could be requested.'))
			}

			const timer = setTimeout(() => finish(), timeoutMs)
			sock.ev.on('connection.update', onUpdate)
		})

	/**
	 * Request a pairing code safely: waits for the socket, retries, returns the code.
	 * Returns { code, formatted }.
	 */
	const safePairingCode = async (phone: string, opts: SafePairingOptions = {}) => {
		const number = normalizePhone(phone)
		const retries = Math.max(1, opts.retries ?? 3)
		await waitUntilReady(opts.readyTimeoutMs ?? 20_000)
		let last: unknown
		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				await sleep(attempt === 1 ? 350 : (opts.retryDelayMs ?? 900))
				const code: string = await sock.requestPairingCode(number, opts.customCode)
				return { code, formatted: formatPairingCode(code), phone: number }
			} catch (err) {
				last = err
			}
		}

		throw new Error(
			`Could not get a pairing code after ${retries} attempts: ${last instanceof Error ? last.message : String(last)}`
		)
	}

	return {
		safePairingCode
	}
}
