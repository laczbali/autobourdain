CREATE TABLE `user_ai_credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`key_hint` text NOT NULL,
	`models` text NOT NULL,
	`models_fetched_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
