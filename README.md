# PPT to Learning

Transform PowerPoint presentations into interactive, semantic web-based learning content with AI-powered enhancement.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

### Core Functionality
- **PPTX Extraction**: High-fidelity extraction of text, images, tables, SmartArt diagrams, and embedded videos
- **Semantic JSON Output**: Hierarchical structure (Sections → Slides → Content Blocks)
- **Interactive Web Viewer**: Modern React-based viewer with slide navigation and search
- **Library Management**: Organize presentations into collections with folders and tags

### AI-Powered Enhancement (Google Gemini)
- **Semantic Conversion**: Transform raw extraction into structured learning content (comparisons, sequences, definitions)
- **Visual Correction**: Upload screenshots to fix extraction errors
- **Batch Processing**: Convert multiple slides at once with progress tracking
- **Include Media Files**: Optionally send slide images to AI for better alt text and semantic placement
- **Preview & Review**: Side-by-side comparison before accepting AI changes

### Web App Features
- **Grid View**: Side-by-side comparison of original screenshots and converted content
- **Multi-select**: Select and batch-convert slides needing review
- **Search**: Search within presentations (press `/`) and across library
- **Collections**: Organize presentations into projects with nested folders
- **YouTube Embeds**: Automatically detect and embed YouTube videos from PPTX links
- **ZIP Export**: Download presentations with all media files for external use
- **Batch Operations**: Move multiple presentations between collections/folders
- **Inline Editing**: Edit presentation metadata (name, description, tags) directly in the library
- **Delete Content Blocks**: Remove unwanted images or content with hover X button
- **JSON Editor**: Directly edit slide JSON with validation and instant apply

## Screenshots

*Grid view with side-by-side screenshot and content preview, multi-select, and zoom controls*

## Requirements

### System Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Python | 3.10+ | PPTX extraction |
| Node.js | 18+ | Web server and frontend |
| LibreOffice | 7.0+ | Screenshot generation (optional) |
| Poppler | - | PDF to image conversion (optional) |

### API Keys
- **Google Gemini API Key** - Required for AI features ([Get one here](https://aistudio.google.com/app/apikey))

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ppt-to-learning.git
cd ppt-to-learning
```

### 2. Python Environment Setup

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install python-pptx Pillow
```

### 3. Install Optional Dependencies (for Screenshots)

**macOS:**
```bash
brew install libreoffice poppler
```

**Ubuntu/Debian:**
```bash
sudo apt-get install libreoffice poppler-utils
```

**Windows:**
- Download LibreOffice from https://www.libreoffice.org/download/
- Download Poppler from https://github.com/oschwartz10612/poppler-windows/releases

### 4. Web Application Setup

```bash
# Install root dependencies (for running both servers)
cd web-app
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 5. Configure Environment

Create a `.env` file in `web-app/server/`:

```bash
cd web-app/server
cp .env.example .env  # Or create manually
```

Edit `.env`:
```env
GEMINI_API_KEY=your_api_key_here
PORT=3001
```

Alternatively, you can enter your API key in the web app's Settings modal.

## Running the Application

### Start Both Servers (Recommended)

From the `web-app` directory:

```bash
npm run dev
```

This starts:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173

Open http://localhost:5173 in your browser.

### Start Servers Separately

**Backend only:**
```bash
cd web-app/server
node index.js
```

**Frontend only:**
```bash
cd web-app/client
npm run dev
```

## Usage

### Upload Presentations

1. Drag and drop `.pptx` files onto the upload area
2. Optionally check "Generate screenshots" for visual comparison
3. Click "Upload" to process

### View and Edit

1. Click a presentation to open the viewer
2. Use arrow keys or sidebar to navigate slides
3. Press `g` to toggle grid view
4. Press `/` to search within the presentation
5. Click "Fix with Gemini" to enhance slides with AI

### Batch Operations

1. In grid view, select slides using checkboxes
2. Click "Select Needing Review" to auto-select unconverted slides
3. Click "Convert with Gemini" to batch process
4. Use zoom controls (+/-) to adjust thumbnail size

### Organize Library

1. Create collections from the sidebar
2. Drag presentations into collections
3. Create nested folders within collections
4. Add tags for filtering

## How Files Are Processed

When you upload a PPTX file, here's what happens:

**1. Upload**
- File saved to `web-app/server/uploads/{uuid}.pptx`
- Entry created in `data.json` with status `"processing"`

**2. Extraction** (Python)
- PPTX unzipped and parsed using `python-pptx`
- Text, images, tables, SmartArt, videos extracted
- Media files copied to `storage/{uuid}/media/`
- JSON output saved to `storage/{uuid}/json/{uuid}.json`

**3. Screenshots** (optional, requires LibreOffice)
- LibreOffice converts PPTX → PDF
- Poppler converts PDF → PNG images per slide
- Saved to `storage/{uuid}/screenshots/slide_XXXX.png`

**File locations:**
```
web-app/server/
├── uploads/              # Original PPTX files
│   └── {uuid}.pptx
├── storage/              # Processed output
│   └── {uuid}/
│       ├── json/
│       │   └── {uuid}.json     # Extracted content
│       ├── media/
│       │   └── *.png, *.mp4    # Images & videos
│       └── screenshots/
│           └── slide_*.png     # Slide screenshots
└── data.json             # Library database
```

**Privacy:** All files stay local on your machine. Nothing is sent to external servers except when you use "Fix with Gemini" (which sends slide data + screenshot to Google's Gemini API).

## Project Structure

```
ppt-to-learning/
├── src/ppt_to_learning/       # Python PPTX extraction
│   ├── core/                  # Data models
│   └── extractors/            # PPTX parsing logic
├── web-app/
│   ├── client/                # React frontend (Vite + TypeScript)
│   │   └── src/
│   │       ├── components/    # Reusable UI components
│   │       ├── pages/         # Page components
│   │       └── api.ts         # API client
│   └── server/                # Express backend
│       ├── index.js           # API routes
│       ├── db.js              # Data persistence
│       └── ai.js              # Gemini integration
├── scripts/                   # Migration utilities
└── tests/                     # Test files
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/presentations` | List all presentations |
| POST | `/api/upload` | Upload PPTX file |
| GET | `/api/presentations/:id/export` | Download presentation as ZIP |
| GET | `/api/presentations/:id/json/:resultId` | Get presentation JSON |
| PATCH | `/api/presentations/batch` | Batch update presentations |
| POST | `/api/ai/semantic-convert` | AI semantic conversion |
| GET | `/api/collections` | List collections |
| POST | `/api/collections` | Create collection |

## Keyboard Shortcuts (Viewer)

| Key | Action |
|-----|--------|
| `←` `→` | Navigate slides |
| `g` | Toggle grid view |
| `t` | Toggle thumbnail |
| `/` | Open search |
| `Esc` | Close panels |

## Configuration

### Gemini Model Selection

In the Settings modal, you can choose between:
- `gemini-3-flash-preview` (default, latest flash model)
- `gemini-3-pro-preview` (most capable reasoning)
- `gemini-2.5-flash` (stable, fast)
- `gemini-2.5-pro` (stable pro with adaptive thinking)

### Screenshot Generation

Screenshots require LibreOffice and Poppler. If not installed, the app will still work but without visual comparison features.

## Troubleshooting

### "Failed to generate screenshots"
- Ensure LibreOffice is installed and `soffice` is in PATH
- Ensure Poppler is installed and `pdftoppm` is in PATH

### "Failed to save collection" (404)
- Restart the server: `cd web-app && npm run dev`
- The server may be running old code

### AI conversion fails
- Check your Gemini API key in Settings
- Verify you have API quota remaining
- Try a different model in Settings

## Changelog

### v0.3 (2025-12-28)
- **Enhanced Slide Editing**: Delete content blocks with hover X button, direct JSON editor with validation
- **Gemini Preview Modal**: Side-by-side comparison of original vs AI-generated content before applying
- **Include Media Files**: Option to send extracted images to Gemini for better alt text and semantic placement
- **Improved Prompts**: AI now positions images correctly and extracts text from images into linked fields
- **UI Improvements**: Cancel edit button, JSON apply feedback, improved filename encoding

### v0.2 (2025-12-27)
- **ZIP Export**: Export presentations with all media files as downloadable ZIP
- **Library Management**: Batch move presentations, inline metadata editing
- **AI Icon Preservation**: Gemini semantic conversion now preserves icons/images from slides
- **Improved UI**: Selection mode, expandable presentation cards, destination picker

### v0.1 (2025-12-26)
- Initial release with PPTX extraction, web viewer, and AI enhancement

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [python-pptx](https://python-pptx.readthedocs.io/) for PPTX parsing
- [Google Gemini](https://ai.google.dev/) for AI capabilities
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) for the frontend
- [Tailwind CSS](https://tailwindcss.com/) for styling
