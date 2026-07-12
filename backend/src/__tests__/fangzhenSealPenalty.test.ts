import {
  createRoom, createAIPlayer, assignRoles, startRound, generateAllArtifacts,
  passAppraiseTurn, canAppraise, yaoburanSeal,
} from '../../../shared/engine'
import { Room, RoleId } from '../../../shared/types'

// 角色顺序：许愿(0) 方震(2) 之间隔着药不然(1)，保证方震在药不然之后（后置位，立即生效）
const roles: RoleId[] = ['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'muhujianai', 'zhengguoqu', 'laochaofeng']

function setupRoom() {
  const room = createRoom('房主', roles.length)
  while (room.players.length < roles.length) room.players.push(createAIPlayer())
  assignRoles(room)
  room.players.forEach((p, i) => { (p as any).role = roles[i] })
  room.game.playerRoundStates = {}
  const artifacts = generateAllArtifacts()
  return { room, artifacts }
}

describe('方震被封印 → 许愿连带丧失鉴宝能力', () => {
  it('立即生效：药不然封印方震（后置位），许愿本轮无法鉴宝，且不暴露方震身份', () => {
    const { room, artifacts } = setupRoom()
    const all = new Set<number>()
    startRound(room, 1, artifacts, all)
    const sealer = room.players.find(p => p.role === 'yaoburan')!
    const fangzhen = room.players.find(p => p.role === 'fangzhen')!
    const xuyuan = room.players.find(p => p.role === 'xuyuan')!
    const round = room.game.rounds[0]

    // 固定顺序确保方震在药不然之后（后置位，立即生效）
    round.appraiseOrder = room.players.map(p => p.id)
    round.currentAppraiserId = round.appraiseOrder[0]
    round.finishedAppraisers = []
    round.actualOrder = [round.appraiseOrder[0]]

    const res = yaoburanSeal(room, sealer.id, fangzhen.id)
    expect(res.ok).toBe(true)
    expect(res.delayed).toBeFalsy()
    // 方震被封印
    expect(room.game.playerRoundStates[fangzhen.id][1].sealed).toBe(true)
    // 许愿被连带：本轮丧失鉴宝能力
    expect(room.game.playerRoundStates[xuyuan.id][1].fangzhenSealPenalty).toBe(true)
    const xc = canAppraise(room, xuyuan.id)
    expect(xc.can).toBe(false)
    expect(xc.reason).toContain('你本轮丧失鉴宝能力')
    // 许愿并非被"直接封印"，不应误标 sealed
    expect(room.game.playerRoundStates[xuyuan.id][1].sealed).toBeFalsy()
  })

  it('延迟生效：方震为药不然前置位，下一轮许愿丧失能力，本轮许愿仍可鉴宝', () => {
    const { room, artifacts } = setupRoom()
    const all = new Set<number>()
    startRound(room, 1, artifacts, all)
    const sealer = room.players.find(p => p.role === 'yaoburan')!
    const fangzhen = room.players.find(p => p.role === 'fangzhen')!
    const xuyuan = room.players.find(p => p.role === 'xuyuan')!
    const round1 = room.game.rounds[0]

    // 强制顺序：方震(2) 排在药不然(1) 之前 → 前置位，延迟生效
    const order = room.players.map(p => p.id)
    // 把方震换到药不然前面
    const ybrIdx = order.indexOf(sealer.id)
    const fzIdx = order.indexOf(fangzhen.id)
    ;[order[ybrIdx], order[fzIdx]] = [order[fzIdx], order[ybrIdx]]
    round1.appraiseOrder = order
    round1.currentAppraiserId = order[0]
    round1.finishedAppraisers = []
    round1.actualOrder = [order[0]]

    const res = yaoburanSeal(room, sealer.id, fangzhen.id)
    expect(res.ok).toBe(true)
    expect(res.delayed).toBe(true)
    // 本轮方震未被封印、许愿未被连累
    expect(room.game.playerRoundStates[fangzhen.id][1].sealed).toBeFalsy()
    expect(room.game.playerRoundStates[xuyuan.id][1].fangzhenSealPenalty).toBeFalsy()

    // 进入下一轮
    const all2 = new Set<number>()
    startRound(room, 2, artifacts, all2)
    const round2 = room.game.rounds[1]
    // 方震本轮被延迟封印
    expect(room.game.playerRoundStates[fangzhen.id][2].sealed).toBe(true)
    // 许愿本轮被连带丧失能力
    expect(room.game.playerRoundStates[xuyuan.id][2].fangzhenSealPenalty).toBe(true)
    expect(canAppraise(room, xuyuan.id).can).toBe(false)
    expect(canAppraise(room, xuyuan.id).reason).toContain('你本轮丧失鉴宝能力')
    // 第 3 轮应恢复（延迟仅一轮）
    const all3 = new Set<number>()
    startRound(room, 3, artifacts, all3)
    expect(room.game.playerRoundStates[xuyuan.id][3].fangzhenSealPenalty).toBeFalsy()
    expect(canAppraise(room, xuyuan.id).can).toBe(true)
    void round2
  })
})
