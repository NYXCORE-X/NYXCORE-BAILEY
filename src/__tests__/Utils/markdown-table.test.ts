import { describe, expect, it } from '@jest/globals'
import { markdownToAIRichResponse, parseMarkdownTables } from '../../Utils/markdown-table'

const md = `Current plans:

| Plan | Storage | Price |
| --- | ---: | ---: |
| Basic | 10 GB | $5 |
| Pro | 100 GB | $15 |

Choose the plan that works for you.`

describe('markdown tables', () => {
	it('splits text and table parts', () => {
		const parts = parseMarkdownTables(md, { title: 'Plan comparison' })
		expect(parts.map(p => p.type)).toEqual(['text', 'table', 'text'])
		const table = parts[1] as any
		expect(table.title).toBe('Plan comparison')
		expect(table.rows).toHaveLength(3)
		expect(table.rows[0]).toEqual({ items: ['Plan', 'Storage', 'Price'], isHeading: true })
		expect(table.rows[2].items).toEqual(['Pro', '100 GB', '$15'])
	})

	it('handles several tables and only titles the first', () => {
		const parts = parseMarkdownTables('| a | b |\n|---|---|\n| 1 | 2 |\n\ntext\n\n| c |\n|---|\n| 3 |')
		const tables = parts.filter(p => p.type === 'table') as any[]
		expect(tables).toHaveLength(2)
		expect(tables[1].title).toBeUndefined()
	})

	it('keeps escaped pipes inside a cell', () => {
		const t = parseMarkdownTables('| a | b |\n| - | - |\n| x \\| y | z |')[0] as any
		expect(t.rows[1].items).toEqual(['x | y', 'z'])
	})

	it('rejects rows with the wrong number of columns', () => {
		expect(() => parseMarkdownTables('| a | b |\n| - | - |\n| 1 |')).toThrow(/expected 2/)
	})

	it('builds a rich response with text and table submessages', () => {
		const rich: any = markdownToAIRichResponse(md, { title: 'T' })
		expect(rich.submessages).toHaveLength(3)
		expect(rich.submessages[1].tableMetadata.rows).toHaveLength(3)
		expect(rich.submessages[0].messageText).toBe('Current plans:')
	})

	it('throws when there is no table', () => {
		expect(() => markdownToAIRichResponse('just text')).toThrow(/No Markdown table/)
	})
})
