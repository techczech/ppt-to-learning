import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { FileUpload } from './components/FileUpload';
import { StatusPage } from './pages/StatusPage';
import { ViewerPage } from './pages/ViewerPage';
import { BookOpen, FileText, Loader2, RefreshCw, Clock, Settings } from 'lucide-react';
import { getLegacyFiles, getManagedPresentations, reprocessPresentation, type LegacyFile, type ManagedPresentation } from './api';
import { ApiKeyModal } from './components/ApiKeyModal';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/status/:id" element={<StatusPage />} />
        <Route path="/viewer/:type/:id/:resultId?" element={<ViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

const Home: React.FC = () => {
  const [legacyFiles, setLegacyFiles] = useState<LegacyFile[]>([]);
  const [managedFiles, setManagedFiles] = useState<ManagedPresentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();

  const loadData = () => {
    setLoading(true);
    Promise.all([getLegacyFiles(), getManagedPresentations()])
      .then(([legacy, managed]) => {
        setLegacyFiles(legacy);
        setManagedFiles(managed);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReprocess = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm('Are you sure you want to reprocess this file?')) {
        await reprocessPresentation(id);
        navigate(`/status/${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">PPT to Learning</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                title="API Settings"
            >
                <Settings className="w-5 h-5" />
            </button>
            <button onClick={loadData} className="text-sm text-blue-600 hover:underline">
                Refresh Lists
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Upload New</h2>
            <p className="text-gray-500">Transform a new PowerPoint presentation.</p>
          </div>
          <div className="bg-white p-2 rounded-xl shadow-lg border border-gray-100 sticky top-24">
            <FileUpload />
          </div>
        </div>

        <div className="lg:col-span-8 space-y-12">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Your Presentations</h2>
                <p className="text-gray-500">Files uploaded and managed by this app.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
                {managedFiles.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No uploads yet.</div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {managedFiles.map((file) => (
                            <li key={file.id} className="p-4 hover:bg-gray-50 transition flex items-center justify-between group">
                                <Link 
                                    to={file.status === 'completed' ? `/viewer/new/${file.id}/${file.resultId}` : `/status/${file.id}`}
                                    className="flex items-center flex-1"
                                >
                                    <div className={`p-2 rounded mr-4 ${file.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {file.status === 'completed' ? <FileText className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                                            {file.originalName}
                                        </h3>
                                        <div className="flex items-center text-xs text-gray-400 space-x-2">
                                            <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span className="capitalize">{file.status}</span>
                                        </div>
                                    </div>
                                </Link>
                                <div className="ml-4">
                                    <button 
                                        onClick={(e) => handleReprocess(file.id, e)}
                                        title="Reprocess"
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
          </div>

          <div>
            <div className="mb-4">
              <h2 className="text-2xl font-bold">Legacy Library</h2>
              <p className="text-gray-500">Files from the sourcefiles/czech folder.</p>
            </div>

            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden min-h-[200px]">
              {loading ? (
                <div className="flex justify-center items-center h-40 text-gray-400">
                  <Loader2 className="animate-spin w-6 h-6 mr-2" /> Loading...
                </div>
              ) : legacyFiles.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No existing files found.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {legacyFiles.map((file) => (
                    <li key={file.id} className="hover:bg-gray-50 transition">
                      <Link 
                        to={`/viewer/legacy/${file.id}`} 
                        className="block p-4 flex items-center group"
                      >
                        <div className="bg-orange-100 p-2 rounded text-orange-600 mr-4">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                            {file.id}
                          </h3>
                          <p className="text-xs text-gray-400">Legacy File</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>

      <ApiKeyModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default App;
