import { Boom } from '@hapi/boom'
import { inflateRawSync } from 'zlib'

/**
 * Minimal ZIP reader/writer used for WhatsApp sticker packs.
 * - writer: STORE method (webp files are already compressed), UTF-8 names
 * - reader: STORE + DEFLATE, central-directory based, with size guards
 */

export type ZipEntry = { name: string; data: Buffer }

const CRC_TABLE = (() => {
	const t = new Uint32Array(256)
	for (let n = 0; n < 256; n++) {
		let c = n
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
		t[n] = c >>> 0
	}

	return t
})()

const crc32 = (buf: Buffer) => {
	let c = 0xffffffff
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
	return (c ^ 0xffffffff) >>> 0
}

const dosDateTime = (d = new Date()) => {
	const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
	const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
	return { time: time & 0xffff, date: date & 0xffff }
}

export const createZip = (entries: ZipEntry[]): Buffer => {
	if (entries.length > 0xffff) throw new Boom('Too many files for zip', { statusCode: 400 })
	const { time, date } = dosDateTime()
	const locals: Buffer[] = []
	const centrals: Buffer[] = []
	let offset = 0

	for (const { name, data } of entries) {
		const nameBuf = Buffer.from(name, 'utf8')
		const crc = crc32(data)

		const local = Buffer.alloc(30)
		local.writeUInt32LE(0x04034b50, 0)
		local.writeUInt16LE(20, 4) // version needed
		local.writeUInt16LE(0x0800, 6) // flags: UTF-8 names
		local.writeUInt16LE(0, 8) // method: store
		local.writeUInt16LE(time, 10)
		local.writeUInt16LE(date, 12)
		local.writeUInt32LE(crc, 14)
		local.writeUInt32LE(data.length, 18)
		local.writeUInt32LE(data.length, 22)
		local.writeUInt16LE(nameBuf.length, 26)
		local.writeUInt16LE(0, 28)
		locals.push(local, nameBuf, data)

		const central = Buffer.alloc(46)
		central.writeUInt32LE(0x02014b50, 0)
		central.writeUInt16LE(20, 4) // version made by
		central.writeUInt16LE(20, 6) // version needed
		central.writeUInt16LE(0x0800, 8)
		central.writeUInt16LE(0, 10)
		central.writeUInt16LE(time, 12)
		central.writeUInt16LE(date, 14)
		central.writeUInt32LE(crc, 16)
		central.writeUInt32LE(data.length, 20)
		central.writeUInt32LE(data.length, 24)
		central.writeUInt16LE(nameBuf.length, 28)
		central.writeUInt32LE(offset, 42)
		centrals.push(central, nameBuf)

		offset += 30 + nameBuf.length + data.length
	}

	const centralBuf = Buffer.concat(centrals)
	const end = Buffer.alloc(22)
	end.writeUInt32LE(0x06054b50, 0)
	end.writeUInt16LE(entries.length, 8)
	end.writeUInt16LE(entries.length, 10)
	end.writeUInt32LE(centralBuf.length, 12)
	end.writeUInt32LE(offset, 16)
	return Buffer.concat([...locals, centralBuf, end])
}

/** Reads a zip into memory. Guards: max 200 files, max 64MB total uncompressed. */
export const readZip = (zip: Buffer, { maxFiles = 200, maxBytes = 64 * 1024 * 1024 } = {}): ZipEntry[] => {
	let eocd = -1
	for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
		if (zip.readUInt32LE(i) === 0x06054b50) {
			eocd = i
			break
		}
	}

	if (eocd < 0) throw new Boom('Not a zip file', { statusCode: 400 })
	const count = zip.readUInt16LE(eocd + 10)
	let p = zip.readUInt32LE(eocd + 16)
	if (count > maxFiles) throw new Boom('Zip has too many files', { statusCode: 400 })

	const out: ZipEntry[] = []
	let total = 0
	for (let i = 0; i < count; i++) {
		if (p + 46 > zip.length || zip.readUInt32LE(p) !== 0x02014b50) throw new Boom('Corrupt zip directory', { statusCode: 400 })
		const method = zip.readUInt16LE(p + 10)
		const csize = zip.readUInt32LE(p + 20)
		const usize = zip.readUInt32LE(p + 24)
		const nlen = zip.readUInt16LE(p + 28)
		const elen = zip.readUInt16LE(p + 30)
		const clen = zip.readUInt16LE(p + 32)
		const lho = zip.readUInt32LE(p + 42)
		const name = zip.toString('utf8', p + 46, p + 46 + nlen)
		p += 46 + nlen + elen + clen

		total += usize
		if (total > maxBytes) throw new Boom('Zip too large', { statusCode: 400 })
		if (lho + 30 > zip.length || zip.readUInt32LE(lho) !== 0x04034b50) throw new Boom('Corrupt zip entry', { statusCode: 400 })
		const start = lho + 30 + zip.readUInt16LE(lho + 26) + zip.readUInt16LE(lho + 28)
		const raw = zip.subarray(start, start + csize)
		let data: Buffer
		if (method === 0) data = Buffer.from(raw)
		else if (method === 8) data = inflateRawSync(raw, { maxOutputLength: Math.max(usize, 1) + 1024 })
		else throw new Boom(`Unsupported zip method ${method}`, { statusCode: 400 })
		if (name.endsWith('/') || name.includes('..')) continue // skip dirs, never trust traversal names
		out.push({ name, data })
	}

	return out
}
