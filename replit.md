# Silver Leaf Training Program Planner

## Overview
A web application for Silver Leaf to organize and manage their teacher training program. The app provides a clean table-based interface for planning training weeks with competency focus, objectives, and presentation files for 2024 and 2025.

## Features
- **Training Week Management**: Add, edit, and delete training weeks
- **Inline Editing**: Click-to-edit cells for Competency Focus and Objective columns
- **File Uploads**: Upload presentation files (PowerPoint, PDF, Keynote) for 2024 and 2025 decks
- **File Display**: Uploaded files shown as clickable download links with file size
- **Clean Table UI**: Simple, modern table layout with responsive design
- **Dark Mode**: Toggle between light and dark themes

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, TypeScript
- **Storage**: In-memory storage (MemStorage)
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
│   │   │   └── home.tsx              # Main page with training weeks table
│   │   └── lib/
│   │       └── queryClient.ts        # React Query setup
├── server/
│   ├── routes.ts                     # API routes
│   ├── storage.ts                    # In-memory storage implementation
│   └── objectStorage.ts              # Object storage service
└── shared/
    └── schema.ts                     # Shared types and schemas
```

## API Routes
- `GET /api/training-weeks` - Get all training weeks
- `POST /api/training-weeks` - Create a new training week
- `PATCH /api/training-weeks/:id` - Update a training week
- `DELETE /api/training-weeks/:id` - Delete a training week
- `POST /api/objects/upload` - Get presigned URL for file upload
- `POST /api/training-weeks/:id/deck` - Update deck file after upload
- `GET /objects/:objectPath` - Download uploaded files

## Data Model
```typescript
{
  id: string;
  weekNumber: number;
  competencyFocus: string;
  objective: string;
  deck2024FileName?: string | null;
  deck2024FileUrl?: string | null;
  deck2024FileSize?: number | null;
  deck2025FileName?: string | null;
  deck2025FileUrl?: string | null;
  deck2025FileSize?: number | null;
}
```

## How to Use
1. Click "Add New Week" to create a new training week row
2. Click on Competency Focus or Objective cells to edit inline (press Enter to save)
3. Click the "Upload" button in the 2024 Deck or 2025 Deck column to upload presentation files
4. Uploaded files appear as clickable links with file size displayed
5. Click the delete (trash) icon to remove a training week (requires confirmation)

## Environment Variables
- `PRIVATE_OBJECT_DIR` - Directory path for private object storage
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Object storage bucket ID

## Recent Changes
- 2024-10-14: Initial implementation of Training Program Planner
  - Created table-based UI for managing training weeks
  - Implemented inline editing for Competency Focus and Objective
  - Added file upload functionality for 2024 and 2025 presentation decks
  - Integrated Replit Object Storage for file persistence
  - Added dark mode support
  - **Fixed critical inline editing focus bug**: Input fields now maintain focus during editing
    - Changed to direct cache updates (`setQueryData`) instead of query invalidation
    - Added `isSavingRef` tracking to prevent blur handler interference during intentional saves
    - Blur handler refocuses only on unintentional blurs (from re-renders)
    - Error handling resets focus flag on save failures
