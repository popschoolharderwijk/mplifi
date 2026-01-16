-- Create todos table
CREATE TABLE public.todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS but allow public read access
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read todos (public access)
CREATE POLICY "Anyone can view todos" 
ON public.todos 
FOR SELECT 
USING (true);

-- Insert 3 example entries
INSERT INTO public.todos (title, completed) VALUES
  ('Boodschappen doen', false),
  ('Project afronden', true),
  ('E-mails beantwoorden', false);