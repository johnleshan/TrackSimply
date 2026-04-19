-- 1. Create site_users table
CREATE TABLE IF NOT EXISTS public.site_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create inventory table
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.site_users(id),
    name TEXT NOT NULL,
    stock INTEGER DEFAULT 0,
    reorder INTEGER DEFAULT 0,
    price NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create debts table
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.site_users(id),
    name TEXT NOT NULL,
    total NUMERIC DEFAULT 0,
    interest NUMERIC DEFAULT 0,
    min_payment NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.site_users(id),
    category TEXT NOT NULL,
    budget NUMERIC DEFAULT 0,
    actual NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.site_users(id),
    description TEXT,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL, -- 'income' or 'expense'
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Default Superadmin
INSERT INTO public.site_users (username, password, role, active)
VALUES ('superadmin', 'password', 'superadmin', true)
ON CONFLICT (username) DO NOTHING;
