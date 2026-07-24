# TokenScan

TokenScan is a comprehensive crypto analytics platform designed to provide users with in-depth insights into token performance, transaction history, and market trends.

## 🚀 Features

- **Token Search**: Instantly search for tokens by name, symbol, or contract address
- **Token Analytics**: Detailed analytics including price charts, market cap, and trading volume
- **Transaction History**: Comprehensive transaction history with filtering and search capabilities
- **Holder Analysis**: Real-time holder tracking and distribution analysis
- **Multi-Chain Support**: Support for multiple blockchain networks (initially Ethereum, with plans for more)

## 🛠️ Tech Stack

### Frontend
- **React**: UI library for building the user interface
- **Tailwind CSS**: Utility-first CSS framework for styling
- **TypeScript**: Type safety for the application
- **Recharts**: Charting library for data visualization

### Backend
- **Node.js**: JavaScript runtime for the backend
- **Express**: Web framework for building APIs
- **MongoDB**: NoSQL database for storing token data
- **Web3.js/Ethers.js**: Ethereum blockchain interaction

## 📂 Project Structure

```
TokenScan/
├── backend/      # Backend services and API
│   ├── src/          # Source code for backend
│   ├── config/       # Configuration files
│   ├── migrations/   # Database migrations
│   └── package.json  # Backend dependencies
│
├── frontend/     # Frontend application
│   ├── public/       # Public assets
│   ├── src/          # Source code for frontend
│   │   ├── components/ # Reusable components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API services
│   │   └── App.tsx     # Main application component
│   └── package.json  # Frontend dependencies
│
├── README.md       # Project documentation
└── package.json    # Root project dependencies (optional)
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (running locally or a connection string)
- Yarn or npm

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TokenScan
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Configuration

1. **Environment variables**
   Create a `.env` file in the `backend/` directory with the following variables:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/tokenscan
   ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your-infura-project-id
   ```

   Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

2. **Database setup**
   Ensure MongoDB is running. The database will be created automatically on first run.

### Running the Application

1. **Start the backend**
   ```bash
   cd backend
   npm start
   ```

2. **Start the frontend**
   ```bash
   cd ../frontend
   npm run dev
   ```

3. **Access the application**
   Open [http://localhost:5173](http://localhost:5173) in your browser

## 📁 API Documentation

### Token Endpoints

- `GET /api/tokens`: Get all tokens
- `GET /api/tokens/:id`: Get token by ID
- `GET /api/tokens/search?q=:query`: Search for tokens

### Transaction Endpoints

- `GET /api/tokens/:id/transactions`: Get transactions for a token
- `GET /api/transactions/search?q=:query`: Search for transactions

### Holder Endpoints

- `GET /api/tokens/:id/holders`: Get holders for a token
- `GET /api/tokens/:id/analytics`: Get analytics for a token

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Create a feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
3. Push to the branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
