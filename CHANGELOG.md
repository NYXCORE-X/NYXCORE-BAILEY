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



