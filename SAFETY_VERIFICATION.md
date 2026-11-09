# Safety workflow verification

Verified November 9, 2026 against the PR #12 preview and its connected Supabase
project. The preview currently shares the production database. Both PR #12 and
the separate email PR #11 remain drafts and unmerged.

## Workflow results

| Workflow | Result | Evidence and limits |
| --- | --- | --- |
| Policy acceptance | PASS in automated checks and saved signup data | Unchecked submission is rejected by the actual signup handler in the automated test. A confirmed test signup saved policy version `2026-10-12` and its acceptance timestamp. The unchecked browser case was not separately recorded. |
| Profile reporting | PASS | A non-admin member submitted a profile report; it appeared in the administrator's Open queue. |
| Job reporting | PASS | The non-admin job report was persisted with entity type `job` and subsequently dismissed. |
| Administrator review | PASS | Reviewing and resolved states persisted after reload; existing private notes were preserved. Controlled reports were also dismissed. |
| Suspension | PASS | The administrator suspended the disposable member for 30 days. The existing member session was redirected to Account Access Paused with a generic category reason. |
| Restore | PASS after manual refresh | The administrator lifted the suspension; the same signed-in member regained dashboard access after refreshing. The database confirms a recorded lift and no active suspension. |
| Access control | PASS in browser and database checks | A non-admin opening the report queue directly saw no reports or private notes. Seventeen live SQL checks also verified anonymous/member restrictions, target validation, admin review, private notes, suspension enforcement and restore inside one rolled-back transaction. |

Expiry is covered by the automated SQL suite; natural expiry was not observed
in the browser. Private-note editing/clearing and failure handling also have
automated coverage beyond the manual saved-note check.

## Fixes following browser review

- Move profile and job reporting near the beginning of their detail pages; use
  a visible, keyboard-accessible report button and associated form labels.
- Add **Check access again** to the paused screen. It re-queries current access
  and returns restored members to their dashboard without signing out. Failed
  or malformed checks stay closed and offer retry.
- Guard both administrator routes before rendering their queue contents,
  headings or filter/action controls for non-admin members. Database policies
  and checked administration functions remain the underlying access boundary.

These UI changes require a targeted check on the new preview before merge.
Automated handler and rendering tests cover recheck/recovery and denied queues.

## Environment setup

Both reviewed security migrations are installed in production:

- `20261109165921_safety_moderation_hardening.sql`
- `20261109170012_reconcile_legacy_permissions.sql`

The original feature tables were installed through SQL Editor. Do not reapply
the original schema or bulk-push old migrations to reconcile partial history.
The initial 17 live checks rolled back all temporary records and preserved
existing record counts. Subsequent manual browser tests intentionally created
a disposable member and controlled reports; that member is restored and all
of today's controlled reports are resolved or dismissed.

Signup initially hit Supabase's built-in email sending limit. Custom SMTP was
configured with Resend using an already verified sending domain, and delivery,
email confirmation, sign-in and onboarding were verified with an owned test
mailbox. This verifies Auth email, independently of PR #11 notifications.

## Remaining release work

- Check the updated report placement, non-admin denial screen and access recheck
  button on the new preview; obtain release approval before merging PR #12.
- Assess/enable leaked-password protection, currently disabled, and establish an
  isolated staging database before broader testing or general launch.
- Retain both `test:safety` and `test:email` scripts when merging with PR #11.
- Finish PR #11's real transactional inbox/preferences checks and durable email
  handoff before general launch; signup SMTP setup does not complete those tests.
