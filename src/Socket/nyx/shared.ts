/**
 * Small pieces shared by the NYXCORE helper modules.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnySock = any

export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export interface SafePairingOptions {
	/** attempts before giving up (default 3) */
	retries?: number
	/** max time to wait for the socket to be ready for a code, ms (default 20000) */
	readyTimeoutMs?: number
	/** pause between attempts, ms (default 900) */
	retryDelayMs?: number
	/** custom 8 character code, optional */
	customCode?: string
}

/** Keeps only digits and checks the length. */
export const normalizePhone = (input: string): string => {
	const digits = String(input ?? '').replace(/[^0-9]/g, '')
	if (digits.length < 8 || digits.length > 15) {
		throw new Error('Enter a valid phone number with country code, digits only.')
	}

	return digits
}

/** Formats an 8 character code as XXXX-XXXX. */
export const formatPairingCode = (code: string) => (code.match(/.{1,4}/g) || [code]).join('-')

/** Extracts the invite code from a channel link, or returns the input when it is already a code. */
export const parseChannelInvite = (input: string): string => {
	const m = String(input)
		.trim()
		.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i)
	return m ? m[1]! : String(input).trim()
}
