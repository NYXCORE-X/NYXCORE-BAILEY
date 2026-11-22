/**
 * HTML -> animated preview (mp4) for WhatsApp.
 *
 * Bailey only sends messages, so to "animate" a page something has to RUN it.
 * This helper opens the page in a headless browser, records frames while the page
 * animates by itself, and joins them with ffmpeg into a looping mp4.
 *
 * Needs on the machine running the bot (all optional, nothing breaks without them):
 *   - a browser library: playwright, playwright-core, puppeteer or puppeteer-core (with a Chromium)
 *   - ffmpeg (system ffmpeg, or the `ffmpeg-static` package)
 * Check first with `await canRenderHtmlPreview()`.
 */
import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface HtmlPreviewOptions {
	/** length of the recording in seconds (default 6, max 20) */
	seconds?: number
	/** target frames per second while recording (default 10) */
	fps?: number
	/** viewport width (default 540) */
	width?: number
	/** viewport height (default 960) */
	height?: number
	/** wait before recording so scripts and libraries can load, ms (default 1500) */
	waitMs?: number
	/** total time limit, ms (default 60000) */
	timeoutMs?: number
	/** turn on software WebGL (needed for three.js pages). Default: detected from the HTML. Slow without a GPU. */
	webgl?: boolean
	/** path to a Chromium/Chrome executable, if the browser library cannot find one */
	executablePath?: string
	/** path to the ffmpeg binary (default: ffmpeg-static if installed, else "ffmpeg") */
	ffmpegPath?: string
}

const BROWSER_LIBS = ['playwright', 'playwright-core', 'puppeteer', 'puppeteer-core']

async function loadBrowserLib(): Promise<{ name: string; lib: any } | null> {
	for (const name of BROWSER_LIBS) {
		try {
			const lib: any = await import(name)
			const api = lib?.chromium ?? lib?.default?.chromium ?? lib?.launch ?? lib?.default?.launch
			if (api) return { name, lib: lib?.default && !lib.chromium && !lib.launch ? lib.default : lib }
		} catch {
			// not installed, try the next one
		}
	}

	return null
}

async function resolveFfmpeg(custom?: string): Promise<string> {
	if (custom) return custom
	try {
		const mod: any = await import('ffmpeg-static')
		const p = mod?.default ?? mod
		if (typeof p === 'string' && p) return p
	} catch {
		// fall through
	}

	return 'ffmpeg'
}

const run = (cmd: string, args: string[], timeout: number) =>
	new Promise<void>((resolve, reject) => {
		execFile(cmd, args, { timeout, maxBuffer: 1024 * 1024 * 8 }, err => (err ? reject(err) : resolve()))
	})

/** true when both a browser library and ffmpeg can be found */
export async function canRenderHtmlPreview(opts: Pick<HtmlPreviewOptions, 'ffmpegPath'> = {}): Promise<boolean> {
	if (!(await loadBrowserLib())) return false
	try {
		await run(await resolveFfmpeg(opts.ffmpegPath), ['-version'], 8000)
		return true
	} catch {
		return false
	}
}

/** The recorded page must not be able to reach the host's own network. */
export function isBlockedUrl(raw: string): boolean {
	let u: URL
	try {
		u = new URL(raw)
	} catch {
		return true
	}

	if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return false
	if (u.protocol !== 'http:' && u.protocol !== 'https:') return true
	const h = u.hostname.toLowerCase()
	if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h === '0.0.0.0' || h === '[::1]' || h === '::1') return true
	const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
	if (m) {
		const [a, b] = [Number(m[1]), Number(m[2])]
		if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return true
	}

	return false
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/**
 * Render an HTML string to an mp4 Buffer (H.264, even dimensions, loops well as a WhatsApp GIF).
 * Throws a clear error if no browser library / ffmpeg is available.
 */
export async function renderHtmlPreview(html: string, opts: HtmlPreviewOptions = {}): Promise<Buffer> {
	const found = await loadBrowserLib()
	if (!found) throw new Error('No browser library found. Install one: npm i playwright-core (and a Chromium) or puppeteer.')
	const seconds = clamp(opts.seconds ?? 6, 1, 20)
	const fps = clamp(opts.fps ?? 10, 2, 20)
	const needsGl = opts.webgl ?? /webgl|WebGLRenderer|three(\.module)?\.(min\.)?js|three@|getContext\(\s*['"](experimental-)?webgl/i.test(html)
	// software WebGL is slow, so 3D pages are recorded smaller
	const width = clamp(opts.width ?? (needsGl ? 360 : 540), 240, 1280)
	const height = clamp(opts.height ?? (needsGl ? 640 : 960), 240, 1920)
	const waitMs = clamp(opts.waitMs ?? 1500, 0, 10_000)
	const timeoutMs = clamp(opts.timeoutMs ?? 60_000, 10_000, 180_000)
	const ffmpeg = await resolveFfmpeg(opts.ffmpegPath)
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nyx-preview-'))
	const started = Date.now()
	const isPw = !!(found.lib.chromium ?? found.lib.default?.chromium)
	let browser: any
	try {
		const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
		// these flags make plain 2D pages ~50x slower, so only 3D pages get them
		if (needsGl) launchArgs.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist')
		if (isPw) {
			const chromium = found.lib.chromium ?? found.lib.default.chromium
			browser = await chromium.launch({ args: launchArgs, ...(opts.executablePath ? { executablePath: opts.executablePath } : {}) })
		} else {
			browser = await (found.lib.launch ?? found.lib.default.launch)({
				headless: true,
				args: launchArgs,
				...(opts.executablePath ? { executablePath: opts.executablePath } : {})
			})
		}

		const page: any = isPw ? await browser.newPage({ viewport: { width, height } }) : await browser.newPage()
		if (!isPw) await page.setViewport({ width, height })
		// block the page from reaching local / private network addresses
		if (isPw) {
			await page.route('**/*', (route: any) => (isBlockedUrl(route.request().url()) ? route.abort() : route.continue()))
		} else {
			await page.setRequestInterception(true)
			page.on('request', (req: any) => (isBlockedUrl(req.url()) ? req.abort() : req.continue()))
		}

		await page.setContent(html, { waitUntil: 'load', timeout: Math.min(30_000, timeoutMs) })
		if (waitMs) await new Promise(r => setTimeout(r, waitMs))

		// record: the page runs in real time, so measure how many frames we really got
		const frameGap = 1000 / fps
		let n = 0
		const t0 = Date.now()
		while (Date.now() - t0 < seconds * 1000 && Date.now() - started < timeoutMs) {
			const t = Date.now()
			const shot: Buffer = await page.screenshot({ type: 'jpeg', quality: 72 })
			await fs.writeFile(path.join(dir, `f${String(n++).padStart(5, '0')}.jpg`), shot)
			const spent = Date.now() - t
			if (spent < frameGap) await new Promise(r => setTimeout(r, frameGap - spent))
		}

		if (n < 2) throw new Error('The page could not be recorded (no frames).')
		// real speed = frames captured / real seconds, so playback is not sped up or slowed down
		const realFps = clamp(n / ((Date.now() - t0) / 1000), 1, 30)
		const out = path.join(dir, 'out.mp4')
		await run(
			ffmpeg,
			[
				'-y', '-loglevel', 'error',
				'-framerate', realFps.toFixed(2),
				'-i', path.join(dir, 'f%05d.jpg'),
				'-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
				'-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'veryfast',
				'-movflags', '+faststart', '-an', out
			],
			Math.max(20_000, timeoutMs)
		)
		return await fs.readFile(out)
	} finally {
		try {
			await browser?.close()
		} catch {}
		fs.rm(dir, { recursive: true, force: true }).catch(() => undefined)
	}
}
