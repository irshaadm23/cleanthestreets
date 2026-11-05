CREATE TABLE `incident_merges` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`reversed_at` text
);
--> statement-breakpoint
CREATE TABLE `route_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`crew` text NOT NULL,
	`day` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`incident_id` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_orders_owner_incident` ON `work_orders` (`owner_id`,`incident_id`);