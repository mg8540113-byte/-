-- Create Institutions Table
CREATE TABLE public.institutions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Groups Table
CREATE TABLE public.groups (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    institution_subsidy_percent NUMERIC DEFAULT 0,
    admin_subsidy_percent NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Vouchers Table
CREATE TABLE public.vouchers (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    owner_name TEXT NOT NULL,
    barcode TEXT NOT NULL,
    face_value NUMERIC NOT NULL,
    paid_amount NUMERIC NOT NULL,
    has_warning BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Create Policies (Allow public access for now - as per user request for simple setup)
-- Warning: This allows anyone with the URL to read/write. Ideally we should add auth later.
CREATE POLICY "Enable read access for all users" ON public.institutions FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.institutions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.institutions FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.institutions FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.groups FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.groups FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON public.vouchers FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.vouchers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.vouchers FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.vouchers FOR DELETE USING (true);
