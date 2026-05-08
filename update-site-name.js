const { MongoClient } = require('mongodb')

async function updateSiteName() {
  const uri = 'mongodb+srv://amansjeje432_db_user:CDKvRZc9AWQAn3Uw@nexusai.vbmcp4b.mongodb.net/nexusai?retryWrites=true&w=majority'
  
  try {
    const client = new MongoClient(uri)
    await client.connect()
    console.log('Connected to MongoDB')
    
    const db = client.db('nexusai')
    
    // Update site config with new name
    const result = await db.collection('siteConfig').updateOne(
      {},
      { 
        $set: { 
          siteName: '✨ Astra AI',
          welcomeMessage: 'Welcome to Astra AI - Your Intelligent Assistant',
          updatedAt: Date.now()
        } 
      },
      { upsert: true }
    )
    
    console.log('Update result:', result)
    console.log('Site name updated to: ✨ Astra AI')
    
    await client.close()
    console.log('Connection closed')
  } catch (error) {
    console.error('Error:', error)
  }
}

updateSiteName()
