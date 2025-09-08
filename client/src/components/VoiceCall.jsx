import React, { useState, useEffect, useRef } from 'react';
import { Button, Typography, Box, Paper, List, ListItem, ListItemText, Chip, Card, CardContent, Divider } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import CallEndIcon from '@mui/icons-material/CallEnd';
import PhoneIcon from '@mui/icons-material/Phone';
import AgoraRTC from 'agora-rtc-sdk-ng';

// Error display component
const ErrorDisplay = ({ error, onRetry }) => {
  return (
    <Card sx={{ mt: 2, mb: 2, bgcolor: '#fff8f8', borderLeft: '4px solid #f44336' }}>
      <CardContent>
        <Typography variant="h6" color="error" gutterBottom>
          <strong>Error:</strong> {error}
        </Typography>
        
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            size="small" 
            color="primary" 
            startIcon={<RefreshIcon />}
            onClick={onRetry}
          >
            Try Again
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

const VoiceCall = ({ socket, username }) => {
  // UI state
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  
  // Agora client state
  const clientRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const remoteUsersRef = useRef(new Map());
  
  // Connection parameters - these should come from your server in production
  const appId = import.meta.env.VITE_AGORA_APP_ID; // Get App ID from environment variables
  const channel = "VirtualOffice";
  const token = null; // Using null for App ID only mode (no token authentication)
  const uid = Math.floor(Math.random() * 1000000);
  
  // Check if App ID is configured
  useEffect(() => {
    if (!appId || appId === "your_agora_app_id_here") {
      setErrorMessage(
        "Agora App ID is not configured. Please update the VITE_AGORA_APP_ID in your .env file with a valid App ID from console.agora.io"
      );
    }
  }, []);
  
  // Initialize Agora client
  useEffect(() => {
    return () => {
      // Clean up on component unmount
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      
      if (clientRef.current) {
        clientRef.current.leave().catch(console.error);
        clientRef.current = null;
      }
    };
  }, []);
  
  // Initialize the Agora client
  const initializeClient = async () => {
    try {
      if (!clientRef.current) {
        clientRef.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        
        // Set up event listeners for remote users
        clientRef.current.on("user-published", async (user, mediaType) => {
          await clientRef.current.subscribe(user, mediaType);
          console.log("Subscribed to remote user:", user.uid);
          
          if (mediaType === "audio") {
            const remoteAudioTrack = user.audioTrack;
            remoteAudioTrack.play();
            
            // Add to participants list
            remoteUsersRef.current.set(user.uid, user);
            updateParticipantsList();
          }
        });
        
        clientRef.current.on("user-unpublished", (user) => {
          console.log("Remote user unpublished:", user.uid);
          
          // Update participants list
          remoteUsersRef.current.delete(user.uid);
          updateParticipantsList();
        });
        
        clientRef.current.on("user-left", (user) => {
          console.log("Remote user left:", user.uid);
          
          // Update participants list
          remoteUsersRef.current.delete(user.uid);
          updateParticipantsList();
        });
      }
    } catch (error) {
      console.error("Error initializing Agora client:", error);
      setErrorMessage(`Failed to initialize: ${error.message}`);
    }
  };
  
  const updateParticipantsList = () => {
    const remoteParticipants = Array.from(remoteUsersRef.current.values()).map(user => ({
      username: `User_${user.uid.toString().substring(0, 5)}`,
      uid: user.uid,
      isSelf: false,
      isMuted: !user.hasAudio
    }));
    
    // Add local user
    const allParticipants = [
      { 
        username: username || "You", 
        uid: 'self', 
        isSelf: true, 
        isMuted: isMuted 
      },
      ...remoteParticipants
    ];
    
    setParticipants(allParticipants);
  };
  
  // Create a local audio track
  const createLocalAudioTrack = async () => {
    try {
      localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
      return true;
    } catch (error) {
      console.error("Error creating local audio track:", error);
      setErrorMessage(`Microphone access error: ${error.message}`);
      return false;
    }
  };
  
  // Join the channel
  const joinChannel = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      // Check if App ID is configured before attempting to join
      if (!appId || appId === "your_agora_app_id_here") {
        throw new Error(
          "Agora App ID is not configured. Please update the VITE_AGORA_APP_ID in your .env file with a valid App ID from console.agora.io"
        );
      }
      
      // Initialize client if not already done
      await initializeClient();
      
      // Create local audio track
      const audioTrackCreated = await createLocalAudioTrack();
      if (!audioTrackCreated) {
        throw new Error("Failed to create audio track");
      }
      
      // Join the channel
      await clientRef.current.join(appId, channel, token, uid);
      console.log("Successfully joined channel");
      
      // Publish local audio track
      await clientRef.current.publish([localAudioTrackRef.current]);
      console.log("Local audio track published");
      
      // Update state
      setIsJoined(true);
      
      // Update participants list
      updateParticipantsList();
      
    } catch (error) {
      console.error("Error joining channel:", error);
      
      // Enhanced error handling
      let errorMsg = `Failed to join: ${error.message}`;
      
      // Add helpful information for specific error types
      if (error.message && error.message.includes("CAN_NOT_GET_GATEWAY_SERVER")) {
        errorMsg = "Invalid App ID. Please make sure you've created a valid project in the Agora Console (console.agora.io) and updated your .env file.";
      } else if (error.message && error.message.includes("DYNAMIC_KEY_EXPIRED")) {
        errorMsg = "Token has expired. Please use App ID authentication (token=null) or generate a new token.";
      }
      
      setErrorMessage(errorMsg);
      
      // Clean up on error
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      
      if (clientRef.current && clientRef.current.connectionState === 'CONNECTED') {
        await clientRef.current.leave().catch(console.error);
      }
      
    } finally {
      setIsLoading(false);
    }
  };
  
  // Leave the channel
  const leaveChannel = async () => {
    try {
      setIsLoading(true);
      
      // Close local audio track
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      
      // Leave the channel
      if (clientRef.current) {
        await clientRef.current.leave();
      }
      
      console.log("Left the channel");
      setIsJoined(false);
      remoteUsersRef.current.clear();
      setParticipants([]);
      
    } catch (error) {
      console.error("Error leaving channel:", error);
      setErrorMessage(`Error leaving channel: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toggle mute/unmute
  const toggleMute = async () => {
    try {
      if (!localAudioTrackRef.current) return;
      
      const newMuteState = !isMuted;
      
      // Mute/unmute local audio track
      if (newMuteState) {
        await localAudioTrackRef.current.setEnabled(false);
      } else {
        await localAudioTrackRef.current.setEnabled(true);
      }
      
      // Update state
      setIsMuted(newMuteState);
      
      // Update participants list
      updateParticipantsList();
      
      console.log(`Microphone ${newMuteState ? 'muted' : 'unmuted'}`);
    } catch (error) {
      console.error("Error toggling mute:", error);
      setErrorMessage(`Error toggling microphone: ${error.message}`);
    }
  };
  
  // Run diagnostics
  const runDiagnostics = async () => {
    try {
      setIsDiagnosticRunning(true);
      setErrorMessage('');
      
      const diagnosticResults = {
        appId: { success: false, message: 'App ID check not run yet' },
        microphone: { success: false, message: 'Microphone test not run yet' },
        connection: { success: false, message: 'Connection test not run yet' },
        overall: false
      };
      
      // Check App ID configuration
      if (!appId || appId === "your_agora_app_id_here") {
        diagnosticResults.appId = {
          success: false,
          message: 'Missing or invalid App ID. Update your .env file with a valid App ID.'
        };
      } else {
        diagnosticResults.appId = {
          success: true,
          message: `App ID is configured (${appId.substring(0, 4)}...)`
        };
      }
      
      // Test microphone access
      try {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        diagnosticResults.microphone = { 
          success: true, 
          message: 'Microphone access granted' 
        };
        audioTrack.close(); // Clean up test track
      } catch (micError) {
        diagnosticResults.microphone = { 
          success: false, 
          message: `Microphone error: ${micError.message}` 
        };
      }
      
      // Test connection to Agora
      try {
        // Only test connection if App ID is configured
        if (diagnosticResults.appId.success) {
          const testClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
          await testClient.join(appId, `test-${Date.now()}`, null, 0);
          await testClient.leave();
          
          diagnosticResults.connection = { 
            success: true, 
            message: 'Connection test passed' 
          };
        } else {
          diagnosticResults.connection = {
            success: false,
            message: 'Connection test skipped - App ID not configured'
          };
        }
      } catch (connError) {
        let errorMsg = `Connection error: ${connError.message}`;
        
        // Add helpful information for specific error types
        if (connError.message && connError.message.includes("CAN_NOT_GET_GATEWAY_SERVER")) {
          errorMsg = "Invalid App ID. Please check your Agora Console for the correct App ID.";
        }
        
        diagnosticResults.connection = { 
          success: false, 
          message: errorMsg
        };
      }
      
      // Set overall status
      diagnosticResults.overall = 
        diagnosticResults.appId.success &&
        diagnosticResults.microphone.success && 
        diagnosticResults.connection.success;
      
      // Set diagnostic results
      setDiagnosticResults(diagnosticResults);
      
      return diagnosticResults;
    } catch (error) {
      console.error("Error running diagnostics:", error);
      setErrorMessage(`Diagnostic error: ${error.message}`);
      return null;
    } finally {
      setIsDiagnosticRunning(false);
    }
  };
  
  // Handle retry
  const handleRetry = async () => {
    setErrorMessage('');
    
    if (isJoined) {
      // Try to leave and rejoin
      await leaveChannel();
      await joinChannel();
    } else {
      // Just try to join
      await joinChannel();
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Typography variant="h5" component="h2" gutterBottom>
        Voice Call
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Start a voice call with other users in the virtual office
      </Typography>
      
      {/* Error Display */}
      {errorMessage && (
        <ErrorDisplay 
          error={errorMessage} 
          onRetry={handleRetry}
        />
      )}
      
      {/* Active Call UI */}
      {isJoined ? (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Active Call
            </Typography>
            <Chip 
              label={`Channel: ${channel}`} 
              size="small" 
              color="primary"
            />
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          {/* Participants List */}
          <Typography variant="subtitle1" gutterBottom>
            Participants ({participants.length})
          </Typography>
          
          <List>
            {participants.map((participant, index) => (
              <ListItem 
                key={index}
                secondaryAction={
                  participant.isSelf ? (
                    <Button
                      variant="outlined"
                      size="small"
                      color={isMuted ? "error" : "primary"}
                      onClick={toggleMute}
                      startIcon={isMuted ? <MicOffIcon /> : <MicIcon />}
                      disabled={isLoading}
                    >
                      {isMuted ? "Unmute" : "Mute"}
                    </Button>
                  ) : (
                    <Chip
                      icon={participant.isMuted ? <MicOffIcon /> : <MicIcon />}
                      label={participant.isMuted ? "Muted" : "Speaking"}
                      size="small"
                      color={participant.isMuted ? "default" : "success"}
                    />
                  )
                }
              >
                <ListItemText 
                  primary={`${participant.username}${participant.isSelf ? ' (You)' : ''}`} 
                />
              </ListItem>
            ))}
          </List>
          
          <Box display="flex" justifyContent="center" mt={3}>
            <Button
              variant="contained"
              color="error"
              size="large"
              startIcon={<CallEndIcon />}
              onClick={leaveChannel}
              disabled={isLoading}
            >
              {isLoading ? 'Leaving...' : 'Leave Call'}
            </Button>
          </Box>
        </Paper>
      ) : (
        /* Call Controls when not in a call */
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Voice Channel: {channel}
          </Typography>
          
          <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<PhoneIcon />}
              onClick={joinChannel}
              disabled={isLoading}
              sx={{ minWidth: '150px' }}
            >
              {isLoading ? 'Joining...' : 'Join Call'}
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={runDiagnostics}
              disabled={isDiagnosticRunning || isLoading}
            >
              {isDiagnosticRunning ? 'Running...' : 'Run Diagnostic'}
            </Button>
          </Box>
        </Paper>
      )}
      
      {/* Diagnostic Results (only shown when diagnostics have been run) */}
      {diagnosticResults && !isJoined && (
        <Paper elevation={2} sx={{ p: 2, mt: 3, bgcolor: '#f8f9fa' }}>
          <Typography variant="subtitle1" gutterBottom>
            Diagnostic Results
          </Typography>
          
          <Box mb={1}>
            <Chip 
              label={diagnosticResults.overall ? 'PASSED' : 'FAILED'} 
              color={diagnosticResults.overall ? 'success' : 'error'}
              size="small"
              sx={{ mr: 1 }}
            />
          </Box>
          
          <List dense>
            <ListItem>
              <ListItemText 
                primary="App ID" 
                secondary={diagnosticResults.appId?.message}
              />
              {diagnosticResults.appId?.success ? 
                <Chip size="small" label="OK" color="success" /> : 
                <Chip size="small" label="Error" color="error" />
              }
            </ListItem>
            
            <ListItem>
              <ListItemText 
                primary="Microphone" 
                secondary={diagnosticResults.microphone?.message}
              />
              {diagnosticResults.microphone?.success ? 
                <Chip size="small" label="OK" color="success" /> : 
                <Chip size="small" label="Error" color="error" />
              }
            </ListItem>
            
            <ListItem>
              <ListItemText 
                primary="Connection Test" 
                secondary={diagnosticResults.connection?.message}
              />
              {diagnosticResults.connection?.success ? 
                <Chip size="small" label="OK" color="success" /> : 
                <Chip size="small" label="Error" color="error" />
              }
            </ListItem>
          </List>
        </Paper>
      )}
    </div>
  );
};

export default VoiceCall; 