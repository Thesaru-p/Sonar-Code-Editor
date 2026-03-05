import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import IDE from './pages/IDE';
import AdminDashboard from './pages/AdminDashboard';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e1e1e', color: '#d4d4d4' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) return <Login />;
  if (user.role === 'admin') return (
    <Routes>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to="/admin" />} />
    </Routes>
  );
  return (
    <Routes>
      <Route path="/ide" element={<IDE />} />
      <Route path="*" element={<Navigate to="/ide" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
