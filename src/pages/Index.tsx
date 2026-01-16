import { getDatabaseURL, isDevelopmentDatabase } from '@/lib/utils';

export default function Index() {
	return (
		<div className="p-8 max-w-2xl mx-auto">
			<h1 className="text-2xl font-bold mb-2">Database Info</h1>
			<p className="text-muted-foreground mb-6 font-mono text-sm break-all">
				URL: {getDatabaseURL()} <strong>({isDevelopmentDatabase() ? 'development' : 'production'})</strong>
			</p>
		</div>
	);
}
