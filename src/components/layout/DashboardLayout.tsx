import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { BreadcrumbProvider } from '@/contexts/BreadcrumbContext';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

export function DashboardLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	return (
		<div className="flex h-screen overflow-hidden">
			{/* Sidebar */}
			<Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

			{/* Main content area */}
			<div className="flex flex-1 flex-col overflow-hidden">
				<BreadcrumbProvider>
					<TopNav />

					{/* Page content */}
					<main className="flex-1 overflow-auto p-6">
						<Outlet />
					</main>
				</BreadcrumbProvider>
			</div>
		</div>
	);
}
