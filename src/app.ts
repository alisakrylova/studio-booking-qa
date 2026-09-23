import express, { type NextFunction, type Request, type Response } from 'express'
import path from 'node:path'
import { AppError } from './errors.ts'
import { routes } from './routes.ts'

const publicDir = path.join(import.meta.dirname, '..', 'public')

export function createApp() {
  const app = express()

  app.use(express.json())
  app.use(express.static(publicDir))
  app.use(routes)

  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof AppError) {
      response.status(error.status).json(error.body)
      return
    }
    next(error)
  })

  return app
}
