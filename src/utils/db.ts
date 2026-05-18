// src/utils/db.ts
import { PrismaClient } from '@prisma/client'

declare global {
  // Prevent multiple instances in dev with hot reload
  var __db: PrismaClient | undefined
}

export const db = global.__db ?? new PrismaClient({ log: ['warn', 'error'] })
if (process.env.NODE_ENV !== 'production') global.__db = db
