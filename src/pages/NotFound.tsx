import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { BrandLockup } from '../components/BrandMark'
import { Button } from '../components/ui/primitives'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <BrandLockup />
      <div className="surface max-w-md p-8">
        <Compass className="mx-auto h-8 w-8 text-violet-soft" />
        <h1 className="mt-4 font-display text-xl font-semibold">This page is outside the map</h1>
        <p className="mt-2 text-sm leading-relaxed text-slatey-400">
          The address you followed does not correspond to a research workspace. Return to the overview to pick up
          your investigation.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link to="/app">
            <Button variant="primary">Go to workspace</Button>
          </Link>
          <Link to="/">
            <Button variant="ghost">Landing page</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
