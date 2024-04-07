console.log("This is the environment variable for mongo", process.env.MONGO_PROD);

import { MongoClient, MongoClientOptions } from 'mongodb';

interface CustomMongoClientOptions extends MongoClientOptions {
    useUnifiedTopology?: boolean;
}
console.log("This is the environment variable for mongo", process.env.NODE_ENV);
const uri='mongodb://arxena:Page321123a321afarx@ec2-18-208-198-96.compute-1.amazonaws.com:27017/admin?authSource=admin'


// const uri = process.env.NODE_ENV === 'production' ? process.env.MONGO_PROD : process.env.MONGO_DEV;
console.log("This is url:",uri);


export async function createClient () {
    let client = new MongoClient(uri, { useUnifiedTopology: true } as CustomMongoClientOptions);
    return client;
}

export async function connectToDatabase() {
    const client = await createClient();
    await client.connect();
    const db = client.db('users'); // Assumes your database is named 'users'
    return { client, db };
}

export async function disconnectFromDatabase(client : MongoClient) {
    await client.close();
}

export async function upsertMessages(messages, phoneNumber) {
    console.log("This is the messages to be inserted", messages);
    console.log("This is the phoneNumber to be inserted", phoneNumber);
    const { db, client } = await connectToDatabase();
    const collection = db.collection('test-messages');
    // Corrected update operation to use $set operator
    const insertResult = await collection.updateOne( { phoneNumber: phoneNumber }, { $set: { messages: messages, phoneNumber: phoneNumber } }, { upsert: true } );
    console.log("This is the insert result", insertResult);
    return insertResult;
}

export async function findMessages(phoneNumber) {
    console.log("This is the messages to be finded for phone number", phoneNumber);
    const { db, client } = await connectToDatabase();
    // console.log("This is the db", db);
    // console.log("This is the client", client);
    const collection = db.collection('test-messages');
    // console.log("This is the collection", collection);
    const findResult = collection.findOne({ phoneNumber: phoneNumber });
    console.log("This is the insert result", findResult);
    return findResult;
}

export async function fetchCandidates() {
    const {client, db} = await connectToDatabase()
    const query_obj = {'job_process.applications.user_id': '63c15d0cd44cbd06297c22ac', 'tables': 'd35191bf78ca41a68340ddea3ca38c5e'}
    const candidates = await db.collection('candidates').find(query_obj).toArray()
    console.log("Candidates: ", candidates);
    return candidates
}
export async function updateCandidateStatus(candidate){
    console.log("Updating candidate status: ", candidate);
    const {client, db} = await connectToDatabase()
    const query_obj = {'_id': candidate._id}
    const update_obj = {$set: {'job_process.applications.$.status': candidate.status}}
    const result = await db.collection('candidates').updateOne(query_obj, update_obj)
    console.log("Result: ", result);
    return result
}



// export async function findUser() {
//     const { db, client } = await connectToDatabase();
//     const collection = db.collection('test-users');
//     const findResult = await collection.findOne({ name: 'John Doe' });
//     return findResult;
// }

// export async function updateUser() {
//     const { db, client } = await connectToDatabase();
//     const collection = db.collection('test-users');
//     const updateResult = await collection.updateOne({ name: 'John Doe' }, { $set: { age: 31 } });
//     return updateResult;
// }

// export async function deleteUser() {
//     const { db, client } = await connectToDatabase();
//     const collection = db.collection('test-users');
//     const deleteResult = await collection.deleteOne({ name: 'John Doe' });
//     return deleteResult;
// }

// export async function main() {
//     const insertResult = await insertUser();
//     console.log('Inserted user:', insertResult);
//     const findResult = await findUser();
//     console.log('Found user:', findResult);
//     const updateResult = await updateUser();
//     console.log('Updated user:', updateResult);
//     const deleteResult = await deleteUser();
//     console.log('Deleted user:', deleteResult);
// }
