// We'll use the <Link> component from React Router for navigation
import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav>
      <Link to="/">Home</Link> | 
      <Link to="/dashboard">Dashboard</Link> | 
      <Link to="/login">Login</Link>
    </nav>
  );
}