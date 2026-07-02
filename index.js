const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const favoriteCollection = db.collection("favorites");
        const paymentCollection = db.collection("payments");
        const reportCollection = db.collection("reports");

        const checkBlocked = async (req, res, next) => {
            try {
                const email = req.body.userEmail || req.body.authorEmail;

                if (!email) {
                    return next(); // email na thakle skip (public route hote pare)
                }

                const user = await userCollection.findOne({ email });

                if (user?.status === "Blocked") {
                    return res.status(403).json({
                        success: false,
                        message: "Your account is blocked. Contact support.",
                    });
                }

                next();
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        };

        // ── Add Recipe ──
        app.post("/api/recipe", checkBlocked, async (req, res) => {
            try {
                const recipeData = {
                    ...req.body,
                    likesCount: 0,
                    likedBy: [],
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
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get My Recipes by Email ──
        app.get("/api/myRecipe/:email", async (req, res) => {
            try {
                const email = req.params.email;

                const result = await myRecipeCollection
                    .find({ authorEmail: email })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({ success: true, data: result });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Update Recipe ──
        app.patch("/api/recipe/:id", async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid recipe id" });
                }

                const updateDoc = { ...req.body, updatedAt: new Date() };
                delete updateDoc._id;

                const result = await myRecipeCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateDoc }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ success: false, message: "Recipe not found" });
                }

                res.status(200).json({ success: true, message: "Recipe updated successfully" });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Delete Recipe ──
        app.delete("/api/recipe/:id", async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid recipe id" });
                }

                const result = await myRecipeCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ success: false, message: "Recipe not found" });
                }

                res.status(200).json({ success: true, message: "Recipe deleted successfully" });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get All Recipes (with filter, sort, pagination) ──
        app.get("/api/recipes", async (req, res) => {
            try {
                const {
                    page = 1,
                    limit = 6,
                    search = "",
                    category = "",
                    cuisineType = "",
                    difficultyLevel = "",
                    sortBy = "",
                } = req.query;

                const pageNum = parseInt(page);
                const limitNum = parseInt(limit);

                const filter = { status: "Published" };

                if (search) filter.recipeName = { $regex: search, $options: "i" };
                if (category) filter.category = category;
                if (cuisineType) filter.cuisineType = cuisineType;
                if (difficultyLevel) filter.difficultyLevel = difficultyLevel;

                const sort = {};
                if (sortBy === "Most Liked") sort.likesCount = -1;
                else if (sortBy === "Newest") sort.createdAt = -1;
                else if (sortBy === "Cook Time") sort.preparationTime = 1;
                else sort.createdAt = -1;

                const total = await myRecipeCollection.countDocuments(filter);
                const totalPages = Math.ceil(total / limitNum);

                const result = await myRecipeCollection
                    .find(filter)
                    .sort(sort)
                    .skip((pageNum - 1) * limitNum)
                    .limit(limitNum)
                    .toArray();

                res.status(200).json({
                    success: true,
                    data: result,
                    total,
                    totalPages,
                    currentPage: pageNum,
                });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get Single Recipe by ID ──
        app.get("/api/recipe/:id", async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid recipe id" });
                }

                const recipe = await myRecipeCollection.findOne({ _id: new ObjectId(id) });

                if (!recipe) {
                    return res.status(404).json({ success: false, message: "Recipe not found" });
                }

                res.status(200).json({ success: true, data: recipe });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });


        // ── Like Recipe ──
        app.patch("/api/recipe/like/:id", checkBlocked, async (req, res) => {
            try {
                const { id } = req.params;
                const { userEmail } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid recipe id" });
                }
                if (!userEmail) {
                    return res.status(400).json({ success: false, message: "userEmail is required" });
                }

                const recipe = await myRecipeCollection.findOne({ _id: new ObjectId(id) });

                if (!recipe) {
                    return res.status(404).json({ success: false, message: "Recipe not found" });
                }

                if (recipe.likedBy?.includes(userEmail)) {
                    return res.status(409).json({ success: false, message: "Already liked" });
                }

                await myRecipeCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $inc: { likesCount: 1 },
                        $addToSet: { likedBy: userEmail },
                    }
                );

                res.status(200).json({ success: true, message: "Recipe liked successfully" });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Unlike Recipe ──
        app.patch("/api/recipe/unlike/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const { userEmail } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid recipe id" });
                }
                if (!userEmail) {
                    return res.status(400).json({ success: false, message: "userEmail is required" });
                }

                const recipe = await myRecipeCollection.findOne({ _id: new ObjectId(id) });

                if (!recipe) {
                    return res.status(404).json({ success: false, message: "Recipe not found" });
                }

                await myRecipeCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $inc: { likesCount: -1 },
                        $pull: { likedBy: userEmail },
                    }
                );

                res.status(200).json({ success: true, message: "Recipe unliked successfully" });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get User by ID (author profile info) ──
        app.get("/api/user/:id", async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid user id" });
                }

                const user = await userCollection.findOne(
                    { _id: new ObjectId(id) },
                    { projection: { image: 1, name: 1, email: 1 } }
                );

                if (!user) {
                    return res.status(404).json({ success: false, message: "User not found" });
                }

                res.status(200).json({ success: true, data: user });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get User by Email (fallback for author profile) ──
        app.get("/api/user/by-email/:email", async (req, res) => {
            try {
                const { email } = req.params;

                const user = await userCollection.findOne(
                    { email },
                    { projection: { image: 1, name: 1, email: 1 } }
                );

                if (!user) {
                    return res.status(404).json({ success: false, message: "User not found" });
                }

                res.status(200).json({ success: true, data: user });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get All Users (Admin) ──
        app.get("/api/admin/users", async (req, res) => {
            try {
                const result = await userCollection
                    .find({}, { projection: { password: 0 } })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({ success: true, data: result, total: result.length });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });


        // ── Get All Recipes for Admin (no status filter, with search) ──
        app.get("/api/admin/recipes", async (req, res) => {
            try {
                const { search = "", status = "", category = "" } = req.query;

                const filter = {};
                if (search) filter.recipeName = { $regex: search, $options: "i" };
                if (status) filter.status = status;
                if (category) filter.category = category;

                const result = await myRecipeCollection
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({ success: true, data: result, total: result.length });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });


        // ── Block / Unblock User (Admin) ──
        app.patch("/api/admin/users/:id/status", async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body; // "Active" or "Blocked"

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid user id" });
                }

                if (!["Active", "Blocked"].includes(status)) {
                    return res.status(400).json({ success: false, message: "Invalid status value" });
                }

                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ success: false, message: "User not found" });
                }

                res.status(200).json({ success: true, message: `User ${status.toLowerCase()} successfully` });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Add Favorite ──
        app.post("/api/favorites", checkBlocked, async (req, res) => {
            try {
                const favorite = req.body;

                if (!favorite.recipeId || !favorite.userEmail) {
                    return res.status(400).json({ success: false, message: "recipeId and userEmail are required" });
                }

                const existing = await favoriteCollection.findOne({
                    recipeId: favorite.recipeId,
                    userEmail: favorite.userEmail,
                });

                if (existing) {
                    return res.status(409).json({ success: false, message: "Already favorited" });
                }

                const result = await favoriteCollection.insertOne({
                    ...favorite,
                    createdAt: new Date(),
                });

                res.status(201).json({ success: true, insertedId: result.insertedId });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get Favorites by Email ──
        app.get("/api/favorites/:email", async (req, res) => {
            try {
                const result = await favoriteCollection
                    .find({ userEmail: req.params.email })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({ success: true, data: result });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Remove Favorite ──
        app.delete("/api/favorites/:id", async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid favorite id" });
                }

                const result = await favoriteCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ success: false, message: "Favorite not found" });
                }

                res.status(200).json({ success: true, message: "Favorite removed successfully" });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Add Payment (Purchase Recipe) ──
        app.post("/api/payments", async (req, res) => {
            try {
                const { recipeId, userId, userEmail, amount } = req.body;

                if (!recipeId || !userEmail || !amount) {
                    return res.status(400).json({
                        success: false,
                        message: "recipeId, userEmail and amount are required",
                    });
                }

                const transactionId = "TXN-" + Date.now() + "-" + Math.random().toString(36).substring(2, 10).toUpperCase();

                const paymentData = {
                    recipeId,
                    userId: userId || null,
                    userEmail,
                    amount,
                    transactionId,
                    paymentStatus: "Success",
                    paidAt: new Date(),
                };

                const result = await paymentCollection.insertOne(paymentData);

                res.status(201).json({
                    success: true,
                    insertedId: result.insertedId,
                    transactionId,
                    message: "Payment successful",
                });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get My Purchases by Email ──
        app.get("/api/payments/:email", async (req, res) => {
            try {
                const result = await paymentCollection
                    .find({ userEmail: req.params.email })
                    .sort({ paidAt: -1 })
                    .toArray();

                res.status(200).json({ success: true, data: result });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get All Transactions for Admin (with recipe name lookup + search) ──
        app.get("/api/admin/payments", async (req, res) => {
            try {
                const { search = "", status = "" } = req.query;

                const filter = {};
                if (search) {
                    filter.$or = [
                        { userEmail: { $regex: search, $options: "i" } },
                        { transactionId: { $regex: search, $options: "i" } },
                    ];
                }
                if (status) filter.paymentStatus = status;

                const result = await paymentCollection
                    .aggregate([
                        { $match: filter },
                        {
                            $addFields: {
                                recipeObjId: {
                                    $cond: [
                                        { $eq: [{ $type: "$recipeId" }, "string"] },
                                        { $toObjectId: "$recipeId" },
                                        "$recipeId",
                                    ],
                                },
                            },
                        },
                        {
                            $lookup: {
                                from: "myRecipe",
                                localField: "recipeObjId",
                                foreignField: "_id",
                                as: "recipe",
                            },
                        },
                        { $unwind: { path: "$recipe", preserveNullAndEmptyArrays: true } },
                        { $sort: { paidAt: -1 } },
                        {
                            $project: {
                                userEmail: 1,
                                userId: 1,
                                amount: 1,
                                transactionId: 1,
                                paymentStatus: 1,
                                paidAt: 1,
                                recipeName: "$recipe.recipeName",
                            },
                        },
                    ])
                    .toArray();

                const totalRevenue = result
                    .filter((t) => t.paymentStatus === "Success")
                    .reduce((sum, t) => sum + (t.amount || 0), 0);

                res.status(200).json({
                    success: true,
                    data: result,
                    total: result.length,
                    totalRevenue,
                });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Submit a Report (User) ──
        app.post("/api/reports",async (req, res) => {
            try {
                const { recipeId, recipeName, reportedByEmail, reportedByName, reason, message } = req.body;

                if (!recipeId || !reportedByEmail || !message) {
                    return res.status(400).json({
                        success: false,
                        message: "recipeId, reportedByEmail and message are required",
                    });
                }

                const reportData = {
                    recipeId,
                    recipeName: recipeName || "Unknown Recipe",
                    reportedByEmail,
                    reportedByName: reportedByName || "",
                    reason: reason || "Other",
                    message,
                    status: "Pending", // Pending | Reviewed | Resolved | Dismissed
                    createdAt: new Date(),
                };

                const result = await reportCollection.insertOne(reportData);

                res.status(201).json({
                    success: true,
                    insertedId: result.insertedId,
                    message: "Report submitted successfully",
                });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get My Reports by Email (User) ──
        app.get("/api/reports/:email", async (req, res) => {
            try {
                const result = await reportCollection
                    .find({ reportedByEmail: req.params.email })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({ success: true, data: result });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Get All Reports (Admin, with search + status filter) ──
        app.get("/api/admin/reports", async (req, res) => {
            try {
                const { search = "", status = "" } = req.query;

                const filter = {};

                if (search) {
                    filter.$or = [
                        { recipeName: { $regex: search, $options: "i" } },
                        { reportedByEmail: { $regex: search, $options: "i" } },
                        { message: { $regex: search, $options: "i" } },
                    ];
                }

                if (status) filter.status = status;

                const result = await reportCollection
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({ success: true, data: result, total: result.length });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Update Report Status (Admin) ──
        app.patch("/api/admin/reports/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid report id" });
                }

                if (!["Pending", "Reviewed", "Resolved", "Dismissed"].includes(status)) {
                    return res.status(400).json({ success: false, message: "Invalid status value" });
                }

                const result = await reportCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ success: false, message: "Report not found" });
                }

                res.status(200).json({ success: true, message: "Report status updated successfully" });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // ── Delete Report (Admin) ──
        app.delete("/api/admin/reports/:id", async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid report id" });
                }

                const result = await reportCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ success: false, message: "Report not found" });
                }

                res.status(200).json({ success: true, message: "Report deleted successfully" });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

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