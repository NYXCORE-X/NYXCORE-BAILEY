<div align="center">

# NYXCORE Baileys

**A WhatsApp Web library for Node.js, built for bots that need to do more.**

`@nyxcore/nyxcorebailey` · TypeScript · WebSocket (no browser) · MIT

</div>

Everything in standard Baileys 7 (`makeWASocket`, `sock.ev`, `sendMessage`, groups, newsletters…) works the same, plus the things bot builders keep rewriting by hand.

## Install

```bash
npm install @nyxcore/nyxcorebailey
```

## Quick start

```js
const { default: makeWASocket, useMultiFileAuthState } = require('@nyxcore/nyxcorebailey')

const { state, saveCreds } = await useMultiFileAuthState('./session')
const sock = makeWASocket({
  auth: state,
  secretStore: { path: './session/message-secrets.jsonl' }, // keeps edit / poll decryption working across restarts
})
sock.ev.on('creds.update', saveCreds)
```

Node 20+. `ffmpeg` and `sharp` are optional.

## What's new

| Area | You get |
|---|---|
| **Decryption** | Edits and poll votes decrypted for you: `messages.edit`, `poll.vote` |
| **Sending** | Group status, status, albums, sticker packs, events, queued / bulk sending |
| **Buttons** | Native-flow buttons that show for **everyone** |
| **Bots & games** | `waitForMessage / Reply / Button / Reaction`, `animate`, `typewriter`, `countdown` |
| **Chat tools** | Archive, lock, clear, delete, pin, mute, disappearing messages |
| **Rich messages** | Markdown tables, tappable article cards |
| **Reliability** | App-state key repair, `deleteForMe`, `diagnose()`, session backup |
| **Presence** | `keepPresence`: always online or always offline |

## Examples

```js
// album, group status, event
await sock.sendAlbum(jid, [{ image: a, caption: '1' }, { image: b }])
await sock.sendGroupStatus(groupJid, { image: buf, caption: 'Hi' })
await sock.sendEvent(jid, { name: 'Game night', start: new Date(Date.now() + 864e5) })

// Markdown table from an AI answer, as an aligned table
await sock.sendMessage(jid, { markdownTable: '| Plan | Price |\n| --- | --- |\n| Pro | $15 |' })

// tappable article card with a framed header
await sock.sendArticleCard(jid, { title: 'How it works', body: 'Help Center', url: 'https://example.com', frame: true })

// lock a chat
await sock.lockChat(jid)
```

## Copy-paste cheat sheet

<details>
<summary>📋 Open, then use the copy icon on the code block</summary>

```js
// npm install @nyxcore/nyxcorebailey
const { default: makeWASocket, useMultiFileAuthState } = require('@nyxcore/nyxcorebailey')

const { state, saveCreds } = await useMultiFileAuthState('./session')
const sock = makeWASocket({ auth: state, secretStore: { path: './session/message-secrets.jsonl' } })
sock.ev.on('creds.update', saveCreds)

sock.ev.on('messages.upsert', async ({ messages }) => {
  const m = messages[0]
  if (!m.message || m.key.fromMe) return
  await sock.sendMessage(m.key.remoteJid, { text: 'Hello from NYXCORE' }, { quoted: m })
})
sock.ev.on('messages.edit', e => console.log('edited', e))
sock.ev.on('poll.vote', v => console.log('vote', v))
```

</details>

## Full documentation

- 📖 [Full README and API reference](https://github.com/NYXCORE-X/NYXCORE-BAILEY/blob/master/docs/FULL.md)
- 🧾 [Changelog](https://github.com/NYXCORE-X/NYXCORE-BAILEY/blob/master/CHANGELOG.md)
- 🐛 [Report a problem](https://github.com/NYXCORE-X/NYXCORE-BAILEY/issues)

Not affiliated with or endorsed by WhatsApp. Use it responsibly: no spam, no bulk unsolicited messaging. Built on the open-source [Baileys](https://github.com/WhiskeySockets/Baileys) protocol work (MIT, see [LICENSE](https://github.com/NYXCORE-X/NYXCORE-BAILEY/blob/master/LICENSE)).
