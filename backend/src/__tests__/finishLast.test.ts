import request from 'supertest'
import { createApp } from '../app'
import { generateAllArtifacts } from '../../../shared/engine'

const app = createApp()

describe('末位玩家直接结束本轮（finishAppraise 修复）', () => {
  it('末位人类鉴宝完成后发 finishAppraise 应成功进入发言', async () => {
    // 创建房间
    const createRes = await request(app).post('/api/game/rooms').send({ name: '房主', maxPlayers: 8 })
    const code = createRes.body.code
    const hostId = createRes.body.playerId

    // 加入 7 个玩家（填满 8 人）
    const pids: string[] = [hostId]
    for (let i = 0; i < 7; i++) {
      const r = await request(app).post(`/api/game/rooms/${code}/join`).send({ name: 'P' + i })
      pids.push(r.body.playerId)
    }

    // 开始游戏
    await request(app).post(`/api/game/rooms/${code}/action`).send({ playerId: hostId, action: { type: 'startGame' } })

    // 让前 7 位（按顺序）全部完成鉴宝，仅留顺序末位未完成
    const roundRes = await request(app).post(`/api/game/rooms/${code}/heartbeat`).send({ playerId: hostId })
    const g0: any = roundRes.body.room.game
    const order: string[] = g0.appraiseOrder
    const last = order[order.length - 1]

    // 通过后端 action 让前 7 位依次鉴宝 + 传递（用真实 passAppraiseTurn 流程）
    // 简化：直接把除末位外都标记完成——但需走引擎。这里用内部：让当前行动者逐一 pass 给下一位直到末位
    let cur = g0.currentAppraiserId
    let guard = 0
    while (cur && cur !== last && guard < 20) {
      guard++
      const rr: any = (await request(app).post(`/api/game/rooms/${code}/heartbeat`).send({ playerId: hostId })).body.room.game
      const ord = rr.appraiseOrder
      const idx = ord.indexOf(cur)
      let nextId: string | undefined
      for (let k = 1; k <= ord.length; k++) {
        const c = ord[(idx + k) % ord.length]
        if (c !== cur && !rr.finishedAppraisers.includes(c)) { nextId = c; break }
      }
      if (!nextId) break
      // 前 7 位直接 pass（不鉴宝也行，appraiseCount 够轮到的玩家随意；此处仅测末位结束，直接 pass）
      const pass = await request(app).post(`/api/game/rooms/${code}/action`).send({ playerId: cur, action: { type: 'passAppraiseTurn', nextPlayerId: nextId } })
      if (!pass.body.ok && pass.body.error) { /* 可能该玩家需先鉴宝 */ }
      cur = nextId
    }

    // 现在末位 = last，应轮到他。末位做鉴宝（用第一只兽首）
    const rr2: any = (await request(app).post(`/api/game/rooms/${code}/heartbeat`).send({ playerId: hostId })).body.room.game
    const art = rr2.artifacts[0].id
    await request(app).post(`/api/game/rooms/${code}/action`).send({ playerId: last, action: { type: 'appraise', artifactId: art } })

    // 末位发 finishAppraise（不应再提示"尚有玩家未完成"）
    const fin = await request(app).post(`/api/game/rooms/${code}/action`).send({ playerId: last, action: { type: 'finishAppraise' } })
    console.log("FIN BODY:", JSON.stringify(fin.body))
    const after: any = (await request(app).post(`/api/game/rooms/${code}/heartbeat`).send({ playerId: hostId })).body.room.game

    expect(fin.body.room.game.phase).toBe('discuss')
    expect(after.phase).toBe('discuss')
  })
})
