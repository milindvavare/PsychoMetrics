import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tests from './pages/admin/Tests';
import Questions from './pages/admin/Questions';
import Categories from './pages/admin/Categories';
import Candidates from './pages/admin/Candidates';
import Reports from './pages/admin/Reports';
import TestResults from './pages/admin/TestResults';
import HRDetailedReport from './pages/admin/HRDetailedReport';
import KRAs from './pages/admin/KRAs';
import KPIs from './pages/admin/KPIs';
import KRADashboard from './pages/admin/KRADashboard';
import Settings from './pages/admin/Settings';
import TestPage from './pages/TestPage';
import TestComplete from './pages/TestComplete';
import Landing from './pages/Landing';
import Register from './pages/Register';
import CandidateLogin from './pages/CandidateLogin';
import CandidateRegister from './pages/CandidateRegister';
import CandidateDashboard from './pages/CandidateDashboard';
import CandidateSetupPassword from './pages/CandidateSetupPassword';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/candidate/login" element={<CandidateLogin />} />
            <Route path="/candidate/register" element={<CandidateRegister />} />
            <Route path="/candidate/setup-password" element={<CandidateSetupPassword />} />
            <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
            <Route path="/test/:testId/:candidateId" element={<TestPage />} />
            <Route path="/test/complete/:attemptId" element={<TestComplete />} />
            
            {/* Admin routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="tests" element={<Tests />} />
              <Route path="questions" element={<Questions />} />
              <Route path="categories" element={<Categories />} />
              <Route path="candidates" element={<Candidates />} />
              <Route path="reports" element={<Reports />} />
              <Route path="reports/test/:testId" element={<TestResults />} />
              <Route path="reports/hr-detailed/:attemptId" element={<HRDetailedReport />} />
              <Route path="kras" element={<KRAs />} />
              <Route path="kpis" element={<KPIs />} />
              <Route path="kra-dashboard/:employeeType/:employeeId" element={<KRADashboard />} />
              <Route path="settings" element={<Settings />} />
            </Route>

          </Routes>
          <ToastContainer position="top-right" autoClose={3000} />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

