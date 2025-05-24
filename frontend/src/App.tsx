import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import Dashboard from './pages/Dashboard';
import PublicStatusPage from './pages/PublicStatusPage';
import CustomSignUp from './components/auth/CustomSignUp';
import './App.css';
import CustomSignIn from './components/auth/CustomSignin';
import AuthSyncer from './components/auth/AuthSync';

// ProtectedRoute component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => (
  <>
    <SignedIn>{children}</SignedIn>
    <SignedOut>
      <Navigate to="/sign-in" replace />
    </SignedOut>
  </>
);

const App = () => {
  return (
    <Router>
      <AuthSyncer />
      <Routes>
        <Route
          path="/sign-in"
          element={<CustomSignIn />}
        />
        <Route
          path="/sign-up"
          element={<CustomSignUp />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<PublicStatusPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;