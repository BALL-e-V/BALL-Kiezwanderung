ALTER TABLE `hikingTails` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `hikingTails` MODIFY COLUMN `title` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `hikingTails` MODIFY COLUMN `description` text NOT NULL;--> statement-breakpoint
ALTER TABLE `hikingTails` MODIFY COLUMN `zoom` float NOT NULL;--> statement-breakpoint
ALTER TABLE `hikingTails` MODIFY COLUMN `mapLat` double NOT NULL;--> statement-breakpoint
ALTER TABLE `hikingTails` MODIFY COLUMN `mapLong` double NOT NULL;--> statement-breakpoint
ALTER TABLE `hikingTails` MODIFY COLUMN `trail` json NOT NULL;--> statement-breakpoint
ALTER TABLE `hikingTails` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `user` ADD `roles` json;--> statement-breakpoint
ALTER TABLE `user` ADD `claims` json;--> statement-breakpoint
ALTER TABLE `hikingTails` ADD `id` varchar(191) DEFAULT '0b11c69f-afad-445e-ba7d-cb8fcb937060' NOT NULL;--> statement-breakpoint
ALTER TABLE `hikingTails` ADD `author` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `hikingTails` ADD `created` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `hikingTails` ADD `editor` varchar(128);--> statement-breakpoint
ALTER TABLE `hikingTails` ADD `updated` timestamp ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `pictures` ADD `latitude` double;--> statement-breakpoint
ALTER TABLE `pictures` ADD `longitude` double;--> statement-breakpoint
ALTER TABLE `pictures` ADD `description` text;--> statement-breakpoint
CREATE INDEX `titleIdx` ON `hikingTails` (`title`);--> statement-breakpoint
ALTER TABLE `hikingTails` DROP COLUMN `logID`;--> statement-breakpoint
ALTER TABLE `hikingTails` DROP COLUMN `duration`;--> statement-breakpoint
ALTER TABLE `hikingTails` DROP COLUMN `startAdress`;--> statement-breakpoint
ALTER TABLE `hikingTails` DROP COLUMN `endAdress`;