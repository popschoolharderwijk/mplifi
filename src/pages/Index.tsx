import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://zdvscmogkfyddnnxzkdu.supabase.co";

type Todo = {
	id: string;
	title: string;
	completed: boolean;
	created_at: string;
};

export default function Index() {
	const [todos, setTodos] = useState<Todo[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchTodos = async () => {
			const { data, error } = await supabase.from("todos").select("*");
			if (!error && data) {
				setTodos(data);
			}
			setLoading(false);
		};
		fetchTodos();
	}, []);

	return (
		<div className="p-8 max-w-2xl mx-auto">
			<h1 className="text-2xl font-bold mb-2">Database URL</h1>
			<p className="text-muted-foreground mb-6 font-mono text-sm break-all">
				{SUPABASE_URL}
			</p>

			<h2 className="text-xl font-semibold mb-4">Todos</h2>
			{loading ? (
				<p className="text-muted-foreground">Laden...</p>
			) : (
				<ul className="space-y-2">
					{todos.map((todo) => (
						<li
							key={todo.id}
							className="flex items-center gap-3 p-3 rounded-lg border bg-card"
						>
							<span
								className={`w-4 h-4 rounded-full ${todo.completed ? "bg-green-500" : "bg-muted"}`}
							/>
							<span className={todo.completed ? "line-through text-muted-foreground" : ""}>
								{todo.title}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
