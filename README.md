# 📊 GST Invoice App (Full-Stack MERN Application)

A modern, robust, and feature-rich Goods and Services Tax (GST) Invoice Management System. Built using the **MERN** stack (MongoDB, Express, React, Node.js), this application enables businesses to seamlessly generate GST-compliant invoices, track purchases, manage clients (buyers) and inventory (items), monitor sales/expense metrics on a dynamic dashboard, and subscribe to premium tiers using **Razorpay**.

---

## 🌟 Key Features

### 1. **Authentication & Authorization**
- Secure User registration and login using JSON Web Tokens (JWT) and bcrypt password hashing.
- Role-based capabilities and session persistence.

### 2. **Dynamic Dashboard**
- Real-time financial indicators: Total Sales, Total Purchases, Net GST Liability, and Outstanding Payments.
- Visual breakdown of tax metrics (CGST, SGST, IGST collected/paid).
- Quick statistics for buyers, items, and transactions.

### 3. **GST-Compliant Invoicing**
- Dynamic tax calculation engine:
  - Automatically splits tax into **CGST + SGST** if the Buyer is in the same state as the Seller/Supplier.
  - Applies **IGST** if the Buyer is in a different state.
- Supports HSN/SAC codes, discount structures, and custom GST rates (e.g., 5%, 12%, 18%, 28%).
- Generates professional PDF invoices on the fly using `jspdf` and `jspdf-autotable`.

### 4. **Purchase & Input Tax Credit (ITC) Tracking**
- Record business purchases from suppliers/sellers.
- Auto-calculate input tax credit available to offset GST liability.
- Upload/record invoice dates, reference numbers, and payment status.

### 5. **Client & Inventory Management**
- **Buyers Database**: Store business name, GSTIN, billing address, state, state code, and contact information.
- **Items (Inventory) Database**: Record product/service names, description, HSN/SAC codes, base prices, units, and default GST rates.

### 6. **Subscription Management (Razorpay Integration)**
- Tiered plans: **Free**, **Pro**, and **Premium** with usage limits (e.g., invoices per month, buyers limit, items limit).
- Live Razorpay checkout integration with secure webhook handling to sync subscription states.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite | High-performance single page application framework |
| **Styling** | Tailwind CSS | Utility-first CSS framework for clean, modern, responsive UI |
| **Routing** | React Router Dom v7 | Client-side routing for seamless navigation |
| **Icons & Alerts** | Lucide React, React Hot Toast | Modern icon pack and sleek notification system |
| **PDF Generation** | jsPDF, jsPDF-autotable | Client-side dynamic PDF formatting and downloading |
| **Backend API** | Node.js, Express.js | Fast, minimalist web framework for RESTful APIs |
| **Database** | MongoDB, Mongoose ODM | Document-based database for flexible schemas |
| **Payments** | Razorpay SDK | Payment gateway integrations and webhook sync |

---

## 📁 Repository Structure

```text
gst-invoice-app/
├── client/                 # React Frontend (Vite)
│   ├── src/
│   │   ├── api/            # Axios API client setup and hooks
│   │   ├── assets/         # Static assets (logos, images)
│   │   ├── components/     # Reusable layout components (Sidebar, Navbar)
│   │   ├── context/        # AuthContext and SubscriptionContext
│   │   ├── pages/          # Application views (Dashboard, Invoices, Pricing, etc.)
│   │   ├── App.jsx         # App routes and main rendering
│   │   └── main.jsx        # App entry point
│   ├── package.json        # Frontend dependencies & scripts
│   └── tailwind.config.js  # Styling configurations
│
└── server/                 # Express Backend API
    ├── middleware/         # Auth verify token, rate limiting, plan check
    ├── models/             # Mongoose schemas (User, Invoice, Purchase, Seller, etc.)
    ├── routes/             # REST API endpoints (auth, invoices, buyers, subscriptions...)
    ├── index.js            # Express server entry point & configuration
    └── package.json        # Backend dependencies & scripts
```

---

## ⚙️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) installed (v18+ recommended)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) or a local MongoDB instance
- [Razorpay Account](https://razorpay.com/) (for subscription testing - Test Mode keys)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/gst-invoice-app.git
cd gst-invoice-app
```

---

### 2. Backend Configuration (`server/`)
Navigate into the `server` directory and install dependencies:
```bash
cd server
npm install
```

Create a `.env` file in the `server/` directory:
```env
# Server Port
PORT=5000

# Database URI
MONGO_URI=your_mongodb_connection_string

# JWT Configurations
JWT_SECRET=your_jwt_strong_secret_key
JWT_EXPIRES_IN=7d

# Default Supplier/Seller Details (Fallback/Default Values)
SUPPLIER_NAME=Your Business Name
SUPPLIER_GSTIN=22AAAAA0000A1Z5
SUPPLIER_ADDRESS=123, Main Street
SUPPLIER_CITY=New Delhi
SUPPLIER_STATE=Delhi
SUPPLIER_PINCODE=110001
SUPPLIER_PHONE=9999999999
SUPPLIER_EMAIL=you@yourbusiness.com
SUPPLIER_BANK_NAME=State Bank of India
SUPPLIER_BANK_ACCOUNT=123456789012
SUPPLIER_BANK_IFSC=SBIN0001234
SUPPLIER_BANK_BRANCH=Connaught Place
SUPPLIER_STATE_CODE=07

# Razorpay API Credentials
RAZORPAY_KEY_ID=rzp_test_yourKeyId
RAZORPAY_KEY_SECRET=yourSecretKey
RAZORPAY_WEBHOOK_SECRET=yourWebhookSecretString
```

Start the backend server:
```bash
# Run in development mode (with nodemon reload)
npm run dev

# Run in production mode
npm start
```
The API server will run at [http://localhost:5000](http://localhost:5000).

---

### 3. Frontend Configuration (`client/`)
Open a new terminal, navigate to the `client` directory, and install dependencies:
```bash
cd client
npm install
```

Create a `.env` file in the `client/` directory:
```env
VITE_API_URL=http://localhost:5000/api
```

Start the React development server:
```bash
npm run dev
```
The frontend application will spin up at [http://localhost:5173](http://localhost:5173).

---

## ⚡ API Endpoints Map

### Authentication
- `POST /api/auth/register` — Create a new user profile
- `POST /api/auth/login` — Sign in and get a JWT token
- `GET /api/auth/me` — Retrieve currently logged-in user context

### Invoices
- `GET /api/invoices` — List all invoices created by the authenticated user (supports search & filters)
- `POST /api/invoices` — Create a new invoice (checks active plan limits)
- `GET /api/invoices/:id` — View detailed invoice record
- `PUT /api/invoices/:id` — Modify an existing invoice
- `DELETE /api/invoices/:id` — Remove an invoice record
- `POST /api/invoices/:id/payments` — Record payment collections

### Purchases
- `GET /api/purchases` — View purchase bills (input records)
- `POST /api/purchases` — Record a new purchase entry
- `DELETE /api/purchases/:id` — Delete a purchase entry

### Buyers & Items
- `GET/POST /api/buyers` — List or create buyers
- `PUT/DELETE /api/buyers/:id` — Manage specific buyer profile
- `GET/POST /api/items` — List or create inventory products
- `PUT/DELETE /api/items/:id` — Update or delete inventory items

### Subscriptions
- `GET /api/subscriptions/plans` — Fetch active billing tiers
- `POST /api/subscriptions/create-order` — Create Razorpay order for billing
- `POST /api/subscriptions/verify` — Verify signature and activate plan status
- `POST /api/subscriptions/webhook` — Razorpay webhook receiver to sync subscriptions asynchronously

---

## 🧮 GST Calculation Logic

The application calculates GST based on the relative locations of the business and the buyer:
- **Intrastate (Same State)**: If `buyer.stateCode == supplier.stateCode`:
  $$\text{CGST} = \text{Tax Rate} / 2$$
  $$\text{SGST} = \text{Tax Rate} / 2$$
  $$\text{IGST} = 0$$
- **Interstate (Different State)**: If `buyer.stateCode != supplier.stateCode`:
  $$\text{CGST} = 0$$
  $$\text{SGST} = 0$$
  $$\text{IGST} = \text{Tax Rate}$$

This ensures compliance with Indian GST directives and produces accurate tax invoice printouts.

---

## 🛡️ License

This project is open-source and available under the [MIT License](LICENSE).
