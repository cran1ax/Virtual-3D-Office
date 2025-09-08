# Virtual Lab 3D Office - Client

This is the client side of the Virtual Lab 3D Office application.

## Setup Instructions

1. Install dependencies
```bash
npm install
# or
yarn
```

2. Configure Agora for Voice Calls
   - Create an account on [Agora Console](https://console.agora.io/)
   - Create a new project (App ID authentication mode is recommended for testing)
   - Copy your App ID
   - Create a `.env` file in the client directory if it doesn't exist
   - Add your Agora App ID to the `.env` file:
   ```
   VITE_SERVER_URL=http://localhost:3000
   VITE_AGORA_APP_ID=your_agora_app_id_here
   ```

3. Start the development server
```bash
npm run dev
# or
yarn dev
```

## Voice Call Troubleshooting

If you encounter issues with the voice call feature:

1. Verify your Agora App ID is correctly set in the `.env` file
2. Make sure your Agora project is active in the Agora Console
3. Try using the "Run Diagnostic" button in the Voice Call interface to check your setup
4. Check that your microphone is properly connected and accessible

## Note on Agora Usage

The free tier of Agora includes 10,000 minutes per month, which should be sufficient for testing purposes. For production use, you may need to upgrade to a paid plan.
