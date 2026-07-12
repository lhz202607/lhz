import {
  createRoom, createAIPlayer, assignRoles, startRound, generateAllArtifacts,
  passAppraiseTurn, canAppraise, appraise, yaoburanSeal,
} from '../../../shared/engine'
import { Room, RoleId } from '../../../shared/types'

// 建房间并用固定角色覆盖，便于断言具体角色的座次
function setupRoom(roles: RoleId[]) {
  const room = createRoom('房主', roles.length)
  while (room.players.length < roles.length) room.players.push(createAIPlayer())
  assignRoles(room)
  room.players.forEach((p, i) => { (p as any).role = roles[i] })
  room.game.playerRoundStates = {}
  const artifacts = generateAllArtifacts()
  return { room, artifacts }
}

// 把本轮 appraiseOrder 强制为指定顺序（让封印目标处于中间）
function forceOrder(room: Room, order: string[]) {
  const round = room.game.rounds[room.game.currentRound - 1]
  round.appraiseOrder = order
  round.currentAppraiserId = order[0]
  round.finishedAppraisers = []
  round.actualOrder = [order[0]]
}

// 固定角色顺序表：fangzhen 始终处于 index 2（中间，非首尾），且排在 yaoburan(index1) 之后
const roles: RoleId[] = ['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'muhujianai', 'zhengguoqu', 'laochaofeng']

describe('封印玩家位于行动顺序中间：完整链路不被自动跳过', () => {
  it('封印目标在 appraiseOrder 中间位置，轮到他时必须手动结束，且 actualOrder 中他处于中间而非末尾/消失', () => {
    const { room, artifacts } = setupRoom(roles)
    const all = new Set<number>()
    startRound(room, 1, artifacts, all)
    const sealer = room.players.find(p => p.role === 'yaoburan')!
    const target = room.players.find(p => p.role === 'fangzhen')! // 被封印者，index 2（中间）
    const round = room.game.rounds[0]

    // 必须先固定顺序，再封印（封印判定依赖 appraiseOrder 前置/后置关系）
    forceOrder(room, room.players.map(p => p.id))
    expect(round.appraiseOrder.indexOf(target.id)).toBeGreaterThan(0)
    expect(round.appraiseOrder.indexOf(target.id)).toBeLessThan(round.appraiseOrder.length - 1)

    // 药不然封印方震（方震在药不然之后=后置位，本轮立即封印）
    const sealRes = yaoburanSeal(room, sealer.id, target.id)
    expect(sealRes.ok).toBe(true)
    expect(sealRes.delayed).toBeFalsy()
    expect(room.game.playerRoundStates[target.id][1].sealed).toBe(true)

    // 正常传递前两位（xuyuan -> yaoburan），轮到封印者方震（index 2）
    const appraisers = [0, 1] // xuyuan, yaoburan
    for (let i = 0; i < appraisers.length; i++) {
      const cur = room.players[appraisers[i]].id
      const nxt = room.players[appraisers[i] + 1].id
      appraise(room, cur, round.artifacts[0].id)
      const res = passAppraiseTurn(room, cur, nxt)
      expect(res.ok).toBe(true)
      expect(round.currentAppraiserId).toBe(nxt)
    }

    // 现在轮到被封印的方震：引擎必须"轮到他"，不能自动跳过
    expect(round.currentAppraiserId).toBe(target.id)
    expect(round.finishedAppraisers.includes(target.id)).toBe(false) // 尚未结束
    const check = canAppraise(room, target.id)
    expect(check.can).toBe(false)
    expect(check.reason).toContain('已被封印')
    // 封印玩家无法鉴宝
    const appRes = appraise(room, target.id, round.artifacts[0].id)
    expect((appRes as any).error).toBeDefined()

    // 方震手动结束回合，传给下一位（muhujianai）
    const next = room.players[4].id
    const res2 = passAppraiseTurn(room, target.id, next)
    expect(res2.ok).toBe(true)
    expect(round.currentAppraiserId).toBe(next)
    expect(round.finishedAppraisers.includes(target.id)).toBe(true)

    // actualOrder 必须包含方震，且处于中间（在前三位之后、muhujianai 之前），不排到末尾
    expect(round.actualOrder.includes(target.id)).toBe(true)
    const idxTarget = round.actualOrder.indexOf(target.id)
    const idxNext = round.actualOrder.indexOf(next)
    expect(idxTarget).toBeGreaterThan(0)
    expect(idxTarget).toBeLessThan(idxNext)
  })

  it('封印目标在中间：走完整轮，actualOrder 反映真实动态顺序（封印者不跳、不丢）', () => {
    const { room, artifacts } = setupRoom(roles)
    const all = new Set<number>()
    startRound(room, 1, artifacts, all)
    const sealer = room.players.find(p => p.role === 'yaoburan')!
    const target = room.players.find(p => p.role === 'fangzhen')!
    const round = room.game.rounds[0]

    forceOrder(room, room.players.map(p => p.id))
    yaoburanSeal(room, sealer.id, target.id)
    expect(room.game.playerRoundStates[target.id][1].sealed).toBe(true)

    const n = room.players.length
    let guard = 0
    // 严格按 appraiseOrder 相邻顺序传递（模拟真人/AI 行为），封印者也要轮到
    while (round.currentAppraiserId && !round.finishedAppraisers.includes(round.currentAppraiserId) && guard < 50) {
      guard++
      const cur = round.currentAppraiserId
      const curIdx = round.appraiseOrder.indexOf(cur)
      let nextId: string | undefined
      for (let k = 1; k <= round.appraiseOrder.length; k++) {
        const cand = round.appraiseOrder[(curIdx + k) % round.appraiseOrder.length]
        if (!round.finishedAppraisers.includes(cand)) { nextId = cand; break }
      }
      if (!nextId) break
      if (nextId === cur) break // 自己是唯一未完成的，应等待引擎自动进入发言，不传给自己
      const c = canAppraise(room, cur)
      if (c.can && c.count > 0) appraise(room, cur, round.artifacts[0].id)
      const res = passAppraiseTurn(room, cur, nextId)
      expect(res.ok).toBe(true)
    }

    // 每位玩家都应"轮到过"（出现在 actualOrder 中），证明封印者未被自动跳过/丢失
    room.players.forEach(p => {
      expect(round.actualOrder.includes(p.id)).toBe(true)
    })
    expect(round.actualOrder.length).toBe(n)
    // sealed 目标应位于 actualOrder 中间（index 2），既非首位也非末位
    expect(round.actualOrder.indexOf(target.id)).toBe(2)
  })

  it('AI 严格顺序传递：药不然把回合传给相邻下一位封印玩家（fangzhen），封印者会轮到自己', () => {
    const { room, artifacts } = setupRoom(roles)
    const all = new Set<number>()
    startRound(room, 1, artifacts, all)
    const sealer = room.players.find(p => p.role === 'yaoburan')!
    const target = room.players.find(p => p.role === 'fangzhen')! // yaoburan 的相邻下一位
    const round = room.game.rounds[0]

    forceOrder(room, room.players.map(p => p.id))
    yaoburanSeal(room, sealer.id, target.id)
    expect(room.game.playerRoundStates[target.id][1].sealed).toBe(true)

    // 先由首位（xuyuan）把回合严格传给相邻下一位 = 药不然（成为当前行动者）
    const res0 = passAppraiseTurn(room, room.players[0].id, sealer.id)
    expect(res0.ok).toBe(true)
    expect(round.currentAppraiserId).toBe(sealer.id)
    // 药不然（严格顺序）传给相邻下一位 = 方震(index2，封印）
    const res = passAppraiseTurn(room, sealer.id, target.id)
    expect(res.ok).toBe(true)
    expect(round.currentAppraiserId).toBe(target.id) // AI 严格传给了封印者，未跳过
    expect(round.finishedAppraisers.includes(target.id)).toBe(false) // 需其手动结束
    // 此时方震轮到自己，无法鉴宝
    expect(canAppraise(room, target.id).can).toBe(false)
  })
})
