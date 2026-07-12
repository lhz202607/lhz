import { assignRoles, startRound, generateAllArtifacts } from '../../../shared/engine'
import { roomManager } from '../modules/game/roomManager'
import { runAIAction } from '../modules/game/ai'
import { RoleId } from '../../../shared/types'

describe('行动顺序：下轮首位跟随本轮实际末位 + AI 不跳过 blocked', () => {
  function setup(roles: RoleId[], blockRole?: RoleId) {
    const room = roomManager.createRoom('host', roles.length)
    while (room.players.length < roles.length) room.players.push({
      id: 'p_' + Math.random().toString(36).slice(2, 10),
      name: 'P' + room.players.length, isHost: false, isAI: true, connected: true,
      seatNumber: 0, betArtifactIds: [], remainingVotes: 0,
    })
    assignRoles(room)
    room.players.forEach((p, i) => { (p as any).role = roles[i] })
    room.game.playerRoundStates = {}
    room.game.skipRoundsMap = {}
    if (blockRole) {
      const p = room.players.find(pl => pl.role === blockRole)!
      room.game.skipRoundsMap[p.id] = 1
    }
    return room
  }

  it('问题1：下一轮首位 = 上一轮 actualOrder 末位', () => {
    const roles: RoleId[] = ['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'muhujianai', 'laochaofeng', 'zhengguoqu', 'jiyunfu']
    const room = setup(roles)
    const arts = generateAllArtifacts()
    const used = new Set<number>()
    startRound(room, 1, arts, used)
    const r1 = room.game.rounds[0]
    // 用严格顺序走完第一轮（模拟真实传递）
    let cur: string | undefined = r1.currentAppraiserId
    let guard = 0
    while (cur && guard < 30) {
      guard++
      const order = r1.appraiseOrder
      const idx = order.indexOf(cur)
      let nextId: string | undefined
      for (let k = 1; k <= order.length; k++) {
        const c = order[(idx + k) % order.length]
        if (!r1.finishedAppraisers.includes(c)) { nextId = c; break }
      }
      if (!nextId) break
      // 直接调用引擎内部 pass（等价于 ai 新逻辑）
      const eng = require('../../../shared/engine')
      eng.passAppraiseTurn(room, cur, nextId)
      cur = r1.currentAppraiserId
      if (!cur) break
    }
    const lastOfR1 = r1.actualOrder[r1.actualOrder.length - 1]
    // 开始第二轮
    startRound(room, 2, arts, used)
    const r2 = room.game.rounds[1]
    expect(r2.currentAppraiserId).toBe(lastOfR1)
    expect(r2.appraiseOrder[0]).toBe(lastOfR1)
  })

  it('问题2：AI 当前行动者把回合传给顺序下一位（被随机封锁的人类），不跳过、人类轮到', () => {
    const roles: RoleId[] = ['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'muhujianai', 'laochaofeng', 'zhengguoqu', 'jiyunfu']
    const room = setup(roles, 'muhujianai') // 木户加奈第1轮被封锁
    const arts = generateAllArtifacts()
    const used = new Set<number>()
    startRound(room, 1, arts, used)
    const r1 = room.game.rounds[0]
    const blocked = room.players.find(p => p.role === 'muhujianai')!
    const blockedIdx = r1.appraiseOrder.indexOf(blocked.id)
    // 找 blocked 的"顺序前一位"作为当前 AI 行动者
    const prevId = r1.appraiseOrder[(blockedIdx - 1 + r1.appraiseOrder.length) % r1.appraiseOrder.length]
    const prevPlayer = room.players.find(p => p.id === prevId)!
    prevPlayer.isAI = true
    blocked.isAI = false // 木户是人类
    r1.currentAppraiserId = prevId

    runAIAction(room.code)
    // AI 应把回合传给顺序下一位 = 木户（blocked），而非跳过
    expect(r1.currentAppraiserId).toBe(blocked.id)
    expect(r1.finishedAppraisers.includes(blocked.id)).toBe(false)
  })

  it('问题1：AI 是最后一位行动者时，能正常结束本轮（不传给自己卡死）', () => {
    const roles: RoleId[] = ['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'muhujianai', 'laochaofeng', 'zhengguoqu', 'jiyunfu']
    const room = setup(roles)
    const arts = generateAllArtifacts()
    const used = new Set<number>()
    startRound(room, 1, arts, used)
    const r1 = room.game.rounds[0]
    // 让前 7 位全部 finished，仅留最后一位（顺序末位）为未 finished 的 AI
    const last = r1.appraiseOrder[r1.appraiseOrder.length - 1]
    r1.appraiseOrder.forEach(id => { if (id !== last) r1.finishedAppraisers.push(id) })
    const lastPlayer = room.players.find(p => p.id === last)!
    lastPlayer.isAI = true
    r1.currentAppraiserId = last
    runAIAction(room.code)
    // 本轮应结束，进入讨论
    expect(room.game.phase).toBe('discuss')
    expect(r1.finishedAppraisers.includes(last)).toBe(true)
    expect(r1.currentAppraiserId).toBeUndefined()
  })
})
