import {
  createRoom, createAIPlayer, assignRoles, startRound, generateAllArtifacts,
  yaoburanSeal, canAppraise,
} from '../../../shared/engine'
import { Room, RoleId } from '../../../shared/types'

// 固定 8 人：许愿、药不然、方震、黄烟烟(idx3)、木户加奈(idx4)、郑国渠、老朝奉、姬云浮
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

function startN(room: Room, n: number, artifacts: any) {
  const used = new Set<number>()
  startRound(room, n, artifacts, used)
}

describe('木户加奈/黄烟烟：被封印占用随机封锁轮时，随机封锁顺延到下一轮', () => {
  it('延迟封印（前置位）占用木户加奈的随机封锁轮：本轮只封印，下轮随机封锁', () => {
    const { room, artifacts } = setupRoom()
    const sealer = room.players.find(p => p.role === 'yaoburan')!
    const muhu = room.players.find(p => p.role === 'muhujianai')! // idx4
    // 设木户加奈随机封锁轮 = 第 2 轮
    room.game.skipRoundsMap[muhu.id] = 2

    // 让木户加奈成为药不然的前置位，使封印延迟到第 2 轮生效
    startN(room, 1, artifacts)
    const round1 = room.game.rounds[0]
    // 强制顺序：木户加奈在药不然之前（前置位）
    const order = room.players.map(p => p.id)
    const yIdx = order.indexOf(sealer.id)
    const mIdx = order.indexOf(muhu.id)
    if (mIdx > yIdx) [order[yIdx], order[mIdx]] = [order[mIdx], order[yIdx]]
    round1.appraiseOrder = order
    round1.currentAppraiserId = order[0]
    round1.finishedAppraisers = []
    round1.actualOrder = [order[0]]

    const res = yaoburanSeal(room, sealer.id, muhu.id)
    expect(res.ok).toBe(true)
    expect(res.delayed).toBe(true)
    expect(room.game.pendingSeals[muhu.id]).toBe(2)

    // 第 2 轮：木户加奈应被延迟封印（sealed），且随机封锁被顺延（本轮不随机封锁）
    startN(room, 2, artifacts)
    expect(room.game.playerRoundStates[muhu.id][2].sealed).toBe(true)
    expect(room.game.playerRoundStates[muhu.id][2].randomlyBlocked).toBe(false) // 本轮封印顶替，不双重惩罚
    expect(canAppraise(room, muhu.id).can).toBe(false)
    expect(room.game.skipRoundsMap[muhu.id]).toBe(3) // 顺延到下一轮

    // 第 3 轮：木户加奈应随机封锁（心神不宁），不再被封印
    startN(room, 3, artifacts)
    expect(room.game.playerRoundStates[muhu.id][3].sealed).toBeFalsy()
    expect(room.game.playerRoundStates[muhu.id][3].randomlyBlocked).toBe(true) // 随机封锁顺延生效
    expect(canAppraise(room, muhu.id).reason).toContain('心神不宁')
  })

  it('立即封印（后置位）占用黄烟烟的随机封锁轮：本轮只封印，下轮随机封锁', () => {
    const { room, artifacts } = setupRoom()
    const sealer = room.players.find(p => p.role === 'yaoburan')!
    const hyy = room.players.find(p => p.role === 'huangyanyan')! // idx3
    // 设黄烟烟随机封锁轮 = 第 1 轮
    room.game.skipRoundsMap[hyy.id] = 1

    startN(room, 1, artifacts)
    // 强制顺序让黄烟烟在药不然之后（后置位，立即生效）
    const round1 = room.game.rounds[0]
    const order = room.players.map(p => p.id)
    const yIdx = order.indexOf(sealer.id)
    const hIdx = order.indexOf(hyy.id)
    if (hIdx < yIdx) [order[yIdx], order[hIdx]] = [order[hIdx], order[yIdx]]
    round1.appraiseOrder = order
    round1.currentAppraiserId = order[0]
    round1.finishedAppraisers = []
    round1.actualOrder = [order[0]]

    const res = yaoburanSeal(room, sealer.id, hyy.id)
    expect(res.ok).toBe(true)
    expect(res.delayed).toBeFalsy()
    // 第 1 轮：黄烟烟被立即封印，随机封锁被顺延
    expect(room.game.playerRoundStates[hyy.id][1].sealed).toBe(true)
    expect(room.game.playerRoundStates[hyy.id][1].randomlyBlocked).toBe(false)
    expect(room.game.skipRoundsMap[hyy.id]).toBe(2) // 顺延到第 2 轮

    // 第 2 轮：黄烟烟应随机封锁（心神不宁）
    startN(room, 2, artifacts)
    expect(room.game.playerRoundStates[hyy.id][2].sealed).toBeFalsy()
    expect(room.game.playerRoundStates[hyy.id][2].randomlyBlocked).toBe(true)
    expect(canAppraise(room, hyy.id).reason).toContain('心神不宁')
  })

  it('对照：随机封锁轮与封印轮不同，两者各自独立触发，不互相影响', () => {
    const { room, artifacts } = setupRoom()
    const sealer = room.players.find(p => p.role === 'yaoburan')!
    const hyy = room.players.find(p => p.role === 'huangyanyan')!
    // 黄烟烟随机封锁轮 = 第 3 轮，但第 1 轮被封印
    room.game.skipRoundsMap[hyy.id] = 3

    startN(room, 1, artifacts)
    const round1 = room.game.rounds[0]
    const order = room.players.map(p => p.id)
    const yIdx = order.indexOf(sealer.id)
    const hIdx = order.indexOf(hyy.id)
    if (hIdx < yIdx) [order[yIdx], order[hIdx]] = [order[hIdx], order[yIdx]]
    round1.appraiseOrder = order
    round1.currentAppraiserId = order[0]
    round1.finishedAppraisers = []
    round1.actualOrder = [order[0]]

    const res = yaoburanSeal(room, sealer.id, hyy.id)
    expect(res.ok).toBe(true)
    expect(room.game.playerRoundStates[hyy.id][1].sealed).toBe(true)
    // 第 1 轮被封印；随机封锁轮(3)不变
    expect(room.game.skipRoundsMap[hyy.id]).toBe(3)

    // 第 3 轮：黄烟烟随机封锁仍应触发（与第 1 轮封印无关）
    startN(room, 3, artifacts)
    expect(room.game.playerRoundStates[hyy.id][3].sealed).toBeFalsy()
    expect(room.game.playerRoundStates[hyy.id][3].randomlyBlocked).toBe(true)
  })
})
