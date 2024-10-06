ALTER TABLE "rounds" ADD COLUMN "is_archived" boolean NOT NULL DEFAULT false;
ALTER TABLE "rounds" ADD COLUMN "archived_at" timestamp;