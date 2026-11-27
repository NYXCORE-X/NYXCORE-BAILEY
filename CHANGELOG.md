# 1.6.3 (NYXCORE)

- fix: the npm / GitHub links now point to the real repository (NYXCORE-X/NYXCORE-BAILEY). `homepage`, `repository` (with type) and `bugs` were wrong, which also breaks npm provenance.
- feat: `sendArticleCard(..., { frame: true })` adds a framed header (title, subtitle, "Tap the card to read") above the link-preview card.
- chore: GitHub releases now get their title and notes from this file automatically.

# 1.6.2 (NYXCORE)

- feat: cooler text tables: rounded box frame, upper-case header, dotted row dividers, 📊 title.
- fix: `sendArticleCard` now sends a real link-preview card with your title, subtitle and image (the thumbnail is downloaded for you). The old external-ad card is still available with `style: 'ad'`.

# 1.6.1 (NYXCORE)

- fix: `markdownTable` now sends aligned monospace tables by default (works on every WhatsApp). The native rich table gave "your version of WhatsApp does not support it" on current WhatsApp, so it is now opt-in: `{ markdownTable, richTable: true }` (experimental).
- feat: `renderTextTables(markdown, { title })`; `parseMarkdownTables` now also returns column alignment (`align`).
- fix: article cards also send `mediaUrl` and `sourceType: 'URL'`.

# 1.6.0 (NYXCORE)

- feat: AI Markdown tables: `sock.sendMessage(jid, { markdownTable: md, tableTitle? })` turns Markdown pipe tables into WhatsApp's native rich table (text before / between / after the tables is kept; several tables; escaped pipes; every row must have the same number of columns).
- feat: `parseMarkdownTables(md, { title })` and `markdownToAIRichResponse(md, { title })` for lower-level control.
- feat: `sock.sendArticleCard(jid, { text?, title, body?, url?, thumbnailUrl?, mediaType?, renderLargerThumbnail?, showAdAttribution? })`: a tappable link / help-center style card (text message + contextInfo.externalAdReply).
- note: both are WhatsApp-only features, and WhatsApp decides the final look of the card / table.

# 1.5.4 (NYXCORE)

- fix: chat lock now uses the index WhatsApp really sends (`['lock', chatJid]`, captured from a real phone), instead of the guessed `lockChat`.
- fix: `app-state.mutation` now names the real action instead of always `timestamp`.

# 1.5.3 (NYXCORE)

- fix: chat tools (archive, pin, lock, clear...) wrongly said the app-state key was missing on sockets without `getAppStateSyncKey` (e.g. the nyxcoresocket package). The key is now read from the auth state, and the phone is asked through `relayMessage`.

# 1.5.2 (NYXCORE)

- feat: new event `app-state.mutation` ({ index, action, value, version }): every app-state change from the phone, raw. Lets you see exactly what WhatsApp sends for things like chat lock.

# 1.5.1 (NYXCORE)

- fix: chat tools (archive, lock, clear, pin, mute, mark read) no longer fail straight away with `myAppStateKey ("...") not present`: they ask your phone for the key, wait up to 30 s (`makeChatTools(sock, { keyWaitMs })`) and then continue, or fail with a clear message

# 1.5.0 (NYXCORE)

- feat: cleaner modules: the helpers are now small files in `src/Socket/nyx/` (pairing, channels, status, groupStatus, stickerPack, chats, presence, html). `makeNyxHelpers(sock)` still returns everything, nothing was renamed.
- feat: chat tools: `archiveChat`, `unarchiveChat`, `lockChat`, `unlockChat`, `clearChat`, `deleteChat`, `pinChat`, `unpinChat`, `muteChat`, `unmuteChat`, `markChatRead`, `markChatUnread`. Archive / clear / read no longer need you to find the last message first.
- feat: `setDisappearing(jid, 'off' | '24h' | '7d' | '90d' | seconds)` works for private chats and groups
- feat: `pinMessage(jid, key, seconds?)` and `unpinMessage(jid, key)`
- feat: `chatModify({ lock: true | false }, jid)` (chat lock)
- feat: `postGroupTextStatus` / `postGroupMediaStatus` and `sendStickerPack` shortcuts

# 1.4.0 (NYXCORE)
- feat: `keepPresence('online' | 'offline', { intervalMs, settleMs })` in the helpers: keeps the account showing online (always online) or offline (always offline, re-applied right after every incoming message). Returns `{ set(mode), stop(), mode }`.
- feat: `useNyxAuthState(folder)`: drop-in for useMultiFileAuthState with atomic writes, damaged files quarantined (`*.corrupt`) instead of lost, and automatic recovery of creds.json from `creds.json.bak`. Stops the "failed to decrypt / Bad MAC" storms that follow a crash or restart in the middle of a write.
- feat: `exportSessionBackup(folder, password?)` and `importSessionBackup(buffer, folder, password?)`: one-file session backup (gzip, AES-256-GCM when a password is given) and restore

# 1.3.1 (NYXCORE)

- feat: sharper, smoother HTML previews: recorded at 2x pixel density, 20 fps, 720px wide output
- feat: uses the browser's screencast (a frame every real change, exact timing), with the old screenshot loop as fallback
- feat: new options `quality` ('low' | 'medium' | 'high'), `scale` (1-3) and `outputWidth`
- feat: phone-sized default viewport (390x844); better encoding (lanczos scaling, CRF 21, medium preset)

# 1.3.0 (NYXCORE)

- feat: `renderHtmlPreview(html, opts)` records an HTML page in a headless browser and returns an mp4 (needs playwright/puppeteer + ffmpeg, all optional)
- feat: `canRenderHtmlPreview()` checks the machine first
- feat: `sock.sendHtmlPage(jid, html, opts)` sends an animated preview + the file, or just the file when no browser exists
- security: the recorded page cannot reach localhost or private network addresses
- 3D (WebGL) pages are detected and recorded in software mode (smaller, slower)

# 1.2.0 (NYXCORE)

- feat: `sock.sendHtmlFile(jid, html, fileName, { caption, quoted })` sends an HTML page as a proper file
- feat: `sock.sendAnimatedPreview(jid, mp4, { caption, quoted })` sends a looping GIF-style preview
- feat: `sock.sendHtmlWithPreview(jid, html, mp4, opts)` sends the preview and then the file

# 1.1.0 (NYXCORE)

- feat: `sock.safePairingCode(phone, opts)` waits for the socket, retries, returns `{ code, formatted }`
- feat: `makeResilientSocket(config, { onSocket, onGiveUp })` auto reconnect with backoff (515 reconnects at once; 401/440/403 stop)
- feat: channel helpers `followChannel` (jid, link or invite code), `unfollowChannel`, `reactToChannelPost`
- feat: status helpers `postTextStatus`, `postMediaStatus`, `viewStatus`, `reactToStatus`
- feat: exports `normalizePhone`, `formatPairingCode`, `parseChannelInvite`, `backoffDelay`

# 7.0.0-rc14 (2026-07-29)



