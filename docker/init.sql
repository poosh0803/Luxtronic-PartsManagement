-- Drop existing tables
DROP TABLE IF EXISTS usage;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS parts;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS machines;

-- Create the machines table
CREATE TABLE machines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255)
);

-- Create the parts table
CREATE TABLE parts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Pre-populate the parts table
INSERT INTO parts (name) VALUES
    ('A panel'),
    ('B panel'),
    ('C panel'),
    ('D panel'),
    ('Battery'),
    ('Fan'),
    ('Heating'),
    ('Motherboard');

-- Create the inventory table
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(id),
    part_id INTEGER NOT NULL REFERENCES parts(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    UNIQUE (machine_id, part_id)
);

-- Create the orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(255)
);

-- Create the order_items table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    machine_id INTEGER NOT NULL REFERENCES machines(id),
    part_id INTEGER NOT NULL REFERENCES parts(id),
    quantity INTEGER NOT NULL,
    price_per_unit DECIMAL NOT NULL
);

-- Create the usage table
CREATE TABLE usage (
    id SERIAL PRIMARY KEY,
    usage_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    purpose VARCHAR(255),
    machine_id INTEGER NOT NULL REFERENCES machines(id),
    part_id INTEGER NOT NULL REFERENCES parts(id),
    quantity_used INTEGER NOT NULL
);