-- 1. Menambahkan kolom 'period' pada tabel sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS period text;

-- 2. Menambahkan kolom 'period' pada tabel soh
ALTER TABLE soh ADD COLUMN IF NOT EXISTS period text;

-- 3. Menambahkan kolom 'period' pada tabel uploaded_files
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS period text;

-- 4. Membuat tabel baru 'historical_snapshots'
CREATE TABLE IF NOT EXISTS historical_snapshots (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    period text UNIQUE NOT NULL,
    total_revenue numeric NOT NULL DEFAULT 0,
    total_stock_value numeric NOT NULL DEFAULT 0,
    stock_efficiency numeric NOT NULL DEFAULT 0,
    ito numeric NOT NULL DEFAULT 0,
    moving_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- (Opsional tapi disarankan) Menambahkan Row Level Security Policy untuk historical_snapshots agar tabelnya aman
ALTER TABLE historical_snapshots ENABLE ROW LEVEL SECURITY;

-- Memberikan akses akses anon / authenticated ke tabel historical_snapshots (Sesuaikan dengan kebutuhan privasi Anda)
CREATE POLICY "Allow anonymous read access on historical_snapshots" 
ON historical_snapshots FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert access on historical_snapshots" 
ON historical_snapshots FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update access on historical_snapshots" 
ON historical_snapshots FOR UPDATE USING (true) WITH CHECK (true);
