import { MongoClient } from 'mongodb'

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI

let cachedClient: MongoClient | null = null

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient
  }

  try {
    const client = new MongoClient(uri)
    await client.connect()
    cachedClient = client
    return client
  } catch (error: any) {
    console.error('MongoDB connection error:', error.message)
    if (error.message.includes('bad auth')) {
      console.error('Authentication failed. Please check your MongoDB credentials in .env.local')
      console.error('Verify that the username and password are correct and the user has proper permissions.')
    }
    throw error
  }
}

const clientPromise = connectToDatabase()

export default clientPromise
