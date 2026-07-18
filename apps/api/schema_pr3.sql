-- PR3: Stripe subscription fields
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_status TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_app_users_stripe_customer
  ON app_users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS usage_daily (
  user_id TEXT NOT NULL,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  chat_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
