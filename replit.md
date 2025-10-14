# Silver Leaf Training Program Planner

## Overview
A web application for Silver Leaf to organize and manage their teacher training program. The app provides a clean, collapsible card-based interface with role-based access control for managing training weeks with competency focus, objectives, and presentation files.

## Features
- **Authentication**: Secure username/password authentication with scrypt password hashing
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
- **Authentication**: Passport.js Local Strategy with scrypt password hashing
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
│   │   │   └── auth-page.tsx         # Login/registration page
│   │   ├── hooks/
│   │   │   └── use-auth.tsx          # Authentication hook with AuthProvider
│   │   └── lib/
│   │       ├── queryClient.ts        # React Query setup
│   │       └── protected-route.tsx   # Route protection component
├── server/
│   ├── routes.ts                     # API routes with auth middleware
│   ├── storage.ts                    # PostgreSQL storage implementation
│   ├── auth.ts                       # Passport.js authentication
│   └── objectStorage.ts              # Object storage service
└── shared/
    └── schema.ts                     # Shared types and schemas
```

## Authentication & Authorization
- **Username/Password Authentication**: Secure login using Passport.js Local Strategy
- **Password Hashing**: Scrypt algorithm with per-user salt for maximum security
- **Teacher Registration**: Public registration available, automatically assigns "teacher" role (view-only)
- **Admin Accounts**: Created manually in database only, no public sign-up
- **Session Management**: Express sessions stored in PostgreSQL with connect-pg-simple
- **Protected Endpoints**: All API routes require authentication
- **Admin-Only Endpoints**: POST, PATCH, DELETE require admin role
- **Current Admin Credentials**: 
  - Username: `admin`
  - Email: admin@silverleaf.com
  - Password: `SecureAdmin123!`

## API Routes
All routes require authentication. Admin-only routes marked with 🔒.

- `GET /api/training-weeks` - Get all training weeks (authenticated)
- `POST /api/training-weeks` 🔒 - Create a new training week (admin only)
- `PATCH /api/training-weeks/:id` 🔒 - Update a training week (admin only)
- `DELETE /api/training-weeks/:id` 🔒 - Delete a training week (admin only)
- `POST /api/objects/upload` 🔒 - Get presigned URL for file upload (admin only)
- `POST /api/training-weeks/:id/deck` 🔒 - Add multiple deck files after upload (admin only)
- `DELETE /api/training-weeks/:id/deck/:fileId` 🔒 - Delete a specific deck file (admin only)
- `GET /objects/:objectPath` - Download uploaded files (authenticated)
- `GET /api/user` - Get current authenticated user
- `POST /api/register` - Register new teacher account (public, always creates teacher role)
- `POST /api/login` - Login with username/password
- `POST /api/logout` - Logout and clear session

## Database Schema (PostgreSQL)
```typescript
users table:
- id: varchar (UUID primary key)
- username: varchar (unique, required)
- password: varchar (hashed with scrypt)
- email: varchar (optional)
- firstName: varchar (optional)
- lastName: varchar (optional)
- role: varchar (admin or teacher, defaults to teacher)
- createdAt: timestamp
- updatedAt: timestamp

sessions table:
- sid: varchar (primary key)
- sess: json
- expire: timestamp

training_weeks table:
- id: varchar (UUID primary key)
- week_number: integer (required)
- competency_focus: text (required, defaults to empty string)
- objective: text (required, defaults to empty string)
- deck_files: jsonb (array of file objects with id, fileName, fileUrl, fileSize)
```

## How to Use

### For Admin Users
1. Login with admin credentials (username: admin, password: SecureAdmin123!)
2. Click "Add New Week" to create a new training week
3. Click the accordion trigger to expand a week card
4. Click on Competency Focus or Objective fields to edit inline (press Enter to save)
5. Click "Upload Deck Files" to upload multiple presentation files (supports up to 10 files)
6. Uploaded files appear as clickable links with file size and individual delete buttons
7. Click the trash icon next to a file to delete that specific file
8. Click the delete (trash) icon on the card header to remove entire training week (requires confirmation)

### For Teacher Users
1. Register a new account on the registration tab (automatically assigned teacher role)
2. Login with your username and password
3. View all training weeks in read-only mode
4. Click accordion triggers to expand week details
5. View competency focus, objectives, and presentation files
6. Download presentation files by clicking the file links
7. No edit, delete, or upload capabilities (view-only access)

### Creating Additional Admin Accounts
Admin accounts cannot be created through the web interface. To create a new admin:
1. Generate a hashed password using the scrypt algorithm
2. Insert directly into the database with role='admin'
3. Example SQL (replace with your values):
   ```sql
   INSERT INTO users (username, password, email, role)
   VALUES ('newadmin', 'hashed_password_here', 'admin@example.com', 'admin');
   ```

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
- `PRIVATE_OBJECT_DIR` - Directory path for private object storage
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Object storage bucket ID

## Recent Changes

### 2025-10-14: Multi-File Upload Support
- **Database Schema Update**:
  - Migrated from single file columns (deckFileName, deckFileUrl, deckFileSize) to jsonb array
  - Added deck_files column to store multiple files per training week
  - Each file has: id (UUID), fileName, fileUrl, fileSize
  - Database schema synchronized with `npm run db:push --force`
- **Backend API Updates**:
  - POST /api/training-weeks/:id/deck now accepts array of files
  - DELETE /api/training-weeks/:id/deck/:fileId for individual file deletion
  - Added comprehensive debug logging for upload flow
- **Frontend UI Changes**:
  - Updated ObjectUploader to support maxNumberOfFiles=10
  - Display all uploaded files as clickable links with individual delete buttons
  - Each file shows name, size, and delete button (admin only)
  - Upload button text changed to "Upload Deck Files"

### 2025-10-14: Migration to Username/Password Authentication
- **Authentication System Overhaul**:
  - Migrated from Replit Auth (OIDC) to traditional username/password authentication
  - Implemented Passport.js Local Strategy for authentication
  - Scrypt password hashing with per-user salt for maximum security
  - Public teacher registration with automatic "teacher" role assignment
  - Admin accounts created manually in database only (no public sign-up)
  - Created tabbed auth page with separate login and registration forms
  - Built AuthProvider with useAuth hook for frontend authentication state
  - Implemented ProtectedRoute component for route protection
  - PostgreSQL session storage with connect-pg-simple
- **Database Schema Updates**:
  - Added username and password fields to users table
  - Removed OIDC-specific fields (no longer needed)
  - Username is unique and required
  - Password stored as hashed string with salt
- **Admin Account Setup**:
  - Created first admin account: username "admin", email "admin@silverleaf.com"
  - Password: "SecureAdmin123!" (can be changed by user)
  - Future admin accounts must be created via direct database insertion

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
- Username/password authentication (no external auth providers)
- Role-based access control with manual admin creation for security
- Public teacher registration for easy onboarding
- Responsive design for all devices
- Keyboard accessibility for all interactions
- Dark mode support
