ALTER TABLE "games" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "game_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "round_id" integer NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "games" ADD CONSTRAINT "games_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
