// Builds the GitHub release title + notes for a tag from CHANGELOG.md.
// usage: node scripts/release-notes.mjs v1.6.3   (writes release-notes.md, sets `title` in $GITHUB_OUTPUT)
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

const tag = process.argv[2] || ''
const version = tag.replace(/^v/, '')
const changelog = readFileSync('CHANGELOG.md', 'utf8')
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const match = changelog.match(new RegExp(`^# ${escaped}\\b[^\\n]*\\n([\\s\\S]*?)(?=^# |(?![\\s\\S]))`, 'm'))

let body
let title = tag
if (match) {
	const bullets = match[1].trim()
	const first = bullets.split('\n').find(l => l.trim().startsWith('-')) || ''
	let headline = first
		.replace(/^\s*-\s*/, '')
		.replace(/^(feat|fix|docs|chore|perf|refactor|style|test)(\([^)]*\))?:\s*/i, '')
		.split(/[:(.]/)[0]
		.trim()
	if (headline.length > 60) headline = headline.slice(0, 57).trimEnd() + '...'
	if (headline) title = `${tag} - ${headline.charAt(0).toUpperCase()}${headline.slice(1)}`
	body = `${bullets}\n\n**Install:** \`npm i @nyxcore/nyxcorebailey@${version}\`\n`
} else {
	body = process.env.CONVENTIONAL || `Release ${tag}`
}

writeFileSync('release-notes.md', body)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `title=${title}\n`)
console.log(title)
console.log(body)
