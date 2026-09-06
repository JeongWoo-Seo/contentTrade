import { AuthProvider } from './features/auth'; 
import AuthPage from './pages/AuthPage'; 
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  );
}
