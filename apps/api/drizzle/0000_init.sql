CREATE TYPE "public"."match_end_reason" AS ENUM('checkmate', 'resignation', 'timeout', 'stalemate', 'insufficient_material', 'threefold_repetition', 'fifty_move_rule', 'draw_agreement');--> statement-breakpoint
CREATE TYPE "public"."match_result" AS ENUM('white_win', 'black_win', 'draw');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('ongoing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."piece_color" AS ENUM('white', 'black');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'open', 'ongoing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('coach', 'student');--> statement-breakpoint
CREATE TABLE "active_players" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"ply" integer NOT NULL,
	"color" "piece_color" NOT NULL,
	"played_by_id" uuid NOT NULL,
	"san" varchar(16) NOT NULL,
	"from_square" varchar(2) NOT NULL,
	"to_square" varchar(2) NOT NULL,
	"promotion" varchar(1),
	"fen_after" text NOT NULL,
	"think_time_ms" integer NOT NULL,
	"white_time_ms" integer NOT NULL,
	"black_time_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_moves_ply_positive_ck" CHECK ("match_moves"."ply" >= 1)
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"white_id" uuid NOT NULL,
	"black_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'ongoing' NOT NULL,
	"result" "match_result",
	"end_reason" "match_end_reason",
	"fen" text DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' NOT NULL,
	"pgn" text DEFAULT '' NOT NULL,
	"ply" integer DEFAULT 0 NOT NULL,
	"base_seconds" integer NOT NULL,
	"increment_seconds" integer NOT NULL,
	"white_time_ms" integer NOT NULL,
	"black_time_ms" integer NOT NULL,
	"turn_started_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_distinct_players_ck" CHECK ("matches"."white_id" <> "matches"."black_id"),
	CONSTRAINT "matches_clock_non_negative_ck" CHECK ("matches"."white_time_ms" >= 0 AND "matches"."black_time_ms" >= 0),
	CONSTRAINT "matches_completion_consistent_ck" CHECK (("matches"."status" = 'completed') = ("matches"."result" IS NOT NULL AND "matches"."end_reason" IS NOT NULL AND "matches"."ended_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "matchmaking_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"base_seconds" integer NOT NULL,
	"increment_seconds" integer DEFAULT 0 NOT NULL,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by_id" uuid NOT NULL,
	"winner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_base_seconds_ck" CHECK ("tournaments"."base_seconds" BETWEEN 30 AND 10800),
	CONSTRAINT "tournaments_increment_seconds_ck" CHECK ("tournaments"."increment_seconds" BETWEEN 0 AND 180),
	CONSTRAINT "tournaments_completed_at_ck" CHECK (("tournaments"."status" = 'completed') = ("tournaments"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" "user_role" NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_players" ADD CONSTRAINT "active_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_players" ADD CONSTRAINT "active_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_moves" ADD CONSTRAINT "match_moves_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_moves" ADD CONSTRAINT "match_moves_played_by_id_users_id_fk" FOREIGN KEY ("played_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_white_id_users_id_fk" FOREIGN KEY ("white_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_black_id_users_id_fk" FOREIGN KEY ("black_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchmaking_queue" ADD CONSTRAINT "matchmaking_queue_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchmaking_queue" ADD CONSTRAINT "matchmaking_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "active_players_match_idx" ON "active_players" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_moves_match_ply_uq" ON "match_moves" USING btree ("match_id","ply");--> statement-breakpoint
CREATE INDEX "matches_tournament_status_idx" ON "matches" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE INDEX "matches_white_idx" ON "matches" USING btree ("white_id");--> statement-breakpoint
CREATE INDEX "matches_black_idx" ON "matches" USING btree ("black_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matchmaking_queue_user_uq" ON "matchmaking_queue" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "matchmaking_queue_tournament_enqueued_idx" ON "matchmaking_queue" USING btree ("tournament_id","enqueued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_participants_tournament_user_uq" ON "tournament_participants" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE INDEX "tournament_participants_user_idx" ON "tournament_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tournaments_status_starts_at_idx" ON "tournaments" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "tournaments_created_by_idx" ON "tournaments" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");