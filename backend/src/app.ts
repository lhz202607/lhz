import express, { Application } from 'express'
import cors from 'cors'
import compression from 'compression'
import path from 'path'
import fs from 'fs'
import 'express-async-errors'
import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import { httpLogger } from './middleware/logger'
import { systemRouter } from './modules/system'
import { gameRouter } from './modules/game'

export const createApp = (): Application => {
  const app = express()

  app.use(httpLogger)

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN,
      credentials: env.CORS_ORIGIN !== '*',
    })
  )

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(compression())

  // API routes
  app.use(env.API_PREFIX, systemRouter)
  app.use(`${env.API_PREFIX}/game`, gameRouter)

  // 生产环境：托管前端静态文件
  if (env.NODE_ENV === 'production') {
    const staticDir = path.resolve(process.cwd(), '../frontend/dist')
    if (fs.existsSync(staticDir)) {
      app.use(express.static(staticDir))
      // SPA 回退：所有非 /api 请求返回 index.html
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next()
        res.sendFile(path.join(staticDir, 'index.html'))
      })
      console.log(`Static files served from ${staticDir}`)
    } else {
      console.warn(`Static dir not found: ${staticDir}`)
    }
  }

  // Error handling
  app.use(errorHandler)

  return app
}
