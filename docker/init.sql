-- Drop existing tables
-- Drop tables in reverse order of dependency to avoid foreign key constraints
DROP TABLE IF EXISTS usage;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS machine_parts;
DROP TABLE IF EXISTS machines;
DROP TABLE IF EXISTS parts;
DROP TABLE IF EXISTS inventory;

-- Create a table to store machine models (e.g., Dell XPS 15, MacBook Pro 16)
CREATE TABLE machines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, manufacturer) -- A machine model should be unique
);

-- Create a table for parts that are specific to a machine model
CREATE TABLE machine_parts (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    part_name VARCHAR(255) NOT NULL, -- e.g., 'A Panel', 'Battery', 'Motherboard'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(machine_id, part_name) -- Ensures a part name is unique for a given machine
);

-- Create the orders table to track incoming parts orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER REFERENCES machines(id), -- Which machine model this order is for
    purpose VARCHAR(255),
    customer_mobile_number VARCHAR(50),
    source VARCHAR(255),
    status VARCHAR(255) DEFAULT 'ordered',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the order_items table to list the specific parts within an order
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    machine_part_id INTEGER NOT NULL REFERENCES machine_parts(id),
    quantity INTEGER NOT NULL,
    price_per_unit DECIMAL(10, 2) NOT NULL
);

-- Create the usage table to track when a part from an order is used
CREATE TABLE usage (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(id),
    machine_part_id INTEGER NOT NULL REFERENCES machine_parts(id),
    quantity_used INTEGER NOT NULL,
    purpose VARCHAR(255),
    usage_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- You can add some initial data here for testing if you like.
-- For example:
-- INSERT INTO machines (name, manufacturer) VALUES ('Dell XPS 15 9510', 'Dell');
-- INSERT INTO machine_parts (machine_id, part_name) VALUES (1, 'Battery'), (1, 'Motherboard');