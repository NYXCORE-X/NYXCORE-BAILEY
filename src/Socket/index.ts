import { DEFAULT_CONNECTION_CONFIG } from '../Defaults'
import type { UserFacingSocketConfig } from '../Types'
import { makeCommunitiesSocket } from './communities'
import { makeNyxHelpers } from './nyx-helpers'

// export the last socket layer
const makeWASocket = (config: UserFacingSocketConfig) => {
	const newConfig = {
		...DEFAULT_CONNECTION_CONFIG,
		...config
	}

	const sock = makeCommunitiesSocket(newConfig)
	return Object.assign(sock, makeNyxHelpers(sock))
}

export default makeWASocket
