import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lrjnqrymzpqdnikglplb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyam5xcnltenBxZG5pa2dscGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NzUxOTYsImV4cCI6MjA1MTA1MTE5Nn0.MftD2d4ShqdoGbv5YmXyFGDaR9OiryO7i9ZzEgIEtUU';

export const supabase = createClient(supabaseUrl, supabaseKey);