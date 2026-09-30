import { LoginScreen } from './auth/LoginScreen'
import { useSession } from './auth/useSession'
import { OnboardingScreen } from './onboarding/OnboardingScreen'
import { useProfile } from './profile/useProfile'
import { AppShell } from './shell/AppShell'
import { Splash } from './ui/Splash'

export function App() {
  const session = useSession()
  if (session.status === 'loading') return <Splash />
  if (session.status === 'signedOut') return <LoginScreen />
  const userId = session.session.user.id
  return <SignedInApp key={userId} userId={userId} />
}

function SignedInApp({ userId }: { userId: string }) {
  const { profile, failed, reload } = useProfile(userId)
  if (failed && !profile) return <Splash failed onRetry={reload} />
  if (!profile) return <Splash />
  if (!profile.terms_accepted_at) return <OnboardingScreen onDone={reload} />
  return <AppShell profile={profile} onProfileChange={reload} />
}
