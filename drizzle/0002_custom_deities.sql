CREATE TABLE `deity_images` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `mime_type` text NOT NULL
    CHECK (`mime_type` IN ('image/jpeg', 'image/png', 'image/webp')),
  `image_data` blob NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `deity_images_user_idx`
  ON `deity_images` (`user_id`);
--> statement-breakpoint
CREATE TABLE `custom_deities` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL,
  `name_normalized` text NOT NULL,
  `prompt` text NOT NULL,
  `image_id` text,
  `random_enabled` integer DEFAULT 1 NOT NULL
    CHECK (`random_enabled` IN (0, 1)),
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE cascade,
  FOREIGN KEY (`image_id`) REFERENCES `deity_images` (`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_deities_user_name_uidx`
  ON `custom_deities` (`user_id`, `name_normalized`);
--> statement-breakpoint
CREATE INDEX `custom_deities_user_updated_idx`
  ON `custom_deities` (`user_id`, `updated_at` DESC);
--> statement-breakpoint
ALTER TABLE `advice_packs`
  ADD COLUMN `selection_mode` text DEFAULT 'random' NOT NULL
  CHECK (`selection_mode` IN ('random', 'manual'));
--> statement-breakpoint
ALTER TABLE `cards`
  ADD COLUMN `oracle_snapshot` text;
