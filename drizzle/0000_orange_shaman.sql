CREATE TABLE "admin_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"admin_user_id" varchar(64) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"email" varchar(254),
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" varchar(64) NOT NULL,
	"role_code" varchar(24) DEFAULT 'editor' NOT NULL,
	"avatar" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"category" varchar(48) NOT NULL,
	"sub_category" varchar(64),
	"author_id" varchar(64),
	"author_name" text NOT NULL,
	"author_role" text NOT NULL,
	"author_avatar" text NOT NULL,
	"author_bio" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_time" varchar(32) NOT NULL,
	"image_url" text NOT NULL,
	"image_caption" text,
	"image_photographer" text,
	"is_breaking" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_editorial_pick" boolean DEFAULT false NOT NULL,
	"is_video" boolean DEFAULT false NOT NULL,
	"video_badge_text" varchar(64),
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'published' NOT NULL,
	"audio_length" varchar(32),
	"location" text,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"method" varchar(16) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"details" text NOT NULL,
	"admin_user_id" varchar(64),
	"status_code" integer
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"target_id" varchar(80) NOT NULL,
	"article_id" varchar(80),
	"state_news_id" varchar(80),
	"user_name" text NOT NULL,
	"user_avatar" text,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'approved' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editors" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"show_name" text,
	"image_url" text NOT NULL,
	"bio" text,
	"twitter" varchar(128),
	"experience" varchar(64),
	"is_staff_author_only" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_updates" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timestamp_label" varchar(64) DEFAULT 'अभी-अभी' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" varchar(48) NOT NULL,
	"is_breaking" boolean DEFAULT false NOT NULL,
	"author" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"tag" varchar(64),
	"link_article_id" varchar(80),
	"location" text
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"mime_type" varchar(64),
	"caption" text,
	"credit" text,
	"uploaded_by_admin_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_broadcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"newsletter_id" varchar(80),
	"subject" text NOT NULL,
	"preview_content" text,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_by_admin_id" varchar(64),
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletters" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"schedule" text NOT NULL,
	"curator" text NOT NULL,
	"icon" varchar(32) NOT NULL,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"badge" varchar(48),
	"sample_headline" text NOT NULL,
	"title" text,
	"delivery_time" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" varchar(80) NOT NULL,
	"option_key" varchar(64) NOT NULL,
	"text" text NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"percentage" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" varchar(80) NOT NULL,
	"option_id" integer NOT NULL,
	"voter_hash" varchar(128) NOT NULL,
	"voted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"category" varchar(64) NOT NULL,
	"total_votes" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_news" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"state" varchar(48) NOT NULL,
	"city" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"content" text,
	"image_url" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reporter" text NOT NULL,
	"read_time" varchar(32) NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_headline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriber_newsletters" (
	"subscriber_id" varchar(80) NOT NULL,
	"newsletter_id" varchar(80) NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_subscriber_newsletters" PRIMARY KEY("subscriber_id","newsletter_id")
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"name" text,
	"frequency" varchar(24) DEFAULT 'daily' NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"video_url" text,
	"duration" varchar(24) NOT NULL,
	"category" varchar(64) NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_label" text DEFAULT 'अभी-अभी' NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"views_display" varchar(24) DEFAULT '0' NOT NULL,
	"anchor_id" varchar(64),
	"anchor" text NOT NULL,
	"anchor_avatar" text,
	"is_live" boolean DEFAULT false NOT NULL,
	"tag" varchar(64)
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_editors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."editors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_state_news_id_state_news_id_fk" FOREIGN KEY ("state_news_id") REFERENCES "public"."state_news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_updates" ADD CONSTRAINT "live_updates_link_article_id_articles_id_fk" FOREIGN KEY ("link_article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_admin_id_admin_users_id_fk" FOREIGN KEY ("uploaded_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_broadcasts" ADD CONSTRAINT "newsletter_broadcasts_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_broadcasts" ADD CONSTRAINT "newsletter_broadcasts_sent_by_admin_id_admin_users_id_fk" FOREIGN KEY ("sent_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriber_newsletters" ADD CONSTRAINT "subscriber_newsletters_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriber_newsletters" ADD CONSTRAINT "subscriber_newsletters_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_anchor_id_editors_id_fk" FOREIGN KEY ("anchor_id") REFERENCES "public"."editors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_user" ON "admin_sessions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_expires" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_admin_users_username_lower" ON "admin_users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_admin_users_email_lower" ON "admin_users" USING btree (lower("email")) WHERE "admin_users"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_articles_status_published" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "idx_articles_category_published" ON "articles" USING btree ("category","published_at");--> statement-breakpoint
CREATE INDEX "idx_articles_breaking" ON "articles" USING btree ("published_at") WHERE "articles"."is_breaking" = true;--> statement-breakpoint
CREATE INDEX "idx_articles_featured" ON "articles" USING btree ("published_at") WHERE "articles"."is_featured" = true;--> statement-breakpoint
CREATE INDEX "idx_articles_tags_gin" ON "articles" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_comments_target_created" ON "comments" USING btree ("target_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_comments_article" ON "comments" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_comments_state_news" ON "comments" USING btree ("state_news_id");--> statement-breakpoint
CREATE INDEX "idx_editors_public_order" ON "editors" USING btree ("is_staff_author_only","display_order");--> statement-breakpoint
CREATE INDEX "idx_live_updates_created" ON "live_updates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_media_assets_created" ON "media_assets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_newsletter_broadcasts_sent" ON "newsletter_broadcasts" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_poll_options_poll_key" ON "poll_options" USING btree ("poll_id","option_key");--> statement-breakpoint
CREATE INDEX "idx_poll_options_poll_order" ON "poll_options" USING btree ("poll_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_poll_votes_poll_voter" ON "poll_votes" USING btree ("poll_id","voter_hash");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_option" ON "poll_votes" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "idx_polls_active_created" ON "polls" USING btree ("is_active","created_at");--> statement-breakpoint
CREATE INDEX "idx_state_news_state_published" ON "state_news" USING btree ("state","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_state_news_active_headline" ON "state_news" USING btree ("state") WHERE "state_news"."is_headline" = true;--> statement-breakpoint
CREATE INDEX "idx_subscriber_newsletters_nl" ON "subscriber_newsletters" USING btree ("newsletter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_subscribers_email_lower" ON "subscribers" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "idx_subscribers_status" ON "subscribers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_videos_category" ON "videos" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_videos_published" ON "videos" USING btree ("published_at");