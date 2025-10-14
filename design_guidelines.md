# Silver Leaf Presentation Manager - Design Guidelines

## Design Approach
**Selected System**: Material Design-inspired productivity application
**Rationale**: This internal tool prioritizes efficiency, clarity, and usability. Material Design principles provide clear visual hierarchy, intuitive interactions, and familiar patterns that reduce learning curve for teachers managing their presentations.

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Primary: 220 60% 50% (Professional blue for primary actions and branding)
- Background: 0 0% 98% (Soft off-white for reduced eye strain)
- Surface: 0 0% 100% (Pure white for cards and elevated elements)
- Text Primary: 220 15% 20% (Dark slate for main content)
- Text Secondary: 220 10% 45% (Medium gray for supporting text)
- Border: 220 15% 88% (Subtle borders for separation)
- Success: 142 76% 36% (Green for upload success)
- Destructive: 0 72% 51% (Red for delete actions)

**Dark Mode:**
- Primary: 220 70% 60% (Lighter blue for contrast)
- Background: 220 18% 12% (Deep navy background)
- Surface: 220 15% 16% (Elevated dark surface)
- Text Primary: 220 15% 95% (Off-white for readability)
- Text Secondary: 220 10% 70% (Light gray for secondary content)
- Border: 220 15% 25% (Subtle dark borders)

### B. Typography
- **Primary Font**: 'Inter' or 'Roboto' via Google Fonts CDN
- **Headings**: 
  - H1: 2.25rem (36px), font-weight 700, letter-spacing -0.02em
  - H2: 1.5rem (24px), font-weight 600
  - H3: 1.25rem (20px), font-weight 600
- **Body Text**: 1rem (16px), font-weight 400, line-height 1.6
- **Small/Meta**: 0.875rem (14px), font-weight 400

### C. Layout System
**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, and 16 for consistent rhythm
- Container padding: p-6 (mobile), p-8 (tablet), p-12 (desktop)
- Card spacing: p-6 with gap-4 between elements
- Section spacing: mt-8 to mt-12 for major sections
- Button padding: px-6 py-3 for primary actions

**Grid System**:
- Upload section: Full-width centered container (max-w-4xl)
- Presentation grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Responsive breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)

### D. Component Library

**Upload Section**:
- Prominent drag-and-drop zone with dashed border (border-2 border-dashed)
- Large upload icon from Heroicons (document-arrow-up, w-16 h-16)
- Primary CTA button: "Upload Presentation" with px-8 py-4, rounded-lg
- Supported formats text below: "Supports: .pptx, .ppt, .pdf, .key (Max 50MB)"
- Visual feedback: border color change on drag-over state

**Presentation Cards**:
- Elevated surface with subtle shadow (shadow-md hover:shadow-lg transition)
- Card structure:
  - File icon with extension badge (document-text from Heroicons)
  - Presentation title (truncate with ellipsis if needed)
  - Metadata row: Upload date and file size in small text
  - Action buttons row: Edit (pencil icon) and Delete (trash icon) buttons
- Rounded corners: rounded-xl
- Border: 1px solid border color in light mode, subtle glow in dark mode

**Navigation Header**:
- Fixed top bar with Silver Leaf logo/name on left
- Height: h-16
- Subtle bottom border
- Background: surface color with backdrop-blur-sm for depth

**Buttons**:
- Primary: Solid fill with primary color, white text, rounded-lg
- Secondary/Destructive: Use outline variant with appropriate color
- Icon buttons: Square (w-10 h-10), rounded-md, hover:bg-surface transition
- All buttons: Use Heroicons for consistent iconography

**Modals/Dialogs**:
- Edit modal: Centered overlay with max-w-md
- Input field with label above, helper text below
- Actions: Cancel (secondary) and Save (primary) buttons
- Delete confirmation: Alert dialog with warning icon, clear consequences text

**File Metadata Display**:
- Inline badge for file type (.pptx, .pdf, etc.) with rounded-full px-3 py-1
- Date format: "MMM DD, YYYY" or relative time ("2 hours ago")
- File size: Human-readable format (KB, MB)
- Status indicators: Use small colored dots for upload progress/success

### E. Interactions & States
- Hover states: Subtle elevation changes (shadow transitions) and slight scale (scale-105)
- Loading states: Skeleton loaders for card grid during fetch
- Empty state: Centered illustration/icon with encouraging message "Upload your first presentation"
- Error states: Toast notifications (top-right corner) with appropriate icons
- Focus states: Visible 2px ring with primary color offset
- Animations: Minimal - only for state transitions (300ms ease-in-out)

## Images
**No hero image required** - This is a utility application focused on functionality. The upload section serves as the visual anchor with clear iconography and call-to-action.

**File type icons**: Use Heroicons document variants with color-coded backgrounds:
- PowerPoint: Orange/red background tint
- PDF: Red background tint  
- Keynote: Blue background tint

## Accessibility & UX Considerations
- Consistent dark mode across all form inputs and text fields
- All interactive elements keyboard accessible (tab navigation)
- ARIA labels for icon-only buttons
- Error messages associated with form fields
- Loading indicators for file upload progress (percentage or spinner)
- Confirmation dialogs before destructive actions (delete)
- Success feedback after operations (toast or inline message)

## Visual Hierarchy Principles
1. Upload section dominates above-the-fold (primary action)
2. Presentation grid uses consistent card size for scanability
3. Visual weight through typography scale, not just color
4. Whitespace creates breathing room - generous padding in cards
5. Subtle borders and shadows for depth, not heavy lines