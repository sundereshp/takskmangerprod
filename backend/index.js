const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

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
});

// GET single project
app.get('/api/projects/:id', (req, res) => {
    const project = projects.find(p => p.id === parseInt(req.params.id));
    if (!project) {
        return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
});

// POST create new project
app.post('/api/projects', (req, res) => {
    console.log('POST /api/projects - Received body:', req.body);

    const requiredFields = ['userID', 'name', 'startDate', 'endDate', 'wsID'];
    const missing = requiredFields.filter(field => !req.body[field]);

    if (missing.length > 0) {
        console.error('Missing required fields:', missing);
        return res.status(400).json({
            error: `Missing required fields: ${missing.join(', ')}`
        });
    }

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
});

// PATCH update project
app.patch('/api/projects/:id', (req, res) => {
    const projectId = parseInt(req.params.id);
    const projectIndex = projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
        return res.status(404).json({ error: 'Project not found' });
    }

    // Only allow updates to fields in the schema; ignore others
    const allowedUpdates = ['userID', 'name', 'description', 'startDate', 'endDate', 'estHours', 'actHours', 'wsID'];
    const updates = {};
    for (const key of allowedUpdates) {
        if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
        }
    }

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
});

// DELETE project
app.delete('/api/projects/:id', (req, res) => {
    const projectId = parseInt(req.params.id);
    const projectIndex = projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
        return res.status(404).json({ error: 'Project not found' });
    }

    projects = projects.filter(p => p.id !== projectId);
    res.json({ success: true });
});

// GET all tasks
app.get('/api/tasks', (req, res) => {
    const allTasks = projects.reduce((acc, project) => acc.concat(project.tasks), []);
    res.json(allTasks);
});

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
        }
    }

    project.tasks.push(newTask);
    res.status(201).json(newTask);
});

// GET tasks for a specific project
app.get('/api/tasks/project/:projectId', (req, res) => {
    const projectId = parseInt(req.params.projectId);
    console.log('GET /api/tasks/project/:projectId - Looking for project:', projectId);

    const project = projects.find(p => p.id === projectId);
    if (!project) {
        console.error('Project not found for ID:', projectId);
        return res.status(404).json({ error: 'Project not found' });
    }

    console.log('Returning tasks for project:', project.tasks);
    res.json(project.tasks);
});

// PUT update task
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
    }

    // Validation
    if (!updatedTask.wsID || !updatedTask.userID || !updatedTask.projectID || !updatedTask.name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    project.tasks[taskIndex] = updatedTask;
    res.json(updatedTask);
});

// DELETE task
app.delete('/api/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    
    const project = projects.find(p => p.tasks.some(t => t.id === taskId));
    if (!project) return res.status(404).json({ error: 'Task not found' });

    const taskToDelete = project.tasks.find(t => t.id === taskId);
    if (!taskToDelete) return res.status(404).json({ error: 'Task not found' });

    const idsToDelete = new Set([taskId]);

    // Determine which level ID to match based on the deleted task's level
    const levelMap = {
        1: 'level1ID',
        2: 'level2ID',
        3: 'level3ID',
        4: 'level4ID'
    };
    
    const targetField = levelMap[taskToDelete.taskLevel];
    
    // First pass: Get direct children
    project.tasks.forEach(t => {
        if (t[targetField] === taskId) {
            idsToDelete.add(t.id);
        }
    });

    // Subsequent passes: Find descendants of descendants
    let currentSize;
    do {
        currentSize = idsToDelete.size;
        project.tasks.forEach(t => {
            if (idsToDelete.has(t[targetField]) && !idsToDelete.has(t.id)) {
                idsToDelete.add(t.id);
            }
        });
    } while (currentSize !== idsToDelete.size);

    // Delete all collected tasks
    project.tasks = project.tasks.filter(t => !idsToDelete.has(t.id));
    
    res.json({ 
        success: true,
        deletedCount: idsToDelete.size
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Initial projects:', projects);
});