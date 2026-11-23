/**
 * Sticker packs: send a whole pack as one message (the pack bubble people can add with one tap).
 */
import type { AnySock } from './shared'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface StickerPackItem {
	/** the sticker file (webp), Buffer / { url } / { stream } */
	data: any
	emojis?: string[]
	accessibilityLabel?: string
	isLottie?: boolean
}

export const makeStickerPack = (sock: AnySock) => {
	/**
	 * Send a sticker pack.
	 * stickers: array of { data, emojis? }, cover: optional tray icon, name / publisher / description: pack info.
	 */
	const sendStickerPack = (
		jid: string,
		stickers: StickerPackItem[],
		opts: { name?: string; publisher?: string; description?: string; cover?: any; quoted?: any } = {}
	) => {
		if (!stickers?.length) throw new Error('A sticker pack needs at least one sticker.')
		const { quoted, ...pack } = opts
		return sock.sendMessage(jid, { stickerPack: { stickers, ...pack } }, quoted ? { quoted } : {})
	}

	return { sendStickerPack }
}
