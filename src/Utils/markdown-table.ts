/**
 * Markdown tables -> WhatsApp's native rich table (AI rich response).
 *
 * parseMarkdownTables(markdown)   splits a Markdown text into text and table parts
 * markdownToAIRichResponse(md)    builds the richResponseMessage that WhatsApp renders as real tables
 */
import { proto } from '../../WAProto/index.js'

export type MarkdownPart =
	| { type: 'text'; text: string }
	| { type: 'table'; title?: string; rows: { items: string[]; isHeading: boolean }[] }

export interface MarkdownTableOptions {
	/** title shown on the first table */
	title?: string
}

const SEPARATOR = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/

/** split one table row on unescaped pipes: "| a | b \| c |" -> ["a", "b | c"] */
const splitRow = (line: string): string[] => {
	let s = line.trim()
	if (s.startsWith('|')) s = s.slice(1)
	if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
	const cells: string[] = []
	let cur = ''
	for (let i = 0; i < s.length; i++) {
		const ch = s[i]!
		if (ch === '\\' && s[i + 1] === '|') {
			cur += '|'
			i++
		} else if (ch === '|') {
			cells.push(cur.trim())
			cur = ''
		} else {
			cur += ch
		}
	}

	cells.push(cur.trim())
	return cells
}

const looksLikeRow = (line: string) => line.includes('|') && line.trim().length > 0

export const parseMarkdownTables = (markdown: string, opts: MarkdownTableOptions = {}): MarkdownPart[] => {
	const lines = String(markdown ?? '')
		.replace(/\r\n?/g, '\n')
		.split('\n')
	const parts: MarkdownPart[] = []
	let text: string[] = []
	let first = true

	const flushText = () => {
		const t = text.join('\n').trim()
		if (t) parts.push({ type: 'text', text: t })
		text = []
	}

	let i = 0
	while (i < lines.length) {
		const line = lines[i]!
		const next = lines[i + 1]
		// a table = a header row followed by a separator row
		if (looksLikeRow(line) && next !== undefined && looksLikeRow(next) && SEPARATOR.test(next)) {
			const header = splitRow(line)
			const sepCols = splitRow(next).length
			if (sepCols !== header.length) {
				throw new Error(`Markdown table: the header has ${header.length} columns but the separator row has ${sepCols}.`)
			}

			const rows = [{ items: header, isHeading: true }]
			let j = i + 2
			while (j < lines.length && looksLikeRow(lines[j]!) && !SEPARATOR.test(lines[j]!)) {
				const cells = splitRow(lines[j]!)
				if (cells.length !== header.length) {
					throw new Error(`Markdown table: row ${rows.length} has ${cells.length} columns, expected ${header.length}.`)
				}

				rows.push({ items: cells, isHeading: false })
				j++
			}

			flushText()
			parts.push({ type: 'table', rows, ...(first && opts.title ? { title: opts.title } : {}) })
			first = false
			i = j
			continue
		}

		text.push(line)
		i++
	}

	flushText()
	return parts
}

/** the rich response message WhatsApp renders with native tables */
export const markdownToAIRichResponse = (markdown: string, opts: MarkdownTableOptions = {}) => {
	const parts = parseMarkdownTables(markdown, opts)
	if (!parts.some(p => p.type === 'table')) {
		throw new Error('No Markdown table found. Use a header row and a separator row (| --- | --- |).')
	}

	const submessages: proto.IAIRichResponseSubMessage[] = parts.map(p =>
		p.type === 'text'
			? {
					messageType: proto.AIRichResponseSubMessageType.AI_RICH_RESPONSE_TEXT,
					messageText: p.text
				}
			: {
					messageType: proto.AIRichResponseSubMessageType.AI_RICH_RESPONSE_TABLE,
					tableMetadata: { rows: p.rows, ...(p.title ? { title: p.title } : {}) }
				}
	)

	return {
		messageType: proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
		submessages
	} as proto.IAIRichResponseMessage
}
