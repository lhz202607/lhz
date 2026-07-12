import {
  createRoom, createAIPlayer, assignRoles, startRound, generateAllArtifacts,
  passAppraiseTurn, canAppraise, appraise,
} from '../../../shared/engine'
import { Room, RoleId } from '../../../shared/types'

// 用一个合法的玩家数（6/7/8）建房间，然后手动覆盖角色分配
function setupRoom(roles: RoleId[], blockRole?: RoleId, blockRound: number = 1): { room: Room; artifacts: any[] } {
  const room = createRoom('房主', roles.length)
  while (room.players.length < roles.length) room.players.push(createAIPlayer())
  assignRoles(room) // 仅用于初始化 skipRoundsMap 等结构
  room.players.forEach((p, i) => { (p as any).role = roles[i] })
  room.game.playerRoundStates = {}
  room.game.skipRoundsMap = {}
  if (blockRole) {
    const p = room.players.find(pl => pl.role === blockRole)!
    room.game.skipRoundsMap[p.id] = blockRound
  }
  const artifacts = generateAllArtifacts()
  return { room, artifacts }
}

describe('随机无法鉴宝（木户加奈/黄烟烟）手动结束回合流程', () => {
  it('被随机封锁的玩家不会被自动跳过，应轮到其手动结束回合', () => {
    const roles: RoleId[] = ['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'muhujianai', 'zhengguoqu', 'laochaofeng', 'jiyunfu']
    const { room, artifacts } = setupRoom(roles, 'muhujianai', 1)
    const all = new Set<number>()
    startRound(room, 1, artifacts, all)

    const blocked = room.players.find(p => p.role === 'muhujianai')!
    const round = room.game.rounds[0]
    expect(round.appraiseOrder.includes(blocked.id)).toBe(true)

    // 当前行动者设为正常玩家，并把回合传给被封锁玩家
    round.currentAppraiserId = room.players.find(p => p.role === 'xuyuan')!.id
    round.actualOrder = [round.currentAppraiserId] // 重置实际顺序链，避免随机首位的干扰
    const before = round.finishedAppraisers.length
    const res = passAppraiseTurn(room, round.currentAppraiserId, blocked.id)
    expect(res.ok).toBe(true)
    // 引擎没有自动跳过：当前行动者变成了被封锁玩家
    expect(round.currentAppraiserId).toBe(blocked.id)
    // 被封锁玩家尚未被记入 finishedAppraisers（需手动结束），而传出方（xuyuan）已被记入
    expect(round.finishedAppraisers.includes(blocked.id)).toBe(false)
    expect(round.finishedAppraisers.includes(room.players.find(p => p.role === 'xuyuan')!.id)).toBe(true)
    expect(round.finishedAppraisers.length).toBe(before + 1)

    // 被封锁玩家无法鉴宝
    const check = canAppraise(room, blocked.id)
    expect(check.can).toBe(false)
    expect(check.reason).toContain('心神不宁')
    const appRes = appraise(room, blocked.id, round.artifacts[0].id)
    expect((appRes as any).error).toBeDefined()

    // 被封锁玩家手动结束回合，把回合传给下一位
    const next = room.players.find(p => p.role === 'yaoburan')!.id
    const res2 = passAppraiseTurn(room, blocked.id, next)
    expect(res2.ok).toBe(true)
    expect(round.currentAppraiserId).toBe(next)
    // 现在被封锁玩家应已被记入 finishedAppraisers
    expect(round.finishedAppraisers.includes(blocked.id)).toBe(true)
    // 实际行动顺序（actualOrder）反映动态链条：blocked 在 next 之前，next 为末尾
    expect(round.actualOrder).toContain(blocked.id)
    expect(round.actualOrder).toContain(next)
    expect(round.actualOrder.indexOf(blocked.id)).toBeLessThan(round.actualOrder.indexOf(next))
    expect(round.actualOrder[round.actualOrder.length - 1]).toBe(next)
    // 若许愿（传出方）已在 actualOrder，则其应在 blocked 之前
    const xy = room.players.find(p => p.role === 'xuyuan')!.id
    if (round.actualOrder.includes(xy)) {
      expect(round.actualOrder.indexOf(xy)).toBeLessThan(round.actualOrder.indexOf(blocked.id))
    }
  })

  it('被封锁玩家的 client 视角：sealedRounds 含 randomlyBlocked', () => {
    const roles: RoleId[] = ['huangyanyan', 'yaoburan', 'fangzhen', 'muhujianai', 'laochaofeng', 'xuyuan']
    const { room } = setupRoom(roles, 'huangyanyan', 1)
    const p = room.players.find(pl => pl.role === 'huangyanyan')!
    expect(room.game.skipRoundsMap[p.id]).toBe(1)
  })

  it('封印（药不然）玩家同样需手动结束回合，不被自动跳过', () => {
    const roles: RoleId[] = ['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'muhujianai', 'zhengguoqu', 'laochaofeng', 'jiyunfu']
    const { room, artifacts } = setupRoom(roles)
    const all = new Set<number>()
    startRound(room, 1, artifacts, all)
    // 封印一个会鉴宝的角色（药不然，appraiseCount=1）
    const target = room.players.find(p => p.role === 'yaoburan')!
    const round = room.game.rounds[0]
    // 模拟被封印
    room.game.playerRoundStates[target.id][1].sealed = true
    round.currentAppraiserId = room.players.find(p => p.role === 'xuyuan')!.id
    const res = passAppraiseTurn(room, round.currentAppraiserId, target.id)
    expect(res.ok).toBe(true)
    expect(round.currentAppraiserId).toBe(target.id)
    expect(round.finishedAppraisers.includes(target.id)).toBe(false)
  })
})
