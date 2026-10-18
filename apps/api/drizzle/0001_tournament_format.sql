CREATE TYPE "public"."tournament_format" AS ENUM('arena', 'round_robin');--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "format" "tournament_format" DEFAULT 'arena' NOT NULL;