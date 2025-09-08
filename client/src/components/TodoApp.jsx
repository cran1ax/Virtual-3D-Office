import React, { useState, useEffect } from 'react';

const TodoApp = ({ socket, isDarkMode }) => {
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState('medium');
  const [editingTodo, setEditingTodo] = useState(null);

  useEffect(() => {
    // Listen for todos update from the server
    socket.on('todosUpdate', (updatedTodos) => {
      setTodos(updatedTodos);
    });

    // Request initial todos
    socket.emit('getTodos');

    // Clean up when component unmounts
    return () => {
      socket.off('todosUpdate');
    };
  }, [socket]);

  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    const todoData = {
      id: Date.now().toString(),
      title: newTodoText,
      description: newTodoDescription,
      priority: newTodoPriority,
      completed: false,
      createdAt: new Date().toISOString()
    };

    // Send new todo to server
    socket.emit('addTodo', todoData);

    // Clear inputs
    setNewTodoText('');
    setNewTodoDescription('');
    setNewTodoPriority('medium');
  };

  const handleUpdateTodo = (e) => {
    e.preventDefault();
    if (!editingTodo || !editingTodo.title.trim()) return;

    // Send updated todo to server
    socket.emit('updateTodo', editingTodo);
    
    // Clear editing state
    setEditingTodo(null);
  };

  const handleToggleTodo = (id) => {
    const todo = todos.find(t => t.id === id);
    if (todo) {
      socket.emit('updateTodo', {
        ...todo,
        completed: !todo.completed
      });
    }
  };

  const handleDeleteTodo = (id) => {
    socket.emit('deleteTodo', id);
  };

  const startEditingTodo = (todo) => {
    setEditingTodo({ ...todo });
  };

  const handleAssignToMe = (todo) => {
    socket.emit('assignTask', {
      taskId: todo.id,
      assignedTo: socket.id
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return isDarkMode ? 'bg-red-800' : 'bg-red-500';
      case 'medium': return isDarkMode ? 'bg-yellow-700' : 'bg-yellow-500';
      case 'low': return isDarkMode ? 'bg-green-700' : 'bg-green-500';
      default: return isDarkMode ? 'bg-blue-700' : 'bg-blue-500';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return 'Medium';
    }
  };

  return (
    <div className={`p-4 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} h-full overflow-y-auto`}>
      <h1 className="text-2xl font-bold mb-4">Task Management</h1>
      
      {!editingTodo ? (
        <form onSubmit={handleAddTodo} className="mb-6 space-y-3">
          <input
            type="text"
            className={`w-full p-2 border rounded ${
              isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
            }`}
            placeholder="Task title..."
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
          />
          
          <textarea
            className={`w-full p-2 border rounded ${
              isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
            }`}
            placeholder="Description (optional)..."
            value={newTodoDescription}
            onChange={(e) => setNewTodoDescription(e.target.value)}
            rows={2}
          />
          
          <div className="flex items-center">
            <label className="mr-2">Priority:</label>
            <select 
              value={newTodoPriority}
              onChange={(e) => setNewTodoPriority(e.target.value)}
              className={`p-2 border rounded ${
                isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Add Task
          </button>
        </form>
      ) : (
        <form onSubmit={handleUpdateTodo} className="mb-6 space-y-3">
          <input
            type="text"
            className={`w-full p-2 border rounded ${
              isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
            }`}
            placeholder="Task title..."
            value={editingTodo.title}
            onChange={(e) => setEditingTodo({...editingTodo, title: e.target.value})}
          />
          
          <textarea
            className={`w-full p-2 border rounded ${
              isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
            }`}
            placeholder="Description (optional)..."
            value={editingTodo.description || ''}
            onChange={(e) => setEditingTodo({...editingTodo, description: e.target.value})}
            rows={2}
          />
          
          <div className="flex items-center">
            <label className="mr-2">Priority:</label>
            <select 
              value={editingTodo.priority || 'medium'}
              onChange={(e) => setEditingTodo({...editingTodo, priority: e.target.value})}
              className={`p-2 border rounded ${
                isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          
          <div className="flex space-x-2">
            <button
              type="submit"
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => setEditingTodo(null)}
              className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      
      <div className="space-y-3">
        {todos.length === 0 ? (
          <p className={`text-${isDarkMode ? 'gray-400' : 'gray-500'}`}>No tasks yet. Add one above!</p>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className={`border rounded ${
                isDarkMode
                  ? 'border-gray-700 bg-gray-700'
                  : 'border-gray-200 bg-gray-50'
              } ${todo.completed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center p-3">
                <div className={`w-2 h-full mr-3 ${getPriorityColor(todo.priority)} rounded-full`}></div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => handleToggleTodo(todo.id)}
                      className="h-5 w-5"
                    />
                    <span className={`font-medium ${todo.completed ? 'line-through' : ''}`}>
                      {todo.title}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(todo.priority)} text-white`}>
                      {getPriorityLabel(todo.priority)}
                    </span>
                  </div>
                  
                  {todo.description && (
                    <p className={`mt-2 ml-7 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {todo.description}
                    </p>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => startEditingTodo(todo)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleAssignToMe(todo)}
                    className="text-purple-500 hover:text-purple-700"
                  >
                    Assign
                  </button>
                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TodoApp; 