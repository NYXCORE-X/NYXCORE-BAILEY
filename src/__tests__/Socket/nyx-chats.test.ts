import { describe, expect, it, jest } from '@jest/globals'
import { disappearingSeconds, makeChatTools } from '../../Socket/nyx/chats'
import { chatModificationToAppPatch } from '../../Utils/chat-utils'
describe('nyx chat tools', () => {
	const make = () => {
		const calls: any[] = []
		const sock = {
			chatModify: jest.fn(async (mod: any, jid: string) => void calls.push(['chatModify', mod, jid])),
			sendMessage: jest.fn(async (jid: string, content: any) => void calls.push(['sendMessage', jid, content])),
			groupToggleEphemeral: jest.fn(async (jid: string, s: number) => void calls.push(['groupToggleEphemeral', jid, s]))
		}
		return { sock, calls, tools: makeChatTools(sock) }
	}

	it('archives and unarchives with an "up to now" range by default', async () => {
		const { calls, tools } = make()
		await tools.archiveChat('1@s.whatsapp.net')
		await tools.unarchiveChat('1@s.whatsapp.net')
		expect(calls[0][1].archive).toBe(true)
		expect(calls[0][1].lastMessages.lastMessageTimestamp).toBeGreaterThan(1_700_000_000)
		expect(calls[1][1].archive).toBe(false)
	})

	it('locks, clears and pins chats', async () => {
		const { calls, tools } = make()
		await tools.lockChat('1@s.whatsapp.net')
		await tools.unlockChat('1@s.whatsapp.net')
		await tools.clearChat('1@s.whatsapp.net')
		await tools.pinChat('1@s.whatsapp.net')
		expect(calls[0][1]).toEqual({ lock: true })
		expect(calls[1][1]).toEqual({ lock: false })
		expect(calls[2][1].clear).toBe(true)
		expect(calls[3][1]).toEqual({ pin: true })
	})

	it('sets disappearing messages in private chats and groups', async () => {
		const { calls, tools } = make()
		await tools.setDisappearing('1@s.whatsapp.net', '7d')
		await tools.setDisappearing('1@s.whatsapp.net', 'off')
		await tools.setDisappearing('123@g.us', '24h')
		expect(calls[0]).toEqual(['sendMessage', '1@s.whatsapp.net', { disappearingMessagesInChat: 604800 }])
		expect(calls[1]).toEqual(['sendMessage', '1@s.whatsapp.net', { disappearingMessagesInChat: 0 }])
		expect(calls[2]).toEqual(['groupToggleEphemeral', '123@g.us', 86400])
		expect(() => disappearingSeconds('soon' as any)).toThrow()
	})

	it('pins and unpins a message', async () => {
		const { calls, tools } = make()
		const key = { remoteJid: '1@s.whatsapp.net', id: 'ABC', fromMe: true }
		await tools.pinMessage('1@s.whatsapp.net', key)
		await tools.unpinMessage('1@s.whatsapp.net', key)
		expect(calls[0][2]).toEqual({ pin: key, type: 1, time: 604800 })
		expect(calls[1][2]).toEqual({ pin: key, type: 2 })
	})
})

describe('chatModify lock', () => {
	it('builds a lockChat app state patch', () => {
		const patch = chatModificationToAppPatch({ lock: true }, '1@s.whatsapp.net')
		expect(patch.index).toEqual(['lockChat', '1@s.whatsapp.net'])
		expect(patch.syncAction.lockChatAction).toEqual({ locked: true })
	})
})
