ALTER TABLE `advice_packs`
ADD COLUMN `visual_spectrum` text DEFAULT 'obsidian' NOT NULL
CHECK (`visual_spectrum` IN ('obsidian', 'lunar', 'ziwei', 'calamity', 'jade'));
