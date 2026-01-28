import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './components/AuthProvider';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ThemeProvider } from './components/ThemeProvider';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Settings from './pages/Settings';
import Students from './pages/Students';
import Teachers from './pages/Teachers';

const App = () => (
	<BrowserRouter>
		<ThemeProvider defaultTheme="system">
			<AuthProvider>
				<Routes>
					<Route path="/login" element={<Login />} />
					<Route path="/auth/callback" element={<AuthCallback />} />

					{/* Protected dashboard routes */}
					<Route
						element={
							<ProtectedRoute>
								<DashboardLayout />
							</ProtectedRoute>
						}
					>
						<Route path="/" element={<Dashboard />} />
						<Route path="/students" element={<Students />} />
						<Route path="/teachers" element={<Teachers />} />
						<Route path="/settings" element={<Settings />} />
					</Route>

					<Route path="*" element={<NotFound />} />
				</Routes>
				<Toaster />
			</AuthProvider>
		</ThemeProvider>
	</BrowserRouter>
);

export default App;
