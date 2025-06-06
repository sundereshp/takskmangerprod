require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3103;

// Updated CORS configuration to include your local IP
const corsOptions = {
    origin: [
        'http://localhost:8080', 
        'http://localhost:8081',
        'http://46.28.44.5:3103', 
        'http://192.168.1.10:8081',  // Add your local IP
        'http://127.0.0.1:8081'      // Add localhost alternative
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Create MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully connected to MySQL database');
        connection.release();
    } catch (error) {
        console.error('Error connecting to MySQL database:', error);
        process.exit(1);
    }
}

testConnection();

// Add logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    next();
});

// GET all projects
app.get('/su/backend/projects', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM projects ORDER BY createdAt DESC');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET single project
app.get('/su/backend/projects/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST create new project - Updated to handle optional fields
app.post('/su/backend/projects', async (req, res) => {
    console.log('POST /su/backend/projects - Received body:', req.body);

    // Only require essential fields, provide defaults for others
    const requiredFields = ['userID', 'name', 'wsID'];
    const missing = requiredFields.filter(field => req.body[field] === undefined || req.body[field] === null);

    if (missing.length > 0) {
        console.error('Missing required fields:', missing);
        return res.status(400).json({
            error: `Missing required fields: ${missing.join(', ')}`
        });
    }

    try {
        const { 
            userID, 
            name, 
            description = '', 
            startDate, 
            endDate, 
            estHours = 0, 
            actHours = 0, 
            wsID 
        } = req.body;

        const [result] = await pool.query(
            'INSERT INTO projects (userID, name, description, startDate, endDate, estHours, actHours, wsID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userID, name, description, startDate, endDate, estHours, actHours, wsID]
        );

        const [newProject] = await pool.query('SELECT * FROM projects WHERE id = ?', [result.insertId]);
        console.log('Created new project:', newProject[0]);
        res.status(201).json(newProject[0]);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// PATCH update project
app.patch('/su/backend/projects/:id', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const updates = req.body;

        // Remove fields that shouldn't be updated directly
        delete updates.id;
        delete updates.createdAt;
        delete updates.modifiedAt;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const [result] = await pool.query(
            'UPDATE projects SET ? WHERE id = ?',
            [updates, projectId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const [updatedProject] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
        res.json(updatedProject[0]);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE project
app.delete('/su/backend/projects/:id', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);

        const [result] = await pool.query('DELETE FROM projects WHERE id = ?', [projectId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET all tasks
app.get('/su/backend/tasks', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tasks ORDER BY createdAt DESC');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET single task
app.get('/su/backend/tasks/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET tasks by project - Fixed endpoint
app.get('/su/backend/tasks/project/:projectId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tasks WHERE projectID = ? ORDER BY createdAt DESC', [req.params.projectId]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching tasks for project:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST create new task - Updated to handle optional fields
app.post('/su/backend/tasks', async (req, res) => {
    console.log('POST /su/backend/tasks - Received body:', req.body);

    // Only require essential fields
    const requiredFields = ['wsID', 'userID', 'projectID', 'name', 'taskLevel'];
    const missing = requiredFields.filter(field => req.body[field] === undefined || req.body[field] === null);

    if (missing.length > 0) {
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    try {
        const {
            wsID,
            userID,
            projectID,
            name,
            description = '',
            taskLevel,
            status = 'TODO',
            parentID = 0,
            level1ID = 0,
            level2ID = 0,
            level3ID = 0,
            level4ID = 0,
            assignee1ID = 0,
            assignee2ID = 0,
            assignee3ID = 0,
            estHours = 0,
            estPrevHours = {},
            actHours = 0,
            isExeceeded = 0,
            info = {}
        } = req.body;

        // Validate status enum
        const validStatuses = ['TODO', 'IN PROGRESS', 'COMPLETE', 'REVIEW', 'CLOSED', 'BACKLOG', 'CLARIFICATION'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const [result] = await pool.query(
            'INSERT INTO tasks (wsID, userID, projectID, name, description, taskLevel, status, parentID, level1ID, level2ID, level3ID, level4ID, assignee1ID, assignee2ID, assignee3ID, estHours, estPrevHours, actHours, isExeceeded, info) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [wsID, userID, projectID, name, description, taskLevel, status, parentID, level1ID, level2ID, level3ID, level4ID, assignee1ID, assignee2ID, assignee3ID, estHours, JSON.stringify(estPrevHours), actHours, isExeceeded, JSON.stringify(info)]
        );

        const [newTask] = await pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
        console.log('Created new task:', newTask[0]);
        res.status(201).json(newTask[0]);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// PUT update task
app.put('/su/backend/tasks/:id', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const updates = req.body;

        // Remove fields that shouldn't be updated directly
        delete updates.id;
        delete updates.createdAt;
        delete updates.modifiedAt;

        // Validate status if provided
        if (updates.status) {
            const validStatuses = ['TODO', 'IN PROGRESS', 'COMPLETE', 'REVIEW', 'CLOSED', 'BACKLOG', 'CLARIFICATION'];
            if (!validStatuses.includes(updates.status)) {
                return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
            }
        }

        // Handle JSON fields
        if (updates.estPrevHours) {
            try {
                updates.estPrevHours = typeof updates.estPrevHours === 'string' ?
                    updates.estPrevHours : JSON.stringify(updates.estPrevHours);
            } catch (jsonError) {
                return res.status(400).json({ error: 'Invalid JSON format for estPrevHours' });
            }
        }

        if (updates.info) {
            try {
                updates.info = typeof updates.info === 'string' ?
                    updates.info : JSON.stringify(updates.info);
            } catch (jsonError) {
                return res.status(400).json({ error: 'Invalid JSON format for info' });
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const [result] = await pool.query(
            'UPDATE tasks SET ? WHERE id = ?',
            [updates, taskId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const [updatedTask] = await pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
        res.json(updatedTask[0]);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE task
app.delete('/su/backend/tasks/:id', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);

        const [result] = await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`API base URL: http://0.0.0.0:${PORT}/su/backend`);
});