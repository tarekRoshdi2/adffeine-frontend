import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import Pricing from './pages/Pricing';
import Demo from './pages/Demo';
import AdminAuthWrapper from './pages/admin/AdminAuthWrapper';
import AdminDashboard from './pages/admin/AdminDashboard';
import DoctorDashboard from './pages/doctor/DoctorDashboard';

function App() {
    return (
        <AuthProvider>
            <Toaster position="top-right" reverseOrder={false} />
            <ToastProvider>
                <Router>
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/demo" element={<Demo />} />

                        {/* Admin route: handles its own auth — wrapped correctly now */}
                        <Route path="/admin/*" element={
                            <AdminAuthWrapper>
                                <AdminDashboard />
                            </AdminAuthWrapper>
                        } />

                        {/* Doctor Protected Routes */}
                        <Route element={<ProtectedRoute />}>
                            <Route path="/dashboard/*" element={<DoctorDashboard />} />
                        </Route>
                    </Routes>
                </Router>
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;
