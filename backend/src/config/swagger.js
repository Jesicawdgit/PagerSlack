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
 *   - name: Messages
 *     description: Messages within a channel
 *   - name: Incidents
 *     description: Incident creation and history
 *   - name: Demo
 *     description: Demo service panel (simulated Order API health)
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
 *     responses:
 *       201: { description: User created, joins the seeded team as EMPLOYEE, session cookie set }
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
 *
 * /channels/{id}/messages:
 *   get:
 *     summary: List messages in a channel, oldest first
 *     tags: [Messages]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of messages }
 *       404: { description: Channel not found }
 *   post:
 *     summary: Post a message to a channel
 *     tags: [Messages]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, maxLength: 2000 }
 *     responses:
 *       201: { description: Message created }
 *       404: { description: Channel not found }
 *
 * /incidents:
 *   get:
 *     summary: List all incidents
 *     tags: [Incidents]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: List of incidents }
 *   post:
 *     summary: Create an incident
 *     tags: [Incidents]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, severity, channel]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               severity: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *               channel: { type: string }
 *     responses:
 *       201: { description: Incident created, CREATED event written }
 *       400: { description: Validation error }
 *       404: { description: Channel not found }
 *
 * /incidents/{id}:
 *   get:
 *     summary: Get an incident by id
 *     tags: [Incidents]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The incident }
 *       404: { description: Incident not found }
 *
 * /incidents/{id}/history:
 *   get:
 *     summary: Get an incident's event history
 *     tags: [Incidents]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of incident events }
 *       404: { description: Incident not found }
 *
 * /incidents/{id}/assign:
 *   post:
 *     summary: Assign an incident to a user
 *     tags: [Incidents]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assigneeId]
 *             properties:
 *               assigneeId: { type: string }
 *     responses:
 *       200: { description: Incident assigned, ASSIGNED event written, incident:updated emitted }
 *       404: { description: Incident or user not found }
 *       409: { description: Incident already resolved }
 *
 * /incidents/{id}/acknowledge:
 *   post:
 *     summary: Acknowledge an incident
 *     tags: [Incidents]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Incident acknowledged, ACKNOWLEDGED event written, incident:acknowledged emitted }
 *       403: { description: Not the assignee and not an equal-or-higher role than the incident's escalation level }
 *       404: { description: Incident not found }
 *       409: { description: Incident already resolved or already acknowledged }
 *
 * /incidents/{id}/resolve:
 *   post:
 *     summary: Resolve an incident
 *     tags: [Incidents]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Incident resolved, RESOLVED event written, incident:resolved emitted }
 *       403: { description: Not the assignee and not an equal-or-higher role than the incident's escalation level }
 *       404: { description: Incident not found }
 *       409: { description: Incident already resolved }
 *
 * /demo/services:
 *   get:
 *     summary: List demo services
 *     tags: [Demo]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: List of demo services }
 *
 * /demo/services/{id}/fail:
 *   post:
 *     summary: Flip a demo service to FAILING and broadcast the change to every connected session
 *     tags: [Demo]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Service marked FAILING, service:health_changed broadcast }
 *       404: { description: Service not found }
 *
 * /demo/services/{id}/restore:
 *   post:
 *     summary: Flip a demo service back to HEALTHY and broadcast the change to every connected session
 *     tags: [Demo]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Service marked HEALTHY, service:health_changed broadcast }
 *       404: { description: Service not found }
 *
 * /demo/orders:
 *   get:
 *     summary: Simulated Order API call — fails when the Order API demo service is FAILING
 *     tags: [Demo]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Fake order data }
 *       500: { description: Order API is currently unavailable }
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
