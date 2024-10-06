ALTER TABLE "round_games" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "round_games" ALTER COLUMN "game_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "round_games" ALTER COLUMN "created_at" DROP NOT NULL;