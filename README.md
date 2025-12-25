# PPT to Learning Content Converter

Transform PowerPoint presentations (`.pptx`) into interactive, semantic web-based learning content.

## Features

- **Modular Converter**: High-fidelity extraction of text, images, tables, and SmartArt.
- **Semantic JSON**: Generates a hierarchical tree structure (Sections -> Slides -> Blocks).
- **Interactive Web App**: A modern React-based viewer with a grouped sidebar.
- **AI-Powered (Gemini 1.5 Flash)**:
    - **Interpret Slide**: Get pedagogical insights and improvement suggestions.
    - **Visual Correction**: Upload a screenshot to fix extraction or OCR errors.
- **Live Editing**: Edit slide content directly in the browser and save changes.
- **BYOK (Bring Your Own Key)**: Manage your own Gemini API usage.

## Project Structure

- `src/ppt_to_learning`: Core Python extraction logic.
- `web-app/`: Full-stack application.
    - `client/`: React (TypeScript) frontend.
    - `server/`: Node.js (Express) backend.
- `sourcefiles/`: Input PPTX files.
- `output/`: Processed static output.

## Installation & Setup

### 1. Prerequisites
- Python 3.10+
- Node.js v18+
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### 2. Backend Setup
```bash
cd web-app/server
npm install
# Create a .env file and add your key:
# GEMINI_API_KEY=your_key_here
```

### 3. Frontend Setup
```bash
cd web-app/client
npm install
```

## Running the Application

In the `web-app` directory, run:
```bash
npm start
```
This will start both the backend (port 3001) and the frontend (port 5173). Open [http://localhost:5173](http://localhost:5173) in your browser.

## CLI Usage (Python Only)

If you only want to process files via command line:
```bash
source .venv/bin/activate
python converter.py --input sourcefiles/czech --output output/czech
```

## Documentation
- [Developer Guide](src/ppt_to_learning/DEVELOPER.md)
- [Semantic Schema Proposal](SCHEMA_PROPOSAL.md)