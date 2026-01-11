const Index = () => {
	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="text-center space-y-6">
				<h1 className="text-4xl font-bold text-foreground">Ready to Test</h1>
				<p className="text-muted-foreground">Your clean starting point</p>
				<button
					type="button"
					className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
					onClick={() => alert('Test!')}
				>
					Test Knopje (/main branch)
				</button>
			</div>
		</div>
	);
};

export default Index;
