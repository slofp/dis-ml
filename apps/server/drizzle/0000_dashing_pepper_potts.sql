CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`stt_model` text NOT NULL,
	`language_hints` text NOT NULL,
	`auto_follow_owner` integer NOT NULL,
	`owner_user_id` text,
	`auto_record` integer NOT NULL,
	`discord_token` text,
	`soniox_api_key` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`user_id` text,
	`display_name` text,
	`file_name` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`duration_ms` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recordings_session` ON `recordings` (`session_id`);--> statement-breakpoint
CREATE TABLE `session_participants` (
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`guild_name` text NOT NULL,
	`channel_id` text NOT NULL,
	`channel_name` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`text` text NOT NULL,
	`start_ms` integer,
	`end_ms` integer,
	`is_final` integer NOT NULL,
	`language` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_transcripts_session` ON `transcripts` (`session_id`,`created_at`);