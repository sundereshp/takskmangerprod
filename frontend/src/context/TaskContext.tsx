import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ActionItem, Priority, Project, Status, Subtask, Task, TimerInfo, User, SubactionItem, TaskType } from "../types/task";
import { addDays } from "date-fns";
import toast from 'react-hot-toast';

// Sample user data
const users: User[] = [
  { id: "1", name: "John Doe" },
  { id: "2", name: "Jane Williams Smith" },
  { id: "3", name: "Mike Johnson" },
  { id: "4", name: "Amy Chen" },
  { id: "5", name: "Bob Wilson" },
  { id: "6", name: "Chris Lee" },
];

interface TaskContextType {
  projects: Project[];
  users: User[];
  timer: TimerInfo;
  selectedProject: Project | null;
  addProject: (name: string) => void;
  updateProject: (projectId: string, name: string) => void;
  deleteProject: (projectId: string) => void;
  renameProject: (projectId: string, name: string) => void;
  duplicateProject: (projectId: string) => void;
  selectProject: (projectId: string | null) => void;
  addTask: (projectId: string, name: string, status?: Status, taskType?: TaskType) => void;
  updateTask: (projectId: string, taskId: string, updates: Partial<Task>) => void;
  addSubtask: (projectId: string, taskId: string, name: string, status?: Status, taskType?: TaskType) => void;
  updateSubtask: (projectId: string, taskId: string, subtaskId: string, updates: Partial<Subtask>) => void;
  addActionItem: (projectId: string, taskId: string, subtaskId: string, name: string, status?: Status, taskType?: TaskType) => void;
  updateActionItem: (projectId: string, taskId: string, subtaskId: string, actionItemId: string, updates: Partial<ActionItem>) => void;
  addSubactionItem: (projectId: string, taskId: string, subtaskId: string, actionItemId: string, name: string, status?: Status, taskType?: TaskType) => void;
  updateSubactionItem: (projectId: string, taskId: string, subtaskId: string, actionItemId: string, subactionItemId: string, updates: Partial<SubactionItem>) => void;
  toggleExpanded: (projectId: string, taskId: string, type: "task" | "subtask" | "actionItem" | "subactionItem", subtaskId?: string, actionItemId?: string, subactionItemId?: string) => void;
  startTimer: (projectId: string, actionItemId: string) => void;
  deleteItem: (projectId: string, itemId: string) => void;
  stopTimer: () => void;
  getUserById: (id: string | null) => User | undefined;
  updateItem: (itemId: string, updates: any) => void;
  fetchTasks: (projectId: string) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [timer, setTimer] = useState<TimerInfo>({
    projectId: null,
    taskId: null,
    subtaskId: null,
    actionItemId: null,
    subactionItemId: null,
    startTime: null,
    isActive: false,
    isRunning: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load of projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('http://localhost:5000/api/projects');
        if (!response.ok) throw new Error('Failed to fetch projects');
        const fetchedProjects = await response.json();

        // Initialize projects with empty tasks arrays
        const projectsWithTasks = fetchedProjects.map(project => ({
          ...project,
          tasks: []
        }));

        setProjects(projectsWithTasks);

        // If no projects exist, create a default one
        if (fetchedProjects.length === 0) {
          const defaultProject = await addProject('Default Project');
          setSelectedProjectId(defaultProject.id.toString());
        } else {
          // Select the first project by default and load its tasks
          const firstProjectId = fetchedProjects[0].id.toString();
          setSelectedProjectId(firstProjectId);
          await fetchTasks(firstProjectId);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to fetch projects');
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // Load tasks when selected project changes


  // Build task tree from flat array
  function buildTaskTree(tasks: any[]) {
    const tasksById: Record<string, any> = {};
    const rootTasks: any[] = [];

    // First pass: create task objects with empty children arrays
    tasks.forEach(task => {
      tasksById[task.id] = {
        ...task,
        subtasks: [],
        actionItems: [],
        subactionItems: [],
        // Ensure dueDate is a Date object if it exists
        dueDate: task.dueDate ? new Date(task.dueDate) : null
      };
    });

    // Second pass: build hierarchy
    tasks.forEach(task => {
      const taskObj = tasksById[task.id];

      if (task.taskLevel === 1) {
        // Top-level task
        rootTasks.push(taskObj);
      } else if (task.taskLevel === 2) {
        // Subtask - add to parent task
        const parentTask = tasksById[task.level1ID];
        if (parentTask) {
          parentTask.subtasks.push(taskObj);
        }
      } else if (task.taskLevel === 3) {
        // Action item - add to parent subtask
        const parentSubtask = tasksById[task.level2ID];
        if (parentSubtask) {
          parentSubtask.actionItems.push(taskObj);
        }
      } else if (task.taskLevel === 4) {
        // Subaction item - add to parent action item
        const parentActionItem = tasksById[task.level3ID];
        if (parentActionItem) {
          parentActionItem.subactionItems.push(taskObj);
        }
      }
    });

    return rootTasks;
  }

  // In TaskContext.tsx
  const fetchTasks = useCallback(async (projectId: string) => {
    if (!projectId) return;

    try {
      const response = await fetch(`http://localhost:5000/api/tasks/project/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');

      const tasks = await response.json();
      const tree = buildTaskTree(tasks);

      setProjects(prevProjects =>
        prevProjects.map(project =>
          project.id.toString() === projectId
            ? { ...project, tasks: tree }
            : project
        )
      );
    } catch (err) {
      console.error('Error fetching tasks:', err);
      toast.error('Failed to load tasks');
    }
  }, []);
  useEffect(() => {
    if (selectedProjectId) {
      fetchTasks(selectedProjectId);
    }
  }, [selectedProjectId, fetchTasks]);

  const selectedProject = projects.find(p => p.id.toString() === selectedProjectId) || null;

  const addProject = async (name: string) => {
    try {
      const response = await fetch('http://localhost:5000/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userID: 1,
          name,
          startDate: new Date().toISOString(),
          endDate: addDays(new Date(), 30).toISOString(),
          wsID: 1
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create project');
      }

      const createdProject = await response.json();
      const projectWithTasks = { ...createdProject, tasks: [] };

      setProjects(prev => [...prev, projectWithTasks]);
      setSelectedProjectId(createdProject.id.toString());

      toast.success('Project created successfully');
      return createdProject;
    } catch (err) {
      console.error('Error adding project:', err);
      toast.error('Failed to create project');
      throw err;
    }
  };

  const updateProject = (projectId: string, name: string) => {
    setProjects(projects.map(project =>
      project.id.toString() === projectId ? { ...project, name } : project
    ));
  };

  const renameProject = async (projectId: string, name: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      if (!response.ok) throw new Error('Failed to rename project');

      const updatedProject = await response.json();
      setProjects(prev =>
        prev.map(project =>
          project.id.toString() === updatedProject.id.toString()
            ? { ...project, ...updatedProject }
            : project
        )
      );

      toast.success('Project renamed successfully');
    } catch (err) {
      console.error('Error renaming project:', err);
      toast.error('Failed to rename project');
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete project');

      setProjects(prev => prev.filter(project => project.id.toString() !== projectId));

      if (selectedProjectId === projectId) {
        const remainingProjects = projects.filter(p => p.id.toString() !== projectId);
        setSelectedProjectId(remainingProjects.length > 0 ? remainingProjects[0].id.toString() : null);
      }

      toast.success('Project deleted successfully');
    } catch (err) {
      console.error('Error deleting project:', err);
      toast.error('Failed to delete project');
    }
  };

  const duplicateProject = async (projectId: string) => {
    try {
      const sourceProject = projects.find(p => p.id.toString() === projectId);
      if (!sourceProject) return;

      // Extract base name by removing any existing number in parentheses
      const baseName = sourceProject.name.replace(/\s*\(\d+\)$/, '').trim();

      // Find all existing project names that match the base name pattern
      const existingNumbers: number[] = [];
      const projectNamePattern = new RegExp(`^${escapeRegExp(baseName)}(?:\s*\((\d+)\))?$`);

      projects.forEach(project => {
        const match = project.name.match(projectNamePattern);
        if (match) {
          if (match[1]) {
            existingNumbers.push(parseInt(match[1], 10));
          } else {
            existingNumbers.push(0);
          }
        }
      });

      // Find the lowest unused positive integer
      let nextNumber = 1;
      while (existingNumbers.includes(nextNumber)) {
        nextNumber++;
      }

      let newProjectName = `${baseName} (${nextNumber})`;

      // Check if the new project name already exists
      while (projects.some(project => project.name === newProjectName)) {
        nextNumber++;
        newProjectName = `${baseName} (${nextNumber})`;
      }

      // Create the new project via API
      const projectResponse = await fetch('http://localhost:5000/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userID: 1,
          name: newProjectName,
          startDate: sourceProject.startDate || new Date().toISOString(),
          endDate: sourceProject.endDate || addDays(new Date(), 30).toISOString(),
          wsID: 1
        })
      });

      if (!projectResponse.ok) throw new Error('Failed to create project copy');

      const newProject = await projectResponse.json();

      // Fetch the source project's tasks
      const tasksResponse = await fetch(`http://localhost:5000/api/tasks/project/${projectId}`);
      if (!tasksResponse.ok) throw new Error('Failed to fetch tasks for duplication');

      const tasks = await tasksResponse.json();

      // Create tasks with updated project ID
      for (const task of tasks) {
        const { id: oldId, ...taskData } = task;
        const newTask = {
          ...taskData,
          projectID: parseInt(newProject.id),
          // Reset task state
          status: task.status === 'completed' ? 'todo' : task.status,
          completedAt: null,
          completedBy: null
        };

        const response = await fetch('http://localhost:5000/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask)
        });

        if (!response.ok) throw new Error('Failed to duplicate task');
      }

      // Refresh the projects list
      const updatedProjectsResponse = await fetch('http://localhost:5000/api/projects');
      if (!updatedProjectsResponse.ok) throw new Error('Failed to fetch updated projects');

      const updatedProjects = await updatedProjectsResponse.json();
      const projectsWithTasks = updatedProjects.map(project => ({
        ...project,
        tasks: project.id.toString() === newProject.id.toString() ? [] :
          projects.find(p => p.id.toString() === project.id.toString())?.tasks || []
      }));

      setProjects(projectsWithTasks);
      setSelectedProjectId(newProject.id.toString());

      // Load tasks for the new project
      await fetchTasks(newProject.id.toString());

      toast.success('Project duplicated successfully');
    } catch (err) {
      console.error('Error duplicating project:', err);
      toast.error('Failed to duplicate project');
    }
  };

  const selectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId);
  };

  const addTask = async (projectId: string, name: string, status: Status = 'todo', taskType: TaskType = 'task') => {
    if (!name.trim()) return;

    const newTaskPayload = {
      name,
      wsID: 1,
      userID: 1,
      projectID: parseInt(projectId),
      taskLevel: 1,
      status,
      taskType: 'task',
      parentID: parseInt(projectId),
      assignee1ID: 0,
      assignee2ID: 0,
      assignee3ID: 0,
      estHours: 0,
      estPrevHours: 0,
      actHours: 0,
      isExceeded: 0,
      info: {},
      description: ''
    };

    try {
      const response = await fetch('http://localhost:5000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTaskPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create task');
      }

      // After successfully adding the task, refresh the task list
      await fetchTasks(projectId);
      toast.success('Task created successfully');
    } catch (err) {
      console.error('Error adding task:', err);
      toast.error('Failed to create task');
      throw err;
    }
  };

  const updateTask = useCallback(async (projectId: string, taskId: string, updates: Partial<Task>) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update task');

      await fetchTasks(projectId);
      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  }, []);

  const addSubtask = async (projectId: string, taskId: string, name: string, status: Status = 'todo', taskType: TaskType = 'task') => {
    if (!name.trim()) return;

    const newSubtaskPayload = {
      name,
      wsID: 1,
      userID: 1,
      projectID: parseInt(projectId),
      taskLevel: 2,
      status,
      taskType,
      parentID: parseInt(taskId),
      estPrevHours: [] // Array for subtasks
    };

    try {
      const response = await fetch('http://localhost:5000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubtaskPayload)
      });

      if (!response.ok) throw new Error('Failed to create subtask');

      const createdSubtask = await response.json();
      await fetchTasks(projectId);
      toast.success('Subtask created successfully');
      return createdSubtask;
    } catch (err) {
      console.error('Error adding subtask:', err);
      toast.error('Failed to create subtask');
      throw err;
    }
  };

  const updateSubtask = async (projectId: string, taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update subtask');

      await fetchTasks(projectId);
      toast.success('Subtask updated successfully');
    } catch (err) {
      console.error('Error updating subtask:', err);
      toast.error('Failed to update subtask');
      throw err;
    }
  };

  const addActionItem = async (projectId: string, taskId: string, subtaskId: string, name: string, status: Status = 'todo', taskType: TaskType = 'task') => {
    try {
      const newActionItemPayload = {
        name,
        wsID: 1,
        userID: 1,
        projectID: parseInt(projectId),
        taskLevel: 3,
        status,
        taskType,
        parentID: parseInt(subtaskId),
      };

      const response = await fetch('http://localhost:5000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newActionItemPayload)
      });

      if (!response.ok) throw new Error('Failed to create action item');

      const createdActionItem = await response.json();
      await fetchTasks(projectId);
      toast.success('Action item created successfully');
      return createdActionItem;
    } catch (err) {
      console.error('Error adding action item:', err);
      toast.error('Failed to create action item');
      throw err;
    }
  };

  const updateActionItem = async (
    projectId: string,
    taskId: string,
    subtaskId: string,
    actionItemId: string,
    updates: Partial<ActionItem>
  ) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${actionItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update action item');

      await fetchTasks(projectId);
      toast.success('Action item updated successfully');
    } catch (err) {
      console.error('Error updating action item:', err);
      toast.error('Failed to update action item');
      throw err;
    }
  };

  const addSubactionItem = async (projectId: string, taskId: string, subtaskId: string, actionItemId: string, name: string, status: Status = 'todo', taskType: TaskType = 'task') => {
    try {
      const newSubactionPayload = {
        name,
        wsID: 1,
        userID: 1,
        projectID: parseInt(projectId),
        taskLevel: 4,
        status,
        taskType,
        parentID: parseInt(actionItemId),
      };

      const response = await fetch('http://localhost:5000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubactionPayload)
      });

      if (!response.ok) throw new Error('Failed to create subaction item');

      const createdSubaction = await response.json();
      await fetchTasks(projectId);
      toast.success('Subaction item created successfully');
      return createdSubaction;
    } catch (err) {
      console.error('Error adding subaction item:', err);
      toast.error('Failed to create subaction item');
      throw err;
    }
  };

  const updateSubactionItem = async (
    projectId: string,
    taskId: string,
    subtaskId: string,
    actionItemId: string,
    subactionItemId: string,
    updates: Partial<SubactionItem>
  ) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${subactionItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update subaction item');

      await fetchTasks(projectId);
      toast.success('Subaction item updated successfully');
    } catch (err) {
      console.error('Error updating subaction item:', err);
      toast.error('Failed to update subaction item');
      throw err;
    }
  };

  const updateItem = async (itemId: string, updates: any) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update item');

      if (selectedProjectId) {
        await fetchTasks(selectedProjectId);
      }
    } catch (err) {
      console.error('Error updating item:', err);
      throw err;
    }
  };

  const deleteItem = async (projectId: string, itemId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete item');

      await fetchTasks(projectId);
      toast.success('Item deleted successfully');
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error('Failed to delete item');
      throw err;
    }
  };

  const toggleExpanded = async (
    projectId: string,
    taskId: string,
    type: "task" | "subtask" | "actionItem" | "subactionItem",
    subtaskId?: string,
    actionItemId?: string,
    subactionItemId?: string
  ) => {
    // Find the item to toggle
    let itemId: string;
    let currentExpanded: boolean = false;

    if (type === "task") {
      itemId = taskId;
      const project = projects.find(p => p.id.toString() === projectId);
      const task = project?.tasks.find(t => t.id.toString() === taskId);
      currentExpanded = task?.expanded || false;
    } else if (type === "subtask" && subtaskId) {
      itemId = subtaskId;
      const project = projects.find(p => p.id.toString() === projectId);
      const task = project?.tasks.find(t => t.id.toString() === taskId);
      const subtask = task?.subtasks.find(s => s.id.toString() === subtaskId);
      currentExpanded = subtask?.expanded || false;
    } else if (type === "actionItem" && subtaskId && actionItemId) {
      itemId = actionItemId;
      const project = projects.find(p => p.id.toString() === projectId);
      const task = project?.tasks.find(t => t.id.toString() === taskId);
      const subtask = task?.subtasks.find(s => s.id.toString() === subtaskId);
      const actionItem = subtask?.actionItems.find(a => a.id.toString() === actionItemId);
      currentExpanded = actionItem?.expanded || false;
    } else {
      return; // Subaction items don't have children to expand
    }

    try {
      await updateItem(itemId, { expanded: !currentExpanded });
    } catch (err) {
      console.error('Error toggling expanded state:', err);
    }
  };

  const startTimer = (projectId: string, actionItemId: string) => {
    setTimer({
      projectId,
      taskId: null,
      subtaskId: null,
      actionItemId,
      subactionItemId: null,
      startTime: new Date(),
      isActive: true,
      isRunning: true
    });
  };

  const stopTimer = () => {
    if (timer.isRunning && timer.startTime && timer.projectId && timer.actionItemId) {
      const endTime = new Date();
      const timeSpent = Math.floor((endTime.getTime() - timer.startTime.getTime()) / 60000); // minutes

      // Update the action item with time spent
      updateItem(timer.actionItemId, {
        actHours: timeSpent // This would need to be added to existing time
      });
    }

    setTimer({
      projectId: null,
      taskId: null,
      subtaskId: null,
      actionItemId: null,
      subactionItemId: null,
      startTime: null,
      isActive: false,
      isRunning: false
    });
  };

  const getUserById = (id: string | null) => {
    if (!id) return undefined;
    return users.find(user => user.id === id);
  };

  return (
    <TaskContext.Provider value={{
      projects,
      users,
      timer,
      selectedProject,
      addProject,
      updateProject,
      deleteProject,
      renameProject,
      duplicateProject,
      selectProject,
      addTask,
      updateTask,
      addSubtask,
      updateSubtask,
      addActionItem,
      updateActionItem,
      addSubactionItem,
      updateSubactionItem,
      deleteItem,
      toggleExpanded,
      startTimer,
      stopTimer,
      getUserById,
      updateItem,
      fetchTasks,
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export const useTaskContext = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTaskContext must be used within a TaskProvider");
  }
  return context;
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}