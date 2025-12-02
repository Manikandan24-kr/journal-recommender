# Journal Scope Matcher - Kriyadocs

A smart manuscript submission recommendation system that analyzes your research manuscript and suggests the most suitable journals for submission based on scope alignment.

## Features

- **Document Upload**: Support for PDF, DOC, and DOCX manuscript files
- **AI-Powered Analysis**: Extracts title and abstract, then uses LLM to match against journal scopes
- **Smart Matching**: Compares manuscript content against a database of journal scope definitions
- **Detailed Reports**: Provides match scores, alignment explanations, and submission considerations
- **Beautiful UI**: Modern, responsive design following Kriyadocs brand guidelines

## Project Structure

```
journal-recommender/
├── frontend/              # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── services/      # API and mock data services
│   │   ├── types/         # TypeScript type definitions
│   │   └── App.tsx        # Main application
│   └── package.json
│
├── backend/               # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── data/          # Journal database
│   │   ├── services/      # LLM and document parsing services
│   │   └── index.ts       # Express server
│   └── package.json
│
└── README.md
```

## Quick Start

### Frontend (Demo Mode)

The frontend includes mock data and works standalone for demonstration:

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to see the application.

### Backend (Production Mode)

For production use with real document parsing and LLM analysis:

```bash
cd backend
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

npm run dev
```

The API will be available at `http://localhost:3001`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/journals` | List all journals |
| GET | `/api/journals/:id` | Get journal details |
| POST | `/api/analyze` | Upload and analyze manuscript |
| POST | `/api/analyze/text` | Analyze with title/abstract text |

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Lucide React for icons
- React Dropzone for file upload

### Backend
- Node.js with Express
- TypeScript
- OpenAI API (GPT-4) for LLM analysis
- Mammoth for DOCX parsing
- PDF-parse for PDF parsing
- Multer for file uploads

## Configuration

### Adding New Journals

Edit `backend/src/data/journals.ts` to add new journals:

```typescript
{
  id: 'unique-id',
  name: 'Journal Name',
  abbreviation: 'J Name',
  publisher: 'Publisher Name',
  impactFactor: 5.0,
  scope: 'Detailed scope description...',
  subjects: ['Subject 1', 'Subject 2'],
  openAccess: true,
  reviewTime: '4-6 weeks',
  acceptanceRate: 30,
  website: 'https://journal-website.com'
}
```

### Customizing LLM Prompts

Edit `backend/src/services/llmService.ts` to customize how the LLM analyzes manuscripts and generates recommendations.

## AWS Deployment (ECS)

### Prerequisites

- Docker installed and running
- AWS CLI credentials (for the deployment container)

### Setup

1. **Copy the deployment environment template:**
   ```bash
   cp .env.deploy.example .env.deploy
   ```

2. **Edit `.env.deploy` with your AWS credentials and configuration:**
   ```bash
   # Required values:
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_DEFAULT_REGION=us-east-1
   AWS_ACCOUNT_ID=your-account-id

   # Database (using existing RDS instance)
   RDS_HOST=your-rds-endpoint
   RDS_DATABASE=journal_recommender
   RDS_USERNAME=your-db-user
   RDS_PASSWORD=your-db-password
   ```

### Deployment Commands

```bash
# First-time setup: Create ECR repos, ECS cluster, ALB target groups
./scripts/deploy.sh setup

# Initialize database schema
./scripts/deploy.sh db-setup

# Full deployment: Build, push, and deploy
./scripts/deploy.sh all

# Individual steps:
./scripts/deploy.sh build    # Build Docker images only
./scripts/deploy.sh push     # Push to ECR only
./scripts/deploy.sh deploy   # Update ECS services only
```

### Architecture

```
                    ┌─────────────────┐
                    │  ALB            │
                    │  (bibmanager)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌─────▼──────┐      │
       │  Frontend   │ │  Backend   │      │
       │  (Nginx)    │ │  (Node.js) │      │
       │  Port 80    │ │  Port 3001 │      │
       └─────────────┘ └──────┬─────┘      │
                              │            │
                       ┌──────▼──────┐     │
                       │    RDS      │     │
                       │  PostgreSQL │     │
                       └─────────────┘     │
```

## Color Scheme

The UI follows Kriyadocs brand colors:
- Primary: `#7C3AED` (Violet)
- Secondary: `#EC4899` (Pink)
- Accent: `#F59E0B` (Orange)
- Success: `#10B981` (Green)

## License

Copyright © 2025 Kriyadocs by Exeter Premedia Services, India.
