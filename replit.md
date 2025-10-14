# Silver Leaf Training Program Planner

## Overview
A web application for Silver Leaf to organize and manage their teacher training program. The app provides a clean, collapsible card-based interface with role-based access control for managing training weeks with competency focus, objectives, and presentation files.

## Features
- **Authentication**: Secure login with Replit Auth (OpenID Connect)
- **Role-Based Access Control**: Admin (full CRUD access) and Teacher (view-only) roles
- **Training Week Management**: Add, edit, and delete training weeks (admin only)
- **Collapsible Cards UI**: Vertical accordion cards for better content organization
- **Inline Editing**: Click-to-edit fields for Competency Focus and Objective (admin only)
- **File Uploads**: Upload presentation files (PowerPoint, PDF, Keynote) for each week (admin only)
- **File Display**: Uploaded files shown as clickable download links with file size
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Dark Mode**: Toggle between light and dark themes
- **Keyboard Accessible**: Full keyboard navigation support for accordion cards

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **File Storage**: Replit Object Storage (Google Cloud Storage)
- **File Uploads**: Uppy.js with AWS S3 plugin

## Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ObjectUploader.tsx    # File upload component
│   │   │   ├── ThemeToggle.tsx       # Dark mode toggle
│   │   │   └── ui/                   # Shadcn UI components
│   │   ├── pages/
│   │   │   ├── home.tsx              # Main page with accordion cards
│   │   │   └── landing.tsx           # Login/landing page
│   │   ├── hooks/
│   │   │   └── useAuth.ts            # Authentication hook
│   │   └── lib/
│   │       ├── queryClient.ts        # React Query setup
│   │       └── authUtils.ts          # Auth utilities
├── server/
│   ├── routes.ts                     # API routes with auth middleware
│   ├── storage.ts                    # PostgreSQL storage implementation
│   ├── replitAuth.ts                 # Replit Auth configuration
│   └── objectStorage.ts              # Object storage service
└── shared/
    └── schema.ts                     # Shared types and schemas
```

## Authentication & Authorization
- **Replit Auth (OIDC)**: Secure authentication using OpenID Connect
- **First User**: Automatically assigned "admin" role
- **Subsequent Users**: Assigned "teacher" role (view-only)
- **Session Management**: Sessions stored in PostgreSQL
- **Protected Endpoints**: All API routes require authentication
- **Admin-Only Endpoints**: POST, PATCH, DELETE require admin role

## API Routes
All routes require authentication. Admin-only routes marked with 🔒.

- `GET /api/training-weeks` - Get all training weeks (authenticated)
- `POST /api/training-weeks` 🔒 - Create a new training week (admin only)
- `PATCH /api/training-weeks/:id` 🔒 - Update a training week (admin only)
- `DELETE /api/training-weeks/:id` 🔒 - Delete a training week (admin only)
- `POST /api/objects/upload` 🔒 - Get presigned URL for file upload (admin only)
- `POST /api/training-weeks/:id/deck` 🔒 - Update deck file after upload (admin only)
- `GET /objects/:objectPath` - Download uploaded files (authenticated)
- `GET /api/auth/user` - Get current authenticated user
- `GET /api/login` - Initiate Replit Auth login
- `GET /api/callback` - Auth callback handler
- `GET /api/logout` - Logout and clear session

## Database Schema (PostgreSQL)
```typescript
users table:
- id: varchar (UUID primary key)
- email: text (unique)
- name: text
- role: text (admin or teacher)
- createdAt: timestamp

sessions table:
- sid: varchar (primary key)
- sess: json
- expire: timestamp

trainingWeeks table:
- id: varchar (UUID primary key)
- weekNumber: serial (auto-incremented)
- competencyFocus: text (nullable)
- objective: text (nullable)
- deckFileName: text (nullable)
- deckFileUrl: text (nullable)
- deckFileSize: integer (nullable)
```

## How to Use

### For Admin Users
1. Login with Replit Auth (first user becomes admin)
2. Click "Add New Week" to create a new training week
3. Click the accordion trigger to expand a week card
4. Click on Competency Focus or Objective fields to edit inline (press Enter to save)
5. Click "Upload Deck" to upload presentation files
6. Uploaded files appear as clickable links with file size
7. Click the delete (trash) icon to remove a training week (requires confirmation)

### For Teacher Users
1. Login with Replit Auth (subsequent users become teachers)
2. View all training weeks in read-only mode
3. Click accordion triggers to expand week details
4. View competency focus, objectives, and presentation files
5. Download presentation files by clicking the file links
6. No edit, delete, or upload capabilities (view-only access)

## Responsive Design
- **Desktop (≥1024px)**: Full layout with all elements visible
- **Tablet (≥640px)**: Adjusted spacing and sizes, hidden subtitle
- **Mobile (<640px)**: Optimized layout with:
  - Icon-only logout button with aria-label
  - Hidden user email and subtitle
  - Stacked "Add New Week" button (full-width)
  - Smaller accordion cards with responsive padding
  - Touch-friendly button sizes

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption secret
- `ISSUER_URL` - Replit Auth OIDC issuer URL
- `CLIENT_ID` - Replit Auth client ID
- `CLIENT_SECRET` - Replit Auth client secret
- `PRIVATE_OBJECT_DIR` - Directory path for private object storage
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Object storage bucket ID

## Recent Changes
### 2024-10-14: Complete Redesign with Authentication and Responsive UI
- **Database Migration**: Migrated from in-memory storage to PostgreSQL with Drizzle ORM
- **Schema Update**: Removed 2024 Deck column, simplified to single Deck field per week
- **Authentication System**: 
  - Implemented Replit Auth (OpenID Connect) for secure login
  - Added role-based access control (Admin/Teacher roles)
  - First user automatically becomes admin, subsequent users are teachers
  - All API endpoints protected with authentication middleware
  - Admin-only endpoints for CRUD operations
- **UI Redesign**: Transformed from table to vertical collapsible accordion cards
  - Implemented Shadcn Accordion component for collapsible week cards
  - Week number displayed in circular badge
  - Competency Focus shown as preview in collapsed state
  - Expanded cards show full details with labeled sections
  - **Accessibility**: Fixed keyboard navigation by moving delete button outside AccordionTrigger
- **Responsive Design**: Full responsive implementation
  - Mobile-optimized header with icon-only logout button
  - Responsive accordion cards with adjusted padding and font sizes
  - Stack layout for mobile, horizontal layout for desktop
  - Hidden elements on small screens (subtitle, user email)
  - Added aria-label to mobile logout button for accessibility
- **Inline Editing Focus Bug Fix**: 
  - Input fields now maintain focus during editing
  - Changed to direct cache updates (`setQueryData`) instead of query invalidation
  - Added `isSavingRef` tracking to prevent blur handler interference
  - Blur handler refocuses only on unintentional blurs
- **E2E Testing**: Comprehensive testing with both Admin and Teacher roles
  - Verified admin CRUD operations, inline editing, file uploads
  - Verified teacher read-only access, no edit/delete/upload buttons
  - Verified responsive design at mobile (375px) and desktop (1024px) breakpoints
  - Verified OIDC authentication and role assignment

## User Preferences
- Clean, modern UI with vertical card layout
- Role-based access control for security
- Responsive design for all devices
- Keyboard accessibility for all interactions
- Dark mode support
