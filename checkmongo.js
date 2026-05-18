const dns = require('dns');
const { MongoClient } = require('mongodb');
(async () => {
  try {
    const srv = await dns.promises.resolveSrv('_mongodb._tcp.cluster0.hl0gcrd.mongodb.net');
    console.log('SRV', srv);
  } catch (e) {
    console.error('SRV ERROR', e.message);
  }
  try {
    const uri = 'mongodb+srv://inventory-user:Parole.123!@cluster0.hl0gcrd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    console.log('MONGO CONNECTED');
    await client.close();
  } catch (e) {
    console.error('MONGO ERROR', e.message);
  }
})();