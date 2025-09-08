import React, { useState, useEffect } from 'react';

const TaskManager = ({ socket, username }) => {
  const [tasks, setTasks] = useState([]);
  const [taskAssignments, setTaskAssignments] = useState({});
  const [activeTask, setActiveTask] = useState(null);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    // Listen for todo updates (which are our tasks)
    socket.on('todosUpdate', (updatedTodos) => {
      setTasks(updatedTodos);
    });

    // Listen for task assignment updates
    socket.on('taskAssignmentsUpdate', (assignments) => {
      setTaskAssignments(assignments);
    });

    // Listen for comment updates
    socket.on('commentsUpdate', (updatedComments) => {
      setComments(updatedComments);
    });

    // Request initial data
    socket.emit('getTodos');
    socket.emit('getTaskAssignments');
    socket.emit('getComments');

    return () => {
      socket.off('todosUpdate');
      socket.off('taskAssignmentsUpdate');
      socket.off('commentsUpdate');
    };
  }, [socket]);

  const handleTaskStatusChange = (taskId, completed) => {
    socket.emit('updateTaskStatus', { taskId, completed });
  };

  const handleDeleteTask = (taskId) => {
    socket.emit('deleteTodo', taskId);
    if (activeTask && activeTask.id === taskId) {
      setActiveTask(null);
    }
  };

  const handleAddComment = () => {
    if (activeTask && newComment.trim()) {
      socket.emit('addComment', {
        taskId: activeTask.id,
        comment: newComment,
        userId: socket.id,
        username: username || `User_${socket.id.slice(0, 4)}`,
        timestamp: new Date().toISOString()
      });
      setNewComment('');
    }
  };

  const handleAssignToMe = (taskId) => {
    socket.emit('assignTask', {
      taskId: taskId,
      assignedTo: socket.id,
      assignedName: username || `User_${socket.id.slice(0, 4)}`,
      assignedAt: new Date().toISOString(),
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Default deadline: 1 week
    });
  };

  const handleTakeTask = (taskId) => {
    socket.emit('takeTask', {
      taskId: taskId,
      userId: socket.id,
      username: username || `User_${socket.id.slice(0, 4)}`,
      takenAt: new Date().toISOString()
    });
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return 'Medium';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeUntilDeadline = (deadline) => {
    if (!deadline) return 'No deadline set';
    
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate - now;
    
    if (diffTime < 0) {
      return 'Overdue';
    }
    
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) {
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} remaining`;
    } else if (diffDays === 1) {
      return '1 day remaining';
    } else if (diffDays < 7) {
      return `${diffDays} days remaining`;
    } else {
      const diffWeeks = Math.ceil(diffDays / 7);
      return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} remaining`;
    }
  };

  return (
    <div className="p-6 bg-[#2E3440] text-gray-200 h-full">
      <div className="flex h-full gap-6">
        {/* Task List */}
        <div className="w-2/5 bg-[#3B4252] rounded-lg p-4 flex flex-col">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Tasks</h2>
            <p className="text-gray-400 text-sm">Manage and track your team's tasks</p>
          </div>
          <div className="space-y-3 overflow-y-auto flex-1 pr-2">
            {tasks.map((task) => {
              const assignment = taskAssignments[task.id];
              return (
                <div
                  key={task.id}
                  className={`bg-[#2E3440] p-4 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    activeTask?.id === task.id ? 'ring-2 ring-[#5E81AC]' : ''
                  } ${assignment?.completed ? 'opacity-75' : ''}`}
                  onClick={() => setActiveTask(task)}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-4 ${getPriorityColor(task.priority)} rounded-full`}></div>
                        <h3 className="font-bold text-white">{task.title}</h3>
                        {assignment?.completed && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                            Completed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-3 pl-4">{task.description || 'No description provided'}</p>
                      {assignment ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Assigned to: {assignment.assignedName || `User ${assignment.assignedTo.slice(0, 4)}`}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{getTimeUntilDeadline(assignment.deadline)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                            Unassigned
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {assignment ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskStatusChange(task.id, !assignment.completed);
                          }}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 ${
                            assignment.completed
                              ? 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        >
                          {assignment.completed ? 'Completed' : 'Mark Complete'}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignToMe(task.id);
                          }}
                          className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-md text-xs font-medium transition-colors duration-200"
                        >
                          Assign to Me
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs font-medium transition-colors duration-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task Details */}
        <div className="w-3/5 bg-[#3B4252] rounded-lg p-4 flex flex-col">
          {activeTask ? (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-6 ${getPriorityColor(activeTask.priority)} rounded-full`}></div>
                  <h2 className="text-2xl font-bold text-white">{activeTask.title}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full text-white ${getPriorityColor(activeTask.priority)}`}>
                    {getPriorityLabel(activeTask.priority)}
                  </span>
                </div>
                <p className="text-gray-400 mt-2">{activeTask.description || 'No description provided'}</p>
                <p className="text-gray-500 text-xs mt-1">Created: {formatDate(activeTask.createdAt)}</p>
                
                {taskAssignments[activeTask.id] ? (
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="bg-[#2E3440] p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-400 mb-2">Status</h3>
                      <p className="text-white flex items-center">
                        <span className={`w-3 h-3 rounded-full mr-2 ${
                          taskAssignments[activeTask.id].completed ? 'bg-green-500' : 'bg-yellow-500'
                        }`}></span>
                        {taskAssignments[activeTask.id].completed ? 'Completed' : 'In Progress'}
                      </p>
                    </div>
                    <div className="bg-[#2E3440] p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-400 mb-2">Deadline</h3>
                      <p className="text-white">
                        {getTimeUntilDeadline(taskAssignments[activeTask.id].deadline)}
                      </p>
                    </div>
                    <div className="bg-[#2E3440] p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-400 mb-2">Assigned To</h3>
                      <p className="text-white">
                        {taskAssignments[activeTask.id].assignedName || 
                          `User ${taskAssignments[activeTask.id].assignedTo.slice(0, 4)}`}
                      </p>
                    </div>
                    <div className="bg-[#2E3440] p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-400 mb-2">Assigned On</h3>
                      <p className="text-white">
                        {formatDate(taskAssignments[activeTask.id].assignedAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 p-4 bg-[#2E3440] rounded-lg">
                    <h3 className="text-lg font-medium text-white mb-3">This task is not assigned yet</h3>
                    <button
                      onClick={() => handleAssignToMe(activeTask.id)}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md font-medium transition-colors duration-200"
                    >
                      Assign to Me
                    </button>
                    <button
                      onClick={() => handleTakeTask(activeTask.id)}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors duration-200 ml-3"
                    >
                      Take This Task
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto mb-4">
                <h3 className="text-lg font-bold text-white mb-4">Comments</h3>
                <div className="space-y-3">
                  {(comments[activeTask.id] || []).length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No comments yet. Add one below.</p>
                  ) : (
                    (comments[activeTask.id] || []).map((comment, index) => (
                      <div key={index} className="bg-[#2E3440] p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-white">
                            {comment.username || `User ${comment.userId.slice(0, 4)}`}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(comment.timestamp)}
                          </span>
                        </div>
                        <p className="text-gray-300">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex gap-2">
                  <textarea
                    placeholder="Add a comment..."
                    className="flex-1 p-3 bg-[#2E3440] rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5E81AC] resize-none"
                    rows="2"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    className="px-4 bg-[#5E81AC] text-white rounded-lg hover:bg-[#81A1C1] transition-colors duration-200"
                    onClick={handleAddComment}
                  >
                    Post
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg">Select a task to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskManager; 