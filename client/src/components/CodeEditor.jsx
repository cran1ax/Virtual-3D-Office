import React, { useState, useEffect } from 'react';

const CodeEditor = ({ socket, isDarkMode }) => {
  const [code, setCode] = useState('// Write your code here...\n\nfunction helloWorld() {\n  console.log("Hello, virtual office!");\n}\n\nhelloWorld();');
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState(isDarkMode ? 'monokai' : 'github');
  const [fontSize, setFontSize] = useState(14);
  const [myId, setMyId] = useState('');

  useEffect(() => {
    // Save my own socket ID
    setMyId(socket.id);

    socket.on('codeUpdate', ({ code: updatedCode, sender }) => {
      if (sender !== socket.id) {
        setCode(updatedCode);
      }
    });

    socket.emit('getCode');

    return () => {
      socket.off('codeUpdate');
    };
  }, [socket]);

  useEffect(() => {
    setTheme(isDarkMode ? 'monokai' : 'github');
  }, [isDarkMode]);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit('codeUpdate', { code: newCode, sender: socket.id });
  };

  const handleRunCode = () => {
    try {
      // eslint-disable-next-line no-eval
      const result = eval(code);
      console.log('Code execution result:', result);
      alert('Code executed. Check console for output.');
    } catch (error) {
      console.error('Code execution error:', error);
      alert(`Error executing code: ${error.message}`);
    }
  };

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className="flex items-center p-2 border-b">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className={`mr-2 p-1 rounded ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
        </select>

        <select
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className={`mr-2 p-1 rounded ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}
        >
          {[12, 14, 16, 18, 20, 24].map(size => (
            <option key={size} value={size}>{size}px</option>
          ))}
        </select>

        <button
          onClick={handleRunCode}
          className="ml-auto px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Run
        </button>
      </div>

      <div className="flex-grow relative min-h-[500px]">
        <textarea
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          className={`w-full h-full p-4 font-mono focus:outline-none resize-none ${
            isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-gray-50 text-gray-900'
          }`}
          style={{ fontSize: `${fontSize}px`, minHeight: '500px' }}
          spellCheck="false"
        />
      </div>
    </div>
  );
};

export default CodeEditor;
