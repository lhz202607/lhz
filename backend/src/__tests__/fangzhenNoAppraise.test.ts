// 验证：方震（appraiseCount=0，未封印）在鉴宝阶段必须"轮到自己"发动验人技能，
// 不能被当作"角色无法鉴宝"自动跳过。
import {
  createRoom, createAIPlayer, assignRoles, startRound, generateAllArtifacts,
  passAppraiseTurn, canAppraise, fangzhenCheck,
} from '../../../shared/engine'
import { Room, RoleId } from '../../../shared/types'

// 固定角色：fangzhen 处于 index 2（行动顺序中间，非首尾），前面是 xuyuan/yaoburan
const roles: RoleId[] = ['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'muhujianai', 'zhengguoqu', 'laochaofeng']

function setupRoom() {
  const room = createRoom('房主', roles.length)
  while (room.players.length < roles.length) room.players.push(createAIPlayer())
  assignRoles(room)
  room.players.forEach((p, i) => { (p as any).role = roles[i] })
  room.game.playerRoundStates = {}
  const all = new Set<number>()
  const artifacts = generateAllArtifacts()
  startRound(room, 1, artifacts, all)
  const round = room.game.rounds[0]
  round.appraiseOrder = room.players.map(p => p.id)
  round.currentAppraiserId = room.players[0].id
  round.finishedAppraisers = []
  round.actualOrder = [room.players[0].id]
  return { room, round }
}

describe('方震（无鉴宝能力但有验人技能）未被封印时不自动跳过', () => {
  it('方震处于行动顺序中间（未封印）时，上家传给他应轮到他，而非跳过', () => {
    const { room, round } = setupRoom()
    const fz = room.players.find(p => p.role === 'fangzhen')!
    const x1 = room.players.find(p => p.role === 'xuyuan')!
    const yb = room.players.find(p => p.role === 'yaoburan')!

    // xuyuan -> yaoburan -> fangzhen（方震未封印）
    passAppraiseTurn(room, x1.id, yb.id)
    const res = passAppraiseTurn(room, yb.id, fz.id)
    expect(res.ok).toBe(true)
    expect(round.currentAppraiserId).toBe(fz.id) // 轮到方震，未跳过
    expect(round.finishedAppraisers.includes(fz.id)).toBe(false) // 需手动结束
    const check = canAppraise(room, fz.id)
    expect(check.can).toBe(false)
    expect(check.reason).toBe('本角色不鉴宝')
    // 方震未被当作"已封印/心神不宁/次数用尽"以外的情形跳过，actualOrder 含他
    expect(round.actualOrder.includes(fz.id)).toBe(true)
  })

  it('方震被轮到后可发动验人技能并结束回合传给下一位', () => {
    const { room, round } = setupRoom()
    const fz = room.players.find(p => p.role === 'fangzhen')!
    const x1 = room.players.find(p => p.role === 'xuyuan')!
    const yb = room.players.find(p => p.role === 'yaoburan')!
    const hyy = room.players.find(p => p.role === 'huangyanyan')!

    passAppraiseTurn(room, x1.id, yb.id)
    passAppraiseTurn(room, yb.id, fz.id)
    expect(round.currentAppraiserId).toBe(fz.id)

    // 方震发动验人技能（明察秋毫）
    const r = fangzhenCheck(room, fz.id, hyy.id)
    expect(r.ok).toBe(true)

    // 结束回合，传给下一位
    const res = passAppraiseTurn(room, fz.id, hyy.id)
    expect(res.ok).toBe(true)
    expect(round.currentAppraiserId).toBe(hyy.id)
    expect(round.finishedAppraisers.includes(fz.id)).toBe(true)
  })

  it('整轮严格按 appraiseOrder 流转，方震出现在 actualOrder 中间而非消失/末尾', () => {
    const { room, round } = setupRoom()
    const fz = room.players.find(p => p.role === 'fangzhen')!
    let guard = 0
    while (round.currentAppraiserId && !round.finishedAppraisers.includes(round.currentAppraiserId) && guard < 50) {
      const cur = round.currentAppraiserId
      const curIdx = round.appraiseOrder.indexOf(cur)
      let nextId: string | undefined
      for (let k = 1; k <= round.appraiseOrder.length; k++) {
        const cand = round.appraiseOrder[(curIdx + k) % round.appraiseOrder.length]
        if (cand !== cur && !round.finishedAppraisers.includes(cand)) { nextId = cand; break }
      }
      if (!nextId) break
      const res = passAppraiseTurn(room, cur, nextId)
      expect(res.ok).toBe(true)
      guard++
    }
    // 方震轮到过，且在 actualOrder 中间
    expect(round.actualOrder.includes(fz.id)).toBe(true)
    expect(round.actualOrder.indexOf(fz.id)).toBeGreaterThan(0)
    expect(round.actualOrder.indexOf(fz.id)).toBeLessThan(round.actualOrder.length - 1)
    expect(round.finishedAppraisers.includes(fz.id)).toBe(true)
  })
})
