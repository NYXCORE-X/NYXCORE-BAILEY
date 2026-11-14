import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { readFile } from 'fs/promises'

export type StickerOptions = {
	/** pack name shown in WhatsApp */
	pack?: string
	/** pack publisher / author */
	author?: string
	/** emojis the sticker is filed under */
	emojis?: string[]
	/** 'crop' fills the 512x512 square, 'full' keeps the whole picture with transparent padding (default) */
	fit?: 'crop' | 'full'
	/** webp quality 1-100 (default 80) */
	quality?: number
	/** the input is a video / gif → animated sticker (needs ffmpeg) */
	animated?: boolean
}

const run = (cmd: string, args: string[], input?: Buffer) =>
	new Promise<Buffer>((resolve, reject) => {
		const p = spawn(cmd, args)
		const out: Buffer[] = []
		const err: Buffer[] = []
		p.stdout.on('data', d => out.push(d))
		p.stderr.on('data', d => err.push(d))
		p.on('error', e => reject(new Error(`${cmd} is not available (${e.message})`)))
		p.on('close', code =>
			code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`${cmd} failed: ${Buffer.concat(err).toString().slice(-300)}`))
		)
		p.stdin.on('error', () => undefined)
		if (input) p.stdin.end(input)
		else p.stdin.end()
	})

export const hasFfmpeg = async () => {
	try {
		await run('ffmpeg', ['-version'])
		return true
	} catch {
		return false
	}
}

export const toBuffer = async (input: Buffer | Uint8Array | string) => {
	if (typeof input === 'string') {
		if (/^https?:\/\//.test(input)) {
			const r = await fetch(input)
			if (!r.ok) throw new Error(`download failed (${r.status})`)
			return Buffer.from(await r.arrayBuffer())
		}

		return readFile(input)
	}

	return Buffer.from(input)
}

/** read the pixel size of a webp (VP8, VP8L or VP8X) */
const webpSize = (b: Buffer) => {
	const t = b.toString('ascii', 12, 16)
	if (t === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) }
	if (t === 'VP8L') {
		const v = b.readUInt32LE(21)
		return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }
	}

	return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
}

/** write WhatsApp sticker-pack info (EXIF) into a webp */
export const addStickerExif = (webp: Buffer, { pack = '', author = '', emojis = [] }: StickerOptions) => {
	if (webp.toString('ascii', 0, 4) !== 'RIFF' || webp.toString('ascii', 8, 12) !== 'WEBP') {
		throw new Error('not a webp image')
	}

	const json = Buffer.from(
		JSON.stringify({
			'sticker-pack-id': randomBytes(16).toString('hex'),
			'sticker-pack-name': pack,
			'sticker-pack-publisher': author,
			emojis
		})
	)
	const head = Buffer.from([0x49, 0x49, 0x2a, 0, 0x08, 0, 0, 0, 0x01, 0, 0x41, 0x57, 0x07, 0, 0, 0, 0, 0, 0x16, 0, 0, 0])
	head.writeUInt32LE(json.length, 14)
	const exif = Buffer.concat([head, json])
	const chunk = (tag: string, data: Buffer) => {
		const h = Buffer.alloc(8)
		h.write(tag, 0, 'ascii')
		h.writeUInt32LE(data.length, 4)
		return Buffer.concat([h, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)])
	}

	let body = webp.subarray(12)
	if (body.toString('ascii', 0, 4) === 'VP8X') {
		// keep the chunks, drop any old EXIF, set the EXIF flag
		const chunks: Buffer[] = []
		let o = 0
		while (o + 8 <= body.length) {
			const tag = body.toString('ascii', o, o + 4)
			const len = body.readUInt32LE(o + 4)
			const full = body.subarray(o, o + 8 + len + (len % 2))
			if (tag !== 'EXIF') chunks.push(full)
			o += 8 + len + (len % 2)
		}

		const first = Buffer.from(chunks[0]!)
		first[8] = first[8]! | 0x08
		body = Buffer.concat([first, ...chunks.slice(1)])
	} else {
		const { w, h } = webpSize(webp)
		const vp8x = Buffer.alloc(10)
		vp8x[0] = 0x08 | (body.toString('ascii', 0, 4) === 'VP8L' ? 0x10 : 0)
		vp8x.writeUIntLE(w - 1, 4, 3)
		vp8x.writeUIntLE(h - 1, 7, 3)
		body = Buffer.concat([chunk('VP8X', vp8x), body])
	}

	const out = Buffer.concat([Buffer.from('WEBP'), body, chunk('EXIF', exif)])
	const riff = Buffer.alloc(8)
	riff.write('RIFF', 0, 'ascii')
	riff.writeUInt32LE(out.length, 4)
	return Buffer.concat([riff, out])
}

/**
 * Turn an image (or a video / gif, needs ffmpeg) into a 512x512 webp sticker with pack info.
 * Uses `sharp` if installed, otherwise ffmpeg.
 */
export const makeSticker = async (input: Buffer | Uint8Array | string, opts: StickerOptions = {}) => {
	const buf = await toBuffer(input)
	const quality = opts.quality ?? 80
	const fit = opts.fit ?? 'full'
	let webp: Buffer
	let sharp: any
	if (!opts.animated) {
		try {
			// optional dependency
			const name = 'sharp'
			sharp = (await import(name)).default
		} catch {}
	}

	if (sharp) {
		webp = await sharp(buf)
			.resize(512, 512, { fit: fit === 'crop' ? 'cover' : 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.webp({ quality })
			.toBuffer()
	} else {
		const vf =
			fit === 'crop'
				? 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512'
				: 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba'
		const args = ['-i', 'pipe:0', '-vf', opts.animated ? `${vf},fps=15` : vf, '-c:v', 'libwebp', '-quality', String(quality)]
		if (opts.animated) args.push('-loop', '0', '-t', '8', '-an')
		else args.push('-frames:v', '1')
		args.push('-f', 'webp', 'pipe:1')
		webp = await run('ffmpeg', ['-v', 'error', ...args], buf)
	}

	return opts.pack || opts.author || opts.emojis ? addStickerExif(webp, opts) : webp
}

/** Convert any audio/video into a WhatsApp voice note (ogg/opus). Needs ffmpeg. */
export const toVoiceNote = async (input: Buffer | Uint8Array | string) => {
	const buf = await toBuffer(input)
	return run(
		'ffmpeg',
		['-v', 'error', '-i', 'pipe:0', '-vn', '-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1', '-application', 'voip', '-f', 'ogg', 'pipe:1'],
		buf
	)
}
