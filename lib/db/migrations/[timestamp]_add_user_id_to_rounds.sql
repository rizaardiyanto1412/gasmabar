-- Add the userId column to the rounds table, allowing NULL values initially
ALTER TABLE "rounds" ADD COLUMN "user_id" integer;

-- Add a foreign key constraint to the users table
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");

-- Populate the user_id column with a default user (you may need to adjust this based on your data)
UPDATE "rounds" SET "user_id" = (SELECT "id" FROM "users" LIMIT 1) WHERE "user_id" IS NULL;

-- Make the user_id column NOT NULL after populating it
ALTER TABLE "rounds" ALTER COLUMN "user_id" SET NOT NULL;