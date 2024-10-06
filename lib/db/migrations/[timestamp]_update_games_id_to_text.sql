-- Drop existing primary key constraint
ALTER TABLE games DROP CONSTRAINT games_pkey;

-- Change id column type to TEXT
ALTER TABLE games ALTER COLUMN id TYPE TEXT;

-- Add new primary key constraint
ALTER TABLE games ADD PRIMARY KEY (id);

-- Update existing id values to UUIDs if necessary
UPDATE games SET id = gen_random_uuid()::TEXT WHERE id IS NULL OR id = '';