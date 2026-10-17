CREATE TABLE "accommodations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"category" varchar(60) NOT NULL,
	"description" text NOT NULL,
	"image" text NOT NULL,
	"capacity" integer NOT NULL,
	"base_rate" integer NOT NULL,
	"amenities" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accommodations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "admin_login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(30) DEFAULT 'admin' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" varchar(200) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"alt" varchar(255) NOT NULL,
	"category" varchar(60) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"reservation_id" integer NOT NULL,
	"method" varchar(40) NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar(30) DEFAULT 'Unverified' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(32) NOT NULL,
	"accommodation_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"guest_id" integer NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"adults" integer NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"nights" integer NOT NULL,
	"nightly_rate" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"fee" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"payment_method" varchar(40) NOT NULL,
	"status" varchar(30) DEFAULT 'Pending' NOT NULL,
	"special_requests" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "room_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"accommodation_id" integer NOT NULL,
	"label" varchar(100) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "room_inventory_label_unique" UNIQUE("label")
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_room_id_room_inventory_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_id_room_inventory_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_inventory" ADD CONSTRAINT "room_inventory_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_login_attempts_lookup_idx" ON "admin_login_attempts" USING btree ("fingerprint","created_at");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" USING btree ("admin_id");