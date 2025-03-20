CREATE TABLE IF NOT EXISTS thule_downloads (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('product', 'car')),
    file_size BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_message TEXT
);
