/**
 * Server Restart Utility
 * 
 * This script helps test and restart the server when it's not responding correctly.
 * Particularly useful when the server returns HTML errors instead of JSON.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${PORT}`;
const TEST_ENDPOINT = '/api/test-agora-token';
const MAX_RETRIES = 3;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

/**
 * Test if the server is responding correctly
 * @returns {Promise<{success: boolean, status?: number, data?: any, error?: string}>}
 */
async function testServer() {
  return new Promise((resolve) => {
    console.log(`${colors.blue}Testing server at ${SERVER_URL}${TEST_ENDPOINT}${colors.reset}`);
    
    const req = http.get(`${SERVER_URL}${TEST_ENDPOINT}`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // Check if response is HTML (error page) or valid JSON
        if (data.includes('<!DOCTYPE') || data.includes('<html')) {
          console.log(`${colors.red}Server returned HTML instead of JSON${colors.reset}`);
          resolve({ 
            success: false, 
            status: res.statusCode,
            error: 'HTML response detected',
            sample: data.substring(0, 150) + '...'
          });
          return;
        }
        
        try {
          const jsonData = JSON.parse(data);
          console.log(`${colors.green}Server returned valid JSON response${colors.reset}`);
          resolve({ 
            success: true, 
            status: res.statusCode,
            data: jsonData
          });
        } catch (err) {
          console.log(`${colors.red}Server returned invalid JSON: ${err.message}${colors.reset}`);
          resolve({ 
            success: false, 
            status: res.statusCode,
            error: 'Invalid JSON: ' + err.message,
            sample: data.substring(0, 150) + '...'
          });
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`${colors.red}Error connecting to server: ${error.message}${colors.reset}`);
      resolve({ 
        success: false, 
        error: error.message 
      });
    });
    
    // Set timeout for request
    req.setTimeout(5000, () => {
      req.abort();
      console.log(`${colors.red}Request timed out${colors.reset}`);
      resolve({ 
        success: false, 
        error: 'Request timed out' 
      });
    });
  });
}

/**
 * Check the .env file for required configurations
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function checkEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    
    if (!fs.existsSync(envPath)) {
      return { 
        success: false, 
        message: '.env file not found. Please create it with your environment variables.'
      };
    }
    
    return {
      success: true,
      message: 'Environment file found'
    };
  } catch (error) {
    return {
      success: false,
      message: `Error checking .env file: ${error.message}`
    };
  }
}

/**
 * Restart the server
 */
async function restartServer() {
  try {
    console.log(`${colors.yellow}Restarting server...${colors.reset}`);
    
    // First check for running server process
    let processFound = false;
    try {
      const processes = execSync('tasklist /fi "imagename eq node.exe" /fo csv /nh').toString();
      processFound = processes.includes('node.exe');
    } catch (e) {
      console.log(`${colors.yellow}Could not check for running processes: ${e.message}${colors.reset}`);
    }
    
    if (processFound) {
      console.log(`${colors.yellow}Attempting to kill existing Node processes...${colors.reset}`);
      try {
        execSync('taskkill /f /im node.exe');
      } catch (e) {
        console.log(`${colors.yellow}Warning: Could not kill Node processes: ${e.message}${colors.reset}`);
      }
    }
    
    // Start server with "node index.js"
    console.log(`${colors.green}Starting server...${colors.reset}`);
    
    const spawn = require('child_process').spawn;
    const server = spawn('node', ['index.js'], {
      detached: true,
      stdio: 'inherit'
    });
    
    // Detach the process
    server.unref();
    
    // Wait for server to start
    console.log(`${colors.yellow}Waiting for server to start...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test if server is running
    for (let i = 0; i < MAX_RETRIES; i++) {
      const testResult = await testServer();
      if (testResult.success) {
        console.log(`${colors.green}Server restarted successfully!${colors.reset}`);
        return true;
      } else {
        console.log(`${colors.yellow}Server not ready yet, retrying... (${i+1}/${MAX_RETRIES})${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`${colors.red}Failed to restart server after ${MAX_RETRIES} attempts${colors.reset}`);
    return false;
  } catch (error) {
    console.log(`${colors.red}Error restarting server: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`${colors.magenta}===== Agora Server Diagnostic =====\n${colors.reset}`);
  
  // Check .env file
  const envCheck = await checkEnvFile();
  if (envCheck.success) {
    console.log(`${colors.green}✓ ${envCheck.message}${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ ${envCheck.message}${colors.reset}`);
    console.log(`\n${colors.yellow}Please fix the .env file and try again.${colors.reset}`);
    return;
  }
  
  // Test the server
  const serverTest = await testServer();
  
  if (serverTest.success) {
    console.log(`${colors.green}✓ Server is responding correctly${colors.reset}`);
    console.log(`${colors.green}Status: ${serverTest.status}${colors.reset}`);
    console.log(`${colors.blue}Server response sample:${colors.reset}`);
    console.log(JSON.stringify(serverTest.data, null, 2).substring(0, 200) + '...');
  } else {
    console.log(`${colors.red}✗ Server is not responding correctly${colors.reset}`);
    console.log(`${colors.red}Error: ${serverTest.error}${colors.reset}`);
    
    if (serverTest.sample) {
      console.log(`${colors.yellow}Response sample:${colors.reset}`);
      console.log(serverTest.sample);
    }
    
    // Ask if user wants to restart the server
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question(`\n${colors.yellow}Do you want to restart the server? (y/n)${colors.reset} `, async (answer) => {
      readline.close();
      
      if (answer.toLowerCase() === 'y') {
        const success = await restartServer();
        if (success) {
          console.log(`${colors.green}Server has been restarted successfully. Try your application again.${colors.reset}`);
        } else {
          console.log(`${colors.red}Failed to restart server automatically. Please try manually:${colors.reset}`);
          console.log(`${colors.yellow}1. Kill any running node processes${colors.reset}`);
          console.log(`${colors.yellow}2. Start server with: node index.js${colors.reset}`);
        }
      } else {
        console.log(`${colors.blue}Server restart skipped.${colors.reset}`);
      }
    });
  }
}

// Run the main function
main(); 