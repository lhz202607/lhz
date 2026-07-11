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
    // 尝试多个可能的路径
    const candidates = [
      path.resolve(process.cwd(), 'frontend/dist'),
      path.resolve(process.cwd(), '../frontend/dist'),
      path.resolve(__dirname, '../frontend/dist'),
      path.resolve(__dirname, '../../frontend/dist'),
    ]
    const staticDir = candidates.find(p => fs.existsSync(p))
    if (staticDir) {
      app.use(express.static(staticDir))
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next()
        res.sendFile(path.join(staticDir, 'index.html'))
      })
      console.log(`Static files served from ${staticDir}`)
    } else {
      console.warn(`Static dir not found. Tried: ${candidates.join(', ')}`)
    }
  }

  // Error handling
  app.use(errorHandler)

  return app
}
