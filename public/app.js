let products = [];
let cart = JSON.parse(localStorage.getItem("ministoreCart") || "[]");
let selectedCategory = "All";
let isLogin = true;

// Helper for safe HTML rendering
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// API Helper
async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

// Toast Notification
function showToast(message) {
  const toast = document.getElementById("toast");

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// Format Price
function formatPrice(price) {
  return "₹" + Number(price).toLocaleString("en-IN");
}

// ================= LOAD PRODUCTS =================

async function loadProducts() {
  try {
    products = await api("/api/products");
    displayProducts();
    renderCart();
  } catch (error) {
    showToast("Unable to load products");
  }
}

// ================= DISPLAY PRODUCTS =================

function displayProducts() {
  const container = document.getElementById("products");

  let filteredProducts = products;

  if (selectedCategory !== "All") {
    filteredProducts = filteredProducts.filter(
      product => product.category === selectedCategory
    );
  }

  const searchValue = document
    .getElementById("searchInput")
    .value.toLowerCase()
    .trim();

  if (searchValue) {
    filteredProducts = filteredProducts.filter(
      product =>
        product.name.toLowerCase().includes(searchValue) ||
        product.category.toLowerCase().includes(searchValue)
    );
  }

  document.getElementById("productCount").textContent =
    `${filteredProducts.length} Products`;

  if (filteredProducts.length === 0) {
    container.innerHTML = `
      <p>No products found.</p>
    `;
    return;
  }

  container.innerHTML = filteredProducts.map(product => `
    <div class="product-card">

      <div class="product-image">
        <img
          src="${escapeHTML(product.image)}?auto=format&fit=crop&w=600&q=80"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
        >
      </div>

      <div class="product-category">
        ${escapeHTML(product.category)}
      </div>

      <h3>${escapeHTML(product.name)}</h3>

      <p class="product-description">
        ${escapeHTML(product.description)}
      </p>

      <div class="product-price">
        ${formatPrice(product.price)}
      </div>

      <div class="product-buttons">

        <button
          class="add-cart"
          onclick="addToCart('${product._id}')"
          ${product.stock <= 0 ? "disabled" : ""}
        >
          ${product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
        </button>

        <button
          class="details-btn"
          onclick="showProductDetails('${product._id}')"
        >
          <i class="fa-solid fa-eye"></i>
        </button>

      </div>

    </div>
  `).join("");
}

// ================= SEARCH =================

function searchProducts() {
  displayProducts();
}

document
  .getElementById("searchInput")
  .addEventListener("input", displayProducts);

// ================= CATEGORY FILTER =================

function filterCategory(category, button) {
  selectedCategory = category;

  document.querySelectorAll(".category").forEach(btn => {
    btn.classList.remove("active");
  });

  button.classList.add("active");

  displayProducts();
}

// ================= PRODUCT DETAILS =================

async function showProductDetails(id) {
  try {
    const product = await api(`/api/products/${id}`);

    document.getElementById("productDetails").innerHTML = `
      <img
        src="${escapeHTML(product.image)}?auto=format&fit=crop&w=600&q=80"
        class="details-image"
        alt="${escapeHTML(product.name)}"
      >

      <h2>${escapeHTML(product.name)}</h2>

      <p>${escapeHTML(product.description)}</p>

      <h3>${formatPrice(product.price)}</h3>

      <p>Category: ${escapeHTML(product.category)}</p>

      <p>Available stock: ${product.stock}</p>

      <button
        class="add-cart"
        style="width:100%; margin-top:15px"
        onclick="addToCart('${product._id}'); closeProductModal()"
        ${product.stock <= 0 ? "disabled" : ""}
      >
        Add to Cart
      </button>
    `;

    document.getElementById("productModal")
      .classList.add("active");

  } catch (error) {
    showToast(error.message);
  }
}

function closeProductModal() {
  document.getElementById("productModal")
    .classList.remove("active");
}

// ================= SHOPPING CART =================

function addToCart(productId) {
  const product = products.find(
    p => p._id === productId
  );

  if (!product || product.stock <= 0) {
    showToast("Product unavailable");
    return;
  }

  const existingItem = cart.find(
    item => item.productId === productId
  );

  if (existingItem) {
    if (existingItem.quantity >= product.stock) {
      showToast("Maximum stock reached");
      return;
    }

    existingItem.quantity++;
  } else {
    cart.push({
      productId: productId,
      quantity: 1
    });
  }

  saveCart();

  showToast("Product added to cart!");
}

function saveCart() {
  localStorage.setItem(
    "ministoreCart",
    JSON.stringify(cart)
  );

  renderCart();
}

// Render Cart
function renderCart() {
  const cartItems = document.getElementById("cartItems");

  let total = 0;
  let count = 0;

  cartItems.innerHTML = cart.map(item => {
    const product = products.find(
      p => p._id === item.productId
    );

    if (!product) return "";

    total += product.price * item.quantity;
    count += item.quantity;

    return `
      <div class="cart-item">

        <div>
          <h4>${escapeHTML(product.name)}</h4>

          <p>
            ${formatPrice(product.price * item.quantity)}
          </p>

          <div class="quantity-controls">

            <button
              onclick="changeQuantity('${product._id}', -1)"
            >
              -
            </button>

            <span>${item.quantity}</span>

            <button
              onclick="changeQuantity('${product._id}', 1)"
            >
              +
            </button>

            <button
              class="remove-btn"
              onclick="removeFromCart('${product._id}')"
            >
              <i class="fa-solid fa-trash"></i>
            </button>

          </div>
        </div>

      </div>
    `;
  }).join("");

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <p style="text-align:center; padding:30px">
        Your cart is empty 🛒
      </p>
    `;
  }

  document.getElementById("cartCount").textContent = count;

  document.getElementById("cartTotal").textContent =
    formatPrice(total);
}

// Change Quantity
function changeQuantity(productId, change) {
  const item = cart.find(
    item => item.productId === productId
  );

  const product = products.find(
    p => p._id === productId
  );

  if (!item || !product) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    cart = cart.filter(
      item => item.productId !== productId
    );
  } else if (item.quantity > product.stock) {
    item.quantity = product.stock;
    showToast("Maximum stock reached");
  }

  saveCart();
}

// Remove Item
function removeFromCart(productId) {
  cart = cart.filter(
    item => item.productId !== productId
  );

  saveCart();

  showToast("Product removed");
}

// Toggle Cart
function toggleCart() {
  document.getElementById("cartSidebar")
    .classList.toggle("active");

  document.getElementById("overlay")
    .classList.toggle("active");
}

// ================= AUTHENTICATION =================

function openAuth() {
  document.getElementById("authModal")
    .classList.add("active");
}

function closeAuth() {
  document.getElementById("authModal")
    .classList.remove("active");
}

function switchAuth() {
  isLogin = !isLogin;

  document.getElementById("authTitle").textContent =
    isLogin ? "Welcome Back!" : "Create Account";

  document.getElementById("authSubtitle").textContent =
    isLogin ? "Login to your account" : "Register for MiniStore";

  document.getElementById("authName").style.display =
    isLogin ? "none" : "block";

  document.getElementById("authName").required = !isLogin;

  document.getElementById("authPassword").autocomplete =
    isLogin ? "current-password" : "new-password";

  document.querySelector(".auth-submit").textContent =
    isLogin ? "Login" : "Register";

  document.getElementById("switchText").textContent =
    isLogin
      ? "Don't have an account?"
      : "Already have an account?";

  document.getElementById("switchButton").textContent =
    isLogin ? "Register" : "Login";
}

// Submit Login / Register
document.getElementById("authForm")
  .addEventListener("submit", async function(event) {

    event.preventDefault();

    const name = document.getElementById("authName").value;
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;

    try {
      const endpoint = isLogin
        ? "/api/login"
        : "/api/register";

      const body = isLogin
        ? { email, password }
        : { name, email, password };

      const result = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(body)
      });

      document.getElementById("userName").textContent =
        result.user.name;

      closeAuth();

      this.reset();

      showToast(result.message);

    } catch (error) {
      showToast(error.message);
    }
  });

// Check Existing User
async function checkUser() {
  try {
    const result = await api("/api/me");

    if (result.user) {
      document.getElementById("userName").textContent =
        result.user.name;
    }
  } catch (error) {
    console.log(error);
  }
}

// ================= CHECKOUT =================

async function checkout() {
  if (cart.length === 0) {
    showToast("Your cart is empty!");
    return;
  }

  try {
    const result = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        items: cart
      })
    });

    cart = [];

    saveCart();

    toggleCart();

    await loadProducts();

    showToast(
      `Order placed successfully! Total: ${formatPrice(result.total)}`
    );

  } catch (error) {
    if (error.message.toLowerCase().includes("login")) {
      toggleCart();
      openAuth();
      showToast("Please login before checkout");
    } else {
      showToast(error.message);
    }
  }
}

// ================= INITIALIZATION =================

loadProducts();
checkUser();