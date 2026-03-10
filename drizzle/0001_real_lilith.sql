CREATE TABLE `hikingTails` (
	`logID` varchar(48) NOT NULL DEFAULT ('UUID()'),
	`title` varchar(128),
	`description` varchar(1024),
	`zoom` float,
	`mapLat` double,
	`mapLong` double,
	`trail` varchar(10000),
	`length` float,
	`duration` time,
	`startAdress` varchar(128),
	`endAdress` varchar(128),
	CONSTRAINT `hikingTails_logID` PRIMARY KEY(`logID`)
);
--> statement-breakpoint
CREATE TABLE `pictures` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`trailID` varchar(48),
	`imageUrl` varchar(128),
	`caption` varchar(128),
	CONSTRAINT `pictures_id` PRIMARY KEY(`id`)
);
