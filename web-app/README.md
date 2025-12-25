# PPT to Learning Web App

This is a full-stack application to convert PowerPoint presentations into interactive learning content.

## Structure

-   `client/`: React frontend (Vite + Tailwind + TypeScript)
-   `server/`: Node.js Express backend

## Prerequisites

-   Node.js (v14+)
-   Python 3 (with the virtual environment set up in the root project)

## Setup & Run

### 1. Start the Backend

The backend handles file uploads and runs the Python converter.

```bash
cd server
npm install
node index.js
```
*Server runs on http://localhost:3001*

### 2. Start the Frontend

The frontend provides the UI.

```bash
cd client
npm install
npm run dev
```
*Frontend runs on http://localhost:5173*

## Usage

1.  Open the frontend URL.
2.  Drag and drop a `.pptx` file.
3.  Wait for conversion.
4.  View the interactive course.
