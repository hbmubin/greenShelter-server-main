const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jweumb2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const propertiesCollection = client
      .db("greenShelterDB")
      .collection("properties");

    app.get("/verified-properties", async (req, res) => {
      const result = await propertiesCollection.find().toArray();
      res.send(result);
    });
    app.get("/advertised-properties", async (req, res) => {
      const query = { advertised: "true" };
      const result = await propertiesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/recent-reviews", async (req, res) => {
      const pipeline = [
        { $unwind: "$reviews" },
        { $sort: { "reviews.timestamp": -1 } },
        { $limit: 4 },
        { $project: { _id: 0, review: "$reviews" } },
      ];
      const recentReviews = await propertiesCollection
        .aggregate(pipeline)
        .toArray();
      res.send(recentReviews.map((item) => item.review));
    });

    app.get("/property/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertiesCollection.findOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Green Shelter Running");
});

app.listen(port, () => {
  console.log(`green shelter is running on port ${port}`);
});
