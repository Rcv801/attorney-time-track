# 11 — Onboarding Flow Specification

*Phase 2 Spec — Created February 18, 2026*

---

## Goal

New user goes from "never heard of us" to "tracking time on a real matter" in **under 5 minutes**. No demos. No sales calls. No 7-step wizards with spinning loading icons.

---

## Flow Overview

```
Landing Page → Sign Up → Firm Setup → First Client + Matter → Dashboard (Timer Ready)
   (30s)        (30s)      (60s)           (60s)               (30s = tracking!)
```

Total time: ~3 minutes for engaged users. Under 5 for everyone.

---

## Step 0: Sign Up (`/signup`)

### Screen
```
┌─────────────────────────────────────┐
│                                     │
│         Start tracking in           │
│          under 5 minutes.           │
│                                     │
│  Email    [                       ] │
│  Password [                       ] │
│                                     │
│  [     Create Account     ]         │
│                                     │
│  ── or ──                           │
│                                     │
│  [G] Continue with Google           │
│                                     │
│  Already have an account? Log in    │
│                                     │
│  By signing up you agree to our     │
│  Terms of Service and Privacy Policy│
└─────────────────────────────────────┘
```

### Validation
- Email: valid format, not already registered
- Password: minimum 8 characters
- Google OAuth: auto-creates account

### After signup
- Account created in Supabase Auth
- Profile row created
- Redirect to `/onboarding/setup`

---

## Step 1: Firm Setup (`/onboarding/setup`)

### Screen
```
┌─────────────────────────────────────────┐
│                                         │
│  Welcome! Let's set up your practice.   │
│  Step 1 of 2                            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Your Name                       │    │
│  │ [Ryan Vantrease              ]  │    │
│  │                                 │    │
│  │ Firm Name                       │    │
│  │ [Vantrease Law PLLC          ]  │    │
│  │                                 │    │
│  │ Hourly Rate                     │    │
│  │ [$  300                      ]  │    │
│  │ You can set different rates per │    │
│  │ client or matter later.         │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [         Continue →         ]         │
│                                         │
│  Skip for now →                         │
│                                         │
└─────────────────────────────────────────┘
```

### Fields
| Field | Required | Validation | Default |
|-------|----------|------------|---------|
| Your Name | ✅ | Min 2 chars | From Google profile if OAuth |
| Firm Name | ❌ | None | Empty (solo = just their name) |
| Hourly Rate | ✅ | > 0, max $9999 | $300 (common solo rate) |

### Skip behavior
- Skips to Step 2 with defaults: name = email prefix, rate = $300
- Settings page accessible later to fill in details

### On continue
- Creates/updates `user_settings` row
- Creates `invoice_sequences` row with default prefix

---

## Step 2: First Client & Matter (`/onboarding/first-client`)

### Screen
```
┌─────────────────────────────────────────┐
│                                         │
│  Now let's add your first client.       │
│  Step 2 of 2                            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Client Name                     │    │
│  │ [Acme Corporation            ]  │    │
│  │                                 │    │
│  │ Matter Name                     │    │
│  │ [Smith v. Jones              ]  │    │
│  │ A matter is a case, project,    │    │
│  │ or engagement you're tracking   │    │
│  │ time for.                       │    │
│  │                                 │    │
│  │ Client Rate (optional)          │    │
│  │ [$  300                      ]  │    │
│  │ Leave blank to use your         │    │
│  │ default rate ($300/hr).         │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [       Start Tracking →       ]       │
│                                         │
│  I'll add clients later →               │
│                                         │
└─────────────────────────────────────────┘
```

### Fields
| Field | Required | Validation | Default |
|-------|----------|------------|---------|
| Client Name | ✅ | Min 1 char | Empty |
| Matter Name | ✅ | Min 1 char | Empty |
| Client Rate | ❌ | >= 0 if provided | User's default rate |

### Skip behavior
- Goes directly to Dashboard
- Empty state on Dashboard prompts to add first client

### On "Start Tracking"
- Creates client record
- Creates matter record (linked to client)
- Pins the matter for quick access
- Redirects to Dashboard
- Timer auto-starts on the new matter (!!!)
  - This is the magic moment: they're tracking real time within 3 minutes of signup

---

## Post-Onboarding: Dashboard

### First-time Dashboard State
```
┌─────────────────────────────────────────┐
│                                         │
│  🎉 You're all set!                    │
│                                         │
│  Timer is running for:                  │
│  Acme Corporation — Smith v. Jones      │
│  ⏱ 00:00:12  [$0.00]  [⏸ Pause] [⏹]  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Quick tips:                     │    │
│  │ • Press ⌘K to search & switch   │    │
│  │ • Pin matters for quick access  │    │
│  │ • Add notes when you stop       │    │
│  │                                 │    │
│  │ [Got it, dismiss]               │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ... rest of Dashboard ...              │
│                                         │
└─────────────────────────────────────────┘
```

The quick tips card shows once, dismisses permanently (stored in localStorage).

---

## Technical Implementation

### Onboarding State Tracking

```typescript
// Track onboarding progress in user_settings or localStorage
interface OnboardingState {
  completed: boolean;
  currentStep: 'setup' | 'first-client' | 'done';
  skippedSteps: string[];
}

// In App.tsx router:
// If !onboarding.completed → redirect to /onboarding/setup
// If onboarding.completed → normal routing
```

### Route Guard

```tsx
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: settings } = useQuery({ queryKey: ['user-settings'], ... });
  
  if (!settings?.onboarding_completed) {
    return <Navigate to="/onboarding/setup" />;
  }
  
  return <>{children}</>;
}
```

### Auto-Start Timer After Onboarding

```typescript
// After creating first client + matter:
// 1. Create the records
// 2. Set onboarding_completed = true
// 3. Navigate to /dashboard
// 4. Dispatch timer start for the new matter
//    (use the existing Timer component's start mechanism)
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User refreshes during onboarding | Resume at current step (state in DB) |
| User signs up with Google | Pre-fill name from Google profile |
| User skips all steps | Dashboard shows empty state with "Add your first client" CTA |
| User has multiple devices | Onboarding state synced via user_settings table |
| User returns after partial onboarding | Resume at last incomplete step |
| Rate = 0 | Allow it (pro bono / contingency attorneys exist) |
| Very long firm name | Truncate in UI, full name stored |

---

## Metrics to Track

| Metric | Target |
|--------|--------|
| Signup → First time entry | < 5 minutes |
| Signup → Onboarding complete | > 80% completion |
| Step 1 skip rate | < 20% |
| Step 2 skip rate | < 30% |
| First-week retention | > 60% |
| Time to first invoice | < 7 days |
