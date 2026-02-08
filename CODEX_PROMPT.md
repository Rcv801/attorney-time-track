# Codex Prompt: Attorney Time Track — Phase 1 Implementation

## Project Overview

**Repository:** `Rcv801/attorney-time-track`  
**Local path:** `/Users/atlasbot3000/.openclaw/workspace/attorney-time-track`  
**Live preview:** https://attorney-time-track.vercel.app/  
**Stack:** React + TypeScript + Vite + Supabase + shadcn/ui + Tailwind  
**Supabase project:** `ibvmcjzhnkkgizagjmuo`  

This is a lean time tracking & billing app for solo attorneys. The tagline is "Track time. Send invoices. Get paid. Nothing else." We intentionally avoid the bloat of competitors like Clio/MyCase.

---

## Current State

### What's Already Built ✅

**Timer & Time Entry:**
- Running timer with start/stop/pause/resume in `Dashboard.tsx`
- Manual entry form in `EntryFormDialog.tsx`
- Popout timer window at `/popout/timer` in `TimerPopout.tsx`
- Stop timer dialog that prompts for notes in `StopTimerDialog.tsx`

**Data Model (Current):**
- `clients` table: id, name, color, hourly_rate, archived, user_id, notes
- `entries` table: id, client_id, start_at, end_at, duration_sec, notes, user_id, billed, invoice_id, archived, paused_at, total_paused_seconds

**Pages:**
- `/` — Index (landing)
- `/login` — Auth
- `/app/dashboard` — Timer + today's entries
- `/app/clients` — Client management
- `/app/entries` — Full entry history with filters, CSV export
- `/app/invoices` — Invoice list
- `/app/reports` — Reports page (placeholder)
- `/app/settings` — Settings page
- `/popout/timer` — Timer popout window

**Key Files:**
- `src/pages/app/Dashboard.tsx` — Main timer interface
- `src/pages/app/Clients.tsx` — Client management
- `src/pages/app/Entries.tsx` — Entry history
- `src/components/EntryFormDialog.tsx` — Add/edit entry form
- `src/components/StopTimerDialog.tsx` — Stop timer with notes
- `src/integrations/supabase/types.ts` — TypeScript types
- `src/integrations/supabase/client.ts` — Supabase client

---

## What Needs to Be Built (Phase 1)

### 1. Matters Data Model

**The Problem:** Currently time entries attach directly to clients. Attorneys track time per *matter* (case), not per client. One client can have multiple active matters.

**New Schema:**

```sql
-- matters table
CREATE TABLE matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Contract Dispute 2024"
  matter_number TEXT, -- e.g., "2024-001" (attorneys reference these)
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'closed'
  hourly_rate DECIMAL(10,2), -- optional override of client rate
  flat_fee DECIMAL(10,2), -- for flat fee matters
  billing_type TEXT DEFAULT 'hourly', -- 'hourly' | 'flat_fee'
  trust_balance DECIMAL(10,2) DEFAULT 0, -- retainer balance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update entries table to reference matters instead of clients
-- (You'll need to migrate existing data or create new column)
ALTER TABLE entries ADD COLUMN matter_id UUID REFERENCES matters(id) ON DELETE CASCADE;
```

**Requirements:**
- Each matter belongs to one client
- Matter has: name, matter_number (optional), status (active/closed), billing_type (hourly/flat_fee)
- If hourly: use matter's hourly_rate or fall back to client's rate
- If flat_fee: use flat_fee amount, track time but don't auto-bill by hour
- Update `entries` table to reference `matter_id` instead of (or in addition to) `client_id`

**New/Moved Pages:**
- Move timer UI from Dashboard to `/app/timer` (make Dashboard an overview page)
- Create `/app/matters` — List all matters with client, status, unbilled time
- Create `/app/matters/[id]` or use a sheet/dialog — Matter detail/edit

**UI Flow:**
1. User creates a client (existing flow)
2. User creates a matter under that client
3. When starting timer, user selects matter (not just client)
4. Time entry records `matter_id`
5. Entries page shows matter name alongside client

### 2. Six-Minute Increment Rounding

**Legal Standard:** Attorneys bill in 0.1 hour increments (6 minutes). 1-6 minutes = 0.1 hr, 7-12 minutes = 0.2 hr, etc.

**Implementation:**
- When displaying duration, round UP to nearest 6 minutes
- Store actual duration in `duration_sec` (for accuracy)
- Display rounded duration in UI
- Use rounded duration for billing calculations

**Formula:**
```typescript
function roundToSixMinutes(seconds: number): number {
  const minutes = seconds / 60;
  const tenths = Math.ceil(minutes / 6) / 10; // Round up to nearest 0.1
  return Math.max(tenths, 0.1); // Minimum 0.1 hr
}

// Usage: roundToSixMinutes(185) // 3 min 5 sec → 0.1 hr
// Usage: roundToSixMinutes(365) // 6 min 5 sec → 0.2 hr
```

**Where to apply:**
- Timer display ("So far: $45.00" should use rounded time)
- Today's entries list
- Entries page duration display
- Invoice generation (when we build it)

### 3. Quick-Switch Timer

**Current Behavior:** Starting a new timer requires: stop current → add notes → select client → start new

**Desired Behavior:** Tap a different matter → current timer auto-stops with empty or default notes → new timer starts on selected matter

**Implementation:**
- In the timer UI, show list of active matters as buttons/chips
- Clicking a matter:
  1. If timer running on different matter: stop it (with optional notes prompt or just save empty)
  2. Start new timer on selected matter
- Always-visible matter selector (not hidden in dropdown)

**UI Pattern:**
```
[MATTER 1: Active Case]  [MATTER 2: Contract Review]  [MATTER 3: Deposition Prep]
        ↑ currently running (highlighted)
        
Click MATTER 2 → stop MATTER 1 → start MATTER 2
```

---

## Technical Notes

### Database Changes via Supabase

1. Create new migration in Supabase dashboard OR use local Supabase CLI
2. If modifying existing tables, consider data migration strategy
3. Update Row Level Security (RLS) policies for new matters table

### TypeScript Types

Update `src/integrations/supabase/types.ts` with new types after schema changes.

### State Management

- Uses React Query (TanStack Query) for server state
- `useQuery` for fetching data
- `useMutation` for mutations
- Invalidate queries after mutations:
  ```typescript
  qc.invalidateQueries({ queryKey: ["entries"] });
  qc.invalidateQueries({ queryKey: ["active-entry"] });
  ```

### shadcn/ui Components Available

Check `src/components/ui/` — all standard shadcn components are installed:
- Button, Card, Dialog, Sheet, Select, Input, Textarea, etc.
- Use these for consistency

### Existing Patterns to Follow

**Query pattern:**
```typescript
const { data: clients } = useQuery({
  queryKey: ["clients"],
  queryFn: async () => {
    const { data, error } = await supabase.from("clients").select("*").order("name");
    if (error) throw error;
    return data;
  },
});
```

**Mutation pattern:**
```typescript
const startMut = useMutation({
  mutationFn: async () => { /* supabase call */ },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["active-entry"] });
  },
});
```

**Auth check:**
```typescript
const { user } = useAuth(); // from src/hooks/useAuth.tsx
if (!user) throw new Error("Not authenticated");
```

---

## File Structure to Create/Modify

**New files:**
- `src/pages/app/Matters.tsx` — Matters list page
- `src/components/MatterFormDialog.tsx` — Add/edit matter form
- `src/components/MatterSelector.tsx` — Quick-switch matter buttons

**Modify:**
- `src/App.tsx` — Add routes for /app/matters
- `src/pages/app/Dashboard.tsx` — Refactor to overview, move timer to new page
- `src/pages/app/Timer.tsx` — New dedicated timer page with quick-switch
- `src/pages/app/Entries.tsx` — Show matter name in entries list
- `src/components/EntryFormDialog.tsx` — Select matter instead of client
- `src/integrations/supabase/types.ts` — Update types

---

## Design Principles (Follow These)

1. **Minimal clicks** — Attorneys context-switch constantly. Every extra click loses them.
2. **Mobile-first** — Many time entries happen on phone in court or traveling.
3. **No bloat** — If it's not time tracking, billing, or trust accounting, question whether it belongs.
4. **Professional but simple** — Invoices should look legit, but UI shouldn't feel enterprise-y.
5. **Transparent** — Show running totals, trust balances, unbilled amounts clearly.

---

## Testing Checklist

After implementation, verify:
- [ ] Can create a matter under a client
- [ ] Can start timer on a matter
- [ ] Can quick-switch between matters
- [ ] Time rounds to 6-minute increments correctly (1-6 min = 0.1, 7-12 min = 0.2, etc.)
- [ ] Billing amount uses rounded time
- [ ] Entries list shows matter name
- [ ] Timer popout still works
- [ ] Manual entry form works with matters
- [ ] Existing data (if any) is migrated or handled gracefully

---

## Questions to Resolve

1. **Data migration:** If entries currently have `client_id`, should we:
   - Add `matter_id` and make it nullable (graceful migration)
   - Create a default matter for each existing client?
   - Or just start fresh (it's pre-launch)?

2. **Timer notes on quick-switch:**
   - Require notes before switching?
   - Auto-save with empty notes and let them edit later?
   - Show quick text input inline?

3. **Client vs Matter selector:**
   - Select client first, then matter?
   - Or flat list of "Client — Matter" combined?

---

## Resources

- **Supabase docs:** https://supabase.com/docs
- **shadcn/ui docs:** https://ui.shadcn.com
- **TanStack Query:** https://tanstack.com/query/latest
- **Existing research:** `research/competitor-analysis.md`, `research/reddit-pain-points.md`
- **Product roadmap:** `ROADMAP.md`

---

## Success Criteria

A solo attorney should be able to:
1. Create a client "Acme Co."
2. Create matters "Contract Dispute" and "IP Licensing" under that client
3. Start timer on "Contract Dispute"
4. Work for 8 minutes, switch to "IP Licensing" with one tap
5. See rounded time (0.2 hr) and billing amount
6. View entries list showing both matters
7. Trust that the math is correct

---

**Good luck! Questions? Ask the human.**
