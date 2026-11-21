# 1.1.0 (NYXCORE)

- feat: `sock.safePairingCode(phone, opts)` waits for the socket, retries, returns `{ code, formatted }`
- feat: `makeResilientSocket(config, { onSocket, onGiveUp })` auto reconnect with backoff (515 reconnects at once; 401/440/403 stop)
- feat: channel helpers `followChannel` (jid, link or invite code), `unfollowChannel`, `reactToChannelPost`
- feat: status helpers `postTextStatus`, `postMediaStatus`, `viewStatus`, `reactToStatus`
- feat: exports `normalizePhone`, `formatPairingCode`, `parseChannelInvite`, `backoffDelay`

# 7.0.0-rc14 (2026-07-29)



