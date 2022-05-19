const express = require("express");
const app = express();
const port = process.env.PROT || 4000;
const cors = require("cors");

var jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const res = require("express/lib/response");
const dotenv = require("dotenv").config();
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://admin:1LwuXLNNamRJB2Tp@cluster0.ti1q2.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctorPortal").collection("service");
    const bookingCollection = client.db("doctorPortal").collection("booking");
    const userCollection = client.db("doctorPortal").collection("user");

    app.get("/service", async (req, res) => {
      const query = {};
      const result = await serviceCollection.find(query).toArray();
      res.send(result);
    });

    function verifyJwt(req, res, next) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
          return res.status(403).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    }

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        date: booking.date,
        treatment: booking.treatment,
        paitent: booking.paitent,
      };

      const exist = await bookingCollection.findOne(query);

      if (exist) {
        return res.send({ success: false, booking: exist });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result });
    });

    app.get("/available", async (req, res) => {
      const date = req.query.date;

      // step 1:  get all services
      const services = await serviceCollection.find().toArray();

      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      // step 3: for each service
      services.map((service) => {
        // step 4: find bookings for that service. output: [{}, {}, {}, {}]
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );
        //

        // step 5: select slots for the service Bookings: ['', '', '', '']
        const bookedSlots = serviceBookings.map((book) => book.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        //step 7: set available to slots to make it easier
        service.slots = available;
      });

      res.send(services);
    });

    app.get("/booking", verifyJwt, async (req, res) => {
      const paitent = req.query.paitent;
      const decoded = req.decoded.email;
      if (paitent === decoded) {
        const query = { paitent: paitent };
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    // admin role check
    app.get("admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isadmin = user.role === "admin";
      res.send({ admin: isadmin });
    });

    //admin
    app.put("/user/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);

        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    });

    // user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };
      const user = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send({ result, token });
    });

    // get all users
    app.get("/users", verifyJwt, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
