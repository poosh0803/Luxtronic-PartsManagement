require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to the database', err.stack);
  } else {
    console.log('Connected to the database at', res.rows[0].now);
  }
});

app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(express.json());

// --- Machine Management ---

// GET all machines (for the first dropdown on the new order page)
app.get('/api/machines', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, manufacturer FROM machines ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching machines', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all parts for a specific machine (for the second dropdown)
app.get('/api/machines/:machineId/parts', async (req, res) => {
  const { machineId } = req.params;
  try {
    const query = 'SELECT id, part_name FROM machine_parts WHERE machine_id = $1 ORDER BY part_name';
    const result = await pool.query(query, [machineId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching machine parts', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST a new machine model
app.post('/api/machines', async (req, res) => {
  const { name, manufacturer } = req.body;
  if (!name || !manufacturer) {
    return res.status(400).json({ error: 'Machine name and manufacturer are required' });
  }
  try {
    const query = 'INSERT INTO machines (name, manufacturer) VALUES ($1, $2) RETURNING *';
    const result = await pool.query(query, [name, manufacturer]);
    res.status(201).json({ message: 'Machine created successfully', machine: result.rows[0] });
  } catch (error) {
    console.error('Error creating machine', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST a new part for a specific machine model
app.post('/api/machine_parts', async (req, res) => {
  const { machine_id, part_name, description } = req.body;
  if (!machine_id || !part_name) {
    return res.status(400).json({ error: 'Machine ID and part name are required' });
  }
  try {
    const query = 'INSERT INTO machine_parts (machine_id, part_name, description) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(query, [machine_id, part_name, description]);
    res.status(201).json({ message: 'Machine part created successfully', machine_part: result.rows[0] });
  } catch (error) {
    console.error('Error creating machine part', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// --- Order Management (Updated) ---

app.post('/api/orders', async (req, res) => {
  // UPDATED: 'machine' is now 'machine_id'
  // 'parts' array now contains 'machine_part_id' instead of 'part_id'
  const { purpose, machine_id, customer_mobile_number, source, parts } = req.body;

  if (!machine_id || !parts || parts.length === 0) {
    return res.status(400).json({ error: 'Machine ID and at least one part are required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // UPDATED: Storing machine_id and status in the orders table
    const orderQuery = 'INSERT INTO orders (purpose, machine_id, customer_mobile_number, source, status) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const orderValues = [purpose, machine_id, customer_mobile_number, source, 'ordered'];
    const orderResult = await client.query(orderQuery, orderValues);
    const orderId = orderResult.rows[0].id;

    for (const part of parts) {
      // VALIDATION: Check if the part belongs to the machine in the order
      const partCheckQuery = 'SELECT machine_id FROM machine_parts WHERE id = $1';
      const partCheckResult = await client.query(partCheckQuery, [part.machine_part_id]);
      if (partCheckResult.rows.length === 0 || partCheckResult.rows[0].machine_id !== parseInt(machine_id, 10)) {
        // If the part doesn't exist or doesn't belong to the correct machine, throw an error to trigger a rollback.
        throw new Error(`Part with id ${part.machine_part_id} does not belong to machine with id ${machine_id}.`);
      }

      // UPDATED: Using machine_part_id
      const orderItemQuery = 'INSERT INTO order_items (order_id, machine_part_id, quantity, price_per_unit) VALUES ($1, $2, $3, $4)';
      const orderItemValues = [orderId, part.machine_part_id, part.quantity, part.price_per_unit];
      await client.query(orderItemQuery, orderItemValues);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Order created successfully', orderId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.put('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const query = 'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [status, orderId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order status updated successfully', order: result.rows[0] });
  } catch (error) {
    console.error('Error updating order status', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/orders/history', async (req, res) => {
  try {
    const query = `
      SELECT
        o.id as order_id,
        o.purpose,
        o.customer_mobile_number,
        o.source,
        o.status,
        o.created_at,
        m.name as machine_name,
        json_agg(
          json_build_object(
            'part_name', mp.part_name,
            'quantity', oi.quantity,
            'price_per_unit', oi.price_per_unit
          )
        ) as parts
      FROM orders o
      JOIN machines m ON o.machine_id = m.id
      JOIN order_items oi ON o.id = oi.order_id
      JOIN machine_parts mp ON oi.machine_part_id = mp.id
      GROUP BY o.id, m.name
      ORDER BY o.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching order history', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// This endpoint is now superseded by /api/machine_parts
// You may want to remove or disable it.
app.post('/api/parts', async (req, res) => {
  const { name, manufacturer, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Part name is required' });
  }

  try {
    const query = 'INSERT INTO parts (name, manufacturer, description) VALUES ($1, $2, $3) RETURNING *';
    const values = [name, manufacturer, description];
    const result = await pool.query(query, values);
    res.status(201).json({ message: 'Part created successfully', part: result.rows[0] });
  } catch (error) {
    console.error('Error creating part', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// The inventory logic will need a significant rewrite based on the new schema.
app.get('/api/inventory', async (req, res) => {
  try {
    const query = `
      SELECT
          mp.id,
          mp.part_name,
          m.name as machine_name,
          m.manufacturer,
          mp.description,
          COALESCE(SUM(oi.quantity), 0) AS total_ordered,
          COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'ordered'), 0) AS in_transit,
          (
              SELECT COALESCE(SUM(u.quantity_used), 0)
              FROM usage u
              WHERE u.machine_part_id = mp.id
          ) AS total_used,
          (COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'delivered'), 0) - (
              SELECT COALESCE(SUM(u.quantity_used), 0)
              FROM usage u
              WHERE u.machine_part_id = mp.id
          )) AS stock_on_hand
      FROM
          machine_parts mp
      JOIN machines m ON mp.machine_id = m.id
      LEFT JOIN order_items oi ON mp.id = oi.machine_part_id
      LEFT JOIN orders o ON oi.order_id = o.id
      GROUP BY
          mp.id, m.name, m.manufacturer
      ORDER BY
          m.name, mp.part_name;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting inventory', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/usage', async (req, res) => {
  const { machine_id, machine_part_id, purpose, quantity_used } = req.body;

  if (!machine_id || !machine_part_id || !quantity_used) {
    return res.status(400).json({ error: 'Machine ID, Part ID and Quantity Used are required' });
  }

  try {
    const query = 'INSERT INTO usage (machine_id, machine_part_id, purpose, quantity_used) VALUES ($1, $2, $3, $4) RETURNING *';
    const values = [machine_id, machine_part_id, purpose, quantity_used];
    const result = await pool.query(query, values);
    res.status(201).json({ message: 'Usage recorded successfully', usage: result.rows[0] });
  } catch (error) {
    console.error('Error recording usage', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'NewOrder.html'));
});

app.get('/new-order', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'NewOrder.html'));
});

app.get('/order-history', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'OrderHistory.html'));
});

app.get('/inventory', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'Inventory.html'));
});

app.get('/usage', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'Usage.html'));
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
