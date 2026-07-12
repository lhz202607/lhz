import {
  createRoom, createAIPlayer, assignRoles, startRound, generateAllArtifacts,
  yaoburanSeal, canAppraise,
} from '../../../shared/engine'
import { Room, RoleId } from '../../../shared/types'

// 8 人：许愿、药不然、方震、黄烟烟、木户加奈、郑国渠、老朝奉、姬云浮
const roles: RoleId[] = ['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'muhujianai', 'zhengguoqu', 'laochaofeng', 'jiyunfu']

function setupRoom() {
  const room = createRoom('房主', roles.length)
  while (room.players.length < roles.length) room.players.push(createAIPlayer())
  assignRoles(room)
  room.players.forEach((p, i) => { (p as any).role = roles[i] })
  room.game.playerRoundStates = {}
  const artifacts = generateAllArtifacts()
  return { room, artifacts }
}

describe('端到端：木户加奈被偷袭后，剩余轮次仍随机一轮无法鉴宝', () => {
  it('第1轮被立即封印（随机轮设第3轮），整局恰好第3轮随机封锁一次，无重叠无丢失', () => {
    const { room, artifacts } = setupRoom()
    const sealer = room.players.find(p => p.role === 'yaoburan')!
    const muhu = room.players.find(p => p.role === 'muhujianai')!
    // 假设木户加奈的随机封锁轮 = 第 3 轮（本就被安排在剩余轮次里）
    room.game.skipRoundsMap[muhu.id] = 3

    // 第 1 轮
    const used1 = new Set<number>()
    startRound(room, 1, artifacts, used1)
    // 强制顺序让木户加奈在药不然之后（后置位，立即生效）
    const r1 = room.game.rounds[0]
    const order = room.players.map(p => p.id)
    const yIdx = order.indexOf(sealer.id)
    const mIdx = order.indexOf(muhu.id)
    if (mIdx < yIdx) [order[yIdx], order[mIdx]] = [order[mIdx], order[yIdx]]
    r1.appraiseOrder = order
    r1.currentAppraiserId = order[0]
    r1.finishedAppraisers = []
    r1.actualOrder = [order[0]]

    // 药不然在第 1 轮偷袭木户加奈
    const res = yaoburanSeal(room, sealer.id, muhu.id)
    expect(res.ok).toBe(true)
    expect(res.delayed).toBeFalsy()
    // 第 1 轮：木户加奈被封印，随机封锁轮(3)未受影响
    expect(room.game.playerRoundStates[muhu.id][1].sealed).toBe(true)
    expect(room.game.playerRoundStates[muhu.id][1].randomlyBlocked).toBeFalsy()
    expect(room.game.skipRoundsMap[muhu.id]).toBe(3) // 顺延逻辑不应被触发（本轮≠随机轮）
    expect(canAppraise(room, muhu.id).reason).toContain('本轮已被封印')

    // 第 2 轮：木户加奈既不封印也不随机封锁（随机轮是3）
    const used2 = new Set<number>()
    startRound(room, 2, artifacts, used2)
    expect(room.game.playerRoundStates[muhu.id][2].sealed).toBeFalsy()
    expect(room.game.playerRoundStates[muhu.id][2].randomlyBlocked).toBeFalsy()
    expect(canAppraise(room, muhu.id).can).toBe(true)

    // 第 3 轮：木户加奈应随机封锁（即"剩余轮次仍会随机一轮无法鉴宝"）
    const used3 = new Set<number>()
    startRound(room, 3, artifacts, used3)
    expect(room.game.playerRoundStates[muhu.id][3].sealed).toBeFalsy()
    expect(room.game.playerRoundStates[muhu.id][3].randomlyBlocked).toBe(true)
    expect(canAppraise(room, muhu.id).reason).toContain('心神不宁')

    // 整局统计：木户加奈恰好随机封锁 1 次（不重复、不丢失）
    const blockCount = [1, 2, 3].filter(r => room.game.playerRoundStates[muhu.id][r].randomlyBlocked).length
    expect(blockCount).toBe(1)
  })

  it('立即封印占用随机轮时：被占轮只封印，下一轮补随机封锁，整局仍恰好1次', () => {
    const { room, artifacts } = setupRoom()
    const sealer = room.players.find(p => p.role === 'yaoburan')!
    const muhu = room.players.find(p => p.role === 'muhujianai')!
    // 随机轮设第 1 轮，但第 1 轮就被偷袭占用 → 应顺延到第 2 轮
    room.game.skipRoundsMap[muhu.id] = 1

    const used1 = new Set<number>()
    startRound(room, 1, artifacts, used1)
    const r1 = room.game.rounds[0]
    const order = room.players.map(p => p.id)
    const yIdx = order.indexOf(sealer.id)
    const mIdx = order.indexOf(muhu.id)
    if (mIdx < yIdx) [order[yIdx], order[mIdx]] = [order[mIdx], order[yIdx]]
    r1.appraiseOrder = order
    r1.currentAppraiserId = order[0]
    r1.finishedAppraisers = []
    r1.actualOrder = [order[0]]

    yaoburanSeal(room, sealer.id, muhu.id)
    expect(room.game.skipRoundsMap[muhu.id]).toBe(2) // 顺延到第 2 轮
    expect(room.game.playerRoundStates[muhu.id][1].sealed).toBe(true)
    expect(room.game.playerRoundStates[muhu.id][1].randomlyBlocked).toBeFalsy()

    const used2 = new Set<number>()
    startRound(room, 2, artifacts, used2)
    expect(room.game.playerRoundStates[muhu.id][2].randomlyBlocked).toBe(true) // 第 2 轮补随机封锁

    const used3 = new Set<number>()
    startRound(room, 3, artifacts, used3)
    expect(room.game.playerRoundStates[muhu.id][3].randomlyBlocked).toBeFalsy() // 第 3 轮不再锁

    const blockCount = [1, 2, 3].filter(r => room.game.playerRoundStates[muhu.id][r].randomlyBlocked).length
    expect(blockCount).toBe(1) // 整局仍恰好随机封锁 1 次
  })
})
