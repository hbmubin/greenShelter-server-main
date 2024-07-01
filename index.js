const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
// const stripe = require("stripe")(process.env.STRIPE_SK);

require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://greeen-shelter.web.app",
      "https://greeen-shelter.firebaseapp.com",
    ],
  })
);
app.use(express.json());
app.use(express.urlencoded());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { default: axios } = require("axios");
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
    // await client.connect();
    // Send a ping to confirm a successful connection

    const propertiesCollection = client
      .db("greenShelterDB")
      .collection("properties");
    const usersCollection = client.db("greenShelterDB").collection("users");

    // app.post("/create-payment-intent", async (req, res) => {
    //   const { price } = req.body;
    //   const amount = parseInt(price * 100);
    //   console.log(amount);
    //   const paymentIntent = await stripe.paymentIntents.create({
    //     amount: amount,
    //     currency: "usd",
    //     payment_method_types: ["card "],
    //   });

    //   res.send({
    //     clientSecret: paymentIntent.client_secret,
    //   });
    // });

    // app.post("/create-payment", async (req, res) => {
    //   const initiateData = {
    //     store_id: "green667fa7ce818e6",
    //     store_passwd: "green667fa7ce818e6@ssl",
    //     total_amount: 100,
    //     currency: "BDT",
    //     tran_id: "REF123",
    //     success_url: "http://localhost:5000/payment-success",
    //     fail_url: "http://yoursite.com/fail.php",
    //     cancel_url: "http://yoursite.com/cancel.php",
    //     cus_name: "Customer Name",
    //     cus_email: "cust@yahoo.com",
    //     cus_add1: "Dhaka",
    //     cus_add2: "Dhaka",
    //     cus_city: "Dhaka",
    //     cus_state: "Dhaka",
    //     cus_postcode: "1000",
    //     cus_country: "Bangladesh",
    //     cus_phone: "01711111111",
    //     cus_fax: "01711111111",
    //     shipping_method: "NO",
    //     product_name: "mobile",
    //     product_category: "mobile",
    //     product_profile: "general",
    //     multi_card_name: "mastercard,visacard,amexcard",
    //     value_a: "ref001_A",
    //     value_b: "ref002_B",
    //     value_c: "ref003_C",
    //     value_d: "ref004_D",
    //   };
    //   const response = await axios({
    //     method: "POST",
    //     url: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
    //     data: initiateData,
    //     headers: {
    //       "Content-Type": "application/x-www-form-urlencoded",
    //     },
    //   });
    //   console.log(response);
    //   res.send({
    //     paymentUrl: response.data.GatewayPageURL,
    //   });
    // });

    // app.post("/payment-success", async (req, res) => {
    //   const successData = req.body();
    //   console.log(successData);
    // });

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        // console.log("inside", req.headers.authorization);
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
    app.get("/user-role/:email", async (req, res) => {
      const email = req.params.email;
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

      const result = await usersCollection.updateOne(
        query,
        { $push: { propertiesBought: req.body } },
        { upsert: true }
      );

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
          .find({ agentEmail: email })
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

    app.get(
      "/agent/offered-properties/:propertyId",
      verifyToken,
      verifyAgent,
      async (req, res) => {
        const propertyId = req.params.propertyId;

        const users = await usersCollection
          .find({
            "propertiesBought.propertyId": propertyId,
          })
          .toArray();

        const result = users.reduce((acc, user) => {
          const properties = user.propertiesBought
            .filter((property) => property.propertyId == propertyId)
            .map((property) => ({
              ...property,
              buyerInfo: {
                buyerEmail: user.email,
                buyerName: user.name,
                buyerPhotoURL: user.photoURL,
              },
            }));
          // console.log(properties);
          return acc.concat(properties);
        }, []);

        res.send(result);
      }
    );

    app.post(
      "/agent/accept/:offerId/:propertyId",
      verifyToken,
      verifyAgent,
      async (req, res) => {
        const { offerId, propertyId } = req.params;

        const acceptResult = await usersCollection.findOneAndUpdate(
          { "propertiesBought.offerId": offerId },
          { $set: { "propertiesBought.$.boughtStatus": "accepted" } },
          { returnDocument: "after" }
        );

        const rejectResult = await usersCollection.updateMany(
          {
            "propertiesBought.propertyId": propertyId,
            "propertiesBought.offerId": { $ne: offerId },
          },
          { $set: { "propertiesBought.$.boughtStatus": "rejected" } }
        );

        res.send({ acceptResult, rejectResult });
      }
    );

    app.post(
      "/agent/reject/:offerId",
      verifyToken,
      verifyAgent,
      async (req, res) => {
        const { offerId } = req.params;

        const result = await usersCollection.findOneAndUpdate(
          { "propertiesBought.offerId": offerId },
          { $set: { "propertiesBought.$.boughtStatus": "rejected" } },
          { new: true }
        );
        res.send(result);
      }
    );

    app.post(
      "/agent/payment-confirm/:paymentId/:propertyId",
      verifyToken,
      async (req, res) => {
        const { paymentId, propertyId } = req.params;
        const {
          buyerEmail,
          buyerName,
          buyerPhotoURL,
          offeredAmount,
          agentEmail,
          offerId,
        } = req.body;

        try {
          const propertyUpdateResult = await propertiesCollection.updateOne(
            { _id: new ObjectId(propertyId) },
            {
              $set: {
                buyerEmail,
                buyerName,
                buyerPhotoURL,
                soldPrice: offeredAmount,
                propertyStatus: "sold",
              },
            }
          );

          if (propertyUpdateResult.matchedCount === 0) {
            return res.status(404).json({ error: "Property not found" });
          }

          const userUpdateResult = await usersCollection.updateOne(
            { email: buyerEmail, "propertiesBought.offerId": offerId },
            {
              $set: {
                "propertiesBought.$.boughtStatus": "bought",
                "propertiesBought.$.paymentId": paymentId,
              },
            }
          );

          if (userUpdateResult.matchedCount === 0) {
            return res
              .status(404)
              .json({ error: "User or offer not found in user collection" });
          }

          const agentUpdateResult = await usersCollection.updateOne(
            { email: agentEmail },
            {
              $push: {
                soldProperties: {
                  buyerEmail,
                  buyerName,
                  buyerPhotoURL,
                  offeredAmount,
                  offerId,
                  propertyId,
                  paymentId,
                },
              },
            }
          );

          if (agentUpdateResult.matchedCount === 0) {
            return res.status(404).json({ error: "Agent not found" });
          }

          res.json({
            message: "Payment confirmed and property updated",
            propertyUpdateResult,
            userUpdateResult,
            agentUpdateResult,
          });
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: "Internal Server Error" });
        }
      }
    );

    app.get(
      "/admin/agent-sold-properties-stats/:agentEmail",
      verifyToken,
      verifyAgent,
      async (req, res) => {
        const { agentEmail } = req.params;

        const agent = await usersCollection.findOne({ email: agentEmail });

        let totalAmount = 0;
        let totalCount = 0;

        agent.soldProperties.forEach((property) => {
          totalAmount += parseFloat(property.offeredAmount);
          totalCount++;
        });

        res.send({
          totalAmount,
          totalCount,
        });
      }
    );

    app.get("/admin/properties", verifyToken, verifyAdmin, async (req, res) => {
      const result = await propertiesCollection.find({}).toArray();
      res.send(result);
    });
    app.get("/admin/all-users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });

    app.patch(
      "/admin/verify-property/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;

        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { propertyStatus: "verified" } }
        );

        res.send(result);
      }
    );
    app.patch(
      "/admin/reject-property/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;

        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              propertyStatus: "rejected",
              advertised: "false",
            },
          }
        );

        res.send(result);
      }
    );

    app.patch(
      "/admin/make-admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: "admin" } }
        );

        res.send(result);
      }
    );
    app.patch(
      "/admin/make-agent/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: "agent" } }
        );

        res.send(result);
      }
    );

    app.patch(
      "/admin/make-fraud/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { email } = req.params;

        const userUpdateResult = await usersCollection.updateOne(
          { email: email },
          { $set: { role: "fraud" } }
        );

        const propertyDeleteResult = await propertiesCollection.deleteMany({
          agentEmail: email,
        });

        const propertyBoughtUpdateResult = await usersCollection.updateMany(
          { "propertiesBought.agentEmail": email },
          { $pull: { propertiesBought: { agentEmail: email } } }
        );

        res.send({
          message: "User marked as fraud and properties deleted successfully",
          userUpdateResult,
          propertyDeleteResult,
          propertyBoughtUpdateResult,
        });
      }
    );

    app.delete(
      "/admin/delete-user/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const userEmail = req.params.email;

        const deleteUserResult = await usersCollection.deleteOne({
          email: userEmail,
        });

        res.send({
          message: "User and their properties deleted successfully",
          deleteUserResult,
        });
      }
    );

    app.get("/admin/reviews", verifyToken, verifyAdmin, async (req, res) => {
      const properties = await propertiesCollection
        .find({}, { projection: { reviews: 1 } })
        .toArray();
      const reviews = properties.flatMap((property) => property.reviews || []);
      res.send(reviews);
    });

    app.delete(
      "/admin/delete-review/:reviewId",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { reviewId } = req.params;

        const result = await propertiesCollection.updateOne(
          { "reviews.reviewId": reviewId },
          { $pull: { reviews: { reviewId: reviewId } } }
        );

        res.send(result);
      }
    );

    app.patch(
      "/admin/advertise-property/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;

        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { advertised: "true" } }
        );

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
