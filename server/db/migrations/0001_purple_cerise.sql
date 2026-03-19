CREATE TYPE "public"."oga_site_status" AS ENUM('active', 'disabled', 'pending');--> statement-breakpoint
ALTER TYPE "public"."ai_provider_type" ADD VALUE 'claude-code';--> statement-breakpoint
CREATE TABLE "oga_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"asset_type" varchar(50) NOT NULL,
	"value" text NOT NULL,
	"mime_type" varchar(100),
	"enabled" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oga_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar(500) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"api_key" text NOT NULL,
	"status" "oga_site_status" DEFAULT 'active' NOT NULL,
	"emancipated" boolean DEFAULT false NOT NULL,
	"parent_domain" varchar(500),
	"allowed_origins" jsonb DEFAULT '[]'::jsonb,
	"last_fetched_at" timestamp,
	"fetch_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oga_sites_domain_unique" UNIQUE("domain"),
	CONSTRAINT "oga_sites_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
ALTER TABLE "oga_assets" ADD CONSTRAINT "oga_assets_site_id_oga_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."oga_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oga_assets_site_type_idx" ON "oga_assets" USING btree ("site_id","asset_type");