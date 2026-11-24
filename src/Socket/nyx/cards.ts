/**
 * Article / link cards: a tappable preview card (title, subtitle, image, url) like WhatsApp's help-center cards.
 * It is a normal text message with contextInfo.externalAdReply filled in; WhatsApp decides the final design.
 */
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
	/** preview image (or video poster) by url */
	thumbnailUrl?: string
	/** preview image as bytes (alternative to thumbnailUrl) */
	thumbnail?: Buffer
	/** 1 = image, 2 = video */
	mediaType?: 1 | 2
	renderLargerThumbnail?: boolean
	showAdAttribution?: boolean
	quoted?: any
}

export const makeCards = (sock: AnySock) => {
	const sendArticleCard = (jid: string, card: ArticleCardOptions) => {
		if (!card?.title) throw new Error('An article card needs a title.')
		const { text, quoted, url, ...rest } = card
		return sock.sendMessage(
			jid,
			{
				text: text || url || card.title,
				contextInfo: {
					externalAdReply: {
						title: rest.title,
						body: rest.body,
						sourceUrl: url,
						thumbnailUrl: rest.thumbnailUrl,
						thumbnail: rest.thumbnail,
						mediaType: rest.mediaType ?? 1,
						renderLargerThumbnail: rest.renderLargerThumbnail ?? true,
						showAdAttribution: rest.showAdAttribution ?? false
					}
				}
			},
			quoted ? { quoted } : {}
		)
	}

	return { sendArticleCard }
}
