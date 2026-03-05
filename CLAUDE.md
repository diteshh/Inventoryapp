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

Copy `frontend/.env.example` to `frontend/.env` and fill in the keys.
Get the Supabase anon key from the team lead or Supabase Dashboard.

```
EXPO_PUBLIC_SUPABASE_URL=https://ovahczsudvwcuwvmapyi.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<get-from-team-lead>
EXPO_PUBLIC_BACKEND_URL=http://localhost:3002
```

## Supabase Project

- **Project:** Inventory App (`ovahczsudvwcuwvmapyi`)
- **Region:** West EU (Ireland)
- **Dashboard:** https://supabase.com/dashboard/project/ovahczsudvwcuwvmapyi
- **Schema migration:** `supabase/migrations/20260301000000_full_schema.sql`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92YWhjenN1ZHZ3Y3V3dm1hcHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDU3ODYsImV4cCI6MjA4NjQyMTc4Nn0.4lnMjqZ1EjZ2zqjonlW_AijqMknH6qNrO-PtoMfZNZQ`
- **Service role key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92YWhjenN1ZHZ3Y3V3dm1hcHlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTc4NiwiZXhwIjoyMDg2NDIxNzg2fQ.-PafXvhPu5GvpSri27np60hw1mdiLz9duL3YDjLzARw`
- **Personal access token:** `sbp_a07e155ce979761aa62984a53bc7eb10b6cdd923`

## Database Tables (Supabase)

- `items` — inventory items (name, SKU, barcode, quantity, pricing, location, photos)
- `folders` — hierarchical storage (supports nesting via parent_folder_id)
- `tags` / `item_tags` — item categorization (many-to-many)
- `pick_lists` / `pick_list_items` — warehouse picking workflow with status tracking
- `profiles` — user profiles (role, PIN hash, avatar, linked to Supabase Auth)
- `activity_log` — audit trail for all actions
- `pick_list_comments` — team collaboration on pick lists
- `teams` — team/organization (id, name, created_by)
- `team_members` — user-team membership (team_id, user_id, role: owner/admin/member)
- `team_invites` — invite codes for joining teams (invite_code, expires_at, used_by)
- `stock_counts` / `stock_count_items` — physical inventory verification
- `purchase_orders` / `purchase_order_items` — supplier order tracking
- `transactions` — inventory transaction history

RLS is enabled on all tables with team-based isolation. Users see team data OR their own personal data.
Storage bucket `item-photos` is set up for item photo uploads.

## Coding Conventions

### Components
- Functional components with hooks
- `useAuth()` for auth context, `useTeam()` for team context, `useLocalSearchParams()` for route params
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
- Log user actions: `logActivity(userId, 'action_type', { itemId, details, teamId })`
- Action types: `item_created`, `item_updated`, `item_deleted`, `pick_list_created`, etc.

### Multi-Tenancy
- All INSERT operations must pass `team_id: teamId ?? null` (from `useTeam()`)
- Folder and tag inserts must also pass `created_by: user?.id ?? null`
- RLS handles read/update/delete filtering automatically — no query changes needed
- Users without a team see only their own personal data (team_id IS NULL)

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
- Team-based multi-tenancy with role-based permissions (owner/admin/member)
- Stock Counts — **Coming Soon** (UI disabled)
- Purchase Orders — **Coming Soon** (UI disabled)

## Quality Checks

```bash
cd frontend && npm run typecheck    # TypeScript
cd frontend && npm run lint         # ESLint + Prettier
cd backend && npm run typecheck
cd backend && npm run lint
```

## Running Migrations

```bash
cd "/Users/shrey/Documents/Inventory App/Inventoryapp" && SUPABASE_ACCESS_TOKEN=sbp_a07e155ce979761aa62984a53bc7eb10b6cdd923 supabase db push <<< "Y"
```

## Running Direct SQL Queries

```bash
curl -s "https://api.supabase.com/v1/projects/ovahczsudvwcuwvmapyi/database/query" \
  -H "Authorization: Bearer sbp_a07e155ce979761aa62984a53bc7eb10b6cdd923" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR SQL HERE"}'
```

## Creating Users (Auth Admin API)

```bash
curl -s "https://ovahczsudvwcuwvmapyi.supabase.co/auth/v1/admin/users" \
  -H "apikey: <service_role_key>" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -X POST \
  --data-raw '{"email":"...","password":"...","email_confirm":true}'
```
Note: escape `!` in passwords using `\u0021`

## Users & Teams (as of 2026-03-05)

| Email | User ID | Team | Role |
|-------|---------|------|------|
| diteshpatel52@gmail.com | 352a07f8-8a9d-4586-b45a-e9764d171c4e | My Team | owner |
| patelshrey12@gmail.com | 494b4694-2f8b-4b41-8d8d-e8e864f413a8 | My Team | member |
| admin@admin.com | 06be13e2-b396-402f-99f1-b1d7b8801755 | None | owner (profile role) |

- **admin@admin.com password:** `Admin123!`
- **My Team ID:** `ee37dc2e-1a10-4fd6-a8e7-d338666771a0`
- Users can only be in 1 team at a time (UNIQUE constraint on team_members.user_id)

## Multi-Tenancy Architecture

- `team_id` column on 11 data tables (nullable — supports personal data)
- RLS policies enforce team isolation via `get_user_team_ids()` SECURITY DEFINER function
- Personal data pattern: `(team_id IS NULL AND created_by = auth.uid())`
- Team data pattern: `(team_id IN (SELECT get_user_team_ids()))`
- `lib/team-context.tsx` — TeamProvider with createTeam, joinTeam, leaveTeam, generateInviteCode
- `lib/permissions.ts` — reads role from `useTeam()` (team_members) instead of profiles
- `app/team.tsx` — NoTeamView (create/join) + TeamMembersView (members list, role management, invite)
- team_members.user_id has FK to both auth.users AND profiles (needed for PostgREST join)

### Migrations (all pushed)

1. `20260305000000_multi_tenancy.sql` — core tables, team_id columns, RLS, backfill
2. `20260305000001_fix_team_rls.sql` — fix chicken-and-egg RLS for team creation
3. `20260305000002_allow_personal_data.sql` — make team_id nullable, personal data RLS
4. `20260305000003_team_members_profiles_fk.sql` — FK for PostgREST profiles join
5. `20260305000004_one_team_per_user.sql` — unique constraint on user_id

## Workflows Status

- **Pick Lists:** Active/functional
- **Stock Counts:** Coming Soon (disabled on workflows page)
- **Purchase Orders:** Coming Soon (disabled on workflows page)
