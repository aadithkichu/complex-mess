import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// Import your page components (we'll create placeholders for these)
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';

// Import a shared layout component (e.g., a Navbar)
import Navbar from './components/Navbar';

// Import your global styles
import './App.css'; // RIGHT: This looks in the 'src' folder

function App() {
  return (
    // BrowserRouter wraps your entire app to enable routing
    <BrowserRouter>
      {/* Navbar is placed *outside* of <Routes> 
        so it appears on every single page.
      */}
      <Navbar />

      <main className="container">
        {/* <Routes> acts like a switch. It will only
          render the *first* <Route> that matches the
          current URL path.
        */}
        <Routes>
          {/* A route for your home/landing page */}
          <Route path="/" element={<HomePage />} />

          {/* A route for your main dashboard */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* A route for your login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* A "Catch-All" 404 Page */}
          <Route path="*" element={<h2>404: Page Not Found</h2>} />
        </Routes>
      </main>

    </BrowserRouter>
  );
}

export default App;