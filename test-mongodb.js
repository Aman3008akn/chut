const { MongoClient } = require('mongodb');

// Test MongoDB connection
async function testConnection() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://amansjeje432_db_user:CDKvRZc9AWQAn3Uw@nexusai.vbmcp4b.mongodb.net/nexusai?retryWrites=true&w=majority';
  
  console.log('Testing MongoDB connection...');
  console.log('URI:', uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // Hide password in log
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!');
    
    // List databases
    const databases = await client.db().admin().listDatabases();
    console.log('\nAvailable databases:');
    databases.databases.forEach(db => {
      console.log(`  - ${db.name}`);
    });
    
    await client.close();
    console.log('\n✅ Connection test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Incorrect username or password');
    console.error('2. User does not have proper permissions');
    console.error('3. IP address not whitelisted in MongoDB Atlas');
    console.error('4. Cluster is paused or not running');
    process.exit(1);
  }
}

testConnection();
