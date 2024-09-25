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
        // Generate the current UTC time
        const tracking_time = new Date(new Date().toUTCString());

        console.log('Current tracking time:', tracking_time);
        
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
