PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_ai_credentials` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`encrypted_key` text,
	`key_hint` text,
	`models` text NOT NULL,
	`models_fetched_at` integer NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `provider`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_ai_credentials`("user_id", "provider", "model", "encrypted_key", "key_hint", "models", "models_fetched_at", "is_active", "created_at", "updated_at") SELECT "user_id", "provider", "model", "encrypted_key", "key_hint", "models", "models_fetched_at", "is_active", "created_at", "updated_at" FROM `user_ai_credentials`;--> statement-breakpoint
DROP TABLE `user_ai_credentials`;--> statement-breakpoint
ALTER TABLE `__new_user_ai_credentials` RENAME TO `user_ai_credentials`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_ai_credentials_one_active` ON `user_ai_credentials` (`user_id`) WHERE "user_ai_credentials"."is_active" = 1;