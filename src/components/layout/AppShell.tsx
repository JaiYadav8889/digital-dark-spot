import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpenCheck,
  ChevronLeft,
  CircleUser,
  ClipboardList,
  History,
  LayoutDashboard,
  Library,
  Menu,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { BrandLockup, BrandMark } from '../BrandMark'
import { Badge, Button, IconButton } from '../ui/primitives'
import { Tooltip } from '../ui/overlay'
import { useAuth } from '../../hooks/useAuth'

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/new', label: 'New Research', icon: Plus },
  { to: '/app/history', label: 'Research History', icon: History },
  { to: '/app/evidence', label: 'Evidence Library', icon: Library },
  { to: '/app/tasks', label: 'Verification Tasks', icon: ClipboardList },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
] as const

interface ShellHeader {
  title: string
  subtitle?: string
  badge?: ReactNode
}

interface ShellContextValue {
  setHeader: (header: ShellHeader | null) => void
}

const ShellContext = createContext<ShellContextValue>({ setHeader: () => {} })

export function useShellHeader(header: ShellHeader | null | undefined, deps: unknown[] = []) {
  const { setHeader } = useContext(ShellContext)
  const serialised = JSON.stringify({ title: header?.title, subtitle: header?.subtitle })
  useEffect(() => {
    if (header) setHeader(header)
    return () => setHeader(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialised, ...deps])
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [header, setHeader] = useState<ShellHeader | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const location = useLocation()
  const { email, isAuthenticated, signOut, loading: authLoading } = useAuth()

  useEffect(() => {
    setMobileOpen(false)
    setProfileOpen(false)
  }, [location.pathname])

  const ctx = useMemo(() => ({ setHeader }), [])

  return (
    <ShellContext.Provider value={ctx}>
      <div className="flex min-h-screen bg-ink-950">
        {/* ---------------------------------------------------------- sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-ink-900/95 backdrop-blur transition-[width,transform] duration-300',
            collapsed ? 'lg:w-[76px]' : 'lg:w-[248px]',
            'w-[264px]',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <div className={cn('flex h-[60px] items-center border-b border-white/[0.06] px-3', collapsed && 'lg:justify-center lg:px-0')}>
            <Link to="/" className="flex items-center rounded-lg px-1 py-1 transition-opacity hover:opacity-85">
              <span className="lg:hidden">
                <BrandLockup size={26} />
              </span>
              <span className="hidden lg:block">
                {collapsed ? <BrandMark size={26} /> : <BrandLockup size={26} />}
              </span>
            </Link>
            <IconButton
              label="Close navigation"
              className="ml-auto lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </IconButton>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-4">
            {!collapsed && <p className="label px-2.5 pb-2">Workspace</p>}
            {NAV.map((item) => {
              const Icon = item.icon
              const link = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-all',
                      collapsed && 'lg:justify-center lg:px-0',
                      isActive
                        ? 'bg-violet-brand/12 text-white'
                        : 'text-slatey-400 hover:bg-white/[0.05] hover:text-slatey-200',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-violet-brand" />
                      )}
                      <Icon
                        className={cn(
                          'h-[17px] w-[17px] shrink-0 transition-colors',
                          isActive ? 'text-violet-soft' : 'text-slatey-400 group-hover:text-slatey-300',
                        )}
                      />
                      <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
                    </>
                  )}
                </NavLink>
              )
              return collapsed ? (
                <Tooltip key={item.to} content={item.label} side="right">
                  {link}
                </Tooltip>
              ) : (
                link
              )
            })}
          </nav>

          <div className="space-y-2 border-t border-white/[0.06] p-2.5">
            {!collapsed && (
              <div className="rounded-lg border border-white/[0.07] bg-gradient-to-br from-violet-brand/[0.09] to-transparent p-3">
                <div className="flex items-center gap-2 text-[11px] font-medium text-violet-soft">
                  <Sparkles className="h-3.5 w-3.5" />
                  Evidence-first
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slatey-400">
                  Findings describe what the reviewed sources establish — never what is objectively true.
                </p>
              </div>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={cn(
                'hidden w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-slatey-400 transition-colors hover:bg-white/[0.05] hover:text-slatey-200 lg:flex',
                collapsed && 'justify-center px-0',
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
              {!collapsed && 'Collapse'}
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}

        {/* ---------------------------------------------------------- main */}
        <div className={cn('flex min-h-screen w-full flex-col transition-[padding] duration-300', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]')}>
          <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-white/[0.06] bg-ink-950/85 px-4 backdrop-blur-xl sm:px-6">
            <IconButton label="Open navigation" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </IconButton>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-[14.5px] font-semibold text-white">
                  {header?.title ?? 'Workspace'}
                </h1>
                {header?.badge}
              </div>
              {header?.subtitle ? (
                <p className="truncate text-[11.5px] text-slatey-400">{header.subtitle}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              <Link to="/app/new" className="hidden sm:block">
                <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                  New research
                </Button>
              </Link>

              <div className="relative">
                <button
                  onClick={() => setProfileOpen((p) => !p)}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-white/20"
                  aria-label="Account menu"
                  aria-expanded={profileOpen}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-brand/20 text-[11px] font-semibold text-violet-soft">
                    {email ? email.slice(0, 2).toUpperCase() : <CircleUser className="h-3.5 w-3.5" />}
                  </span>
                  <span className="hidden max-w-[9rem] truncate text-[12px] text-slatey-300 sm:block">
                    {authLoading ? 'Checking…' : email ?? 'Guest'}
                  </span>
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} aria-hidden />
                    <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-64 overflow-hidden rounded-xl border border-white/10 bg-ink-850 shadow-lift animate-fade-up">
                      <div className="border-b border-white/[0.07] px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slatey-400">
                          {isAuthenticated ? 'Signed in' : 'Guest workspace'}
                        </p>
                        <p className="mt-1 truncate text-[13px] text-white">{email ?? 'Not signed in'}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slatey-400">
                          {isAuthenticated
                            ? 'Your sessions are private to this account.'
                            : 'Sessions are stored in the shared demo workspace.'}
                        </p>
                      </div>
                      <div className="p-1.5">
                        <Link
                          to="/app/settings"
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slatey-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                          <SettingsIcon className="h-4 w-4" /> Settings
                        </Link>
                        <Link
                          to="/app/tasks"
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slatey-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                          <BookOpenCheck className="h-4 w-4" /> Verification tasks
                        </Link>
                        {isAuthenticated && (
                          <button
                            onClick={() => void signOut()}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-coral-soft transition-colors hover:bg-coral-soft/10"
                          >
                            Sign out
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  )
}

export function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'emerald' | 'amber' | 'coral' | 'ice' | 'slate' | 'violet'; label: string }> = {
    draft: { tone: 'slate', label: 'Draft' },
    collecting: { tone: 'ice', label: 'Collecting sources' },
    analysing: { tone: 'violet', label: 'Analysing' },
    ready: { tone: 'emerald', label: 'Analysis ready' },
    failed: { tone: 'coral', label: 'Needs attention' },
  }
  const meta = map[status] ?? { tone: 'slate' as const, label: status }
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  )
}
