/**
 * Forever Finds CMS — Access Control (Phase 9, RBAC UI).
 *
 * Admin-only page for assigning per-user CMS roles. Lives under the
 * "Site Management" group (parent route: /cms).
 *
 * ROLES (see role-helper.ts on the backend):
 *   admin  — full access (everything, incl. settings + role management)
 *   editor — read everything + write content (pages/sections/blog/media),
 *            but NOT settings writes and NOT role management
 *   viewer — read-only (GET); no writes; cannot see role management
 *
 * FAIL-SAFE: a user with NO explicit row defaults to "admin". Only an
 * explicit editor/viewer assignment downgrades. The backend guards the
 * last remaining admin from being downgraded.
 *
 * API CONTRACT (all under /admin/cms/*, cookie-session auth, credentials:include):
 *   GET    /admin/cms/roles            -> { roles:[{user_id,email,first_name,last_name,role,is_default}], count, default_role }
 *   PUT    /admin/cms/roles/:user_id   { role } -> 200 { role }
 *   DELETE /admin/cms/roles/:user_id   -> 200 { user_id, object:"cms_role", role:"admin", reset:true }
 *
 * Core user list/name resolution:
 *   GET    /admin/users?limit=1000     -> { users:[{id,email,first_name,last_name}], count }
 *   GET    /admin/users/me             -> { user:{id,...} }   (current user)
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { EllipsisHorizontal, Key, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  DropdownMenu,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type CmsRole = "admin" | "editor" | "viewer"

const ROLES: CmsRole[] = ["admin", "editor", "viewer"]
const DEFAULT_ROLE: CmsRole = "admin"

const ROLE_BADGE: Record<CmsRole, "purple" | "blue" | "grey"> = {
  admin: "purple",
  editor: "blue",
  viewer: "grey",
}

const ROLE_HINT: Record<CmsRole, string> = {
  admin: "Full access — content, settings and role management.",
  editor: "Edit content (pages, blog, media). No settings or roles.",
  viewer: "Read-only. Cannot make any changes.",
}

type RoleEntry = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: CmsRole
  is_default: boolean
}

type CoreUser = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const displayName = (u: {
  first_name: string | null
  last_name: string | null
  email: string | null
}) => {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim()
  return name || u.email || "Unknown user"
}

const isCmsRole = (v: unknown): v is CmsRole =>
  typeof v === "string" && (ROLES as string[]).includes(v)

/* ------------------------------------------------------------------ */
/* Create-user modal — add an admin user + CMS role, no email invite   */
/* ------------------------------------------------------------------ */

const CreateUserModal = ({ onCreated }: { onCreated: () => void }) => {
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<CmsRole>("editor")
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setFirstName("")
    setLastName("")
    setEmail("")
    setPassword("")
    setRole("editor")
  }

  const submit = async () => {
    if (!email.trim() || password.length < 8) {
      toast.error("Enter an email and a password of at least 8 characters.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/admin/cms/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error("Could not create user", {
          description: body?.message || `Error ${res.status}`,
        })
        return
      }
      // Assign the chosen CMS role (admin is the default, so only set editor/viewer).
      if (role !== "admin" && body?.user?.id) {
        await fetch(`/admin/cms/roles/${body.user.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }).catch(() => {})
      }
      toast.success("User created", {
        description: `${email.trim()} can now sign in as ${role}.`,
      })
      reset()
      setOpen(false)
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FocusModal open={open} onOpenChange={setOpen}>
      <FocusModal.Trigger asChild>
        <Button size="small" variant="secondary">
          Add user
        </Button>
      </FocusModal.Trigger>
      <FocusModal.Content>
        <FocusModal.Header>
          <Button
            size="small"
            onClick={submit}
            isLoading={submitting}
            disabled={submitting}
          >
            Create user
          </Button>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center py-16">
          <div className="flex w-full max-w-lg flex-col gap-y-4">
            <div>
              <Heading level="h2">Add a user</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Creates an admin account with a password (no email invite) and
                assigns its CMS role. Share the credentials with them directly.
              </Text>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-1">
                <Label size="small">First name</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                />
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small">Last name</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="flex flex-col gap-y-1">
              <Label size="small">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@yourstore.com"
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label size="small">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label size="small">CMS role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as CmsRole)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {ROLES.map((r) => (
                    <Select.Item key={r} value={r}>
                      {r} — {ROLE_HINT[r]}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const CmsAccessPage = () => {
  const [rows, setRows] = useState<RoleEntry[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const prompt = usePrompt()

  const load = async () => {
    setLoading(true)
    try {
      // Fetch the effective role list, the full core user list (for name
      // resolution in case the roles endpoint fell back to raw rows), and
      // the current user — in parallel.
      const [rolesRes, usersRes, meRes] = await Promise.all([
        fetch("/admin/cms/roles", { credentials: "include" }),
        fetch("/admin/users?limit=1000", { credentials: "include" }),
        fetch("/admin/users/me", { credentials: "include" }),
      ])

      if (!rolesRes.ok) {
        const body = await rolesRes.json().catch(() => ({}))
        throw new Error(
          body?.message || "You do not have permission to manage CMS access."
        )
      }

      const rolesBody = await rolesRes.json()
      const usersBody = usersRes.ok ? await usersRes.json() : { users: [] }
      const meBody = meRes.ok ? await meRes.json() : { user: null }

      setCurrentUserId(meBody?.user?.id ?? null)

      const coreUsers: CoreUser[] = Array.isArray(usersBody?.users)
        ? usersBody.users
        : []
      const userMap = new Map<string, CoreUser>(
        coreUsers.map((u) => [u.id, u])
      )

      const roleEntries: RoleEntry[] = Array.isArray(rolesBody?.roles)
        ? rolesBody.roles
        : []
      const seen = new Set<string>()

      // Start from the roles endpoint, enriching missing names from the
      // core user list (covers the raw-row fallback shape).
      const merged: RoleEntry[] = roleEntries.map((r) => {
        seen.add(r.user_id)
        const core = userMap.get(r.user_id)
        const role = isCmsRole(r.role) ? r.role : DEFAULT_ROLE
        return {
          user_id: r.user_id,
          email: r.email ?? core?.email ?? null,
          first_name: r.first_name ?? core?.first_name ?? null,
          last_name: r.last_name ?? core?.last_name ?? null,
          role,
          is_default: r.is_default ?? role === DEFAULT_ROLE,
        }
      })

      // Add any core admin users the roles endpoint did not return — they
      // have no explicit row, so they are full admins by default.
      for (const u of coreUsers) {
        if (seen.has(u.id)) {
          continue
        }
        merged.push({
          user_id: u.id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          role: DEFAULT_ROLE,
          is_default: true,
        })
      }

      merged.sort((a, b) =>
        displayName(a).localeCompare(displayName(b), undefined, {
          sensitivity: "base",
        })
      )

      setRows(merged)
    } catch (e: any) {
      setRows([])
      toast.error("Could not load CMS access", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Count of effective admins — used to prevent removing the last admin
  // from the UI before the request is even sent.
  const adminCount = useMemo(
    () => rows.filter((r) => r.role === "admin").length,
    [rows]
  )

  const changeRole = async (entry: RoleEntry, nextRole: CmsRole) => {
    if (nextRole === entry.role) {
      return
    }

    // Client-side guard mirroring the backend last-admin invariant.
    if (
      entry.role === "admin" &&
      nextRole !== "admin" &&
      adminCount <= 1
    ) {
      toast.error("Cannot remove the last admin", {
        description:
          "At least one user must keep the admin role. Assign another admin first.",
      })
      return
    }

    setSavingId(entry.user_id)

    // Optimistic update so the Select reflects the choice immediately.
    const prev = rows
    setRows((rs) =>
      rs.map((r) =>
        r.user_id === entry.user_id
          ? { ...r, role: nextRole, is_default: nextRole === DEFAULT_ROLE }
          : r
      )
    )

    try {
      let res: Response
      if (nextRole === DEFAULT_ROLE) {
        // Reset to default — removes the explicit row (idempotent).
        res = await fetch(`/admin/cms/roles/${entry.user_id}`, {
          method: "DELETE",
          credentials: "include",
        })
      } else {
        res = await fetch(`/admin/cms/roles/${entry.user_id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nextRole }),
        })
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || `Request failed (${res.status}).`)
      }

      toast.success("Role updated", {
        description: `${displayName(entry)} is now ${
          nextRole === DEFAULT_ROLE ? "an admin (default)" : `an ${nextRole}`
        }.`,
      })
    } catch (e: any) {
      // Roll back on failure (e.g. backend last-admin guard 403).
      setRows(prev)
      toast.error("Could not update role", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSavingId(null)
    }
  }

  const removeUser = async (entry: RoleEntry) => {
    // Client-side guards mirroring the backend (fail fast with a clear reason).
    if (entry.user_id === currentUserId) {
      toast.error("You cannot remove your own account.")
      return
    }
    if (entry.role === "admin" && adminCount <= 1) {
      toast.error("Cannot remove the last admin", {
        description: "Assign another admin first.",
      })
      return
    }

    const confirmed = await prompt({
      title: `Remove ${displayName(entry)}?`,
      description:
        "This permanently deletes their admin account. They will no longer be able to sign in. This cannot be undone.",
      confirmText: "Remove user",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!confirmed) {
      return
    }

    setDeletingId(entry.user_id)
    try {
      const res = await fetch(`/admin/cms/users/${entry.user_id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error("Could not remove user", {
          description: body?.message || `Error ${res.status}`,
        })
        return
      }
      toast.success(`${displayName(entry)} was removed.`)
      await load()
    } catch (e: any) {
      toast.error("Could not remove user", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <div className="flex items-center justify-between">
          <Heading level="h2">CMS Access</Heading>
          <div className="flex items-center gap-x-3">
            <Badge size="small">{rows.length} users</Badge>
            <CreateUserModal onCreated={load} />
          </div>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Assign what each admin user can do in the CMS. A user with{" "}
          <span className="font-medium text-ui-fg-base">no role</span> set has
          full admin access (the default). Only explicit{" "}
          <span className="font-medium text-ui-fg-base">editor</span> or{" "}
          <span className="font-medium text-ui-fg-base">viewer</span>{" "}
          assignments restrict access.
        </Text>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 px-6 py-3">
        {ROLES.map((r) => (
          <div key={r} className="flex items-center gap-x-2">
            <Badge size="2xsmall" color={ROLE_BADGE[r]}>
              {r}
            </Badge>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {ROLE_HINT[r]}
            </Text>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Loading…</Text>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">No admin users found.</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>User</Table.HeaderCell>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Current role</Table.HeaderCell>
              <Table.HeaderCell className="w-[180px]">
                Assign role
              </Table.HeaderCell>
              <Table.HeaderCell className="w-[60px]" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((r) => {
              const isYou = r.user_id === currentUserId
              const isLastAdmin = r.role === "admin" && adminCount <= 1
              return (
                <Table.Row key={r.user_id}>
                  <Table.Cell>
                    <div className="flex items-center gap-x-2">
                      <Text size="small" weight="plus">
                        {displayName(r)}
                      </Text>
                      {isYou && (
                        <Badge size="2xsmall" color="green">
                          You
                        </Badge>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {r.email ?? "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-x-2">
                      <Badge size="2xsmall" color={ROLE_BADGE[r.role]}>
                        {r.role}
                      </Badge>
                      {r.is_default && (
                        <Text size="xsmall" className="text-ui-fg-muted">
                          default
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Select
                      value={r.role}
                      disabled={savingId === r.user_id}
                      onValueChange={(v) =>
                        isCmsRole(v) && changeRole(r, v)
                      }
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {ROLES.map((opt) => {
                          // Block downgrading the last admin from the menu.
                          const blocked =
                            isLastAdmin && r.role === "admin" && opt !== "admin"
                          return (
                            <Select.Item
                              key={opt}
                              value={opt}
                              disabled={blocked}
                            >
                              {opt}
                              {opt === DEFAULT_ROLE ? " (default)" : ""}
                            </Select.Item>
                          )
                        })}
                      </Select.Content>
                    </Select>
                    {isLastAdmin && (
                      <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                        Last admin — cannot downgrade.
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <DropdownMenu>
                      <DropdownMenu.Trigger asChild>
                        <IconButton
                          size="small"
                          variant="transparent"
                          disabled={deletingId === r.user_id}
                        >
                          <EllipsisHorizontal />
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content>
                        <DropdownMenu.Item
                          className="gap-x-2 text-ui-fg-error"
                          disabled={isYou || isLastAdmin}
                          onClick={() => removeUser(r)}
                        >
                          <Trash className="text-ui-fg-error" />
                          Remove user
                        </DropdownMenu.Item>
                        {(isYou || isLastAdmin) && (
                          <div className="px-2 py-1">
                            <Text size="xsmall" className="text-ui-fg-muted">
                              {isYou
                                ? "You can't remove your own account."
                                : "The last admin can't be removed."}
                            </Text>
                          </div>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "CMS Access",
  icon: Key,
})

export default CmsAccessPage
