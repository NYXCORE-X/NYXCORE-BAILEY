/**
 * NYXCORE session safety.
 *
 * The stock `useMultiFileAuthState` writes files in place. If the process is killed (panel restart, crash,
 * out-of-memory) halfway through a write, the JSON is left cut off, the session key is lost and every message
 * from that contact then fails with "failed to decrypt" / "Bad MAC". This module fixes the cause:
 *
 *  - `useNyxAuthState`      same shape as useMultiFileAuthState, but every write is atomic (temp file + rename),
 *                           a damaged file is quarantined instead of silently treated as "no session", and
 *                           creds.json always has a last-known-good copy (creds.json.bak) it recovers from.
 *  - `exportSessionBackup`  the whole session folder as one (optionally password-encrypted) Buffer.
 *  - `importSessionBackup`  put such a backup back into a folder (restores a lost or broken session).
 */
import { Mutex } from 'async-mutex'
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto'
import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { gunzipSync, gzipSync } from 'zlib'
import { proto } from '../../WAProto/index.js'
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from '../Types'
import { initAuthCreds } from './auth-utils'
import { BufferJSON } from './generics'

/* eslint-disable @typescript-eslint/no-explicit-any, max-depth */

const locks = new Map<string, Mutex>()
const lockFor = (p: string) => {
	let m = locks.get(p)
	if (!m) locks.set(p, (m = new Mutex()))
	return m
}

const fixFileName = (file: string) => file.replace(/\//g, '__').replace(/:/g, '-')

export interface NyxAuthStateOptions {
	/** called when a damaged file is found / recovered, for your own logging */
	onRecover?: (info: { file: string; action: 'restored-from-backup' | 'quarantined' }) => void
}

export const useNyxAuthState = async (
	folder: string,
	opts: NyxAuthStateOptions = {}
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> => {
	const info = await stat(folder).catch(() => undefined)
	if (info && !info.isDirectory()) throw new Error(`found something that is not a directory at ${folder}`)
	if (!info) await mkdir(folder, { recursive: true })

	const pathOf = (file: string) => join(folder, fixFileName(file))

	const writeAtomic = async (file: string, data: unknown) => {
		const target = pathOf(file)
		const release = await lockFor(target).acquire()
		try {
			const tmp = `${target}.${process.pid}.tmp`
			await writeFile(tmp, JSON.stringify(data, BufferJSON.replacer))
			await rename(tmp, target)
		} finally {
			release()
		}
	}

	const readJson = async (target: string) => JSON.parse(await readFile(target, 'utf-8'), BufferJSON.reviver)

	const readData = async (file: string): Promise<any> => {
		const target = pathOf(file)
		const release = await lockFor(target).acquire()
		try {
			try {
				return await readJson(target)
			} catch (err: any) {
				if (err?.code === 'ENOENT') {
					if (file === 'creds.json') {
						try {
							const good = await readJson(target + '.bak')
							await copyFile(target + '.bak', target)
							opts.onRecover?.({ file, action: 'restored-from-backup' })
							return good
						} catch {}
					}

					return null
				}

				// the file exists but is damaged
				if (file === 'creds.json') {
					try {
						const good = await readJson(target + '.bak')
						await rename(target, `${target}.corrupt`).catch(() => undefined)
						await copyFile(target + '.bak', target)
						opts.onRecover?.({ file, action: 'restored-from-backup' })
						return good
					} catch {}
				}

				await rename(target, `${target}.corrupt`).catch(() => undefined)
				opts.onRecover?.({ file, action: 'quarantined' })
				return null
			}
		} finally {
			release()
		}
	}

	const removeData = async (file: string) => {
		const target = pathOf(file)
		const release = await lockFor(target).acquire()
		try {
			await unlink(target)
		} catch {
		} finally {
			release()
		}
	}

	const creds: AuthenticationCreds = (await readData('creds.json')) || initAuthCreds()

	return {
		state: {
			creds,
			keys: {
				get: async (type, ids) => {
					const data: { [_: string]: SignalDataTypeMap[typeof type] } = {}
					await Promise.all(
						ids.map(async id => {
							let value = await readData(`${type}-${id}.json`)
							if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value)
							data[id] = value
						})
					)
					return data
				},
				set: async data => {
					const tasks: Promise<void>[] = []
					for (const category in data) {
						for (const id in data[category as keyof SignalDataTypeMap]) {
							const value = data[category as keyof SignalDataTypeMap]![id]
							const file = `${category}-${id}.json`
							tasks.push(value ? writeAtomic(file, value) : removeData(file))
						}
					}

					await Promise.all(tasks)
				}
			}
		},
		saveCreds: async () => {
			const target = pathOf('creds.json')
			// keep the previous good creds as a backup BEFORE replacing them
			try {
				await readJson(target)
				await copyFile(target, target + '.bak')
			} catch {}

			await writeAtomic('creds.json', creds)
		}
	}
}

// ───────────────────────── backup / restore ─────────────────────────

const MAGIC = Buffer.from('NYXB1')

const deriveKey = (password: string, salt: Buffer) =>
	new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 32, (err, key) => (err ? reject(err) : resolve(key))))

/** files worth backing up: creds, signal sessions, keys, secret store. Skips temp and quarantined files. */
const wanted = (name: string) => !/\.(tmp|corrupt)$/.test(name) && !name.endsWith('.bak')

/**
 * The session folder as a single Buffer (gzip, then AES-256-GCM if a password is given).
 * Save it anywhere (a file, a DM to yourself, cloud storage).
 */
export async function exportSessionBackup(folder: string, password?: string): Promise<Buffer> {
	const files: Record<string, string> = {}
	for (const name of await readdir(folder)) {
		if (!wanted(name)) continue
		const p = join(folder, name)
		const s = await stat(p).catch(() => undefined)
		if (!s?.isFile()) continue
		files[name] = (await readFile(p)).toString('base64')
	}

	if (!files['creds.json']) throw new Error('No creds.json in that folder: nothing to back up (is the bot paired?).')
	const packed = gzipSync(Buffer.from(JSON.stringify({ v: 1, at: Date.now(), files })))
	if (!password) return Buffer.concat([MAGIC, Buffer.from([0]), packed])
	const salt = randomBytes(16)
	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', await deriveKey(password, salt), iv)
	const enc = Buffer.concat([cipher.update(packed), cipher.final()])
	return Buffer.concat([MAGIC, Buffer.from([1]), salt, iv, cipher.getAuthTag(), enc])
}

/** Restore a backup made by exportSessionBackup into `folder`. Returns how many files were written. */
export async function importSessionBackup(backup: Buffer, folder: string, password?: string): Promise<number> {
	if (backup.length < MAGIC.length + 1 || !backup.subarray(0, MAGIC.length).equals(MAGIC)) {
		throw new Error('This is not a NYXCORE session backup.')
	}

	const encrypted = backup[MAGIC.length] === 1
	let packed: Buffer
	if (encrypted) {
		if (!password) throw new Error('This backup is password-protected: a password is needed.')
		const o = MAGIC.length + 1
		const salt = backup.subarray(o, o + 16)
		const iv = backup.subarray(o + 16, o + 28)
		const tag = backup.subarray(o + 28, o + 44)
		const decipher = createDecipheriv('aes-256-gcm', await deriveKey(password, salt), iv)
		decipher.setAuthTag(tag)
		try {
			packed = Buffer.concat([decipher.update(backup.subarray(o + 44)), decipher.final()])
		} catch {
			throw new Error('Wrong password, or the backup is damaged.')
		}
	} else {
		packed = backup.subarray(MAGIC.length + 1)
	}

	const data = JSON.parse(gunzipSync(packed).toString('utf-8'))
	if (data?.v !== 1 || typeof data.files !== 'object' || !data.files['creds.json']) {
		throw new Error('Backup is incomplete.')
	}

	await mkdir(folder, { recursive: true })
	let n = 0
	for (const [name, b64] of Object.entries<string>(data.files)) {
		if (name.includes('/') || name.includes('\\') || name.startsWith('.')) continue // never write outside the folder
		const target = join(folder, name)
		await writeFile(`${target}.tmp`, Buffer.from(b64, 'base64'))
		await rename(`${target}.tmp`, target)
		n++
	}

	return n
}
