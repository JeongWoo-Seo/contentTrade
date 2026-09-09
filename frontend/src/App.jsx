import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './features/auth';
import AuthPage from './pages/AuthPage';
import NovelsPage from './pages/NovelsPage';
import NovelCreatePage from './pages/NovelCreatePage';
import MyRegistrationsPage from './pages/MyRegistrationsPage';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route
            path="/novels"
            element={
              <ProtectedRoute>
                <NovelsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/novels/new"
            element={
              <ProtectedRoute>
                <NovelCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/novels/mine"
            element={
              <ProtectedRoute>
                <MyRegistrationsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
