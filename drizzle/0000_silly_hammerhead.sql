CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`creator` text NOT NULL,
	`owner` text NOT NULL,
	`source` text,
	`document` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_code_unique` ON `books` (`code`);--> statement-breakpoint
CREATE TABLE `contributions` (
	`book_id` text NOT NULL,
	`task_id` text NOT NULL,
	`owner_id` text,
	`work` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`book_revision` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`reviewer_id` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`book_id`, `task_id`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`last_seen` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_session` ON `members` (`book_id`,`session_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`task_id` text NOT NULL,
	`member_id` text NOT NULL,
	`work_revision` integer NOT NULL,
	`verdict` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
