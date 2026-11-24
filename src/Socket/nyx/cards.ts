/**
 * Article / link cards: a tappable preview card (title, subtitle, image, url) like WhatsApp's help-center cards.
 * It is a normal text message with contextInfo.externalAdReply filled in; WhatsApp decides the final design.
 */
import { extractImageThumb } from '../../Utils/messages-media'
import type { AnySock } from './shared'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ArticleCardOptions {
	/** normal message text above the card */
	text?: string
	/** main bold line */
	title: string
	/** second line */
	body?: string
	/** opened when the card is tapped */
	url?: string
	/** preview image by url (downloaded and attached to the card) */
	thumbnailUrl?: string
	/** preview image as bytes (alternative to thumbnailUrl) */
	thumbnail?: Buffer
	/**
	 * 'preview' (default): a normal WhatsApp link-preview card with YOUR title, subtitle and image.
	 * 'ad': the external-ad style card (contextInfo.externalAdReply). WhatsApp often shows it differently or hides it.
	 */
	style?: 'preview' | 'ad'
	/** 1 = image, 2 = video (style 'ad') */
	mediaType?: 1 | 2
	renderLargerThumbnail?: boolean
	showAdAttribution?: boolean
	quoted?: any
}

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8

/** download an image and turn it into a JPEG thumbnail for the card */
const loadThumb = async (card: ArticleCardOptions): Promise<Buffer | undefined> => {
	let raw = card.thumbnail
	if (!raw && card.thumbnailUrl) {
		try {
			const res = await fetch(card.thumbnailUrl, { signal: AbortSignal.timeout(10_000) })
			if (!res.ok) return undefined
			raw = Buffer.from(await res.arrayBuffer())
			if (raw.length > 5 * 1024 * 1024) return undefined
		} catch {
			return undefined
		}
	}

	if (!raw) return undefined
	try {
		return (await extractImageThumb(raw, 400)).buffer
	} catch {
		// no image library installed: a JPEG can be attached as it is
		return isJpeg(raw) ? raw : undefined
	}
}

export const makeCards = (sock: AnySock) => {
	const sendArticleCard = async (jid: string, card: ArticleCardOptions) => {
		if (!card?.title) throw new Error('An article card needs a title.')
		const { text, quoted, url } = card
		const opts = quoted ? { quoted } : {}

		if ((card.style ?? 'preview') === 'preview' && url) {
			const jpegThumbnail = await loadThumb(card)
			return sock.sendMessage(
				jid,
				{
					text: text ? `${text}\n${url}` : url,
					linkPreview: {
						'canonical-url': url,
						'matched-text': url,
						title: card.title,
						description: card.body,
						jpegThumbnail
					}
				},
				opts
			)
		}

		return sock.sendMessage(
			jid,
			{
				text: text || url || card.title,
				contextInfo: {
					externalAdReply: {
						title: card.title,
						body: card.body,
						sourceUrl: url,
						mediaUrl: url,
						sourceType: 'URL',
						thumbnailUrl: card.thumbnailUrl,
						thumbnail: card.thumbnail,
						mediaType: card.mediaType ?? 1,
						renderLargerThumbnail: card.renderLargerThumbnail ?? true,
						showAdAttribution: card.showAdAttribution ?? false
					}
				}
			},
			opts
		)
	}

	return { sendArticleCard }
}
