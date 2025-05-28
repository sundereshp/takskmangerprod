require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3103;

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

// Middleware
app.use(cors());
app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

<<<<<<< HEAD
// GET all projects
app.get('/su/backend/projects', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM projects ORDER BY createdAt DESC');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Database error' });
    }
=======
// In-memory storage
let projects = [];
let globalTaskId = 1; // Global task ID counter

// Helper function to get next task ID
const getNextTaskId = () => {
    return globalTaskId++;
};

// GET all projects
app.get('/api/projects', (req, res) => {
    console.log('GET /api/projects - Returning projects:', projects);
    // Return projects without tasks array to match desired format
    const projectsWithoutTasks = projects.map(project => {
        const { tasks, ...projectWithoutTasks } = project;
        return projectWithoutTasks;
    });
    res.json(projectsWithoutTasks);
>>>>>>> d0791c6423d6925ea1fc356569afd202b979f3a4
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

// POST create new project
app.post('/su/backend/projects', async (req, res) => {
    console.log('POST /su/backend/projects - Received body:', req.body);

    const requiredFields = ['userID', 'name', 'description', 'startDate', 'endDate', 'estHours', 'actHours', 'wsID'];
    const missing = requiredFields.filter(field => req.body[field] === undefined || req.body[field] === null);

    if (missing.length > 0) {
        console.error('Missing required fields:', missing);
        return res.status(400).json({
            error: `Missing required fields: ${missing.join(', ')}`
        });
    }

<<<<<<< HEAD
    try {
        const { userID, name, description, startDate, endDate, estHours, actHours, wsID } = req.body;
        
        const [result] = await pool.query(
            'INSERT INTO projects (userID, name, description, startDate, endDate, estHours, actHours, wsID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userID, name, description, startDate, endDate, estHours, actHours, wsID]
        );
        
        const [newProject] = await pool.query('SELECT * FROM projects WHERE id = ?', [result.insertId]);
        console.log('Created new project:', newProject[0]);
        res.status(201).json(newProject[0]);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Database error' });
    }
=======
    const { description,
        userID, name, startDate, endDate,
        estHours = 0, actHours = 0, wsID
    } = req.body;

    // Validate required fields
    if (!userID || !name || !startDate || !endDate || !wsID) {
        console.error('Validation failed for project creation');
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const newProject = {
        id: projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1,
        userID: parseInt(userID),
        name,
        description,
        startDate,
        endDate,
        estHours: parseFloat(estHours),
        actHours: parseFloat(actHours),
        wsID: parseInt(wsID),
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        tasks: []
    };

    console.log('Adding new project:', newProject);
    projects.push(newProject);
    console.log('Projects after addition:', projects);

    // Return project without tasks to match desired format
    const { tasks, ...projectResponse } = newProject;
    res.status(201).json(projectResponse);
>>>>>>> d0791c6423d6925ea1fc356569afd202b979f3a4
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
<<<<<<< HEAD
=======

    // Ensure numeric fields are parsed
    if (updates.userID !== undefined) updates.userID = parseInt(updates.userID);
    if (updates.estHours !== undefined) updates.estHours = parseFloat(updates.estHours);
    if (updates.actHours !== undefined) updates.actHours = parseFloat(updates.actHours);
    if (updates.wsID !== undefined) updates.wsID = parseInt(updates.wsID);

    const updatedProject = {
        ...projects[projectIndex],
        ...updates,
        modifiedAt: new Date().toISOString()
    };

    projects[projectIndex] = updatedProject;
    
    // Return project without tasks to match desired format
    const { tasks, ...projectResponse } = updatedProject;
    res.json(projectResponse);
>>>>>>> d0791c6423d6925ea1fc356569afd202b979f3a4
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

<<<<<<< HEAD
// GET single task
app.get('/su/backend/tasks/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
=======
// POST create new task (including subtasks)
app.post('/api/tasks', (req, res) => {
    console.log('POST /api/tasks - Received body:', req.body);

    const { description = "",
        wsID, userID, projectID, name,
        taskLevel = 1, status = 'todo', parentID = 0,
        assignee1ID = 0, assignee2ID = 0, assignee3ID = 0,
        estHours = 0, estPrevHours, actHours = 0,
        isExceeded = 0, info = {}, taskType = 'task'
    } = req.body;

    const project = projects.find(p => p.id === parseInt(projectID));
    if (!project) {
        return res.status(404).json({ error: 'Project not found' });
    }

    // Use global task ID
    const taskId = getNextTaskId();

    const newTask = {
        id: taskId,
        wsID: parseInt(wsID),
        userID: parseInt(userID),
        projectID: parseInt(projectID),
        name,
        description,
        taskLevel,
        status,
        parentID: taskLevel === 1 ? parseInt(projectID) : parseInt(parentID),
        level1ID: 0,
        level2ID: 0,
        level3ID: 0,
        level4ID: 0,
        assignee1ID: parseInt(assignee1ID),
        assignee2ID: parseInt(assignee2ID),
        assignee3ID: parseInt(assignee3ID),
        estHours: parseFloat(estHours),
        estPrevHours: taskLevel === 2 ? [] : (estPrevHours !== undefined ? estPrevHours : 0),
        actHours: parseFloat(actHours),
        isExceeded,
        priority: 'low',
        info,
        taskType,
        dueDate: null,
        comments: "",
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        expanded: true
    };

    // Handle hierarchy levels
    if (taskLevel === 1) {
        newTask.level1ID = newTask.id;
    } else {
        const parentTask = project.tasks.find(t => t.id === newTask.parentID);
        if (!parentTask) return res.status(400).json({ error: 'Parent task not found' });

        switch (taskLevel) {
            case 2: // Subtask
                newTask.level1ID = parentTask.level1ID;
                newTask.level2ID = newTask.id;
                break;
            case 3: // Action Item
                newTask.level1ID = parentTask.level1ID;
                newTask.level2ID = parentTask.level2ID;
                newTask.level3ID = newTask.id;
                break;
            case 4: // Sub-action
                newTask.level1ID = parentTask.level1ID;
                newTask.level2ID = parentTask.level2ID;
                newTask.level3ID = parentTask.level3ID;
                newTask.level4ID = newTask.id;
                break;
>>>>>>> d0791c6423d6925ea1fc356569afd202b979f3a4
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

<<<<<<< HEAD
// GET tasks by project
app.get('/su/backend/projects/:projectId/tasks', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tasks WHERE projectID = ? ORDER BY createdAt DESC', [req.params.projectId]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching tasks for project:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST create new task
app.post('/su/backend/tasks', async (req, res) => {
    console.log('POST /su/backend/tasks - Received body:', req.body);
=======
// GET tasks for a specific project
app.get('/api/tasks/project/:projectId', (req, res) => {
    const projectId = parseInt(req.params.projectId);
    console.log('GET /api/tasks/project/:projectId - Looking for project:', projectId);
>>>>>>> d0791c6423d6925ea1fc356569afd202b979f3a4

    const requiredFields = ['wsID', 'userID', 'projectID', 'name', 'description', 'taskLevel', 'parentID', 'level1ID', 'level2ID', 'level3ID', 'level4ID', 'assignee1ID', 'assignee2ID', 'assignee3ID', 'estHours', 'estPrevHours', 'actHours', 'isExeceeded', 'info'];
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
            description, 
            taskLevel, 
            status = 'TODO', 
            parentID, 
            level1ID, 
            level2ID, 
            level3ID, 
            level4ID, 
            assignee1ID, 
            assignee2ID, 
            assignee3ID, 
            estHours, 
            estPrevHours, 
            actHours, 
            isExeceeded, 
            info 
        } = req.body;
        
        // Validate status enum
        const validStatuses = ['TODO', 'IN PROGRESS', 'COMPLETE', 'REVIEW', 'CLOSED', 'BACKLOG', 'CLARIFICATION'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }
        
        // Validate JSON fields
        let parsedEstPrevHours, parsedInfo;
        try {
            parsedEstPrevHours = typeof estPrevHours === 'string' ? JSON.parse(estPrevHours) : estPrevHours;
            parsedInfo = typeof info === 'string' ? JSON.parse(info) : info;
        } catch (jsonError) {
            return res.status(400).json({ error: 'Invalid JSON format for estPrevHours or info fields' });
        }
        
        const [result] = await pool.query(
            'INSERT INTO tasks (wsID, userID, projectID, name, description, taskLevel, status, parentID, level1ID, level2ID, level3ID, level4ID, assignee1ID, assignee2ID, assignee3ID, estHours, estPrevHours, actHours, isExeceeded, info) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [wsID, userID, projectID, name, description, taskLevel, status, parentID, level1ID, level2ID, level3ID, level4ID, assignee1ID, assignee2ID, assignee3ID, estHours, JSON.stringify(parsedEstPrevHours), actHours, isExeceeded, JSON.stringify(parsedInfo)]
        );
        
        const [newTask] = await pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
        console.log('Created new task:', newTask[0]);
        res.status(201).json(newTask[0]);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// PUT update task
<<<<<<< HEAD
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
=======
app.put('/api/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const updates = req.body;
    
    const project = projects.find(p => p.tasks.some(t => t.id === taskId));
    if (!project) return res.status(404).json({ error: 'Task not found' });

    const taskIndex = project.tasks.findIndex(t => t.id === taskId);
    const currentTask = project.tasks[taskIndex];
    const updatedTask = {
        ...currentTask,
        ...updates,
        modifiedAt: new Date().toISOString()
    };

    // Handle estHours and estPrevHours based on task level
    if (updates.estHours !== undefined) {
        updatedTask.estHours = parseFloat(updates.estHours);
        
        // For subtasks (level 2), use array format
        if (currentTask.taskLevel === 2) {
            updatedTask.estPrevHours = Array.isArray(currentTask.estPrevHours) ? 
                currentTask.estPrevHours : [];
        } else {
            // For other levels, store as single number
            updatedTask.estPrevHours = currentTask.estHours || 0;
        }
>>>>>>> d0791c6423d6925ea1fc356569afd202b979f3a4
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
app.listen(PORT, () => {
<<<<<<< HEAD
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API base URL: http://localhost:${PORT}/su/backend`);
=======
    console.log(`Server running on port ${PORT}`);
    console.log('Initial projects:', projects);
>>>>>>> d0791c6423d6925ea1fc356569afd202b979f3a4
});