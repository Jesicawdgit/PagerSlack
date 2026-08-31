const swaggerJsdoc = require('swagger-jsdoc');

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Registration, login, and session management
 *
 * components:
 *   securitySchemes:
 *     cookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: token
 *
 * /auth/register:
 *   post:
 *     summary: Register a new user and log them in
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [EMPLOYEE, TEAM_LEAD, MANAGER] }
 *     responses:
 *       201: { description: User created, session cookie set }
 *       400: { description: Validation error }
 *       409: { description: Email already registered }
 *
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Logged in, session cookie set }
 *       401: { description: Invalid credentials }
 *
 * /auth/logout:
 *   post:
 *     summary: Log out the current user
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Logged out, session cookie cleared }
 *       401: { description: Not authenticated }
 *
 * /auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Not authenticated }
 */

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PagerSlack API',
      version: '1.0.0',
      description: 'Slack + PagerDuty-style team communication and incident escalation demo API',
    },
    servers: [{ url: '/api/v1' }],
  },
  apis: ['./src/config/swagger.js'],
});

module.exports = swaggerSpec;
