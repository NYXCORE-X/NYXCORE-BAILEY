/**
 * NYXCORE helpers: one object with everything extra, built from small modules in ./nyx:
 *   pairing      safePairingCode
 *   channels     followChannel, unfollowChannel, reactToChannelPost
 *   status       postTextStatus, postMediaStatus, viewStatus, reactToStatus
 *   groupStatus  postGroupTextStatus, postGroupMediaStatus
 *   stickerPack  sendStickerPack
 *   chats        archiveChat, unarchiveChat, lockChat, unlockChat, clearChat, deleteChat, pinChat, unpinChat,
 *                muteChat, unmuteChat, markChatRead, markChatUnread, setDisappearing, pinMessage, unpinMessage
 *   presence     keepPresence (always online / always offline)
 *   html         sendHtmlFile, sendAnimatedPreview, sendHtmlWithPreview, sendHtmlPage,
 *                renderHtmlPreview, canRenderHtmlPreview
 *
 * Everything here only calls methods that already exist on the socket, so it
 * cannot change the behaviour of the core protocol code.
 */
import { canRenderHtmlPreview, renderHtmlPreview } from '../Utils/html-preview'
import { makeChannels } from './nyx/channels'
import { makeChatTools } from './nyx/chats'
import { makeGroupStatus } from './nyx/groupStatus'
import { makeHtml } from './nyx/html'
import { makePairing } from './nyx/pairing'
import { makePresence } from './nyx/presence'
import { type AnySock, formatPairingCode, normalizePhone, parseChannelInvite } from './nyx/shared'
import { makeStatus } from './nyx/status'
import { makeStickerPack } from './nyx/stickerPack'

export { formatPairingCode, normalizePhone, parseChannelInvite }
export type { SafePairingOptions } from './nyx/shared'
export type { DisappearingDuration } from './nyx/chats'
export { disappearingSeconds } from './nyx/chats'

export const makeNyxHelpers = (sock: AnySock) => ({
	...makePairing(sock),
	...makeChannels(sock),
	...makeStatus(sock),
	...makeGroupStatus(sock),
	...makeStickerPack(sock),
	...makeChatTools(sock),
	...makePresence(sock),
	...makeHtml(sock),
	renderHtmlPreview,
	canRenderHtmlPreview
})

export type NyxHelpers = ReturnType<typeof makeNyxHelpers>
