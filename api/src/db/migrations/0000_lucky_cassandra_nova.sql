CREATE TABLE "audit_logs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"actor_username" varchar(64) NOT NULL,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(64) NOT NULL,
	"details" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_attachments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"comment_id" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"size_kb" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "default_slas" (
	"priority" varchar(20) PRIMARY KEY NOT NULL,
	"response_hours" integer NOT NULL,
	"resolution_hours" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"name" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"role" varchar(20) NOT NULL,
	"is_department_head" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"password_hash" text NOT NULL,
	"requires_password_change" boolean DEFAULT false NOT NULL,
	"email" varchar(255),
	"receive_email_notifications" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"recipient_username" varchar(64) NOT NULL,
	"ticket_id" varchar(64),
	"type" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_templates" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"target_department" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"purpose" text NOT NULL,
	"expected_result" text NOT NULL,
	"default_priority" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_assignment_history" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"ticket_id" varchar(64) NOT NULL,
	"from_assignee" text,
	"to_assignee" text NOT NULL,
	"at" varchar(64) NOT NULL,
	"actor_name" text,
	"actor_department" text
);
--> statement-breakpoint
CREATE TABLE "ticket_attachments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"ticket_id" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"size_kb" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"ticket_id" varchar(64) NOT NULL,
	"author" text NOT NULL,
	"department" text NOT NULL,
	"body" text NOT NULL,
	"created_at" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_status_history" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"ticket_id" varchar(64) NOT NULL,
	"status" varchar(20) NOT NULL,
	"at" varchar(64) NOT NULL,
	"reason" text,
	"actor_name" text,
	"actor_department" text
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"purpose" text,
	"expected_result" text,
	"priority" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"requester_name" text NOT NULL,
	"from_department" text NOT NULL,
	"to_department" text NOT NULL,
	"assignee_name" text,
	"due_date" varchar(10),
	"rating" integer,
	"feedback" text,
	"cancel_reason" text,
	"created_at" varchar(64) NOT NULL,
	"created_at_updated" varchar(64) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_comment_id_ticket_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."ticket_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_department_departments_name_fk" FOREIGN KEY ("department") REFERENCES "public"."departments"("name") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_templates" ADD CONSTRAINT "request_templates_target_department_departments_name_fk" FOREIGN KEY ("target_department") REFERENCES "public"."departments"("name") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignment_history" ADD CONSTRAINT "ticket_assignment_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "ticket_status_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_from_department_departments_name_fk" FOREIGN KEY ("from_department") REFERENCES "public"."departments"("name") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_to_department_departments_name_fk" FOREIGN KEY ("to_department") REFERENCES "public"."departments"("name") ON DELETE restrict ON UPDATE no action;