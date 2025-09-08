const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const { nanoid } = require('nanoid');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const pathfinding = require('pathfinding');

// Load environment variables
dotenv.config();

const origin = process.env.CLIENT_URL || "http://localhost:5173";
const port = process.env.PORT || 3000;

// Create Express app first
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with the server
const io = new socketIo.Server(server, {
  cors: {
    origin,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Enable CORS for all routes
app.use(cors({
  origin: [origin, 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Parse JSON bodies
app.use(bodyParser.json());

console.log("Server configured with CORS for origin: " + origin);

console.log("Server started on port " + port + ", allowed cors origin: " + origin);

// PATHFINDING UTILS

const finder = new pathfinding.AStarFinder({
  allowDiagonal: true,
  dontCrossCorners: true,
});

const findPath = (room, start, end) => {
  const gridClone = room.grid.clone();
  const path = finder.findPath(start[0], start[1], end[0], end[1], gridClone);
  return path;
};

const updateGrid = (room) => {
  // RESET GRID FOR ROOM
  for (let x = 0; x < room.size[0] * room.gridDivision; x++) {
    for (let y = 0; y < room.size[1] * room.gridDivision; y++) {
      room.grid.setWalkableAt(x, y, true);
    }
  }

  room.items.forEach((item) => {
    if (item.walkable || item.wall) {
      return;
    }
    const width =
      item.rotation === 1 || item.rotation === 3 ? item.size[1] : item.size[0];
    const height =
      item.rotation === 1 || item.rotation === 3 ? item.size[0] : item.size[1];
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        room.grid.setWalkableAt(
          item.gridPosition[0] + x,
          item.gridPosition[1] + y,
          false
        );
      }
    }
  });
};

// ROOMS MANAGEMENT
const rooms = [];

const loadRooms = async () => {
  let data;
  try {
    data = fs.readFileSync("rooms.json", "utf8");
  } catch (ex) {
    console.log("No rooms.json file found, using default file");
    try {
      data = fs.readFileSync("default.json", "utf8");
    } catch (ex) {
      console.log("No default.json file found, exiting");
      process.exit(1);
    }
  }
  data = JSON.parse(data);
  data.forEach((roomItem) => {
    const room = {
      ...roomItem,
      size: [7, 7], // HARDCODED FOR SIMPLICITY PURPOSES
      gridDivision: 2,
      characters: [],
    };
    room.grid = new pathfinding.Grid(
      room.size[0] * room.gridDivision,
      room.size[1] * room.gridDivision
    );
    updateGrid(room);
    rooms.push(room);
  });
};

loadRooms();

// UTILS

const generateRandomPosition = (room) => {
  // TO AVOID INFINITE LOOP WE LIMIT TO 100, BEST WOULD BE TO CHECK IF THERE IS ENOUGH SPACE LEFT 🤭
  for (let i = 0; i < 100; i++) {
    const x = Math.floor(Math.random() * room.size[0] * room.gridDivision);
    const y = Math.floor(Math.random() * room.size[1] * room.gridDivision);
    if (room.grid.isWalkableAt(x, y)) {
      return [x, y];
    }
  }
};

// Laptop UI state
const tasks = new Map();
const codeContent = new Map();
const chatMessages = new Map();
const editRequests = new Map();

// Store todos for each room
const roomTodos = new Map();
const roomCodes = new Map();

// Voice call state
const activeCalls = new Map(); // roomId -> { meetingId, participants: Map<userId, {displayName, isMuted}>, host: userId }

// Task management state
const roomTasks = new Map(); // roomId -> tasks[]
const roomComments = new Map(); // roomId -> { taskId: comments[] }
const taskAssignments = new Map(); // roomId -> { taskId: assignment }

// SOCKET MANAGEMENT

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);
  
    let room = null;
    let character = null;

    socket.emit("welcome", {
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        nbCharacters: room.characters.length,
      })),
      items,
    });

    socket.on("joinRoom", (roomId, opts) => {
      room = rooms.find((room) => room.id === roomId);
      if (!room) {
        return;
      }
      socket.join(room.id);
      character = {
        id: socket.id,
        session: parseInt(Math.random() * 1000),
        position: generateRandomPosition(room),
        avatarUrl: opts.avatarUrl,
      };
      room.characters.push(character);

      // Initialize room data if not exists
      if (!roomCodes.has(room.id)) {
        roomCodes.set(room.id, '');
      }

      // Emit initial states
      socket.emit('codeUpdate', roomCodes.get(room.id));
      socket.emit('editPermissionUpdate', {
        canEdit: true,
        isAdmin: true
      });

      // Broadcast user count to all users in room
      io.to(room.id).emit('userCountUpdate', {
        count: room.characters.length
      });

      // Initialize todos for the room if not exists
      if (!roomTodos.has(room.id)) {
        roomTodos.set(room.id, []);
      }

      socket.emit("roomJoined", {
        map: {
          gridDivision: room.gridDivision,
          size: room.size,
          items: room.items,
        },
        characters: room.characters,
        id: socket.id,
      });
      onRoomUpdate();

      // Set admin status based on being first user
      socket.emit('userRole', { 
        isAdmin: room.characters.length === 1 
      });
    });

    const onRoomUpdate = () => {
    if (!room) return;
    
      io.to(room.id).emit("characters", room.characters);
      io.emit(
        "rooms",
        rooms.map((room) => ({
          id: room.id,
          name: room.name,
          nbCharacters: room.characters.length,
        }))
      );
    };

    socket.on("leaveRoom", () => {
      if (!room) {
        return;
      }
      socket.leave(room.id);
      room.characters.splice(
        room.characters.findIndex((character) => character.id === socket.id),
        1
      );
      onRoomUpdate();
      room = null;
    });

    socket.on("characterAvatarUpdate", (avatarUrl) => {
      character.avatarUrl = avatarUrl;
      io.to(room.id).emit("characters", room.characters);
    });

    socket.on("move", (from, to) => {
      const path = findPath(room, from, to);
      if (!path) {
        return;
      }
      character.position = from;
      character.path = path;
      io.to(room.id).emit("playerMove", character);
    });

    socket.on("dance", () => {
      io.to(room.id).emit("playerDance", {
        id: socket.id,
      });
    });

    socket.on("chatMessage", (message) => {
      io.to(room.id).emit("playerChatMessage", {
        id: socket.id,
        message,
      });
    });

    socket.on("passwordCheck", (password) => {
      if (password === room.password) {
        socket.emit("passwordCheckSuccess");
        character.canUpdateRoom = true;
      } else {
        socket.emit("passwordCheckFail");
      }
    });

    socket.on("itemsUpdate", async (items) => {
      if (!character.canUpdateRoom) {
        return;
      }
      if (!items || items.length === 0) {
        return; // security
      }
      room.items = items;
      updateGrid(room);
      room.characters.forEach((character) => {
        character.path = [];
        character.position = generateRandomPosition(room);
      });
      io.to(room.id).emit("mapUpdate", {
        map: {
          gridDivision: room.gridDivision,
          size: room.size,
          items: room.items,
        },
        characters: room.characters,
      });

      fs.writeFileSync("rooms.json", JSON.stringify(rooms, null, 2));
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
      if (room) {
        // Handle voice call cleanup
        if (activeCalls.has(room.id)) {
          const call = activeCalls.get(room.id);
        
        // Check if this user was in the call
        if (call.participants.has(socket.id)) {
          console.log(`Participant ${socket.id} disconnected from call in room ${room.id}`);
          
          // Get participant info before removing
          const participant = call.participants.get(socket.id);
          
          // Remove the participant
          call.participants.delete(socket.id);

          // Check if this was the host
          if (call.host === socket.id) {
            console.log(`Host ${socket.id} disconnected from call in room ${room.id}`);
            
            // If there are other participants, select a new host
            if (call.participants.size > 0) {
              // Select the first participant as the new host
              const newHost = [...call.participants.keys()][0];
              call.host = newHost;
              
              console.log(`New host assigned: ${newHost} in room ${room.id}`);
              
              // Notify all participants about the host change
              io.to(room.id).emit('host-changed', { 
                previousHost: socket.id,
                newHost,
                displayName: call.participants.get(newHost).displayName
              });
            } else {
              // If no participants left, end the call
              console.log(`Call in room ${room.id} has ended - last participant disconnected`);
            activeCalls.delete(room.id);
            }
          } else {
            // Notify remaining participants if there are any
            if (call.participants.size > 0) {
              io.to(room.id).emit('user-left', { 
                userId: socket.id,
                displayName: participant.displayName
              });
              
              console.log(`Call in room ${room.id} now has ${call.participants.size} participants after disconnect`);
            } else {
              // If this was the last participant, clean up the call
              console.log(`Call in room ${room.id} has ended - last participant disconnected`);
              activeCalls.delete(room.id);
            }
          }
          }
        }

        // Broadcast new user count
        io.to(room.id).emit('userCountUpdate', {
          count: room.characters.length - 1 // Subtract 1 because this user is about to be removed
        });

        room.characters.splice(
          room.characters.findIndex((character) => character.id === socket.id),
          1
        );
        onRoomUpdate();
        room = null;
      }
    });

    socket.on('createTask', (task) => {
      if (room) {
        const tasks = roomTasks.get(room.id) || [];
        tasks.push(task);
        roomTasks.set(room.id, tasks);
        io.to(room.id).emit('tasksUpdate', tasks);
      }
    });

    socket.on('reorderTasks', (reorderedTasks) => {
      if (room) {
        roomTasks.set(room.id, reorderedTasks);
        io.to(room.id).emit('tasksUpdate', reorderedTasks);
      }
    });

    socket.on('updateTaskStatus', ({ taskId, status }) => {
      if (room) {
        const tasks = roomTasks.get(room.id) || [];
        const updatedTasks = tasks.map(task =>
          task.id === taskId ? { ...task, status } : task
        );
        roomTasks.set(room.id, updatedTasks);
        io.to(room.id).emit('tasksUpdate', updatedTasks);
      }
    });

  socket.on('addComment', ({ taskId, comment, userId, username, timestamp }) => {
      if (room) {
        const comments = roomComments.get(room.id) || {};
        if (!comments[taskId]) {
          comments[taskId] = [];
        }
      
      comments[taskId].push({
        userId,
        username: username || `User_${userId.slice(0, 4)}`,
        comment,
        timestamp: timestamp || new Date().toISOString()
      });
      
        roomComments.set(room.id, comments);
        io.to(room.id).emit('commentsUpdate', comments);
      }
    });

    socket.on('getTasks', () => {
      if (room) {
        const tasks = roomTasks.get(room.id) || [];
        socket.emit('tasksUpdate', tasks);
      }
    });

    socket.on('getComments', () => {
      if (room) {
        const comments = roomComments.get(room.id) || {};
        socket.emit('commentsUpdate', comments);
      }
    });

    socket.on('codeUpdate', ({ code: newCode, sender }) => {
      if (room) {
        roomCodes.set(room.id, newCode);
        io.to(room.id).emit('codeUpdate', { code: newCode, sender });
      }
    });
    

    socket.on('deleteRoom', (roomId) => {
      tasks.delete(roomId);
      codeContent.delete(roomId);
      chatMessages.delete(roomId);
      editRequests.delete(roomId);
    });

    socket.on('nearDeskComputer', (isNear) => {
      if (!room) return;
      io.to(room.id).emit('nearDeskComputer', isNear);
    });

    // Todo management events
    socket.on('getTodos', () => {
      if (room) {
        const todos = roomTodos.get(room.id) || [];
        socket.emit('todosUpdate', todos);
      }
    });

  socket.on('addTodo', (todo) => {
      if (room) {
        const todos = roomTodos.get(room.id) || [];
        todos.push(todo);
        roomTodos.set(room.id, todos);
        io.to(room.id).emit('todosUpdate', todos);
      }
    });

  socket.on('updateTodo', (updatedTodo) => {
      if (room) {
        const todos = roomTodos.get(room.id) || [];
        const updatedTodos = todos.map(todo =>
        todo.id === updatedTodo.id ? { ...todo, ...updatedTodo } : todo
        );
        roomTodos.set(room.id, updatedTodos);
        io.to(room.id).emit('todosUpdate', updatedTodos);
      }
    });

    socket.on('deleteTodo', (todoId) => {
      if (room) {
        const todos = roomTodos.get(room.id) || [];
        const updatedTodos = todos.filter(todo => todo.id !== todoId);
        roomTodos.set(room.id, updatedTodos);
        io.to(room.id).emit('todosUpdate', updatedTodos);

      // Also remove any associated assignments and comments
      const roomAssignments = taskAssignments.get(room.id) || {};
      if (roomAssignments[todoId]) {
        delete roomAssignments[todoId];
        taskAssignments.set(room.id, roomAssignments);
        io.to(room.id).emit('taskAssignmentsUpdate', roomAssignments);
      }

      const roomTaskComments = roomComments.get(room.id) || {};
      if (roomTaskComments[todoId]) {
        delete roomTaskComments[todoId];
        roomComments.set(room.id, roomTaskComments);
        io.to(room.id).emit('commentsUpdate', roomTaskComments);
      }
    }
  });

  // Task assignments
  socket.on('getTaskAssignments', () => {
      if (room) {
      const assignments = taskAssignments.get(room.id) || {};
      socket.emit('taskAssignmentsUpdate', assignments);
    }
  });

  socket.on('assignTask', ({ taskId, assignedTo, assignedName, assignedAt, deadline }) => {
    if (room) {
      const assignments = taskAssignments.get(room.id) || {};
      
      assignments[taskId] = {
        taskId,
        assignedTo,
        assignedName: assignedName || `User_${assignedTo.slice(0, 4)}`,
        assignedAt: assignedAt || new Date().toISOString(),
        deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default: 1 week
        completed: assignments[taskId]?.completed || false
      };
      
      taskAssignments.set(room.id, assignments);
      io.to(room.id).emit('taskAssignmentsUpdate', assignments);
    }
  });

  socket.on('takeTask', ({ taskId, userId, username, takenAt }) => {
    if (room) {
      const assignments = taskAssignments.get(room.id) || {};
      
      assignments[taskId] = {
        taskId,
        assignedTo: userId,
        assignedName: username || `User_${userId.slice(0, 4)}`,
        assignedAt: takenAt || new Date().toISOString(),
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default: 1 week
        completed: false
      };
      
      taskAssignments.set(room.id, assignments);
      io.to(room.id).emit('taskAssignmentsUpdate', assignments);
    }
  });

  socket.on('updateTaskStatus', ({ taskId, completed }) => {
    if (room) {
      const assignments = taskAssignments.get(room.id) || {};
      
      if (assignments[taskId]) {
        assignments[taskId].completed = completed;
        taskAssignments.set(room.id, assignments);
        io.to(room.id).emit('taskAssignmentsUpdate', assignments);
      }
    }
  });

  socket.on('leaveCodeEditor', () => {
    // No need to handle editor changes since all users can edit
  });

  socket.on('startCall', async ({ isHost, username }) => {
    try {
      if (isHost) {
        // Generate a unique channel name
        const channel = `room_${room ? room.id : 'default'}_${Date.now()}`;
        
        socket.emit('callStarted', { 
          channel, 
          isHost: true,
          userId: socket.id,
          displayName: username || `Host ${socket.id.slice(0, 4)}`
        });
        socket.broadcast.emit('roomStatus', { isActive: true });
      } else {
        // Participant needs to receive channel info from the client
        // The client should pass the channel information when a non-host joins
        socket.emit('callError', { message: 'Please wait for a host to start a call first.' });
      }
    } catch (error) {
      console.error('Error starting call:', error.message);
      socket.emit('callError', { message: error.message || 'Failed to start call' });
    }
  });

  // Voice call events for socket management
  socket.on('voice-call-start', ({ meetingId, username, isMuted }) => {
    if (!room) return;
    
    // Store creator as participant and host
    const callData = {
      host: socket.id,
      participants: [
        { 
          id: socket.id, 
          username, 
          isMuted,
          isHost: true 
        }
      ]
    };
    
    // Save call data
    socket.data.currentCall = meetingId;
    
    // Initialize voiceCalls if it doesn't exist
    if (!io.voiceCalls) {
      io.voiceCalls = {};
    }
    
    io.voiceCalls[meetingId] = callData;
    
    // Join the room for the meeting
    socket.join(meetingId);
    
    console.log(`Voice call created: ${meetingId} by ${username}`);
  });
  
  socket.on('voice-call-join', ({ meetingId, username, isMuted }) => {
    if (!room) return;
    
    // Check if call exists
    if (!io.voiceCalls || !io.voiceCalls[meetingId]) {
      socket.emit('voice-call-error', { 
        error: 'Call not found', 
        meetingId 
      });
      return;
    }
    
    // Add user to participants
    socket.data.currentCall = meetingId;
    io.voiceCalls[meetingId].participants.push({
      id: socket.id,
      username,
      isMuted,
      isHost: false
    });
    
    // Notify all participants of new joiner
    io.to(meetingId).emit('voice-call-user-join', {
      meetingId,
      username,
      isMuted
    });
    
    // Send updated participants list to all
    io.to(meetingId).emit('voice-call-participants', {
      meetingId,
      participants: io.voiceCalls[meetingId].participants
    });
    
    // Join socket room
    socket.join(meetingId);
    
    console.log(`${username} joined voice call: ${meetingId}`);
  });
  
  socket.on('voice-call-leave', ({ meetingId, username }) => {
    leaveVoiceCall(socket, meetingId, username);
  });
  
  socket.on('voice-call-mute-change', ({ meetingId, username, isMuted }) => {
    if (!room) return;
    
    // Update user's mute status
    if (io.voiceCalls && io.voiceCalls[meetingId]) {
      const participant = io.voiceCalls[meetingId].participants.find(
        p => p.id === socket.id
      );
      
      if (participant) {
        participant.isMuted = isMuted;
        
        // Notify all participants
        io.to(meetingId).emit('voice-call-mute-change', {
          meetingId,
          username,
          isMuted
        });
        
        console.log(`${username} ${isMuted ? 'muted' : 'unmuted'} in voice call: ${meetingId}`);
      }
    }
  });
  
  // Helper function to handle leaving a voice call
  const leaveVoiceCall = (socket, meetingId, username) => {
    // Check if call exists
    if (!io.voiceCalls || !io.voiceCalls[meetingId]) {
      return;
    }
    
    // Remove user from participants
    io.voiceCalls[meetingId].participants = io.voiceCalls[meetingId].participants.filter(
      p => p.id !== socket.id
    );
    
    // Check if this was the host
    const wasHost = io.voiceCalls[meetingId].host === socket.id;
    
    // If this was the host, end the call for everyone
    if (wasHost) {
      // Notify all participants
      io.to(meetingId).emit('voice-call-end', { meetingId });
      
      // Delete call data
      delete io.voiceCalls[meetingId];
      
      console.log(`Voice call ended by host: ${meetingId}`);
    } else {
      // Notify remaining participants
      io.to(meetingId).emit('voice-call-user-leave', {
        meetingId,
        username
      });
      
      // Send updated participants list
      io.to(meetingId).emit('voice-call-participants', {
        meetingId,
        participants: io.voiceCalls[meetingId].participants
      });
      
      console.log(`${username} left voice call: ${meetingId}`);
    }
    
    // Leave socket room
    socket.leave(meetingId);
    
    // Clear current call data
    socket.data.currentCall = null;
  };
  
  // Handle disconnection
  socket.on('disconnect', () => {
    // If user was in a voice call, remove them
    if (socket.data && socket.data.currentCall) {
      leaveVoiceCall(socket, socket.data.currentCall, "User");
    }
    
    // Handle room cleanup
    if (room) {
      // Remove character from room
      const characterIndex = room.characters.findIndex(c => c.id === socket.id);
      if (characterIndex !== -1) {
        room.characters.splice(characterIndex, 1);
      }
      
      // Update other clients
      onRoomUpdate();
    }
    
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ROOMS

// SHOP ITEMS
const items = {
  washer: {
    name: "washer",
    size: [2, 2],
  },
  toiletSquare: {
    name: "toiletSquare",
    size: [2, 2],
  },
  trashcan: {
    name: "trashcan",
    size: [1, 1],
  },
  bathroomCabinetDrawer: {
    name: "bathroomCabinetDrawer",
    size: [2, 2],
  },
  bathtub: {
    name: "bathtub",
    size: [4, 2],
  },
  bathroomMirror: {
    name: "bathroomMirror",
    size: [2, 1],
    wall: true,
  },
  bathroomCabinet: {
    name: "bathroomCabinet",
    size: [2, 1],
    wall: true,
  },
  bathroomSink: {
    name: "bathroomSink",
    size: [2, 2],
  },
  showerRound: {
    name: "showerRound",
    size: [2, 2],
  },
  tableCoffee: {
    name: "tableCoffee",
    size: [4, 2],
  },
  loungeSofaCorner: {
    name: "loungeSofaCorner",
    size: [5, 5],
    rotation: 2,
  },
  bear: {
    name: "bear",
    size: [2, 1],
    wall: true,
  },
  loungeSofaOttoman: {
    name: "loungeSofaOttoman",
    size: [2, 2],
  },
  tableCoffeeGlassSquare: {
    name: "tableCoffeeGlassSquare",
    size: [2, 2],
  },
  loungeDesignSofaCorner: {
    name: "loungeDesignSofaCorner",
    size: [5, 5],
    rotation: 2,
  },
  loungeDesignSofa: {
    name: "loungeDesignSofa",
    size: [5, 2],
    rotation: 2,
  },
  loungeSofa: {
    name: "loungeSofa",
    size: [5, 2],
    rotation: 2,
  },
  bookcaseOpenLow: {
    name: "bookcaseOpenLow",
    size: [2, 1],
  },
  bookcaseClosedWide: {
    name: "bookcaseClosedWide",
    size: [3, 1],
    rotation: 2,
  },
  bedSingle: {
    name: "bedSingle",
    size: [3, 6],
    rotation: 2,
  },
  bench: {
    name: "bench",
    size: [2, 1],
    rotation: 2,
  },
  bedDouble: {
    name: "bedDouble",
    size: [5, 5],
    rotation: 2,
  },
  benchCushionLow: {
    name: "benchCushionLow",
    size: [2, 1],
  },
  loungeChair: {
    name: "loungeChair",
    size: [2, 2],
    rotation: 2,
  },
  cabinetBedDrawer: {
    name: "cabinetBedDrawer",
    size: [1, 1],
    rotation: 2,
  },
  cabinetBedDrawerTable: {
    name: "cabinetBedDrawerTable",
    size: [1, 1],
    rotation: 2,
  },
  table: {
    name: "table",
    size: [4, 2],
  },
  tableCrossCloth: {
    name: "tableCrossCloth",
    size: [4, 2],
  },
  plant: {
    name: "plant",
    size: [1, 1],
  },
  plantSmall: {
    name: "plantSmall",
    size: [1, 1],
  },
  rugRounded: {
    name: "rugRounded",
    size: [6, 4],
    walkable: true,
  },
  rugRound: {
    name: "rugRound",
    size: [4, 4],
    walkable: true,
  },
  rugSquare: {
    name: "rugSquare",
    size: [4, 4],
    walkable: true,
  },
  rugRectangle: {
    name: "rugRectangle",
    size: [8, 4],
    walkable: true,
  },
  televisionVintage: {
    name: "televisionVintage",
    size: [4, 2],
    rotation: 2,
  },
  televisionModern: {
    name: "televisionModern",
    size: [4, 2],
    rotation: 2,
  },
  kitchenFridge: {
    name: "kitchenFridge",
    size: [2, 1],
    rotation: 2,
  },
  kitchenFridgeLarge: {
    name: "kitchenFridgeLarge",
    size: [2, 1],
  },
  kitchenBar: {
    name: "kitchenBar",
    size: [2, 1],
  },
  kitchenCabinetCornerRound: {
    name: "kitchenCabinetCornerRound",
    size: [2, 2],
  },
  kitchenCabinetCornerInner: {
    name: "kitchenCabinetCornerInner",
    size: [2, 2],
  },
  kitchenCabinet: {
    name: "kitchenCabinet",
    size: [2, 2],
  },
  kitchenBlender: {
    name: "kitchenBlender",
    size: [1, 1],
  },
  dryer: {
    name: "dryer",
    size: [2, 2],
  },
  chairCushion: {
    name: "chairCushion",
    size: [1, 1],
    rotation: 2,
  },
  chair: {
    name: "chair",
    size: [1, 1],
    rotation: 2,
  },
  deskComputer: {
    name: "deskComputer",
    size: [3, 2],
  },
  desk: {
    name: "desk",
    size: [3, 2],
  },
  chairModernCushion: {
    name: "chairModernCushion",
    size: [1, 1],
    rotation: 2,
  },
  chairModernFrameCushion: {
    name: "chairModernFrameCushion",
    size: [1, 1],
    rotation: 2,
  },
  kitchenMicrowave: {
    name: "kitchenMicrowave",
    size: [1, 1],
  },
  coatRackStanding: {
    name: "coatRackStanding",
    size: [1, 1],
  },
  kitchenSink: {
    name: "kitchenSink",
    size: [2, 2],
  },
  lampRoundFloor: {
    name: "lampRoundFloor",
    size: [1, 1],
  },
  lampRoundTable: {
    name: "lampRoundTable",
    size: [1, 1],
  },
  lampSquareFloor: {
    name: "lampSquareFloor",
    size: [1, 1],
  },
  lampSquareTable: {
    name: "lampSquareTable",
    size: [1, 1],
  },
  toaster: {
    name: "toaster",
    size: [1, 1],
  },
  kitchenStove: {
    name: "kitchenStove",
    size: [2, 2],
  },
  laptop: {
    name: "laptop",
    size: [1, 1],
  },
  radio: {
    name: "radio",
    size: [1, 1],
  },
  speaker: {
    name: "speaker",
    size: [1, 1],
  },
  speakerSmall: {
    name: "speakerSmall",
    size: [1, 1],
    rotation: 2,
  },
  stoolBar: {
    name: "stoolBar",
    size: [1, 1],
  },
  stoolBarSquare: {
    name: "stoolBarSquare",
    size: [1, 1],
  },
};

// Get userId endpoint - provides unique user IDs for client-side use
app.get('/api/get-userid', (req, res) => {
  try {
    // Generate a random numeric user ID for Agora
    const uid = Math.floor(10000 + Math.random() * 90000);
    
    // Return the generated ID
    return res.json({
      success: true,
      uid,
      message: 'User ID generated successfully'
    });
  } catch (error) {
    console.error("Error generating user ID:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate user ID",
      error: error.message
    });
  }
});

// Start the server
server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
