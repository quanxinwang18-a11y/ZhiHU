CREATE TABLE `quote_insights` (
  `user_id` text PRIMARY KEY NOT NULL,
  `source_hash` text NOT NULL,
  `source_count` integer NOT NULL,
  `catalog_version` text NOT NULL,
  `prompt_version` text NOT NULL,
  `status` text NOT NULL,
  `result_json` text,
  `generated_at` integer,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE cascade
);
