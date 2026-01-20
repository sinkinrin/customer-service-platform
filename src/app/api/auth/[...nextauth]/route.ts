/**
 * NextAuth.js API Route Handler
 *
 * @swagger
 * /api/auth/{action}:
 *   post:
 *     description: Handle authentication actions (signin, signout)
 *     parameters:
 *       - in: path
 *         name: action
 *         schema:
 *           type: string
 *           enum: [signin, signout, session, csrf, providers, callback]
 *         description: Auth action to perform
 *     responses:
 *       200:
 *         description: Auth action completed
 *   get:
 *     description: Get authentication information
 *     parameters:
 *       - in: path
 *         name: action
 *         schema:
 *           type: string
 *           enum: [signin, signout, session, csrf, providers, callback]
 *         description: Auth action to perform
 *     responses:
 *       200:
 *         description: Auth information returned
 */

import { handlers } from "@/auth"

export const { GET, POST } = handlers
