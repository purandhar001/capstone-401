# Firebase Authentication with Express and EJS

A simple authentication system using Express.js, EJS templates, and Firebase Authentication.

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Set up Firebase:
   - Go to Firebase Console (https://console.firebase.google.com/)
   - Create a new project
   - Go to Project Settings > Service Accounts
   - Generate a new private key
   - Save the JSON file as `firebase-credentials.json` in the project root

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on http://localhost:3000

## Features
- User registration (Sign Up)
- User authentication (Sign In)
- Protected dashboard route
- Session management
- Clean and responsive UI
