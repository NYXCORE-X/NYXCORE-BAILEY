/**
 * Channels (newsletters): follow, unfollow and react.
 */
import { type AnySock, parseChannelInvite } from './shared'

export const makeChannels = (sock: AnySock) => {
	// ── newsletter / channel shortcuts ──
	/** Follow a channel from a jid (…@newsletter), a channel link, or an invite code. */
	const followChannel = async (target: string) => {
		let jid = String(target).trim()
		if (!jid.endsWith('@newsletter')) {
			const meta = await sock.newsletterMetadata('invite', parseChannelInvite(jid))
			if (!meta?.id) throw new Error('Channel not found.')
			jid = meta.id
		}

		await sock.newsletterFollow(jid)
		return jid
	}

	const unfollowChannel = async (jid: string) => sock.newsletterUnfollow(jid)

	/** React to a channel post. serverId is the post's server id; emoji empty removes the reaction. */
	const reactToChannelPost = async (jid: string, serverId: string, emoji?: string) =>
		sock.newsletterReactMessage(jid, String(serverId), emoji)

	return {
		followChannel,
		unfollowChannel,
		reactToChannelPost
	}
}
