const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
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
    const usersCollection = client.db("greenShelterDB").collection("users");

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization;
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        console.log("inside", req.headers.authorization);
        next();
      });
    };

    const verifyAgent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAgent = user?.role === "agent";
      if (!isAgent) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    app.get("/user-role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let role = "";
      if (user) {
        role = user?.role;
      }
      if (role == undefined) {
        role = "user";
      }
      res.send({ role });
    });

    app.post("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ insertedId: null });
      }
      user.email = email;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.get("/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);

      res.send(result || { message: "User not found" });
    });

    app.post("/add-wishlist/:email", async (req, res) => {
      const { propertyId } = req.body;
      const email = req.params.email;

      const query = { email: email };
      const user = await usersCollection.findOne(query);

      let wishList = Array.isArray(user.wishList) ? user.wishList : [];

      if (wishList.includes(propertyId)) {
        return res.send("Property already in wishlist");
      }

      wishList.push(propertyId);

      const update = {
        $set: { wishList: wishList },
      };

      const result = await usersCollection.updateOne(query, update);
      res.send(result);
    });

    app.get("/verified-properties", async (req, res) => {
      const result = await propertiesCollection
        .find({ propertyStatus: "verified" })
        .toArray();
      res.send(result);
    });
    app.get("/advertised-properties", async (req, res) => {
      const query = {
        advertised: "true",
        propertyStatus: "verified",
      };
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

    app.post("/property/:id/review", async (req, res) => {
      const id = req.params.id;
      const newReview = req.body;
      const query = { _id: new ObjectId(id) };

      const result = await propertiesCollection.updateOne(query, {
        $push: { reviews: newReview },
      });

      res.send(result);
    });

    app.get("/user-wishlist/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      const wishlist = user.wishList || [];
      res.send(wishlist);
    });

    app.delete("/remove-wishlist/:email/:propertyId", async (req, res) => {
      const email = req.params.email;
      const propertyId = req.params.propertyId;

      const query = { email: email };
      const update = {
        $pull: { wishList: propertyId },
      };

      const result = await usersCollection.updateOne(query, update);
      res.send(result);
    });

    app.delete(
      "/delete-userReview/:propertyId/:email/:reviewId",
      (req, res) => {
        const propertyId = req.params.propertyId;
        const email = req.params.email;
        const reviewId = req.params.reviewId;

        propertiesCollection
          .updateOne(
            { _id: new ObjectId(propertyId) },
            { $pull: { reviews: { reviewId: reviewId, reviewerEmail: email } } }
          )
          .then((result) => {
            res.send(result);
          })
          .catch((error) => {
            res
              .status(500)
              .send({ error: "An error occurred while deleting the review." });
          });
      }
    );

    app.post("/submit-offer", async (req, res) => {
      const { propertyId, offeredAmount, buyerEmail, offerDate } = req.body;
      const query = { email: buyerEmail };
      const result = await usersCollection.updateOne(query, {
        $push: {
          propertiesBought: {
            propertyId,
            offeredAmount,
            offerDate,
            boughtStatus: "pending",
          },
        },
      });

      res.send(result);
    });

    app.get("/user-properties-bought/:email", async (req, res) => {
      const { email } = req.params;

      const user = await usersCollection.findOne({ email });
      const propertiesBought = user.propertiesBought || [];

      res.send(propertiesBought);
    });

    app.get("/reviews-by-email/:reviewerEmail", async (req, res) => {
      const { reviewerEmail } = req.params;

      const properties = await propertiesCollection.find().toArray();
      const reviews = properties
        .flatMap((property) => property.reviews || [])
        .filter((review) => review.reviewerEmail === reviewerEmail);
      res.send(reviews);
    });

    app.post("/property", verifyToken, verifyAgent, async (req, res) => {
      const property = req.body;
      const result = await propertiesCollection.insertOne(property);
      res.send(result);
    });

    app.get(
      "/agent/properties/:email",
      verifyToken,
      verifyAgent,
      async (req, res) => {
        const email = req.params.email;

        const result = await propertiesCollection
          .find({ agentEmail: email, propertyStatus: { $ne: "sold" } })
          .toArray();

        res.send(result);
      }
    );

    app.patch("/property/:id", verifyToken, verifyAgent, async (req, res) => {
      const propertyId = req.params.id;
      const updatedFields = req.body;

      const result = await propertiesCollection.updateOne(
        { _id: new ObjectId(propertyId) },
        { $set: updatedFields }
      );

      res.send(result);
    });

    app.delete("/property/:id", verifyToken, verifyAgent, async (req, res) => {
      const propertyId = req.params.id;

      const result = await propertiesCollection.deleteOne({
        _id: new ObjectId(propertyId),
      });

      res.send(result);
    });

    app.get(
      "/agent/sold-properties/:email",
      verifyToken,
      verifyAgent,
      async (req, res) => {
        const email = req.params.email;
        const result = await propertiesCollection
          .find({ agentEmail: email, propertyStatus: "sold" })
          .toArray();

        res.send(result);
      }
    );
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
