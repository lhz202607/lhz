import {
  createRoom, createAIPlayer, assignRoles, startRound, generateAllArtifacts,
  reindexSeats, changeSeat,
} from '../../../shared/engine'
import { roomManager } from '../modules/game/roomManager'
import { RoleId } from '../../../shared/types'

function setupRoom(roles: RoleId[]) {
  const room = createRoom('host', roles.length)
  while (room.players.length < roles.length) room.players.push(createAIPlayer())
  assignRoles(room)
  room.players.forEach((p, i) => { (p as any).role = roles[i] })
  reindexSeats(room)
  return room
}

describe('座位号与换座', () => {
  it('加入房间后按序分配座位号 1..N', () => {
    const room = setupRoom(['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'laochaofeng', 'zhengguoqu'])
    const seats = room.players.map(p => p.seatNumber).sort((a, b) => a - b)
    expect(seats).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('落座阶段可与另一玩家交换座位，且数字跟随玩家', () => {
    const room = setupRoom(['xuyuan', 'yaoburan', 'fangzhen', 'huangyanyan', 'laochaofeng', 'zhengguoqu'])
    const a = room.players[0]
    const b = room.players[1]
    const aSeat = a.seatNumber, bSeat = b.seatNumber
    const r = changeSeat(room, a.id, b.id)
    expect(r.ok).toBe(true)
    expect(a.seatNumber).toBe(bSeat)
    expect(b.seatNumber).toBe(aSeat)
  })

  it('游戏开始后(PUBLIC)换座被拒绝', () => {
    const room = createRoom('host', 6)
    while (room.players.length < 6) room.players.push(createAIPlayer())
    assignRoles(room)
    reindexSeats(room)
    const arts = generateAllArtifacts()
    startRound(room, 1, arts, new Set<number>())
    const r = changeSeat(room, room.players[0].id, room.players[1].id)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('固定')
  })
})

describe('药不然偷袭信息仅药不然本人可见', () => {
  it('普通玩家看不到偷袭目标，老朝奉/药不然可见', () => {
    const room = createRoom('host', 8)
    while (room.players.length < 8) room.players.push(createAIPlayer())
    assignRoles(room)
    room.players.forEach((p, i) => { (p as any).role = ['xuyuan','fangzhen','jiyunfu','huangyanyan','muhujianai','laochaofeng','yaoburan','zhengguoqu'][i] })
    reindexSeats(room)
    const arts = generateAllArtifacts()
    const used = new Set<number>()
    startRound(room, 1, arts, used)
    const ybr = room.players.find(p => p.role === 'yaoburan')!
    const target = room.players.find(p => p.role === 'muhujianai')!
    // 设为药不然的回合
    room.game.rounds[0].currentAppraiserId = ybr.id
    // @ts-ignore 调用内部 seal
    const eng = require('../../../shared/engine')
    const res = eng.yaoburanSeal(room, ybr.id, target.id)
    expect(res.ok).toBe(true)

    const civilian = room.players.find(p => p.role === 'xuyuan')!
    const laochf = room.players.find(p => p.role === 'laochaofeng')!
    const pubCivilian = roomManager.toPublicRoom(room, civilian.id)
    const pubLao = roomManager.toPublicRoom(room, laochf.id)
    const pubYbr = roomManager.toPublicRoom(room, ybr.id)

    expect(JSON.stringify(pubCivilian.game.events)).not.toContain('偷袭')
    expect(JSON.stringify(pubLao.game.events)).not.toContain('偷袭')
    expect(JSON.stringify(pubYbr.game.events)).toContain('偷袭')
    expect(JSON.stringify(pubCivilian.game.events)).not.toContain('许愿不受影响')
    expect(JSON.stringify(pubLao.game.events)).not.toContain('许愿不受影响')
  })
})
