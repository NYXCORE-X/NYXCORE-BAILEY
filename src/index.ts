import makeWASocket from './Socket/index'

export * from '../WAProto/index.js'
export * from './Utils/index'
export * from './Types/index'
export * from './Defaults/index'
export * from './WABinary/index'
export * from './WAM/index'
export * from './WAUSync/index'

export {
	disappearingSeconds,
	formatPairingCode,
	makeNyxHelpers,
	normalizePhone,
	parseChannelInvite
} from './Socket/nyx-helpers'
export type { DisappearingDuration, NyxHelpers } from './Socket/nyx-helpers'
export { makeResilientSocket, backoffDelay } from './Socket/nyx-resilient'
export type WASocket = ReturnType<typeof makeWASocket>
export { makeWASocket }
export default makeWASocket
