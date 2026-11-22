/**
 * NYXCORE helpers (v1.1.0)
 *  - safePairingCode:   request a pairing code with waiting, retries and a timeout
 *  - followChannel / reactToChannelPost / unfollowChannel: newsletter shortcuts
 *  - postTextStatus / postMediaStatus / viewStatus / reactToStatus: status shortcuts
 *  - makeResilientSocket (see nyx-resilient.ts): auto reconnect with backoff
 *
 * Everything here only calls methods that already exist on the socket, so it
 * cannot change the behaviour of the core protocol code.
 */

import { canRenderHtmlPreview, renderHtmlPreview, type HtmlPreviewOptions } from '../Utils/html-preview'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnySock = any

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

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
	const m = String(input).trim().match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i)
	return m ? m[1]! : String(input).trim()
}

export const makeNyxHelpers = (sock: AnySock) => {
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
				await sleep(attempt === 1 ? 350 : opts.retryDelayMs ?? 900)
				const code: string = await sock.requestPairingCode(number, opts.customCode)
				return { code, formatted: formatPairingCode(code), phone: number }
			} catch (err) {
				last = err
			}
		}

		throw new Error(`Could not get a pairing code after ${retries} attempts: ${last instanceof Error ? last.message : String(last)}`)
	}

	// ── newsletter / channel shortcuts ──
	/** Follow a channel from a jid (…@newsletter), a channel link, or an invite code. */
	const followChannel = async (target: string) => {
		let jid = String(target).trim()
		if (!jid.endsWith('@newsletter')) {
			const meta = await sock.newsletterMetadata('invite', parseChannelInvite(jid))
			if (!meta?.id) throw new Error('Channel not found.')
			jid = meta.id
		}

		await sock.newsletterFollow(jid)
		return jid
	}

	const unfollowChannel = async (jid: string) => sock.newsletterUnfollow(jid)

	/** React to a channel post. serverId is the post's server id; emoji empty removes the reaction. */
	const reactToChannelPost = async (jid: string, serverId: string, emoji?: string) =>
		sock.newsletterReactMessage(jid, String(serverId), emoji)

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
	const reactToStatus = async (key: { remoteJid?: string | null; id?: string | null; participant?: string | null }, emoji: string) => {
		const author = key.participant || key.remoteJid
		return sock.sendMessage(
			'status@broadcast',
			{ react: { text: emoji, key } },
			{ statusJidList: [author, ownJid()].filter(Boolean) }
		)
	}

	// ── file / preview senders ──
	/**
	 * Send an HTML page (string or Buffer) as a proper file the user can open in a browser.
	 * opts: { caption, quoted }
	 */
	const sendHtmlFile = async (jid: string, html: string | Buffer, fileName = 'page.html', opts: { caption?: string; quoted?: unknown } = {}) => {
		const name = /\.html?$/i.test(fileName) ? fileName : `${fileName}.html`
		const buffer = Buffer.isBuffer(html) ? html : Buffer.from(String(html), 'utf8')
		return sock.sendMessage(
			jid,
			{ document: buffer, mimetype: 'text/html', fileName: name, ...(opts.caption ? { caption: opts.caption } : {}) },
			opts.quoted ? { quoted: opts.quoted } : {}
		)
	}

	/**
	 * Send a short looping preview (mp4 buffer or {url}) that plays like a GIF.
	 * opts: { caption, quoted }
	 */
	const sendAnimatedPreview = async (jid: string, video: Buffer | { url: string }, opts: { caption?: string; quoted?: unknown } = {}) =>
		sock.sendMessage(
			jid,
			{ video, gifPlayback: true, mimetype: 'video/mp4', ...(opts.caption ? { caption: opts.caption } : {}) },
			opts.quoted ? { quoted: opts.quoted } : {}
		)

	/** Send the animated preview first, then the HTML file, in one call. */
	const sendHtmlWithPreview = async (
		jid: string,
		html: string | Buffer,
		video: Buffer | { url: string },
		opts: { fileName?: string; previewCaption?: string; fileCaption?: string; quoted?: unknown } = {}
	) => {
		await sendAnimatedPreview(jid, video, { caption: opts.previewCaption, quoted: opts.quoted })
		return sendHtmlFile(jid, html, opts.fileName ?? 'page.html', { caption: opts.fileCaption, quoted: opts.quoted })
	}

	/**
	 * Send an HTML page the best way possible:
	 *  - if a headless browser + ffmpeg exist, an animated preview first, then the file
	 *  - otherwise just the file
	 * Returns { previewed: boolean, reason?: string }.
	 */
	const sendHtmlPage = async (
		jid: string,
		html: string | Buffer,
		opts: { fileName?: string; previewCaption?: string; fileCaption?: string; quoted?: unknown; preview?: HtmlPreviewOptions | false } = {}
	) => {
		const source = Buffer.isBuffer(html) ? html.toString('utf8') : String(html)
		let video: Buffer | undefined
		let reason: string | undefined
		if (opts.preview !== false) {
			try {
				if (await canRenderHtmlPreview(opts.preview || {})) video = await renderHtmlPreview(source, opts.preview || {})
				else reason = 'no browser/ffmpeg on this machine'
			} catch (err) {
				reason = err instanceof Error ? err.message : String(err)
			}
		}

		if (video) await sendAnimatedPreview(jid, video, { caption: opts.previewCaption, quoted: opts.quoted })
		await sendHtmlFile(jid, source, opts.fileName ?? 'page.html', { caption: opts.fileCaption, quoted: opts.quoted })
		return { previewed: !!video, reason }
	}

	return {
		safePairingCode,
		followChannel,
		unfollowChannel,
		reactToChannelPost,
		postTextStatus,
		postMediaStatus,
		viewStatus,
		reactToStatus,
		sendHtmlFile,
		sendAnimatedPreview,
		sendHtmlWithPreview,
		sendHtmlPage,
		renderHtmlPreview,
		canRenderHtmlPreview
	}
}

export type NyxHelpers = ReturnType<typeof makeNyxHelpers>
