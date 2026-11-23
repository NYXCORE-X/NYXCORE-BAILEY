/**
 * HTML pages: send as a file and/or as an animated preview video.
 */
import { canRenderHtmlPreview, type HtmlPreviewOptions, renderHtmlPreview } from '../../Utils/html-preview'
import type { AnySock } from './shared'
/* eslint-disable @typescript-eslint/no-explicit-any */

export const makeHtml = (sock: AnySock) => {
	// ── file / preview senders ──
	/**
	 * Send an HTML page (string or Buffer) as a proper file the user can open in a browser.
	 * opts: { caption, quoted }
	 */
	const sendHtmlFile = async (
		jid: string,
		html: string | Buffer,
		fileName = 'page.html',
		opts: { caption?: string; quoted?: unknown } = {}
	) => {
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
	const sendAnimatedPreview = async (
		jid: string,
		video: Buffer | { url: string },
		opts: { caption?: string; quoted?: unknown } = {}
	) =>
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
		opts: {
			fileName?: string
			previewCaption?: string
			fileCaption?: string
			quoted?: unknown
			preview?: HtmlPreviewOptions | false
		} = {}
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
		sendHtmlFile,
		sendAnimatedPreview,
		sendHtmlWithPreview,
		sendHtmlPage,
	}
}
