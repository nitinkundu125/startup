# Portfolio Tracker

A comprehensive, private-by-design portfolio tracking application built with **Next.js**, **Prisma**, and **SQLite**. This app allows you to upload your broker's tradebook CSV files to track your stocks, mutual funds, and US stocks with extreme accuracy, including historical corporate actions and cash flows.

## ✨ Features

- **Multi-Asset Tracking**: Separate dashboards for Overall Portfolio, Indian Stocks, Mutual Funds, and US Stocks.
- **Accurate FIFO Cost Basis**: Replays your entire trading history chronologically to calculate the exact FIFO cost basis of your current holdings.
- **Intelligent Corporate Actions Engine**: 
  - Automatically fetches historical announcements from the **NSE API**.
  - Adjusts your holdings for **Stock Splits** and **Bonus Issues**.
  - Parses text announcements to extract exact cash **Dividends** and calculates total passive income earned per stock.
- **XIRR & Performance Tracking**: 
  - Calculates annualized returns (XIRR) based on exact cash inflows and outflows.
  - Compares your portfolio's performance against major indices (e.g., Nifty 50, Nifty 500) using historical data from **Yahoo Finance**.
- **Cash Flow Analytics**: Visualizes your monthly invested capital vs. withdrawn capital using interactive charts.
- **Live Pricing**: Fetches real-time LTP (Last Traded Price) from Yahoo Finance for up-to-date portfolio valuations.
- **Privacy First**: All data is stored locally in a SQLite database (`prisma/dev.db`). No financial data is sent to third-party tracking servers.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nitinkundu125/startup.git
   cd startup
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up the database:**
   The project uses Prisma with a local SQLite database. Push the schema to create the database:
   ```bash
   npx prisma db push
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open the app:**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📊 How to Use

1. Navigate to the **Dashboard**.
2. Click **Import data** to upload your tradebook CSV.
3. The app will process your trades, automatically apply historical corporate actions (splits, bonuses, dividends), and calculate your exact holdings and cost basis.
4. Use the **Overall**, **Stocks**, **Mutual Funds**, and **US Stocks** tabs to view specific allocations, XIRR, and performance charts.
5. Click the **Refresh** button on the dashboard at any time to pull the latest live prices from Yahoo Finance.

## 🛠 Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: SQLite
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Data Sources**: NSE India API, Yahoo Finance API

## 📝 License

This project is licensed under the MIT License.
