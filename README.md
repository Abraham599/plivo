# Plivo Status Page

A modern, real-time status page application built with FastAPI (Python) and React (TypeScript). This application allows you to monitor the status of your services, report incidents, and keep your users informed about system status.

## Features

- 🚀 Real-time service status monitoring
- 📊 Uptime metrics and historical data
- 🔔 Incident management with updates
- 👥 Multi-organization support
- 🔒 Secure authentication with Clerk
- 🌐 Responsive design for all devices

## Tech Stack

### Backend
- Python 3.9+
- FastAPI
- Prisma ORM
- PostgreSQL
- WebSockets for real-time updates
- JWT Authentication

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Shadcn/UI
- Recharts
- Clerk for authentication

## Prerequisites

- Node.js 18+
- Python 3.9+
- PostgreSQL 13+
- pnpm (recommended) or npm
- Docker (optional, for PostgreSQL)

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd plivo
```

### 2. Set up the backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the database connection string and other environment variables

5. Set up the database:
   ```bash
   # Run database migrations
   prisma migrate dev
   ```

6. Start the backend server:
   ```bash
   uvicorn main:app --reload
   ```
   The API will be available at `http://localhost:8000`

### 3. Set up the frontend

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Install dependencies:
   ```bash
   pnpm install
   # or
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the VITE_API_URL to point to your backend
   - Add Clerk authentication keys

4. Start the development server:
   ```bash
   pnpm dev
   # or
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`

## Project Structure

```
plivo/
├── backend/                 # FastAPI backend
│   ├── prisma/              # Database schema and migrations
│   ├── main.py              # Main FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── .env.example        # Example environment variables
│
├── frontend/               # React frontend
│   ├── public/             # Static files
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── stores/         # State management
│   │   └── lib/            # Utility functions
│   ├── .env.example       # Example environment variables
│   └── package.json
│
└── README.md             # This file
```

## Environment Variables

### Backend (`.env`)

```
DATABASE_URL="postgresql://user:password@localhost:5432/plivo"
CLERK_SECRET_KEY="your-clerk-secret-key"
CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
JWT_SECRET_KEY="your-jwt-secret-key"
```

### Frontend (`.env`)

```
VITE_API_URL="http://localhost:8000"
VITE_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
```

## Deployment

### Backend

1. Set up a production-ready ASGI server like Uvicorn with Gunicorn:
   ```bash
   pip install gunicorn uvicorn[standard]
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
   ```

2. For production, use a reverse proxy like Nginx or Caddy.

### Frontend

1. Build the production bundle:
   ```bash
   cd frontend
   pnpm build
   # or
   npm run build
   ```

2. Deploy the `dist` folder to a static hosting service like Vercel, Netlify, or Cloudflare Pages.

## Development

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd ../frontend
pnpm test
```

### Code Style

- Backend: Follows PEP 8 and Black formatting
- Frontend: Uses ESLint and Prettier for code formatting

## License

[MIT](LICENSE)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

For support, email support@example.com or open an issue in the GitHub repository.
