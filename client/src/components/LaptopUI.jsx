import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAtom } from 'jotai';
import { isInCallAtom, isHostAtom } from '../atoms';
import { Box, Button, Tabs, Tab, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TaskManager from './TaskManager';
import CodeEditor from './CodeEditor';
import TodoApp from './TodoApp';
import VoiceCall from './VoiceCall';
import BrightnessHighIcon from '@mui/icons-material/BrightnessHigh';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

const LaptopUI = ({ onClose, socket, isDarkMode, toggleDarkMode }) => {
  const [activeTab, setActiveTab] = useState('todos');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [dragConstraints, setDragConstraints] = useState({ top: 0, left: 0, right: 0, bottom: 0 });
  const [username, setUsername] = useState(`User_${socket?.id?.substr(0, 5) || Math.floor(Math.random() * 10000)}`);

  // Set up drag constraints when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDragConstraints({
        top: -window.innerHeight + 100,
        left: -window.innerWidth + 100,
        right: window.innerWidth - 100,
        bottom: window.innerHeight - 100
      });
    }
  }, []);

  // Update username when socket ID changes
  useEffect(() => {
    if (socket && socket.id) {
      setUsername(`User_${socket.id.substr(0, 5)}`);
    }
  }, [socket]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Handle call status changes
  const handleCallStatusChange = (isActive) => {
    setIsCallActive(isActive);
  };

  // Close the menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <motion.div
      drag
      dragConstraints={dragConstraints}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
        width: '80%',
        maxWidth: '800px',
      }}
    >
      <Box sx={{ 
        width: '100%',
        bgcolor: 'background.paper',
        borderRadius: '8px',
        boxShadow: 24,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '500px',
        maxHeight: '80vh',
      }}>
        {/* Header with title and controls */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 1, 
          bgcolor: '#2c3e50',
          color: 'white',
          cursor: 'move'
        }}>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1
            }}
          >
            <DragIndicatorIcon fontSize="small" />
            <span role="img" aria-label="laptop">💻</span> Virtual Laptop
          </Typography>
          <Box>
            <IconButton 
              size="small" 
              onClick={toggleDarkMode} 
              sx={{ color: 'white', mr: 1 }}
            >
              {isDarkMode ? <BrightnessHighIcon /> : <Brightness4Icon />}
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setMenuOpen(!menuOpen)}
              sx={{ color: 'white', mr: 1 }}
            >
              <ArrowDropDownIcon />
            </IconButton>
            <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Menu dropdown */}
        {menuOpen && (
          <Box
            ref={menuRef}
            sx={{
              position: 'absolute',
              right: 0,
              top: '48px',
              zIndex: 1000,
              bgcolor: 'background.paper',
              boxShadow: 3,
              borderRadius: 1,
              p: 1,
              width: '200px',
            }}
          >
            <Button fullWidth onClick={() => {
              window.location.reload();
            }}>
              Reload Application
            </Button>
          </Box>
        )}

        {/* Tab navigation */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: '#34495e',
            '& .MuiTab-root': {
              color: 'rgba(255,255,255,0.7)',
              '&.Mui-selected': {
                color: 'white',
              },
            },
          }}
        >
          <Tab label="Todos" value="todos" />
          <Tab label="Code" value="code" />
          <Tab label="Voice Call" value="voice-call" />
          <Tab label="Task Manager" value="task-manager" />
        </Tabs>

        {/* Content area */}
        <Box sx={{ 
          flexGrow: 1, 
          p: 2, 
          overflow: 'auto',
          bgcolor: isDarkMode ? '#2c3e50' : 'white',
          color: isDarkMode ? 'white' : 'black',
        }}>
          {activeTab === 'todos' && <TodoApp socket={socket} isDarkMode={isDarkMode} />}
          {activeTab === 'code' && <CodeEditor socket={socket} isDarkMode={isDarkMode} />}
          {activeTab === 'voice-call' && <VoiceCall 
            socket={socket}
            username={username} 
          />}
          {activeTab === 'task-manager' && <TaskManager socket={socket} isDarkMode={isDarkMode} />}
        </Box>
      </Box>
    </motion.div>
  );
};

export default LaptopUI; 