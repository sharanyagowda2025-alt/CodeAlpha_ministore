const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");

const app = express();

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "ministore-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection
mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb+srv://ministore:internship@sharanya.ecrgvyl.mongodb.net/ministore"
  )
  .then(() => {
    console.log("MongoDB Connected Successfully");
    seedProducts();
  })
  .catch((err) => {
    console.log("MongoDB Error:", err);
  });

// ================= SCHEMAS =================

// User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true,
    lowercase: true
  },
  password: String
});

// Product Schema
const ProductSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  category: String,
  image: String,
  stock: {
    type: Number,
    default: 20
  }
});

// Order Schema
const OrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  items: [
    {
      productId: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number,
      quantity: Number
    }
  ],
  total: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model("User", UserSchema);
const Product = mongoose.model("Product", ProductSchema);
const Order = mongoose.model("Order", OrderSchema);

// ================= SAMPLE PRODUCTS =================

async function seedProducts() {
  if (await Product.countDocuments()) return;

  await Product.insertMany([
    {
      name: "Premium Headphones",
      description: "High quality wireless headphones.",
      price: 2499,
      category: "Electronics",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
      stock: 15
    },
    {
      name: "Smart Watch",
      description: "Modern smart watch with fitness tracking.",
      price: 3999,
      category: "Electronics",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
      stock: 12
    },
    {
      name: "Running Sneakers",
      description: "Comfortable sneakers for everyday use.",
      price: 1999,
      category: "Fashion",
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
      stock: 20
    },
    {
      name: "Travel Backpack",
      description: "Stylish backpack with spacious storage.",
      price: 1499,
      category: "Fashion",
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62",
      stock: 10
    },
    {
      name: "Modern Sunglasses",
      description: "Stylish sunglasses for everyday fashion.",
      price: 999,
      category: "Accessories",
      image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083",
      stock: 25
    },
    {
      name: "Digital Camera",
      description: "Capture your memorable moments.",
      price: 8999,
      category: "Electronics",
      image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32",
      stock: 8
    }
  ]);
}

// ================= AUTHENTICATION =================

function auth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please login first"
    });
  }

  next();
}

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({
        message: "Enter all details. Password must be 6+ characters."
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase()
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    req.session.userId = user._id;

    res.json({
      message: "Registration successful",
      user: {
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({
      message: "Registration failed"
    });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase()
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    req.session.userId = user._id;

    res.json({
      message: "Login successful",
      user: {
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({
      message: "Login error"
    });
  }
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      message: "Logged out successfully"
    });
  });
});

// Current User
app.get("/api/me", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }

  const user = await User.findById(req.session.userId)
    .select("name email");

  res.json({ user });
});

// ================= PRODUCTS =================

// Get Products
app.get("/api/products", async (req, res) => {
  const products = await Product.find();

  res.json(products);
});

// Get Single Product
app.get("/api/products/:id", async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      message: "Product not found"
    });
  }

  res.json(product);
});

// ================= ORDER PROCESSING =================

app.post("/api/orders", auth, async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Cart is empty"
      });
    }

    const orderItems = [];
    let total = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      const quantity = Number(item.quantity);

      if (
        !product ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > product.stock
      ) {
        return res.status(400).json({
          message: "Invalid product or quantity"
        });
      }

      orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity
      });

      total += product.price * quantity;
    }

    const order = await Order.create({
      userId: req.session.userId,
      items: orderItems,
      total
    });

    // Decrease product stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -item.quantity } }
      );
    }

    res.status(201).json({
      message: "Order placed successfully!",
      orderId: order._id,
      total
    });
  } catch (err) {
    res.status(500).json({
      message: "Order processing failed"
    });
  }
});

// User Order History
app.get("/api/orders", auth, async (req, res) => {
  const orders = await Order.find({
    userId: req.session.userId
  }).sort({ createdAt: -1 });

  res.json(orders);
});

// ================= SERVER =================

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});