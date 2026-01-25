import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import AuthCallback from './pages/AuthCallback';
import Index from './pages/Index';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Register from './pages/Register';

const App = () => (
	<BrowserRouter>
		<AuthProvider>
			<Routes>
				<Route path="/login" element={<Login />} />
				<Route path="/register" element={<Register />} />
				<Route path="/auth/callback" element={<AuthCallback />} />
				<Route
					path="/"
					element={
						<ProtectedRoute>
							<Index />
						</ProtectedRoute>
					}
				/>
				<Route path="*" element={<NotFound />} />
			</Routes>
		</AuthProvider>
	</BrowserRouter>
);

export default App;
