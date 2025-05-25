import { useState, useMemo, useEffect } from "react";
import { useTaskContext } from "../../context/TaskContext";
import { ActionItem, Priority, Status, Subtask, SubactionItem, Task, Project } from "@/types/task";
import { toast } from "sonner";
import { TaskTableHeader } from "./TaskTableHeader";
import { TableHead } from "./TableHead";
import { TaskRow } from "./TaskRow";
import { SubtaskRow } from "./SubtaskRow";
import { ActionItemRow } from "./ActionItemRow";
import { SubactionItemRow } from "./SubactionItemRow";
import { NewItemRow } from "./NewItemRow";
import { TimerDialog } from "./TimerDialog";
import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type SortDirection = 'asc' | 'desc' | 'none';

const statusOrder = ['backlog', 'clarification', 'todo', 'inprogress', 'review', 'complete', 'closed'];
const priorityOrder = ['none', 'low', 'normal', 'high', 'urgent'];

export function TaskTable() {
  const {
    selectedProject,
    users,
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
    timer,
    startTimer,
    stopTimer,
    updateItem,
  } = useTaskContext();

  const [editingItem, setEditingItem] = useState<{
    id: string;
    type: 'task' | 'subtask' | 'actionItem' | 'subactionItem';
    name: string;
  } | null>(null);

  const [newItemState, setNewItemState] = useState<{
    type: 'task' | 'subtask' | 'actionItem' | 'subactionItem';
    parentTaskId?: string;
    parentSubtaskId?: string;
    parentActionItemId?: string;
    name: string;
    status?: Status;
    fromExpand?: boolean;
  } | null>(null);

  const [isTimerDialogOpen, setIsTimerDialogOpen] = useState(false);
  const [timerDialogData, setTimerDialogData] = useState<{
    taskId: string;
    subtaskId: string;
    actionItems: ActionItem[];
    selectedActionItemId: string | null;
  } | null>(null);

  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number>(15); // Default is 15px

  const [sortConfig, setSortConfig] = useState<{
    [status: string]: {
      key: string;
      direction: SortDirection;
    };
  }>({});

  // New function to handle toggle expanded for action items
  const handleToggleActionItemExpand = (projectId: string, taskId: string, subtaskId: string, actionItemId: string) => {
    if (!selectedProject) return;

    const task = selectedProject.tasks.find(t => t.id === taskId);
    if (!task) return;

    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (!subtask) return;

    const actionItem = subtask.actionItems.find(a => a.id === actionItemId);
    if (!actionItem) return;

    if (actionItem.expanded) {
      // If already expanded, collapse
      updateActionItem(projectId, taskId, subtaskId, actionItemId, { expanded: false });
    } else {
      // If not expanded, expand
      updateActionItem(projectId, taskId, subtaskId, actionItemId, { expanded: true });

      // If no subaction items, show input for creating one, but don't auto-create it
      if (actionItem.subactionItems.length === 0) {
        setNewItemState({
          type: 'subactionItem',
          parentTaskId: taskId,
          parentSubtaskId: subtaskId,
          parentActionItemId: actionItemId,
          name: '',
          fromExpand: true
        });
      }
    }
  };

  const sortItems = (items: any[], key: string, dir: 'asc' | 'desc' | 'none'): any[] => {
    if (dir === 'none') return items;

    return [...items].sort((a, b) => {
      let valA, valB;

      switch (key) {
        case 'status':
          valA = statusOrder.indexOf(a.status || 'backlog');
          valB = statusOrder.indexOf(b.status || 'backlog');
          break;
        case 'priority':
          valA = priorityOrder.indexOf(a.priority || 'none');
          valB = priorityOrder.indexOf(b.priority || 'none');
          break;
        case 'dueDate':
          valA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          valB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          break;
        case 'estimatedTime':
          valA = (a.estimatedTime?.hours || 0) * 60 + (a.estimatedTime?.minutes || 0);
          valB = (b.estimatedTime?.hours || 0) * 60 + (b.estimatedTime?.minutes || 0);
          break;
        case 'name':
          valA = a.name?.toLowerCase() || '';
          valB = b.name?.toLowerCase() || '';
          break;
        default:
          valA = a[key];
          valB = b[key];
      }

      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSortChange = (status: string, key: string, direction: 'asc' | 'desc' | 'none') => {
    setSortConfig(prev => ({
      ...prev,
      [status]: { key, direction }
    }));
  };

  // Get sorted tasks for a specific status
  const getSortedTasks = (tasks: any[], status: string) => {
    const config = sortConfig[status];
    if (!config || config.direction === 'none') return tasks;

    return sortItems(tasks, config.key, config.direction).map(item => ({
      ...item,
      subtasks: item.subtasks ? getSortedTasks(item.subtasks, status) : [],
      actionItems: item.actionItems ? getSortedTasks(item.actionItems, status) : [],
      subactionItems: item.subactionItems ? getSortedTasks(item.subactionItems, status) : []
    }));
  };

  // Update the tasks assignment to use the original tasks
  const tasks = selectedProject?.tasks || [];

  // Track which statuses have tasks
  const [visibleStatuses, setVisibleStatuses] = useState<Set<Status>>(new Set(['todo']));

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    const grouped = tasks.reduce((acc, task) => {
      const status = task.status || 'backlog';
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(task);
      return acc;
    }, {} as Record<string, any[]>);

    return grouped;
  }, [tasks]);

  // Effect to update visible statuses when tasks change
  useEffect(() => {
    if (!selectedProject) return;

    const statuses = new Set<Status>(['todo']); // Always include 'todo'

    // Find all statuses that have at least one task
    const findAllStatuses = (items: any[]) => {
      items.forEach(item => {
        if (item.status) {
          statuses.add(item.status);
        }
        if (item.subtasks) findAllStatuses(item.subtasks);
        if (item.actionItems) findAllStatuses(item.actionItems);
        if (item.subactionItems) findAllStatuses(item.subactionItems);
      });
    };

    findAllStatuses(selectedProject.tasks);
    setVisibleStatuses(statuses);
  }, [selectedProject]);

  // Status columns in the desired order, filtered by visible statuses and whether they have tasks
  const statusColumns = useMemo(() => {
    const allStatuses = ['backlog', 'clarification', 'todo', 'inprogress', 'review', 'complete', 'closed'];

    // First, get all statuses that have tasks
    const statusesWithTasks = allStatuses.filter(status => {
      if (status === 'todo') return true; // Always include 'todo'
      return (groupedTasks[status] || []).length > 0;
    });

    // Then sort them with 'todo' always first, and the rest in their original order
    return statusesWithTasks.sort((a, b) => {
      if (a === 'todo') return -1;
      if (b === 'todo') return 1;
      return allStatuses.indexOf(a) - allStatuses.indexOf(b);
    });
  }, [groupedTasks]);

  // Status display names
  const statusDisplayNames: Record<Status, string> = {
    todo: 'To Do',
    inprogress: 'In Progress',
    complete: 'Complete',
    review: 'Review',
    closed: 'Closed',
    backlog: 'Backlog',
    clarification: 'Clarification Needed'
  };

  const handleSaveEdit = async () => {
    try {
      await updateItem(editingItem?.id, { name: editingItem?.name });
      setEditingItem(null);
    } catch (err) {
      console.error('Error saving task name:', err);
    }
  };

  const handleAddItem = (
    type: 'task' | 'subtask' | 'actionItem' | 'subactionItem',
    parentTaskId?: string,
    parentSubtaskId?: string,
    parentActionItemId?: string,
    status?: Status
  ) => {
    if (!selectedProject) {
      console.error('No project selected');
      return;
    }

    // Auto-expand all relevant parents when adding a new item
    if (type === 'subtask' && parentTaskId) {
      updateTask(selectedProject.id, parentTaskId, { expanded: true });
    }
    else if (type === 'actionItem' && parentTaskId && parentSubtaskId) {
      updateSubtask(selectedProject.id, parentTaskId, parentSubtaskId, { expanded: true });
    }
    else if (type === 'subactionItem' && parentTaskId && parentSubtaskId && parentActionItemId) {
      updateActionItem(
        selectedProject.id,
        parentTaskId,
        parentSubtaskId,
        parentActionItemId,
        { expanded: true }
      );
    }

    const newItem = {
      type,
      parentTaskId,
      parentSubtaskId,
      parentActionItemId,
      name: '',
      status
    };

    setNewItemState(newItem);
  };

  const handleSaveNewItem = async () => {
    if (!newItemState || !selectedProject || !newItemState.name.trim()) return;

    const { type, parentTaskId, parentSubtaskId, parentActionItemId, name, status } = newItemState;

    try {
      if (type === 'task') {
        await addTask(selectedProject.id, name, status);
      } else if (type === 'subtask' && parentTaskId) {
        await addSubtask(selectedProject.id, parentTaskId, name);
        // Ensure parent task stays expanded
        updateTask(selectedProject.id, parentTaskId, { expanded: true });
      } else if (type === 'actionItem' && parentTaskId && parentSubtaskId) {
        await addActionItem(selectedProject.id, parentTaskId, parentSubtaskId, name);
        // Ensure parent subtask stays expanded
        updateSubtask(selectedProject.id, parentTaskId, parentSubtaskId, { expanded: true });
        // Also ensure parent task is expanded
        updateTask(selectedProject.id, parentTaskId, { expanded: true });
      } else if (type === 'subactionItem' && parentTaskId && parentSubtaskId && parentActionItemId) {
        await addSubactionItem(selectedProject.id, parentTaskId, parentSubtaskId, parentActionItemId, name);
        // Ensure parent action item stays expanded
        updateActionItem(
          selectedProject.id,
          parentTaskId,
          parentSubtaskId,
          parentActionItemId,
          { expanded: true }
        );
        // Also ensure parent subtask and task are expanded
        updateSubtask(selectedProject.id, parentTaskId, parentSubtaskId, { expanded: true });
        updateTask(selectedProject.id, parentTaskId, { expanded: true });
      }
    } catch (error) {
      console.error('Error saving item:', error);
      return;
    }

    setNewItemState(null);
  };

  const handleDeleteItem = (id: string, type: 'task' | 'subtask' | 'actionItem' | 'subactionItem') => {
    if (!selectedProject) return;

    if (type === 'task') {
      deleteItem(selectedProject.id, id);
      toast.success("Task deleted");
    } else if (type === 'subtask') {
      const parentTask = selectedProject.tasks.find(task =>
        task.subtasks.some(subtask => subtask.id === id)
      );
      if (parentTask) {
        deleteItem(selectedProject.id, parentTask.id);
        toast.success("Subtask deleted");
      }
    } else if (type === 'actionItem') {
      for (const task of selectedProject.tasks) {
        for (const subtask of task.subtasks) {
          if (subtask.actionItems.some(ai => ai.id === id)) {
            deleteItem(selectedProject.id, subtask.id);
            toast.success("Action item deleted");
            return;
          }
        }
      }
    } else if (type === 'subactionItem') {
      for (const task of selectedProject.tasks) {
        for (const subtask of task.subtasks) {
          for (const actionItem of subtask.actionItems) {
            if (actionItem.subactionItems.some(sai => sai.id === id)) {
              deleteItem(selectedProject.id, subtask.id);
              toast.success("Subaction item deleted");
              return;
            }
          }
        }
      }
    }
  };

  const handleStartTimer = (taskId: string, subtaskId: string) => {
    const task = selectedProject.tasks.find(t => t.id === taskId);
    if (!task) return;

    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (!subtask) return;

    // If there's only one action item, start the timer for that
    if (subtask.actionItems.length === 1) {
      startTimer(selectedProject.id, subtask.actionItems[0].id);
      toast.success("Timer started");
      return;
    }

    // Otherwise open dialog to select action item
    setTimerDialogData({
      taskId,
      subtaskId,
      actionItems: subtask.actionItems,
      selectedActionItemId: null
    });

    setIsTimerDialogOpen(true);
  };

  const confirmStartTimer = () => {
    if (!timerDialogData?.selectedActionItemId || !selectedProject) return;

    startTimer(selectedProject.id, timerDialogData.selectedActionItemId);
    setIsTimerDialogOpen(false);
    setTimerDialogData(null);
    toast.success("Timer started");
  };

  const handleStopTimer = () => {
    stopTimer();
    toast.success("Timer stopped");
  };

  const isActiveTimer = (actionItemId: string): boolean => {
    return timer.isRunning && timer.actionItemId === actionItemId;
  };

  const adjustFontSize = (direction: 'increase' | 'decrease') => {
    if (direction === 'increase') {
      setFontSize(prev => Math.min(prev + 1, 20)); // Max size is 20px
    } else {
      setFontSize(prev => Math.max(prev - 1, 10)); // Min size is 10px
    }
  };

  // Update the updateTask function to ensure the status is visible when a task is moved to it
  const handleUpdateTask = async (projectId: string, taskId: string, updates: Partial<Task>) => {
    // If status is being updated, ensure it's in visibleStatuses
    if (updates.status) {
      setVisibleStatuses(prev => {
        const newStatuses = new Set(prev);
        newStatuses.add(updates.status as Status);
        return newStatuses;
      });
    }
    await updateTask(projectId, taskId, updates);
  };

  // Update the updateSubtask function - no need to update visibleStatuses for subtasks
  const handleUpdateSubtask = async (projectId: string, taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
    await updateSubtask(projectId, taskId, subtaskId, updates);
  };

  // Update the updateActionItem function - no need to update visibleStatuses for action items
  const handleUpdateActionItem = async (
    projectId: string,
    taskId: string,
    subtaskId: string,
    actionItemId: string,
    updates: Partial<ActionItem>
  ) => {
    await updateActionItem(projectId, taskId, subtaskId, actionItemId, updates);
  };

  // Update the updateSubactionItem function - no need to update visibleStatuses for subaction items
  const handleUpdateSubactionItem = async (
    projectId: string,
    taskId: string,
    subtaskId: string,
    actionItemId: string,
    subactionItemId: string,
    updates: Partial<SubactionItem>
  ) => {
    await updateSubactionItem(projectId, taskId, subtaskId, actionItemId, subactionItemId, updates);
  };

  // Add state variables for hours and minutes
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [estHours, setEstHours] = useState<number | null>(null);

  // Utility functions for time estimation
  const convertToDecimalTime = (hours: number, minutes: number): number => {
    return parseFloat((hours + (minutes / 60)).toFixed(2));
  };

  const isValidMinute = (minute: number): boolean => {
    return [10, 20, 30, 40, 50].includes(minute);
  };

  const handleTimeChange = (hours: number, minutes: number, itemId: string) => {
    if (!isValidMinute(minutes)) {
      toast.error('Please select a valid minute value (10, 20, 30, 40, 50)');
      return;
    }

    // Convert to decimal hours
    const decimalHours = convertToDecimalTime(hours, minutes);

    // Update the item with the decimal hours
    updateItem(itemId, {
      estHours: decimalHours
    });

    // Update local state
    setEstHours(decimalHours);
  };

  const renderTimeInputs = (itemId: string) => {
    // Convert decimal hours back to hours and minutes for display
    const getHoursAndMinutes = (decimalHours: number): { hours: number; minutes: number } => {
      const hours = Math.floor(decimalHours);
      const minutes = Math.round((decimalHours - hours) * 60);
      return { hours, minutes };
    };

    // Initialize hours and minutes from estHours
    useEffect(() => {
      if (estHours !== null) {
        const { hours: h, minutes: m } = getHoursAndMinutes(estHours);
        setHours(h);
        setMinutes(m);
      }
    }, [estHours]);

    return (
      <div className="flex space-x-2">
        <input
          type="number"
          placeholder="0"
          value={hours}
          onChange={(e) => {
            const value = parseInt(e.target.value) || 0;
            setHours(value);
            // Update minutes to 0 when hours change
            setMinutes(0);
          }}
          className="w-16 text-center"
        />
        <span className="text-center">:</span>
        <input
          type="number"
          placeholder="0"
          value={minutes}
          onChange={(e) => {
            const value = parseInt(e.target.value) || 0;
            if (value >= 60) {
              setHours(hours + 1);
              setMinutes(0);
            } else if (isValidMinute(value)) {
              setMinutes(value);
              // Update the item when minutes change
              handleTimeChange(hours, value, itemId);
            }
          }}
          className="w-16 text-center"
        />
      </div>
    );
  };

  const calculateTotalEstimatedTime = (project: Project) => {
    if (!project?.tasks) return 0;
    
    return (project.tasks || []).reduce((total, task) => {
      const subtaskSum = (task.subtasks || []).reduce((subTotal, subtask) => {
        const actionItemSum = (subtask.actionItems || []).reduce((actionTotal, actionItem) => {
          const subactionSum = (actionItem.subactionItems || []).reduce(
            (subactionTotal, subaction) => subactionTotal + (subaction?.estHours || 0),
            0
          );
          return actionTotal + (actionItem?.estHours || 0) + subactionSum;
        }, 0);
        return subTotal + (subtask?.estHours || 0) + actionItemSum;
      }, 0);
      return total + (task?.estHours || 0) + subtaskSum;
    }, 0);
  };

  return (
    <div className="w-full overflow-x-auto px-2 pb-6">
      {selectedProject && (
        <TaskTableHeader
          projectName={selectedProject?.name || ""}
          timer={timer}
          selectedProjectId={selectedProject?.id || ""}
          onStopTimer={handleStopTimer}
          totalEstimatedTime={calculateTotalEstimatedTime(selectedProject)}
        />
      )}

      {!selectedProject ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center p-6 bg-background rounded-lg shadow">
            <h3 className="text-lg font-medium mb-2">No Project Selected</h3>
            <p className="text-muted-foreground">Please select a project from the sidebar to get started</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {statusColumns.map((status) => (
            <div key={status} className="bg-background rounded-md shadow overflow-hidden">
              {/* Status Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <h2 className="text-lg font-semibold capitalize">
                  {statusDisplayNames[status]}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddItem('task', undefined, undefined, undefined, status as Status)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Task
                </Button>
              </div>

              {/* Table */}
              <table className="w-full border-separate border-spacing-0 border border-gray-200 dark:border-gray-700" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '300px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '60px' }} />
                </colgroup>
                <TableHead
                  onSortChange={handleSortChange}
                  sortConfig={sortConfig}
                  status={status}
                />
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {/* Show NewItemRow if it matches the current status */}
                  {newItemState?.type === 'task' && newItemState.status === status && (
                    <tr>
                        <NewItemRow
                          type="task"
                          name={newItemState.name}
                          setName={(name) => setNewItemState({ ...newItemState, name })}
                          onSave={handleSaveNewItem}
                          onCancel={() => setNewItemState(null)}
                          newItemState={newItemState}
                          selectedProject={selectedProject}
                          addTask={addTask}
                          addSubtask={addSubtask}
                          addActionItem={addActionItem}
                          addSubactionItem={addSubactionItem}
                          updateTask={updateTask}
                          updateSubtask={updateSubtask}
                          updateActionItem={updateActionItem}
                          setNewItemState={setNewItemState}
                          toast={toast}
                        />
                    </tr>
                  )}

                  {getSortedTasks(groupedTasks[status] || [], status).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-1 text-center text-gray-500">
                        No tasks in this status.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {getSortedTasks(groupedTasks[status] || [], status).map((task) => (
                        <React.Fragment key={`task-${task.id}`}>
                          <TaskRow
                            task={task}
                            users={users}
                            selectedProjectId={selectedProject?.id || ''}
                            hoveredRowId={hoveredRowId}
                            setHoveredRowId={setHoveredRowId}
                            editingItem={editingItem}
                            setEditingItem={setEditingItem}
                            toggleExpanded={toggleExpanded}
                            updateTask={handleUpdateTask}
                            handleSaveEdit={handleSaveEdit}
                            handleAddItem={handleAddItem}
                            subtaskCount={task.subtaskCount}
                          />
                          {task.expanded && (
                            <>
                              {newItemState &&
                                newItemState.type === 'subtask' &&
                                newItemState.parentTaskId === task.id && (
                                  <tr key={`new-subtask-${task.id}`}>
                                      <NewItemRow
                                        type="subtask"
                                        newItemState={newItemState}
                                        selectedProject={selectedProject}
                                        addTask={addTask}
                                        addSubtask={addSubtask}
                                        addActionItem={addActionItem}
                                        addSubactionItem={addSubactionItem}
                                        updateTask={updateTask}
                                        updateSubtask={updateSubtask}
                                        updateActionItem={updateActionItem}
                                        setNewItemState={setNewItemState}
                                        toast={toast}
                                        name={newItemState.name}
                                        setName={(name) => setNewItemState({ ...newItemState, name })}
                                        onSave={handleSaveNewItem}
                                        onCancel={() => {
                                          setNewItemState(null);
                                          if (newItemState.fromExpand) {
                                            toggleExpanded(selectedProject?.id || '', task.id, 'task');
                                          }
                                        }}
                                        parentTaskId={task.id}
                                      />
                                  </tr>
                                )}
                              {task.subtasks?.map((subtask) => (
                                <React.Fragment key={`subtask-${subtask.id}`}>
                                  <SubtaskRow
                                    subtask={subtask}
                                    taskId={task.id}
                                    users={users}
                                    selectedProjectId={selectedProject?.id || ''}
                                    hoveredRowId={hoveredRowId}
                                    setHoveredRowId={setHoveredRowId}
                                    editingItem={editingItem}
                                    setEditingItem={setEditingItem}
                                    toggleExpanded={toggleExpanded}
                                    updateSubtask={handleUpdateSubtask}
                                    handleSaveEdit={handleSaveEdit}
                                    handleDeleteItem={handleDeleteItem}
                                    handleAddItem={handleAddItem}
                                    handleStartTimer={handleStartTimer}
                                    parentTaskType={task.taskType || 'task'}
                                  />
                                  {subtask.expanded && (
                                    <>
                                      {newItemState &&
                                        newItemState.type === 'actionItem' &&
                                        newItemState.parentTaskId === task.id &&
                                        newItemState.parentSubtaskId === subtask.id && (
                                          <tr key={`new-action-item-${subtask.id}`}>
                                              <NewItemRow
                                                type="actionItem"
                                                newItemState={newItemState}
                                                selectedProject={selectedProject}
                                                addTask={addTask}
                                                addSubtask={addSubtask}
                                                addActionItem={addActionItem}
                                                addSubactionItem={addSubactionItem}
                                                updateTask={updateTask}
                                                updateSubtask={updateSubtask}
                                                updateActionItem={updateActionItem}
                                                setNewItemState={setNewItemState}
                                                toast={toast}
                                                name={newItemState.name}
                                                setName={(name) => setNewItemState({ ...newItemState, name })}
                                                onSave={handleSaveNewItem}
                                                onCancel={() => {
                                                  setNewItemState(null);
                                                  if (newItemState.fromExpand) {
                                                    toggleExpanded(selectedProject?.id || '', task.id, 'subtask', subtask.id);
                                                  }
                                                }}
                                                parentTaskId={task.id}
                                                parentSubtaskId={subtask.id}
                                          />
                                        </tr>
                                        )}
                                      {subtask.actionItems?.map((actionItem) => (
                                        <React.Fragment key={`action-item-${actionItem.id}`}>
                                          <ActionItemRow
                                            actionItem={actionItem}
                                            taskId={task.id}
                                            subtaskId={subtask.id}
                                            isActiveTimer={timer?.actionItemId === actionItem.id}
                                            users={users}
                                            selectedProjectId={selectedProject?.id || ''}
                                            hoveredRowId={hoveredRowId}
                                            setHoveredRowId={setHoveredRowId}
                                            editingItem={editingItem}
                                            setEditingItem={setEditingItem}
                                            toggleExpanded={handleToggleActionItemExpand}
                                            updateActionItem={handleUpdateActionItem}
                                            handleSaveEdit={handleSaveEdit}
                                            handleAddItem={handleAddItem}
                                            startTimer={handleStartTimer}
                                            stopTimer={handleStopTimer}
                                            parentTaskType={task.taskType || 'task'}
                                          />
                                          {actionItem.expanded && (
                                            <>
                                              {newItemState &&
                                                newItemState.type === 'subactionItem' &&
                                                newItemState.parentTaskId === task.id &&
                                                newItemState.parentSubtaskId === subtask.id &&
                                                newItemState.parentActionItemId === actionItem.id && (
                                                  <tr key={`new-subaction-item-${actionItem.id}`}>
                                                      <NewItemRow
                                                        type="subactionItem"
                                                        newItemState={newItemState}
                                                        selectedProject={selectedProject}
                                                        addTask={addTask}
                                                        addSubtask={addSubtask}
                                                        addActionItem={addActionItem}
                                                        addSubactionItem={addSubactionItem}
                                                        updateTask={updateTask}
                                                        updateSubtask={updateSubtask}
                                                        updateActionItem={updateActionItem}
                                                        setNewItemState={setNewItemState}
                                                        toast={toast}
                                                        name={newItemState.name}
                                                        setName={(name) => setNewItemState({ ...newItemState, name })}
                                                        onSave={handleSaveNewItem}
                                                        onCancel={() => {
                                                          setNewItemState(null);
                                                          if (newItemState.fromExpand) {
                                                            updateActionItem(
                                                              selectedProject?.id || '',
                                                              task.id,
                                                              subtask.id,
                                                              actionItem.id,
                                                              { expanded: false }
                                                            );
                                                          }
                                                        }}
                                                        parentTaskId={task.id}
                                                        parentSubtaskId={subtask.id}
                                                        parentActionItemId={actionItem.id}
                                                      />
                                                  </tr>
                                                )}
                                              {actionItem.subactionItems?.map((subactionItem) => (
                                                <SubactionItemRow
                                                  key={subactionItem.id}
                                                  subactionItem={subactionItem}
                                                  taskId={task.id}
                                                  subtaskId={subtask.id}
                                                  actionItemId={actionItem.id}
                                                  isActiveTimer={timer.isActive && timer.actionItemId === actionItem.id && timer.subactionItemId === subactionItem.id}
                                                  users={users}
                                                  selectedProjectId={selectedProject.id}
                                                  hoveredRowId={hoveredRowId}
                                                  setHoveredRowId={setHoveredRowId}
                                                  editingItem={editingItem}
                                                  setEditingItem={setEditingItem}
                                                  updateSubactionItem={handleUpdateSubactionItem}
                                                  handleSaveEdit={handleSaveEdit}
                                                  startTimer={handleStartTimer}
                                                  stopTimer={handleStopTimer}
                                                  parentTaskType={task.taskType || 'task'}
                                                  toggleExpanded={toggleExpanded}
                                                />
                                              ))}
                                            </>
                                          )}
                                        </React.Fragment>
                                      ))}
                                    </>
                                  )}
                                </React.Fragment>
                              ))}
                            </>
                          )}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      <TimerDialog
        open={isTimerDialogOpen}
        onClose={() => {
          setIsTimerDialogOpen(false);
          setTimerDialogData(null);
        }}
        taskId={timerDialogData?.taskId || ''}
        subtaskId={timerDialogData?.subtaskId || ''}
        actionItemId={timerDialogData?.selectedActionItemId || ''}
        subactionItemId=""
        actionItems={timerDialogData?.actionItems || []}
        onSelectActionItem={(actionItemId) => {
          if (timerDialogData) {
            setTimerDialogData({
              ...timerDialogData,
              selectedActionItemId: actionItemId
            });
          }
        }}
        onStartTimer={(actionItemId) => {
          if (selectedProject && actionItemId) {
            startTimer(selectedProject.id, actionItemId);
            toast.success("Timer started");
          }
        }}
      />
    </div>
  );
}
