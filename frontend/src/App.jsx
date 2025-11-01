import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import Navbar from './components/common/Navbar.jsx';
import AuthProvider from './hooks/useAuth.jsx';
import './index.css'; // we'll use index.css for global Tailwind + GitHub style

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="min-h-screen bg-[#f6f8fa] pb-10 text-[#1f2328]">
          <div className="max-w-7xl mx-auto pt-6 px-4 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="*" element={<h2 className="text-center text-gray-600">404: Page Not Found</h2>} />
            </Routes>
          </div>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
