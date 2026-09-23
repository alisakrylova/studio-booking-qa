import express from 'express'
import path from 'node:path'

const publicDir = path.join(import.meta.dirname, '..', 'public')

export function createApp() {
  const app = express()

  app.use(express.json())
  app.use(express.static(publicDir))

  return app
}
