-- Flyway Migration: Initial schema

CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    shopify_domain VARCHAR(255) NOT NULL UNIQUE,
    access_token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id),
    shopify_product_id VARCHAR(64) NOT NULL,
    title VARCHAR(255),
    price NUMERIC(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id),
    shopify_order_id VARCHAR(64) NOT NULL,
    total_price NUMERIC(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE competitor_urls (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    url TEXT NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE price_snapshots (
    id SERIAL PRIMARY KEY,
    competitor_url_id INTEGER REFERENCES competitor_urls(id),
    price NUMERIC(12,2),
    in_stock BOOLEAN,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id),
    product_id INTEGER REFERENCES products(id),
    competitor_url_id INTEGER REFERENCES competitor_urls(id),
    type VARCHAR(64),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_metrics (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id),
    date DATE NOT NULL,
    conversion_rate NUMERIC(5,2),
    top_selling_products JSONB,
    abandoned_cart_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 