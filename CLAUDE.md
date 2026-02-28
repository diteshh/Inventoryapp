# Imperial Inventory App

Inventory management app for warehouses/businesses with barcode scanning, pick lists, and team collaboration.

## Tech Stack

- **Frontend:** React Native 0.81 + Expo 54 + TypeScript
- **Routing:** Expo Router v6 (file-based)
- **Styling:** NativeWind (Tailwind CSS for RN) + inline styles for dynamic colors
- **State:** React Context API (auth), useState hooks (local)
- **Backend:** Hono on Bun (port 3002) — currently minimal, ready to expand
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth (email/password) + biometric/PIN app lock
- **Storage:** Supabase Storage (item photos)

## Project Structure

```
frontend/
├── app/                    # Expo Router pages
│   ├── (auth)/login.tsx    # Login screen
│   ├── (tabs)/             # 5 tabs: Home, Inventory, Scanner, Pick Lists, More
│   ├── item/               # Add/edit/view items
│   ├── pick-list/          # Pick list operations
│   └── _layout.tsx         # Root layout (ErrorBoundary, AuthProvider)
├── lib/
│   ├── api.ts              # Backend fetch wrapper
│   ├── auth-context.tsx    # Auth context & session management
│   ├── supabase.ts         # Supabase client init
│   ├── types.ts            # Generated Supabase types
│   ├── theme.ts            # COLORS constant (Navy/Teal palette)
│   ├── utils.ts            # Formatting, logging helpers
│   └── haptics.ts          # Haptic feedback
├── components/ui/          # Reusable UI components
└── assets/                 # Images, icons, splash

backend/
├── src/index.ts            # Hono server entry point
├── build.js                # esbuild config
└── scripts/                # ngrok setup
```

## Running the App

```bash
# Install deps
cd frontend && bun install && cd ../backend && bun install

# Run both frontend + backend
npm run dev

# Run separately
npm run backend          # Backend on port 3002
npm run app              # Expo dev server

# Mobile testing with tunnel
npm run dev:tunnel       # Backend + ngrok for public URL
```

## Environment Variables

Frontend `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=<supabase_project_url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase_anon_key>
EXPO_PUBLIC_BACKEND_URL=http://localhost:3002
```

## Database Tables (Supabase)

- `items` — inventory items (name, SKU, barcode, quantity, pricing, location, photos)
- `folders` — hierarchical storage (supports nesting via parent_folder_id)
- `tags` / `item_tags` — item categorization (many-to-many)
- `pick_lists` / `pick_list_items` — warehouse picking workflow with status tracking
- `profiles` — user profiles (role, PIN hash, avatar)
- `activity_log` — audit trail for all actions
- `pick_list_comments` — team collaboration on pick lists

## Coding Conventions

### Components
- Functional components with hooks
- `useAuth()` for auth context, `useLocalSearchParams()` for route params
- `router.push()` / `router.back()` for navigation

### Styling
- Use Tailwind classes via `className` for layout
- Use inline `style` with `COLORS` from `@/lib/theme` for dynamic/theme colors
- Always import colors: `import { COLORS } from '@/lib/theme'`

### Data Fetching
- Direct Supabase client calls from components
- Pattern: `const { data, error } = await supabase.from('table').select()`
- Always check `if (error) throw error` after queries

### Error Handling
- Wrap async ops in try/catch
- Show `Alert.alert('Error', 'message')` to user
- `console.error` for logging

### Activity Logging
- Log user actions: `logActivity(userId, 'action_type', { itemId, details })`
- Action types: `item_created`, `item_updated`, `item_deleted`, `pick_list_created`, etc.

### Path Alias
- Use `@/` to reference project root (e.g., `import { COLORS } from '@/lib/theme'`)

## Key Features

- Multi-platform (iOS, Android, Web)
- Barcode/QR scanning with native camera
- Multi-photo upload for items
- Hierarchical folder organization
- Search across name, SKU, barcode
- Pick list workflow (draft > ready > in_progress > complete)
- Low stock alerts and inventory analytics
- Biometric + PIN authentication
- Activity audit trail
- Dark theme (Navy/Teal)
- Haptic feedback

## Quality Checks

```bash
cd frontend && npm run typecheck    # TypeScript
cd frontend && npm run lint         # ESLint + Prettier
cd backend && npm run typecheck
cd backend && npm run lint
```
