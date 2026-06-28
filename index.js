const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config()
const cors = require('cors');
const app = express();
const port = process.env.PORT;

app.use(cors())
app.use(express.json())




const uri = process.env.MONGO_DB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const db = client.db("assignment10")
        const userCollection = db.collection("user")
        const myRecipeCollection = db.collection("myRecipe")


        app.post("/api/recipe", async (req, res) => {
            try {
                const recipeData = {
                    ...req.body,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                const result = await myRecipeCollection.insertOne(recipeData);

                res.status(201).json({
                    success: true,
                    insertedId: result.insertedId,
                    message: "Recipe added successfully",
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: error.message,
                });
            }
        });

        // await client.connect();

        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});