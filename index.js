const express = require('express');
const sql = require('mssql');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// SQL Server configuration
const dbConfig = {
    user: 'urbanwada', 
    password: 'Admin@1845', 
    server: 'urbanwada.database.windows.net', 
    database: 'urbanwada', 
    options: {
        encrypt: true, 
        trustServerCertificate: false, 
        connectionTimeout: 30000, 
        requestTimeout: 30000,
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Function to connect to the database
async function connectWithRetry() {
    let retries = 5;
    while (retries) {
        try {
            await sql.connect(dbConfig);
            console.log('Connected to SQL Server');
            break;
        } catch (err) {
            console.error('Database connection failed:', err);
            retries -= 1;
            console.log(`Retrying connection (${5 - retries}/5)`);
            if (retries === 0) {
                console.error('Could not connect to SQL Server after multiple attempts.');
                throw err;
            }
            await new Promise(res => setTimeout(res, 5000));
        }
    }
}

// Call the function to establish connection
connectWithRetry();

// Function to log errors into the error_logs table
async function logError(errorMessage, errorStack ) {
    try {

      
        const request = new sql.Request();
        const query = `INSERT INTO error_logs (error_message, error_stack ) 
                       VALUES (@errorMessage, @errorStack)`;

        request.input('errorMessage', sql.NVarChar(sql.MAX), errorMessage);
        request.input('errorStack', sql.NVarChar(sql.MAX), errorStack);

        await request.query(query);
    } catch (err) {
        console.error('Failed to log error:', err);
    }
}

// Middleware for error handling
app.use(async (err, req, res, next) => {
    console.error('Unhandled error:', err);
    await logError(err.message, err.stack);
    res.status(500).send(`Server error: ${err.message}`);
});

// POST API to add new user tracking
app.post('/api/user_tracking', async (req, res) => {
    const { agent_id, user_name, longitude, latitude } = req.body;
    try {
        // Generate the current UTC time and convert it to Indian Standard Time (IST)
        let currentUTC = new Date();
        let utcOffset = currentUTC.getTimezoneOffset() * 60000; // Get the offset in milliseconds
        let indiaTimeOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30 (5.5 hours)
        let tracking_time = new Date(currentUTC.getTime() + indiaTimeOffset - utcOffset); // Adjust to IST

        console.log('Current tracking time in IST:', tracking_time);
        
        const request = new sql.Request();
        const query = `INSERT INTO user_tracking (agent_id, user_name, longitude, latitude, tracking_time) 
                       VALUES (@agent_id, @user_name, @longitude, @latitude, @tracking_time)`;

        request.input('agent_id', sql.Int, agent_id);
        request.input('user_name', sql.NVarChar(100), user_name);
        request.input('longitude', sql.Float, longitude);
        request.input('latitude', sql.Float, latitude);
        request.input('tracking_time', sql.DateTime, tracking_time);

        await request.query(query);
        res.status(201).send('User tracking added successfully');
    } catch (err) {
        console.error('Error inserting user tracking:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});

// GET API to fetch agent info and the latest user tracking entry
app.get('/api/agent/:id', async (req, res) => {
    const agentId = req.params.id;
    try {
        const agentResult = await sql.query`SELECT * FROM agent WHERE agent_id = ${agentId}`;
        const trackingResult = await sql.query`
            SELECT TOP 1 * FROM user_tracking WHERE agent_id = ${agentId} ORDER BY tracking_time DESC`;

        const agent = agentResult.recordset[0];
        const latestTracking = trackingResult.recordset[0];

        if (!agent) {
            const errorMessage = `Agent with ID ${agentId} not found`;
            await logError(errorMessage, 'Agent not found in the database');
            return res.status(404).send(errorMessage);
        }

        res.json({ agent, latestTracking });
    } catch (err) {
        console.error('Error fetching data:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});


// GET API to fetch the latest tracking data for all agents
app.get('/api/agents/tracking', async (req, res) => {
    try {
        const allTracking = await sql.query`SELECT agent_id, user_name, longitude, latitude, tracking_time 
                                            FROM user_tracking 
                                            ORDER BY tracking_time DESC`;

        if (allTracking.recordset.length === 0) {
            return res.status(404).send('No tracking data available');
        }

        res.json(allTracking.recordset);
    } catch (err) {
        console.error('Error fetching tracking data:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});



// POST API to add a new agent
app.post('/api/agents', async (req, res) => {
    const { name, address, mobile_no, is_active } = req.body;
    try {
        const request = new sql.Request();
        const query = `INSERT INTO agent (name, address, mobile_no, is_active) 
                       VALUES (@name, @address, @mobile_no, @is_active)`;

        request.input('name', sql.NVarChar(100), name);
        request.input('address', sql.NVarChar(255), address);
        request.input('mobile_no', sql.NVarChar(15), mobile_no);
        request.input('is_active', sql.Bit, is_active);

        await request.query(query);
        res.status(201).send('Agent added successfully');
    } catch (err) {
        console.error('Error inserting agent:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});



// POST API to register a new customer
app.post('/api/customers/register', async (req, res) => {
    const { name, address, pincode, mobile, latitude, longitude, is_active } = req.body;
    try {
        // Generate the current UTC time and convert it to Indian Standard Time (IST)
        let currentUTC = new Date();
        let utcOffset = currentUTC.getTimezoneOffset() * 60000; // Get the offset in milliseconds
        let indiaTimeOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30 (5.5 hours)
        let registration_time = new Date(currentUTC.getTime() + indiaTimeOffset - utcOffset); // Adjust to IST

        console.log('Current registration time in IST:', registration_time);

        const request = new sql.Request();
        const query = `INSERT INTO customer_registration (name, address, pincode, mobile, latitude, longitude, registration_time, is_active) 
                       VALUES (@name, @address, @pincode, @mobile, @latitude, @longitude, @registration_time, @is_active)`;

        request.input('name', sql.NVarChar(100), name);
        request.input('address', sql.NVarChar(255), address);
        request.input('pincode', sql.NVarChar(10), pincode);
        request.input('mobile', sql.NVarChar(15), mobile);
        request.input('latitude', sql.Float, latitude);
        request.input('longitude', sql.Float, longitude);
        request.input('registration_time', sql.DateTime, registration_time); // Save IST time
        request.input('is_active', sql.Bit, is_active);

        await request.query(query);
        res.status(201).send('Customer registered successfully');
    } catch (err) {
        console.error('Error registering customer:', err);
        await logError(err.message, err.stack); // Assuming you have a function to log errors
        res.status(500).send(`Server error: ${err.message}`);
    }
});



// GET API to fetch all registered customers
app.get('/api/customers', async (req, res) => {
    try {
        const result = await sql.query`SELECT id, name, address, pincode, mobile, latitude, longitude, registration_time, is_active 
                                        FROM customer_registration 
                                        ORDER BY registration_time DESC`;

        if (result.recordset.length === 0) {
            return res.status(404).send('No customers found');
        }

        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching customers:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});

// GET API to fetch a customer by ID
app.get('/api/customers/:id', async (req, res) => {
    const customerId = req.params.id; // Extract the customer ID from the URL
    try {
        // Query to get the customer details based on the ID
        const customerResult = await sql.query`SELECT id, name, address, pincode, mobile, latitude, longitude, registration_time, is_active 
                                                FROM customer_registration 
                                                WHERE id = ${customerId}`;

        const customer = customerResult.recordset[0]; // Get the first record
        if (!customer) {
            return res.status(404).send(`Customer with ID ${customerId} not found`);
        }

        res.json(customer); // Respond with the customer details
    } catch (err) {
        console.error('Error fetching customer:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});


// POST API to create a new order
app.post('/api/orders', async (req, res) => {
    const { agent_id, source_latitude, source_longitude, user_latitude, user_longitude, order_item_list, order_amount, customer_id } = req.body;
    try {
        let currentUTC = new Date();
        let utcOffset = currentUTC.getTimezoneOffset() * 60000; // Get the offset in milliseconds
        let indiaTimeOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
        let order_created_time = new Date(currentUTC.getTime() + indiaTimeOffset - utcOffset); // Adjust to IST

        const request = new sql.Request();
        const query = `INSERT INTO orderdetails (agent_id, source_latitude, source_longitude, user_latitude, user_longitude, order_item_list, order_amount, customer_id, order_is_accepted, order_is_picked, order_is_delivered, order_is_accepted_time, order_is_picked_time, order_is_delivered_time) 
                       VALUES (@agent_id, @source_latitude, @source_longitude, @user_latitude, @user_longitude, @order_item_list, @order_amount, @customer_id, 0, 0, 0, NULL, NULL, NULL);
                       SELECT SCOPE_IDENTITY() AS order_id;`; // Add to get the newly created order ID

        request.input('agent_id', sql.Int, agent_id);
        request.input('source_latitude', sql.Float, source_latitude);
        request.input('source_longitude', sql.Float, source_longitude);
        request.input('user_latitude', sql.Float, user_latitude);
        request.input('user_longitude', sql.Float, user_longitude);
        request.input('order_item_list', sql.NVarChar(sql.MAX), order_item_list);
        request.input('order_amount', sql.Decimal(10, 2), order_amount);
        request.input('customer_id', sql.Int, customer_id); // Add customer_id input

        const result = await request.query(query);
        const orderId = result.recordset[0].order_id; // Get the order ID

        // Create the response object
        const responseData = {
            order_id: orderId,
            agent_id,
            source_latitude,
            source_longitude,
            user_latitude,
            user_longitude,
            order_item_list,
            order_amount,
            customer_id,
            order_created_time: order_created_time.toISOString() // Convert to ISO string format
        };

        res.status(201).json({
            message: 'Order created successfully',
            order: responseData
        });
    } catch (err) {
        console.error('Error creating order:', err);
        await logError(err.message, err.stack);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// GET API to fetch orders by customer ID
app.get('/api/orders/customer/:customerId', async (req, res) => {
    const customerId = req.params.customerId;
    try {
        const result = await sql.query`SELECT * FROM orderdetails WHERE customer_id = ${customerId} ORDER BY order_created_time DESC`;

        if (result.recordset.length === 0) {
            return res.status(404).send(`No orders found for customer ID ${customerId}`);
        }

        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching orders for customer:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});


// GET API to retrieve an order by ID
app.get('/api/orders/:id', async (req, res) => {
    const orderId = req.params.id;
    try {
        const orderResult = await sql.query`SELECT * FROM orderdetails WHERE order_id = ${orderId}`;

        const order = orderResult.recordset[0];
        if (!order) {
            return res.status(404).send(`Order with ID ${orderId} not found`);
        }

        res.json(order);
    } catch (err) {
        console.error('Error fetching order:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});

// PUT API to update is_order_accepted
app.put('/api/orders/:id/accept', async (req, res) => {
    const orderId = req.params.id;
    try {
        let currentUTC = new Date();
        let utcOffset = currentUTC.getTimezoneOffset() * 60000; // Get the offset in milliseconds
        let indiaTimeOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
        let order_is_accepted_time = new Date(currentUTC.getTime() + indiaTimeOffset - utcOffset); // Adjust to IST

        const request = new sql.Request();
        const query = `UPDATE orderdetails SET order_is_accepted = 1, order_is_accepted_time = @order_is_accepted_time WHERE order_id = @order_id`;

        request.input('order_id', sql.Int, orderId);
        request.input('order_is_accepted_time', sql.DateTime, order_is_accepted_time);

        const result = await request.query(query);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send(`Order with ID ${orderId} not found`);
        }

        res.send('Order accepted successfully');
    } catch (err) {
        console.error('Error updating order acceptance:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});

// PUT API to update is_order_picked
app.put('/api/orders/:id/pick', async (req, res) => {
    const orderId = req.params.id;
    try {
        let currentUTC = new Date();
        let utcOffset = currentUTC.getTimezoneOffset() * 60000; // Get the offset in milliseconds
        let indiaTimeOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
        let order_is_picked_time = new Date(currentUTC.getTime() + indiaTimeOffset - utcOffset); // Adjust to IST

        const request = new sql.Request();
        const query = `UPDATE orderdetails SET order_is_picked = 1, order_is_picked_time = @order_is_picked_time WHERE order_id = @order_id`;

        request.input('order_id', sql.Int, orderId);
        request.input('order_is_picked_time', sql.DateTime, order_is_picked_time);

        const result = await request.query(query);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send(`Order with ID ${orderId} not found`);
        }

        res.send('Order picked successfully');
    } catch (err) {
        console.error('Error updating order pick status:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});

// PUT API to update is_order_delivered
app.put('/api/orders/:id/deliver', async (req, res) => {
    const orderId = req.params.id;
    try {
        let currentUTC = new Date();
        let utcOffset = currentUTC.getTimezoneOffset() * 60000; // Get the offset in milliseconds
        let indiaTimeOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
        let order_is_delivered_time = new Date(currentUTC.getTime() + indiaTimeOffset - utcOffset); // Adjust to IST

        const request = new sql.Request();
        const query = `UPDATE orderdetails SET order_is_delivered = 1, order_is_delivered_time = @order_is_delivered_time WHERE order_id = @order_id`;

        request.input('order_id', sql.Int, orderId);
        request.input('order_is_delivered_time', sql.DateTime, order_is_delivered_time);

        const result = await request.query(query);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send(`Order with ID ${orderId} not found`);
        }

        res.send('Order delivered successfully');
    } catch (err) {
        console.error('Error updating order delivery status:', err);
        await logError(err.message, err.stack);
        res.status(500).send(`Server error: ${err.message}`);
    }
});
// POST API for Admin Login
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Query to get the admin record by username
        const adminResult = await sql.query`SELECT * FROM admins WHERE username = ${username}`;

        const admin = adminResult.recordset[0];
        if (!admin) {
            return res.status(404).send('Admin not found');
        }

        // Direct password comparison (plaintext) for simplicity
        if (admin.password !== password) {
            return res.status(401).send('Invalid credentials');
        }

        res.json({ message: 'Login successful' });
    } catch (err) {
        console.error('Error logging in:', err);
        await logError(err.message, err.stack);
        res.status(500).send('Server error');
    }
});
// Start the server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
