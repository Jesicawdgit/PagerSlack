const swaggerJsdoc = require('swagger-jsdoc');

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Registration, login, and session management
 *   - name: Teams
 *     description: Team creation and membership
 *   - name: Channels
 *     description: Channels within a team
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
 *
 * /teams:
 *   get:
 *     summary: List all teams
 *     tags: [Teams]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: List of teams }
 *   post:
 *     summary: Create a team and join it as the creator
 *     tags: [Teams]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201: { description: Team created, creator assigned to it }
 *       400: { description: Validation error }
 *       409: { description: Team name taken, or creator already belongs to a team }
 *
 * /teams/{id}:
 *   get:
 *     summary: Get a team by id
 *     tags: [Teams]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The team }
 *       404: { description: Team not found }
 *
 * /teams/{teamId}/channels:
 *   get:
 *     summary: List channels for a team
 *     tags: [Channels]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of channels }
 *       404: { description: Team not found }
 *   post:
 *     summary: Create a channel in a team
 *     tags: [Channels]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201: { description: Channel created }
 *       404: { description: Team not found }
 *       409: { description: Channel name already taken on this team }
 *
 * /channels/{id}:
 *   get:
 *     summary: Get a channel by id
 *     tags: [Channels]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The channel }
 *       404: { description: Channel not found }
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
